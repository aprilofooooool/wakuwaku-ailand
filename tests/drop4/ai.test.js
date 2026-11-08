(function (A) {
  'use strict';
  var describe = A.Test.describe, it = A.Test.it, expect = A.Test.expect;
  var E = A.games.drop4.Engine;
  var Ai = A.games.drop4.Ai;
  var Rng = A.core.Rng;
  var AI = A.games.drop4.Constants.AI;

  // Runs fn with one AI parameter temporarily replaced.
  function withParam(level, key, value, fn) {
    var had = Object.prototype.hasOwnProperty.call(AI[level], key), old = AI[level][key];
    AI[level][key] = value;
    try { return fn(); } finally { if (had) { AI[level][key] = old; } else { delete AI[level][key]; } }
  }
  // Positions where the next opponent has exactly one immediate win and the mover has none.
  function threatPositions(count, seed) {
    var rng = Rng.mulberry32(seed), out = [], guard = 0;
    while (out.length < count && guard < 50000) {
      guard++;
      var s = randomPosition({}, 6 + Math.floor(rng() * 20), rng);
      if (s.result || E.immediateWins(s, E.currentSeat(s)).length > 0) { continue; }
      var t = E.immediateWins(s, 3 - E.currentSeat(s));
      if (t.length === 1) { out.push({ state: s, col: t[0] }); }
    }
    return out;
  }

  function mk(o) {
    var s = { players: 2, teams: false, popOut: false, blocks: false, firstSeat: 1 };
    for (var k in (o || {})) { s[k] = o[k]; }
    return E.create(s);
  }
  // stacks maps column -> array of seats bottom-up. turnIndex picks the mover.
  function setup(state, stacks, turnIndex) {
    for (var c in stacks) {
      stacks[c].forEach(function (v, r) { state.cells[Number(c) * state.rows + r] = v; });
    }
    state.turnIndex = turnIndex || 0;
    return state;
  }
  // Fake clock: every call advances by `step` ms.
  function clock(step) {
    var t = 0;
    return function () { t += step; return t; };
  }
  function opts(seed, step) { return { rng: Rng.mulberry32(seed), now: clock(step || 1) }; }
  function isLegal(state, m) {
    return E.legalMoves(state).some(function (x) { return x.type === m.type && x.col === m.col && x.seat === m.seat; });
  }
  // Random position reached by up to `plies` random legal moves (stops before a finished game).
  function randomPosition(settings, plies, rng) {
    var s = mk(settings);
    for (var i = 0; i < plies; i++) {
      var ms = E.legalMoves(s);
      var n = E.apply(s, ms[Math.floor(rng() * ms.length)]);
      if (n.result) { break; }
      s = n;
    }
    return s;
  }
  var VARIANTS = [
    {}, { popOut: true }, { blocks: true }, { popOut: true, blocks: true },
    { players: 3 }, { players: 3, popOut: true, blocks: true },
    { players: 4 }, { players: 4, teams: true }, { players: 4, teams: true, popOut: true, blocks: true }
  ];

  describe('drop4 ai: normal/strong tactics', function () {
    ['normal', 'strong'].forEach(function (level) {
      it(level + ' plays an immediate win', function () {
        // Seat 1 has 3 in row 0 (cols 1-3); seat 2 also threatens col 6 vertically.
        var s = setup(mk(), { 1: [1], 2: [1], 3: [1], 6: [2, 2, 2] }, 0);
        var m = Ai.chooseMove(s, level, opts(1, 50));
        expect(m.type).toBe('drop');
        expect([0, 4]).toContain(m.col);
        expect(E.apply(s, m).result.type).toBe('win');
      });
      // normal.missRate (tuning parameter, see the measure report) is set to 0 so the stop logic itself is checked.
      it(level + ' stops the opponent immediate win', function () {
        var s = setup(mk({ blocks: true }), { 0: [1], 2: [1], 4: [2, 2, 2] }, 0);
        var m = withParam('normal', 'missRate', 0, function () { return Ai.chooseMove(s, level, opts(2, 50)); });
        expect(m.col).toBe(4);
        expect(['drop', 'block']).toContain(m.type);
      });
      it(level + ' stops a horizontal threat in 3 players', function () {
        // Seat 2 moves next and has 3 in row 0 at cols 2-4; col 1 is taken by seat 3, so col 5 is the only threat.
        var s = setup(mk({ players: 3 }), { 1: [3], 2: [2], 3: [2], 4: [2] }, 0);
        var m = withParam('normal', 'missRate', 0, function () { return Ai.chooseMove(s, level, opts(3, 50)); });
        expect(m.col).toBe(5);
      });
    });
  });

  describe('drop4 ai: stop rates', function () {
    it('strong always stops; normal stops at about 1 - missRate (+-0.15)', function () {
      var ps = threatPositions(100, 31);
      expect(ps.length).toBe(100);
      var stopped = { normal: 0, strong: 0 };
      ps.forEach(function (p, i) {
        ['normal', 'strong'].forEach(function (level) {
          if (Ai.chooseMove(p.state, level, opts(500 + i, 1000)).col === p.col) { stopped[level]++; }
        });
      });
      expect(stopped.strong).toBe(100);
      var expected = 1 - AI.normal.missRate;
      expect(stopped.normal / 100).toBeGreaterThanOrEqual(expected - 0.15);
      expect(stopped.normal / 100).toBeLessThanOrEqual(expected + 0.15);
    });
  });

  describe('drop4 ai: weak', function () {
    it('takes an immediate win at about winRate (+-0.15)', function () {
      var rng = Rng.mulberry32(77);
      var found = 0, wins = 0, guard = 0;
      while (found < 100 && guard < 20000) {
        guard++;
        var s = randomPosition({}, 6 + Math.floor(rng() * 20), rng);
        if (s.result || E.immediateWins(s, E.currentSeat(s)).length === 0) { continue; }
        found++;
        var m = Ai.chooseMove(s, 'weak', opts(1000 + found));
        var n = E.apply(s, m);
        if (n.result && n.result.type === 'win') { wins++; }
      }
      expect(found).toBe(100);
      expect(wins / found).toBeGreaterThanOrEqual(AI.weak.winRate - 0.15);
      expect(wins / found).toBeLessThanOrEqual(AI.weak.winRate + 0.15);
    });
  });

  describe('drop4 ai: legality', function () {
    it('returns legal moves in 3/4 players, teams, popOut and blocks', function () {
      var rng = Rng.mulberry32(5);
      VARIANTS.forEach(function (v, vi) {
        var s = randomPosition(v, 10 + vi, rng);
        ['weak', 'normal', 'strong'].forEach(function (level) {
          var m = Ai.chooseMove(s, level, opts(vi + 1, 100));
          expect(isLegal(s, m)).toBe(true);
        });
      });
    });
    it('every returned move is in legalMoves (200 random positions)', function () {
      var rng = Rng.mulberry32(9);
      var bad = 0;
      for (var i = 0; i < 200; i++) {
        var v = VARIANTS[i % VARIANTS.length];
        var s = randomPosition(v, Math.floor(rng() * 40), rng);
        var level = ['weak', 'normal', 'strong'][i % 3];
        var m = Ai.chooseMove(s, level, opts(i + 1, 1000));
        if (!isLegal(s, m)) { bad++; }
      }
      expect(bad).toBe(0);
    });
  });

  describe('drop4 ai: search', function () {
    function runSearch(s, level, seed, step) {
      var queue = [], slices = 0;
      var o = opts(seed, step);
      o.scheduler = function (fn) { slices++; queue.push(fn); };
      var p = Ai.search(s, level, o);
      while (queue.length > 0) { queue.shift()(); }
      return p.then(function (m) { return { move: m, slices: slices }; });
    }
    it('returns the same move as chooseMove and yields in slices', function () {
      var rng = Rng.mulberry32(11);
      var cases = [];
      for (var i = 0; i < 6; i++) { cases.push(randomPosition(VARIANTS[i], 6 + i, rng)); }
      var maxSlices = 0;
      return cases.reduce(function (chain, s, i) {
        return chain.then(function () {
          return ['weak', 'normal', 'strong'].reduce(function (c2, level) {
            return c2.then(function () {
              var expected = Ai.chooseMove(s, level, opts(i + 1, 5));
              return runSearch(s, level, i + 1, 5).then(function (r) {
                expect(r.move).toEqual(expected);
                if (r.slices > maxSlices) { maxSlices = r.slices; }
              });
            });
          }, Promise.resolve());
        });
      }, Promise.resolve()).then(function () {
        expect(maxSlices).toBeGreaterThanOrEqual(3);
      });
    });
  });
})(window.Ailand);
