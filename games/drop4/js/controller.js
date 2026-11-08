(function (G) {
  'use strict';
  var E = G.Engine, R = G.Reactions, Reaction = Ailand.core.Reaction;

  var CPU_MIN_WAIT_MS = 600;
  var UNDO_MAX = 3;
  var SAVE_KEY = 'save.v1';
  var SETTINGS_KEY = 'settings.v1';

  // Reaction event kind -> speech situation, for the mover's side and for the others.
  var SITUATION = {
    reach: { mover: 'reach', other: 'reached' },
    block: { mover: 'block', other: 'blocked' },
    double: { mover: 'double', other: 'doubled' },
    endgame: { mover: 'endgame', other: 'endgame' },
    win: { mover: 'win', other: 'win' },
    lose: { mover: 'lose', other: 'lose' },
    draw: { mover: 'draw', other: 'draw' }
  };

  function sameMove(a, b) { return a.type === b.type && a.col === b.col && a.seat === b.seat; }

  function validSettings(s) {
    if (!s || typeof s !== 'object' || !Array.isArray(s.seats) || s.seats.length !== s.players) { return false; }
    return s.seats.every(function (x, i) { return x && x.seat === i + 1 && typeof x.charId === 'string'; });
  }

  function engineSettings(s) {
    return { players: s.players, teams: s.teams, popOut: s.popOut, blocks: s.blocks, firstSeat: s.firstSeat };
  }

  // Replays history from a fresh state. Throws on any illegal move. endgameFired is recomputed the same way as live play.
  function replay(settings, history) {
    var state = E.create(engineSettings(settings));
    var ctx = { endgameFired: false };
    history.forEach(function (m) {
      var after = E.apply(state, m);
      R.detect(state, m, after, ctx).forEach(function (e) { if (e.kind === 'endgame') { ctx.endgameFired = true; } });
      state = after;
    });
    return { state: state, endgameFired: ctx.endgameFired };
  }

  function create(deps) {
    var bus = deps.bus, storage = deps.storage;
    var settings = null, state = null, history = [], undoLeft = UNDO_MAX, endgameFired = false;
    var thinking = false, gen = 0;

    function isHuman(seat) {
      return settings.seats.some(function (x) { return x.seat === seat && x.human; });
    }
    function humans() {
      return settings.seats.filter(function (x) { return x.human; }).map(function (x) { return x.seat; });
    }
    function charOf(seat) {
      return settings.seats.filter(function (x) { return x.seat === seat; })[0].charId;
    }

    function save() {
      try { storage.set(SAVE_KEY, { version: 1, settings: settings, history: history, undoLeft: undoLeft }); } catch (e) { /* play on */ }
    }

    function linesFor(picked) {
      var out = {};
      if (!picked) { return out; }
      var kind = picked.event.kind, map = SITUATION[kind];
      if (!map) { return out; }
      var terminal = { win: 1, lose: 1, draw: 1 };
      picked.events.forEach(function (e) {
        if (terminal[kind] ? !terminal[e.kind] : e.kind !== kind) { return; }
        var sit = e.seat === e.by ? SITUATION[e.kind].mover : SITUATION[e.kind].other;
        out[e.seat] = deps.linePicker.pick(charOf(e.seat), sit);
      });
      return out;
    }

    function commit(move) {
      var before = state;
      var after = E.apply(before, move);
      var ctx = { endgameFired: endgameFired };
      var events = R.detect(before, move, after, ctx);
      endgameFired = ctx.endgameFired || events.some(function (e) { return e.kind === 'endgame'; });
      state = after;
      history.push({ type: move.type, col: move.col, seat: move.seat });

      var picked = Reaction.pick(events, {
        humans: humans(), mover: move.seat, priority: R.PRIORITY,
        teamOf: function (seat) { return E.teamOf(before, seat); }
      });
      var lines = linesFor(picked && { event: picked.event, events: events });

      if (after.result) { storage.remove(SAVE_KEY); } else { save(); }
      bus.emit('moved', { move: move, before: before, after: after });
      bus.emit('reaction', { events: events, picked: picked, lines: lines });
      if (after.result) {
        bus.emit('gameover', { result: after.result, perspective: picked ? picked.perspective : 'draw' });
      } else {
        nextTurn();
      }
    }

    function nextTurn() {
      var seat = E.currentSeat(state);
      var human = isHuman(seat);
      bus.emit('turn', { seat: seat, human: human });
      if (!human) { think(seat); }
    }

    function think(seat) {
      var myGen = gen, t0 = deps.now();
      thinking = true;
      bus.emit('thinking', { seat: seat, on: true });
      var snapshot = state;
      var p;
      try {
        p = deps.ai.search(snapshot, settings.level, { rng: deps.rng, now: deps.now, scheduler: deps.scheduler });
      } catch (e) {
        p = Promise.reject(e);
      }
      p.catch(function () {
        // Fall back to a random legal move so the game never stalls.
        var ms = E.legalMoves(snapshot);
        return ms[Math.floor(deps.rng() * ms.length)];
      }).then(function (move) {
        if (myGen !== gen) { return; }
        var wait = Math.max(0, CPU_MIN_WAIT_MS - (deps.now() - t0));
        deps.scheduler(function () {
          if (myGen !== gen) { return; }
          thinking = false;
          bus.emit('thinking', { seat: seat, on: false });
          commit(move);
        }, wait);
      });
    }

    function begin(newSettings, newHistory, newUndo, replayed) {
      gen++;
      thinking = false;
      settings = newSettings;
      state = replayed.state;
      endgameFired = replayed.endgameFired;
      history = newHistory;
      undoLeft = newUndo;
      bus.emit('started', { state: state });
      nextTurn();
    }

    function humanCount() { return humans().length; }

    return {
      start: function (s) {
        storage.remove(SAVE_KEY);
        storage.set(SETTINGS_KEY, s);
        begin(s, [], UNDO_MAX, replay(s, []));
      },
      resume: function () {
        var data = storage.get(SAVE_KEY, null);
        if (data === null && !storage.has(SAVE_KEY)) { return false; }
        try {
          if (!data || data.version !== 1 || !validSettings(data.settings) || !Array.isArray(data.history) ||
              typeof data.undoLeft !== 'number' || data.undoLeft % 1 !== 0 || data.undoLeft < 0 || data.undoLeft > UNDO_MAX) {
            throw new Error('invalid save');
          }
          var r = replay(data.settings, data.history);
          if (r.state.result) { throw new Error('finished game'); }
          begin(data.settings, data.history.slice(), data.undoLeft, r);
          return true;
        } catch (e) {
          storage.remove(SAVE_KEY);
          return false;
        }
      },
      hasSave: function () { return storage.has(SAVE_KEY); },
      loadSettings: function () { return storage.get(SETTINGS_KEY, null); },
      input: function (move) {
        if (!state || thinking || state.result || !move) { return false; }
        var seat = E.currentSeat(state);
        if (!isHuman(seat) || move.seat !== seat) { return false; }
        if (!E.legalMoves(state).some(function (m) { return sameMove(m, move); })) { return false; }
        commit(move);
        return true;
      },
      undo: function () {
        if (!state || thinking || state.result || undoLeft <= 0 || humanCount() !== 1) { return false; }
        var idx = -1;
        for (var i = history.length - 1; i >= 0 && idx < 0; i--) { if (isHuman(history[i].seat)) { idx = i; } }
        if (idx < 0) { return false; }
        var next = history.slice(0, idx);
        var r = replay(settings, next);
        gen++;
        history = next;
        state = r.state;
        endgameFired = r.endgameFired;
        undoLeft--;
        save();
        bus.emit('undo', { state: state });
        nextTurn();
        return true;
      },
      undoLeft: function () { return undoLeft; },
      state: function () { return state; },
      settings: function () { return settings; },
      isBusy: function () { return thinking; }
    };
  }

  G.Controller = {
    create: create,
    CPU_MIN_WAIT_MS: CPU_MIN_WAIT_MS, UNDO_MAX: UNDO_MAX, SAVE_KEY: SAVE_KEY, SETTINGS_KEY: SETTINGS_KEY
  };
})(Ailand.games.drop4);
