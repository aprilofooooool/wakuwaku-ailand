(function (G) {
  'use strict';
  var E = G.Engine, R = G.Reactions, K = G.Constants, Reaction = Ailand.core.Reaction;

  var CPU_MIN_WAIT_MS = 600;
  var UNDO_MAX = 3;
  var SAVE_KEY = 'save.v1';
  var SETTINGS_KEY = 'settings.v1';
  var FIRSTS = ['me', 'them', 'random'];
  var TERMINAL = { win: 1, lose: 1, draw: 1 };

  // Reaction event kind -> speech situation, for the mover's side and for the others (missing = no line).
  var SITUATION = {
    block: { mover: 'block', other: 'blocked' },
    big: { mover: 'big' },
    rest: { mover: 'rest', other: 'rest' },
    endgame: { mover: 'endgame', other: 'endgame' },
    win: { mover: 'win', other: 'win' },
    lose: { mover: 'lose', other: 'lose' },
    draw: { mover: 'draw', other: 'draw' }
  };

  function defaultSettings() {
    return {
      players: 2, level: 'weak', first: 'random',
      seats: [{ seat: 1, charId: 'mametchi', human: true }, { seat: 2, charId: 'kuchipatchi', human: false }]
    };
  }

  function validSettings(s) {
    if (!s || typeof s !== 'object' || !Array.isArray(s.seats) || s.seats.length !== s.players) { return false; }
    if (s.players !== 2 && s.players !== 3 && s.players !== 4) { return false; }
    if (!Object.prototype.hasOwnProperty.call(K.AI, s.level) || FIRSTS.indexOf(s.first) < 0) { return false; }
    var used = {};
    return s.seats.every(function (x, i) {
      if (!x || x.seat !== i + 1 || typeof x.charId !== 'string' || typeof x.human !== 'boolean') { return false; }
      if (used[x.charId] || !Ailand.core.Characters.get(x.charId)) { return false; }
      used[x.charId] = true;
      return true;
    });
  }

  function validSaved(s) {
    return validSettings(s) && s.firstSeat % 1 === 0 && s.firstSeat >= 1 && s.firstSeat <= s.players;
  }

  function cleanMove(m) {
    return { seat: m.seat, pieceId: m.pieceId, rot: m.rot, flip: m.flip, x: m.x, y: m.y };
  }

  // Replays history from a fresh state. Throws on any move the rules refuse. endgameFired is recomputed as in live play.
  function replay(settings, history) {
    var state = E.create({ players: settings.players, firstSeat: settings.firstSeat });
    var ctx = { endgameFired: false };
    history.forEach(function (m) {
      if (!m || m.seat !== E.currentSeat(state) || !E.check(state, m).ok) { throw new Error('illegal history'); }
      var after = E.apply(state, m);
      R.detect(state, m, after, ctx);
      state = after;
    });
    return { state: state, endgameFired: ctx.endgameFired };
  }

  function create(deps) {
    var bus = deps.bus, storage = deps.storage, ai = deps.ai || G.Ai;
    var rng = deps.rng || Math.random, now = deps.now || Date.now, later = deps.setTimeout || setTimeout;
    var settings = null, state = null, history = [], undoLeft = UNDO_MAX, endgameFired = false;
    var thinking = false, gen = 0;
    var variety = Ailand.core.EmotionVariety.create(rng);
    var linePicker = deps.linePicker ||
      Ailand.core.LinePicker.create({ gameLines: G.Lines, commonLines: Ailand.core.CommonLines, rng: rng });

    function isHuman(seat) {
      return settings.seats.some(function (x) { return x.seat === seat && x.human; });
    }
    function humans() {
      return settings.seats.filter(function (x) { return x.human; }).map(function (x) { return x.seat; });
    }
    function charOf(seat) {
      return settings.seats.filter(function (x) { return x.seat === seat; })[0].charId;
    }

    function settingsRecord() { return storage.get(SETTINGS_KEY, null); }
    function seenHowTo() {
      var rec = settingsRecord();
      return !!rec && rec.seenHowTo === true;
    }
    function writeSettings(s) {
      storage.set(SETTINGS_KEY, { players: s.players, seats: s.seats, level: s.level, first: s.first, seenHowTo: seenHowTo() });
    }

    function save() {
      storage.set(SAVE_KEY, { settings: settings, history: history, undoLeft: undoLeft });
    }

    function linesFor(top, events) {
      var out = {};
      if (!top || !SITUATION[top.kind]) { return out; }
      var kind = top.kind;
      events.forEach(function (e) {
        if (TERMINAL[kind] ? !TERMINAL[e.kind] : e.kind !== kind) { return; }
        var sit = SITUATION[e.kind][e.seat === e.by ? 'mover' : 'other'];
        if (sit) { out[e.seat] = linePicker.pick(charOf(e.seat), sit); }
      });
      return out;
    }

    // The one full-screen effect for this move, seen from the human side (spec 5.1). null = none.
    function screenOf(picked, mover) {
      if (!picked) { return null; }
      var kind = picked.event.kind;
      if (TERMINAL[kind]) { return picked.perspective; }
      if (kind === 'block') { return isHuman(mover) ? 'block' : 'mark'; }
      if (kind === 'big') { return isHuman(mover) ? 'big' : null; }
      if (kind === 'rest' || kind === 'endgame') { return kind; }
      return null;
    }

    function commit(move) {
      var before = state;
      var after = E.apply(before, move);
      var ctx = { endgameFired: endgameFired };
      var events = R.vary(R.detect(before, move, after, ctx), variety);
      endgameFired = ctx.endgameFired;
      state = after;
      history.push(cleanMove(move));

      var picked = Reaction.pick(events, {
        humans: humans(), mover: move.seat, priority: R.PRIORITY,
        teamOf: function () { return null; }
      });
      var lines = linesFor(picked && picked.event, events);
      var screen = screenOf(picked, move.seat);

      var over = E.isOver(after);
      if (over) { storage.remove(SAVE_KEY); } else { save(); }
      bus.emit('moved', { move: move, before: before, state: after });
      bus.emit('reaction', { events: events, picked: picked, lines: lines, screen: screen });
      if (over) {
        bus.emit('gameover', { result: E.result(after) });
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

    function legal(s, move) {
      try { return E.check(s, move).ok; } catch (e) { return false; }
    }

    function think(seat) {
      var myGen = gen, t0 = now();
      thinking = true;
      bus.emit('thinking', { seat: seat, on: true, line: linePicker.pick(charOf(seat), 'thinking') });
      var snapshot = state, move = null;
      try { move = ai.chooseMove(snapshot, settings.level, { rng: rng, now: now }); } catch (e) { move = null; }
      // Fall back to a random legal move so the game never stalls (AI error or illegal answer).
      if (!move || move.seat !== seat || !legal(snapshot, move)) {
        var ms = E.legalMoves(snapshot, seat);
        move = ms[Math.floor(rng() * ms.length)];
      }
      later(function () {
        if (myGen !== gen) { return; }
        thinking = false;
        bus.emit('thinking', { seat: seat, on: false });
        commit(move);
      }, Math.max(0, CPU_MIN_WAIT_MS - (now() - t0)));
    }

    function begin(newSettings, newHistory, newUndo, replayed) {
      gen++;
      thinking = false;
      variety.reset();
      settings = newSettings;
      state = replayed.state;
      endgameFired = replayed.endgameFired;
      history = newHistory;
      undoLeft = newUndo;
      bus.emit('started', { state: state });
      nextTurn();
    }

    function resolveFirstSeat(s) {
      var hs = s.seats.filter(function (x) { return x.human; }).map(function (x) { return x.seat; });
      var me = hs.length ? hs[0] : 1;
      if (s.players === 2 && s.first === 'me') { return me; }
      if (s.players === 2 && s.first === 'them') { return me === 1 ? 2 : 1; }
      return Math.floor(rng() * s.players) + 1;
    }

    // Index of the last human move that undo would take back, or -1 when undo is not allowed now.
    function lastHumanIndex() {
      if (!state || thinking || E.isOver(state) || undoLeft <= 0 || humans().length !== 1) { return -1; }
      for (var i = history.length - 1; i >= 0; i--) { if (isHuman(history[i].seat)) { return i; } }
      return -1;
    }

    return {
      loadSettings: function () {
        var rec = settingsRecord();
        if (!validSettings(rec)) { rec = defaultSettings(); }
        return { players: rec.players, seats: rec.seats, level: rec.level, first: rec.first };
      },
      saveSettings: function (s) { writeSettings(s); },
      seenHowTo: seenHowTo,
      markHowToSeen: function () {
        var rec = settingsRecord();
        if (!rec || typeof rec !== 'object') { rec = {}; }
        rec.seenHowTo = true;
        storage.set(SETTINGS_KEY, rec);
      },
      hasSave: function () { return storage.has(SAVE_KEY); },
      start: function (s) {
        if (!validSettings(s)) { return false; }
        var resolved = { players: s.players, seats: s.seats, level: s.level, first: s.first, firstSeat: resolveFirstSeat(s) };
        storage.remove(SAVE_KEY);
        writeSettings(resolved);
        begin(resolved, [], UNDO_MAX, replay(resolved, []));
        save();
        return true;
      },
      resume: function () {
        if (!storage.has(SAVE_KEY)) { return false; }
        var data = storage.get(SAVE_KEY, null);
        try {
          if (!data || !validSaved(data.settings) || !Array.isArray(data.history) ||
              typeof data.undoLeft !== 'number' || data.undoLeft % 1 !== 0 || data.undoLeft < 0 || data.undoLeft > UNDO_MAX) {
            throw new Error('invalid save');
          }
          var r = replay(data.settings, data.history);
          if (E.isOver(r.state)) { throw new Error('finished game'); }
          begin(data.settings, data.history.map(cleanMove), data.undoLeft, r);
          return true;
        } catch (e) {
          storage.remove(SAVE_KEY);
          return false;
        }
      },
      input: function (move) {
        if (!state || thinking || E.isOver(state) || !move) { return { ok: false, reason: 'busy' }; }
        var seat = E.currentSeat(state);
        if (!isHuman(seat) || move.seat !== seat) { return { ok: false, reason: 'turn' }; }
        var c;
        try { c = E.check(state, move); } catch (e) { return { ok: false, reason: 'bad' }; }
        if (!c.ok) { return { ok: false, reason: c.reason }; }
        commit(move);
        return { ok: true };
      },
      // Leaves the game (e.g. to the settings screen): drops any pending CPU move. The save stays as is.
      stop: function () {
        gen++;
        if (thinking) {
          thinking = false;
          bus.emit('thinking', { seat: state ? E.currentSeat(state) : null, on: false });
        }
      },
      canUndo: function () { return lastHumanIndex() >= 0; },
      undo: function () {
        var idx = lastHumanIndex();
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
      settings: function () { return settings ? Object.assign({}, settings) : null; },
      isBusy: function () { return thinking; }
    };
  }

  G.Controller = {
    create: create, defaultSettings: defaultSettings,
    CPU_MIN_WAIT_MS: CPU_MIN_WAIT_MS, UNDO_MAX: UNDO_MAX, SAVE_KEY: SAVE_KEY, SETTINGS_KEY: SETTINGS_KEY
  };
})(Ailand.games.territory);
