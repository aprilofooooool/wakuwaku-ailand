(function (G) {
  'use strict';
  var K = G.Constants, E = G.Engine;
  var SETTINGS_KEY = 'settings.v1';

  function defaults() { return { char: 'mametchi', difficulty: 'easy', seenHowTo: false }; }

  function validChar(id) { return typeof id === 'string' && !!Ailand.core.Characters.get(id); }
  function validDifficulty(d) { return typeof d === 'string' && Object.prototype.hasOwnProperty.call(K.DIFFICULTY, d); }

  function create(deps) {
    var bus = deps.bus, storage = deps.storage;
    var game = null, settings = null;
    var curPhase = 'idle', pausedBy = null;
    var cd = 0, counted = 0, dangerOn = false, result = null;
    var held = {}, seq = 0;   // held[action] = { t, next, order }

    function load() {
      var s = storage.get(SETTINGS_KEY, null);
      var d = defaults();
      if (!s || typeof s !== 'object') { return d; }
      return {
        char: validChar(s.char) ? s.char : d.char,
        difficulty: validDifficulty(s.difficulty) ? s.difficulty : d.difficulty,
        seenHowTo: s.seenHowTo === true
      };
    }

    function save(s) { storage.set(SETTINGS_KEY, { char: s.char, difficulty: s.difficulty, seenHowTo: s.seenHowTo }); }

    function getResult() {
      if (!game) { return { cleared: false, collected: 0, goal: 0, jar: 0, char: settings ? settings.char : defaults().char }; }
      return { cleared: game.state === 'goal', collected: game.collected, goal: game.goal, jar: game.jar, char: game.selfId };
    }

    // Emits engine events, then danger changes, then ends the round on goal or over.
    function handle(events) {
      var ended = false;
      events.forEach(function (e) {
        bus.emit(e.type, e);
        if (e.type === 'goal' || e.type === 'over') { ended = true; }
      });
      var d = E.dangerous(game);
      if (d !== dangerOn) { dangerOn = d; bus.emit('danger', { on: d }); }
      if (ended) {
        curPhase = 'result';
        held = {};
        result = getResult();
        bus.emit('result', result);
      }
    }

    function doMove(action) {
      var ok = false;
      if (action === 'left') { ok = E.move(game, -1); }
      else if (action === 'right') { ok = E.move(game, 1); }
      else if (action === 'rotate') { ok = E.rotate(game); }
      else if (action === 'soft') { ok = E.softDrop(game); }
      if (ok) { bus.emit('moved', { action: action }); }
      return ok;
    }

    function activeHoriz() {
      var best = null;
      ['left', 'right'].forEach(function (a) {
        if (held[a] && (best === null || held[a].order > held[best].order)) { best = a; }
      });
      return best;
    }

    function repeats(ms) {
      var h = activeHoriz();
      var list = h ? [h] : [];
      if (held.soft) { list.push('soft'); }
      list.forEach(function (a) {
        var s = held[a];
        s.t += ms;
        while (s.t >= s.next) {
          s.next += a === 'soft' ? K.SOFT_MS : K.REPEAT_MS;
          doMove(a);
        }
      });
    }

    function advance(ms) {
      if (pausedBy !== null) { return; }
      if (curPhase === 'countdown') {
        cd += ms;
        while (counted < 3 && cd >= counted * 1000) {
          bus.emit('count', { n: 3 - counted });
          counted++;
        }
        if (cd >= K.COUNTDOWN_MS) {
          curPhase = 'playing';
          bus.emit('go', {});
          bus.emit('spawn', { type: 'spawn', shape: game.piece.shape, charId: game.piece.charId });
        }
        return;
      }
      if (curPhase !== 'playing') { return; }
      repeats(ms);
      handle(E.step(game, ms));
    }

    return {
      loadSettings: load,
      needsHowTo: function () { return !load().seenHowTo; },
      markHowToSeen: function () {
        var s = load();
        s.seenHowTo = true;
        save(s);
      },
      start: function (s) {
        var cur = load();
        settings = {
          char: validChar(s && s.char) ? s.char : cur.char,
          difficulty: validDifficulty(s && s.difficulty) ? s.difficulty : cur.difficulty,
          seenHowTo: s && typeof s.seenHowTo === 'boolean' ? s.seenHowTo : cur.seenHowTo
        };
        save(settings);
        game = E.create({ difficulty: settings.difficulty, selfId: settings.char, seed: deps.seed() });
        held = {}; result = null; pausedBy = null; dangerOn = false;
        cd = 0; counted = 0;
        curPhase = 'countdown';
      },
      advance: advance,
      press: function (action) {
        if (curPhase !== 'playing' || pausedBy !== null) { return false; }
        if (action === 'hard') {
          var ev = E.hardDrop(game);
          handle(ev);
          return true;
        }
        doMove(action);
        if (action === 'left' || action === 'right' || action === 'soft') {
          if (!held[action]) {
            held[action] = { t: 0, next: action === 'soft' ? K.SOFT_MS : K.REPEAT_DELAY_MS, order: ++seq };
          }
        }
        return true;
      },
      release: function (action) { delete held[action]; },
      pause: function (reason) { pausedBy = reason; held = {}; },
      resume: function () { pausedBy = null; },
      isPaused: function () { return pausedBy !== null; },
      phase: function () { return curPhase; },
      game: function () { return game; },
      getResult: getResult,
      quit: function () { curPhase = 'idle'; pausedBy = null; held = {}; }
    };
  }

  G.Controller = { create: create, SETTINGS_KEY: SETTINGS_KEY };
})(Ailand.games.blocks);
