(function (A) {
  'use strict';
  var describe = A.Test.describe, it = A.Test.it, expect = A.Test.expect;
  var E = A.games.drop4.Engine;

  function mk(o) {
    var s = { players: 2, teams: false, popOut: false, blocks: false, firstSeat: 1 };
    for (var k in o) { s[k] = o[k]; }
    return E.create(s);
  }
  function play(state, cols) {
    cols.forEach(function (c) {
      state = E.apply(state, { type: 'drop', col: c, seat: E.currentSeat(state) });
    });
    return state;
  }

  describe('drop4 engine: create', function () {
    it('sizes by player count', function () {
      var s2 = mk({}), s3 = mk({ players: 3 }), s4 = mk({ players: 4 });
      expect([s2.cols, s2.rows]).toEqual([7, 6]);
      expect([s3.cols, s3.rows]).toEqual([9, 7]);
      expect([s4.cols, s4.rows]).toEqual([10, 8]);
      expect(s2.cells.length).toBe(42);
      expect(E.emptyCount(s2)).toBe(42);
      expect(s2.result).toBe(null);
      expect(s2.moveCount).toBe(0);
    });
    it('blocksLeft is 2 per seat only with blocks', function () {
      expect(mk({ blocks: true }).blocksLeft).toEqual({ 1: 2, 2: 2 });
      expect(mk({}).blocksLeft).toEqual({ 1: 0, 2: 0 });
    });
    it('teams only valid for 4 players', function () {
      expect(mk({ teams: true }).teams).toBe(false);
      expect(mk({ players: 4, teams: true }).teams).toBe(true);
      expect(E.teamOf(mk({ players: 4, teams: true }), 3)).toBe(0);
      expect(E.teamOf(mk({ players: 4, teams: true }), 4)).toBe(1);
      expect(E.teamOf(mk({ players: 4 }), 1)).toBe(null);
    });
    it('turn order', function () {
      var s = mk({ players: 3, firstSeat: 2 });
      expect(s.order).toEqual([2, 3, 1]);
      expect(E.currentSeat(s)).toBe(2);
      s = play(s, [0]); expect(E.currentSeat(s)).toBe(3);
      s = play(s, [1]); expect(E.currentSeat(s)).toBe(1);
      s = play(s, [2]); expect(E.currentSeat(s)).toBe(2);
      expect(mk({ players: 4, teams: true }).order).toEqual([1, 2, 3, 4]);
      expect(mk({ players: 4, teams: true, firstSeat: 2 }).order).toEqual([2, 3, 4, 1]);
    });
  });

  describe('drop4 engine: apply', function () {
    it('does not mutate input and counts moves', function () {
      var s = mk({});
      var n = E.apply(s, { type: 'drop', col: 3, seat: 1 });
      expect(s.cells[3 * 6]).toBe(0);
      expect(n.cells[3 * 6]).toBe(1);
      expect(E.at(n, 3, 0)).toBe(1);
      expect(n.moveCount).toBe(1);
      expect(n.lastMove).toEqual({ type: 'drop', col: 3, seat: 1 });
    });
    it('full column is illegal', function () {
      var s = play(mk({}), [0, 0, 0, 0, 0, 0]);
      expect(s.result).toBe(null);
      expect(E.legalMoves(s).some(function (m) { return m.col === 0; })).toBe(false);
      expect(E.legalMoves(s).length).toBe(6);
      expect(function () { E.apply(s, { type: 'drop', col: 0, seat: 1 }); }).toThrow();
    });
    it('wrong seat / bad col throws', function () {
      var s = mk({});
      expect(function () { E.apply(s, { type: 'drop', col: 0, seat: 2 }); }).toThrow();
      expect(function () { E.apply(s, { type: 'drop', col: 7, seat: 1 }); }).toThrow();
    });
    it('legalMoves are drops only', function () {
      var m = E.legalMoves(mk({ popOut: true, blocks: true }));
      expect(m.length).toBe(7);
      expect(m.every(function (x) { return x.type === 'drop' && x.seat === 1; })).toBe(true);
    });
  });

  describe('drop4 engine: wins', function () {
    it('vertical', function () {
      var s = play(mk({}), [0, 1, 0, 1, 0, 1, 0]);
      expect(s.result.type).toBe('win');
      expect(s.result.seats).toEqual([1]);
      expect(s.result.team).toBe(null);
      expect(s.result.lines.length).toBe(1);
      expect(s.result.lines[0].length).toBe(4);
    });
    it('horizontal', function () {
      var s = play(mk({}), [0, 0, 1, 1, 2, 2, 3]);
      expect(s.result.type).toBe('win');
      expect(s.result.lines[0].length).toBe(4);
    });
    it('diagonal up-right', function () {
      var s = play(mk({}), [0, 1, 1, 2, 3, 2, 2, 3, 3, 6, 3]);
      expect(s.result.type).toBe('win');
      expect(s.result.seats).toEqual([1]);
      expect(s.result.lines[0].length).toBe(4);
    });
    it('diagonal down-right', function () {
      var s = play(mk({}), [3, 2, 2, 1, 1, 0, 1, 0, 0, 6, 0]);
      expect(s.result.type).toBe('win');
      expect(s.result.lines[0].length).toBe(4);
    });
    it('three in a row is not a win', function () {
      expect(play(mk({}), [0, 0, 1, 1, 2]).result).toBe(null);
    });
    it('five in a row wins and includes all cells', function () {
      var s = play(mk({}), [0, 0, 1, 1, 3, 3, 4, 4, 2]);
      expect(s.result.type).toBe('win');
      expect(s.result.lines[0].length).toBe(5);
    });
    it('game over: no legal moves, apply throws', function () {
      var s = play(mk({}), [0, 1, 0, 1, 0, 1, 0]);
      expect(E.legalMoves(s)).toEqual([]);
      expect(function () { E.apply(s, { type: 'drop', col: 2, seat: 2 }); }).toThrow();
    });
    it('team win mixes seats 1 and 3', function () {
      var s = play(mk({ players: 4, teams: true }), [0, 5, 1, 5, 2, 6, 3]);
      expect(s.result.type).toBe('win');
      expect(s.result.team).toBe(0);
      expect(s.result.seats).toEqual([1, 3]);
    });
  });

  describe('drop4 engine: draw and immediateWins', function () {
    it('full board draws', function () {
      var seq = [0, 0, 0, 0, 0, 0, 1, 1, 1, 1, 1, 1, 2, 2, 2, 2, 2, 2, 4, 3, 3, 3, 3, 3, 3, 4, 4, 4, 4, 4,
        5, 5, 5, 5, 5, 5, 6, 6, 6, 6, 6, 6];
      var s = play(mk({}), seq);
      expect(s.moveCount).toBe(42);
      expect(s.result).toEqual({ type: 'draw', reason: 'full' });
      expect(E.legalMoves(s)).toEqual([]);
    });
    it('draw by move limit', function () {
      var s = mk({});
      s.moveCount = 7 * 6 * 2 - 1;
      s = E.apply(s, { type: 'drop', col: 0, seat: 1 });
      expect(s.result).toEqual({ type: 'draw', reason: 'limit' });
    });
    it('immediateWins finds both ends of an open three', function () {
      var s = play(mk({}), [1, 1, 2, 2, 3]);
      expect(E.immediateWins(s, 1)).toEqual([0, 4]);
      expect(E.immediateWins(s, 2)).toEqual([]);
    });
    it('immediateWins counts teammates', function () {
      var s = play(mk({ players: 4, teams: true }), [0, 5, 1, 5, 2, 6]);
      expect(E.immediateWins(s, 3)).toEqual([3]);
    });
  });
})(window.Ailand);
