(function (A) {
  'use strict';
  var describe = A.Test.describe, it = A.Test.it, expect = A.Test.expect;
  var G = A.games.territory, E = G.Engine, Ai = G.Ai;
  var mulberry32 = A.core.Rng.mulberry32;

  function midGame(players, plies, seed) {
    var rng = mulberry32(seed), s = E.create({ players: players, firstSeat: 1 });
    for (var i = 0; i < plies && !E.isOver(s); i++) {
      var ms = E.legalMoves(s, E.currentSeat(s));
      s = E.apply(s, ms[Math.floor(rng() * ms.length)]);
    }
    return s;
  }

  describe('territory ai', function () {
    it('every level returns a legal move', function () {
      ['weak', 'normal', 'strong'].forEach(function (level) {
        [[2, 0, 1], [2, 9, 2], [2, 16, 3], [4, 0, 4], [4, 14, 5]].forEach(function (c) {
          var s = midGame(c[0], c[1], c[2]);
          var m = Ai.chooseMove(s, level, { rng: mulberry32(7), now: function () { return 0; } });
          expect(m.seat).toBe(E.currentSeat(s));
          expect(E.check(s, m).ok).toBe(true);
        });
      });
    });
    it('null when no move', function () {
      var s = midGame(2, 6, 1);
      s.hands[E.currentSeat(s)] = [];
      ['weak', 'normal', 'strong'].forEach(function (level) {
        expect(Ai.chooseMove(s, level, { rng: mulberry32(1), now: function () { return 0; } })).toBe(null);
      });
    });
    it('same seed same move', function () {
      var s = midGame(2, 12, 3);
      ['weak', 'normal', 'strong'].forEach(function (level) {
        var a = Ai.chooseMove(s, level, { rng: mulberry32(42), now: function () { return 0; } });
        var b = Ai.chooseMove(s, level, { rng: mulberry32(42), now: function () { return 0; } });
        expect(a).toEqual(b);
      });
    });
    it('strong stops within its budget', function () {
      var s = midGame(2, 10, 5), t = 0, calls = 0;
      var m = Ai.chooseMove(s, 'strong', { rng: mulberry32(1), now: function () { calls++; t += 100; return t; } });
      expect(E.check(s, m).ok).toBe(true);
      // budget 400 ms with a clock that advances 100 ms per read: only a handful of reads
      expect(calls < 20).toBe(true);
    });
  });
})(Ailand);
