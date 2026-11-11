(function (G) {
  'use strict';
  var K = G.Constants, E = G.Engine;
  var SETTINGS_KEY = 'settings.v1';
  var BEST_KEY = 'best.v1';

  function defaults() { return { players: 1, chars: ['mametchi', 'kuchipatchi'], difficulty: 'easy' }; }

  function validSettings(s) {
    if (!s || typeof s !== 'object') { return false; }
    if (s.players !== 1 && s.players !== 2) { return false; }
    if (!Array.isArray(s.chars) || s.chars.length !== 2 || s.chars[0] === s.chars[1]) { return false; }
    if (!s.chars.every(function (id) { return typeof id === 'string' && !!Ailand.core.Characters.get(id); })) { return false; }
    return Object.prototype.hasOwnProperty.call(K.DIFFICULTY, s.difficulty);
  }

  function withSide(side, e) {
    var out = { side: side };
    Object.keys(e).forEach(function (k) { out[k] = e[k]; });
    return out;
  }

  function create(deps) {
    var bus = deps.bus, storage = deps.storage;
    var settings = null, gameMode = null, schedule = null;
    var sides = [], players = [];   // players[i] = player number of sides[i]
    var curPhase = 'idle', pausedBy = null;
    var cd = 0, counted = 0, elapsed = 0, finalFired = false, turn = 0, result = null;

    function bestOf(difficulty) {
      var b = storage.get(BEST_KEY, null);
      var v = b && typeof b === 'object' ? b[difficulty] : 0;
      return typeof v === 'number' && v > 0 ? v : 0;
    }

    function makeSide(player) {
      var self = settings.chars[player];
      return E.createSide({ schedule: schedule, selfId: self, ngIds: E.ngIdsFor(self) });
    }

    function beginCountdown() {
      cd = 0; counted = 0; elapsed = 0; finalFired = false;
      curPhase = 'countdown';
    }

    function firstPlayer() { return gameMode === 'turns' ? turn : 0; }

    function computeResult(persist) {
      var scores = sides.map(function (s) { return s.score; });
      if (gameMode === 'turns') { scores = turnScores.slice(); }
      var r = { mode: gameMode, scores: scores, winner: null, draw: false, newRecord: false, best: bestOf(settings.difficulty) };
      if (gameMode === 'solo') {
        r.newRecord = scores[0] > 0 && scores[0] > r.best;
        if (r.newRecord) {
          r.best = scores[0];
          if (persist) {
            var b = storage.get(BEST_KEY, null);
            b = b && typeof b === 'object' ? b : {};
            b[settings.difficulty] = r.best;
            storage.set(BEST_KEY, b);
          }
        }
      } else if (scores[0] === scores[1]) {
        r.draw = true;
      } else {
        r.winner = scores[0] > scores[1] ? 0 : 1;
      }
      return r;
    }
    var turnScores = [];

    function finishPlay() {
      if (gameMode === 'turns' && turn === 0) {
        turnScores[0] = sides[0].score;
        curPhase = 'handoff';
        bus.emit('turnEnd', { player: 0, score: turnScores[0] });
        return;
      }
      if (gameMode === 'turns') { turnScores[1] = sides[0].score; }
      curPhase = 'result';
      result = computeResult(true);
      bus.emit('result', result);
    }

    function advance(ms) {
      if (pausedBy !== null) { return; }
      var i;
      if (curPhase === 'countdown') {
        cd += ms;
        while (counted < 3 && cd >= counted * 1000) {
          bus.emit('count', { n: 3 - counted });
          counted++;
        }
        if (cd >= K.COUNTDOWN_MS) {
          curPhase = 'playing';
          elapsed = 0;   // leftover ms is discarded
          bus.emit('go', { player: firstPlayer() });
        }
        return;
      }
      if (curPhase !== 'playing') { return; }
      elapsed += ms;
      if (!finalFired && elapsed >= K.DURATION_MS - K.FINAL_MS) {
        finalFired = true;
        bus.emit('final10', {});
      }
      sides.forEach(function (s, idx) {
        E.step(s, elapsed).forEach(function (e) { bus.emit(e.type, withSide(players[idx], e)); });
      });
      if (sides.every(function (s) { return s.ended; })) { finishPlay(); }
    }

    return {
      loadSettings: function () {
        var s = storage.get(SETTINGS_KEY, null);
        return validSettings(s) ? { players: s.players, chars: s.chars.slice(), difficulty: s.difficulty } : defaults();
      },
      bestOf: bestOf,
      start: function (s, mode) {
        settings = validSettings(s) ? s : defaults();
        storage.set(SETTINGS_KEY, { players: settings.players, chars: settings.chars.slice(), difficulty: settings.difficulty });
        gameMode = mode;
        schedule = E.buildSchedule(settings.difficulty, deps.seed());
        turn = 0; turnScores = []; result = null; pausedBy = null;
        if (mode === 'together') { sides = [makeSide(0), makeSide(1)]; players = [0, 1]; }
        else { sides = [makeSide(0)]; players = [0]; }
        beginCountdown();
      },
      advance: advance,
      press: function (side, hole) {
        if (curPhase !== 'playing' || pausedBy !== null) { return null; }
        var idx = gameMode === 'together' ? side : 0;
        var s = sides[idx];
        if (!s) { return null; }
        var hit = E.press(s, hole, elapsed);
        if (hit) { bus.emit('hit', withSide(players[idx], hit)); }
        return hit;
      },
      nextTurn: function () {
        if (curPhase !== 'handoff') { return; }
        turn = 1;
        sides = [makeSide(1)]; players = [1];
        beginCountdown();
      },
      pause: function (reason) { pausedBy = reason; },
      resume: function () { pausedBy = null; },
      isPaused: function () { return pausedBy !== null; },
      phase: function () { return curPhase; },
      mode: function () { return gameMode; },
      getResult: function () { return curPhase === 'result' && result ? result : computeResult(false); },
      quit: function () { curPhase = 'idle'; pausedBy = null; }
    };
  }

  G.Controller = { create: create, SETTINGS_KEY: SETTINGS_KEY, BEST_KEY: BEST_KEY };
})(Ailand.games.whack);
