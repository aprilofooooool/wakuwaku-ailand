(function (A) {
  'use strict';
  var describe = A.Test.describe, it = A.Test.it, expect = A.Test.expect;
  var G = A.games.territory, E = G.Engine, C = G.Constants, Pieces = G.Pieces;

  function mv(seat, pieceId, rot, flip, x, y) {
    return { seat: seat, pieceId: pieceId, rot: rot, flip: flip, x: x, y: y };
  }
  // Put cells straight onto the board (test setup only).
  function withCells(state, seat, cells) {
    var s = JSON.parse(JSON.stringify(state));
    cells.forEach(function (c) { s.board[c[1]][c[0]] = seat; });
    s.placed[seat] += cells.length;
    return s;
  }
  function two() { return E.create({ players: 2, firstSeat: 1 }); }

  describe('territory engine', function () {
    it('board sizes and corners by players', function () {
      expect(C.SIZES[2]).toBe(11);
      expect(C.SIZES[3]).toBe(14);
      expect(C.SIZES[4]).toBe(14);
      var s2 = two();
      expect(s2.size).toBe(11);
      expect(E.cornerOf(s2, 1)).toEqual([0, 0]);
      expect(E.cornerOf(s2, 2)).toEqual([10, 10]);
      var s3 = E.create({ players: 3, firstSeat: 2 });
      expect(s3.size).toBe(14);
      expect(s3.turn).toBe(2);
      expect(E.cornerOf(s3, 2)).toEqual([13, 0]);
      expect(E.cornerOf(s3, 3)).toEqual([13, 13]);
      var s4 = E.create({ players: 4, firstSeat: 1 });
      expect(E.cornerOf(s4, 4)).toEqual([0, 13]);
      expect(s3.hands[1].length).toBe(12);
      expect(s3.board[13][0]).toBe(0);
      expect(E.remainingCells(s3)).toBe(44 * 3);
    });
    it('first move must cover the own corner', function () {
      var s = two();
      expect(E.check(s, mv(1, 'i2', 0, 0, 3, 3))).toEqual({ ok: false, reason: 'start' });
      expect(E.check(s, mv(1, 'i2', 0, 0, 0, 0))).toEqual({ ok: true });
      expect(E.check(s, mv(2, 'i2', 0, 0, 9, 10))).toEqual({ ok: true });
    });
    it('touching own color by a corner is ok', function () {
      var s = withCells(two(), 1, [[3, 3]]);
      expect(E.check(s, mv(1, 'p1', 0, 0, 4, 4))).toEqual({ ok: true });
    });
    it('touching own color by an edge is edge', function () {
      var s = withCells(two(), 1, [[3, 3]]);
      expect(E.check(s, mv(1, 'p1', 0, 0, 4, 3))).toEqual({ ok: false, reason: 'edge' });
    });
    it('edge wins over corner', function () {
      var s = withCells(two(), 1, [[3, 3]]);
      // vertical i2 at (4,2),(4,3): (4,3) touches by edge, (4,2) by corner
      expect(E.check(s, mv(1, 'i2', 1, 0, 4, 2))).toEqual({ ok: false, reason: 'edge' });
    });
    it('touching others by an edge is ok', function () {
      var s = withCells(withCells(two(), 1, [[3, 3]]), 2, [[5, 4]]);
      expect(E.check(s, mv(1, 'p1', 0, 0, 4, 4))).toEqual({ ok: true });
    });
    it('not touching own color is corner', function () {
      var s = withCells(two(), 1, [[3, 3]]);
      expect(E.check(s, mv(1, 'p1', 0, 0, 6, 6))).toEqual({ ok: false, reason: 'corner' });
    });
    it('out and overlap', function () {
      var s = withCells(two(), 2, [[1, 1]]);
      expect(E.check(s, mv(1, 'i2', 0, 0, 10, 0)).reason).toBe('out');
      expect(E.check(s, mv(1, 'i2', 0, 0, -1, 0)).reason).toBe('out');
      expect(E.check(s, mv(1, 'p1', 0, 0, 1, 1)).reason).toBe('overlap');
    });
    it('used piece is gone', function () {
      var s = two();
      s.hands[1] = ['i2'];
      expect(E.check(s, mv(1, 'p1', 0, 0, 0, 0))).toEqual({ ok: false, reason: 'gone' });
    });
    it('anchors after the first move', function () {
      var s = two();
      expect(E.anchors(s, 1)).toEqual([[0, 0]]);
      expect(E.anchors(s, 2)).toEqual([[10, 10]]);
      var s2 = E.apply(s, mv(1, 'l3', 0, 0, 0, 0));
      expect(E.anchors(s2, 1)).toEqual([[2, 0], [2, 2]]);
      // an occupied start corner is not offered
      var s3 = withCells(two(), 1, [[10, 10]]);
      expect(E.anchors(s3, 2)).toEqual([]);
    });
    it('legalMoves, canPlace and hasMove agree with check', function () {
      var s = two();
      var moves = E.legalMoves(s, 1);
      var keys = {};
      moves.forEach(function (m) {
        expect(E.check(s, m)).toEqual({ ok: true });
        var k = JSON.stringify(m);
        expect(keys[k]).toBe(undefined);
        keys[k] = true;
      });
      expect(moves.filter(function (m) { return m.pieceId === 'p1'; }).length).toBe(1);
      // i2 covering the corner: horizontal at (0,0), vertical at (0,0)
      expect(moves.filter(function (m) { return m.pieceId === 'i2'; }).length).toBe(2);
      // the cross has no cell in its corner, so it cannot cover a board corner
      expect(E.canPlace(s, 1, 'x5')).toBe(false);
      expect(E.canPlace(s, 1, 'l5')).toBe(true);
      s.hands[1] = ['p1'];
      expect(E.canPlace(s, 1, 'l5')).toBe(false);
      expect(E.canPlace(s, 1, 'p1')).toBe(true);
      expect(E.hasMove(s, 1)).toBe(true);
      s.hands[1] = [];
      expect(E.hasMove(s, 1)).toBe(false);
    });
    it('apply does not mutate and places the piece', function () {
      var s = two();
      var before = JSON.stringify(s);
      var n = E.apply(s, mv(1, 'o4', 0, 0, 0, 0));
      expect(JSON.stringify(s)).toBe(before);
      expect(n.board[1][1]).toBe(1);
      expect(n.hands[1].indexOf('o4')).toBe(-1);
      expect(n.placed[1]).toBe(4);
      expect(n.moves).toBe(1);
      expect(n.turn).toBe(2);
      expect(E.currentSeat(n)).toBe(2);
      expect(E.remainingCells(n)).toBe(88 - 4);
    });
    it('apply skips seats without a move and ends', function () {
      var s = two();
      s.hands[2] = [];
      var n = E.apply(s, mv(1, 'p1', 0, 0, 0, 0));
      expect(n.justRested).toEqual([2]);
      expect(n.resting[2]).toBe(true);
      expect(n.turn).toBe(1);
      expect(E.isOver(n)).toBe(false);
      // seat 2 is already resting, so it is not reported again
      var n2 = E.apply(n, mv(1, 'i2', 0, 0, 1, 1));
      expect(n2.justRested).toEqual([]);
      expect(n2.turn).toBe(1);
      var e = two();
      e.hands[1] = ['p1'];
      e.hands[2] = [];
      var end = E.apply(e, mv(1, 'p1', 0, 0, 0, 0));
      expect(end.turn).toBe(null);
      expect(E.isOver(end)).toBe(true);
      expect(end.justRested).toEqual([1, 2]);
    });
    it('placing all pieces rests the seat', function () {
      var s = E.create({ players: 3, firstSeat: 3 });
      s.hands[3] = ['p1'];
      var n = E.apply(s, mv(3, 'p1', 0, 0, 13, 13));
      expect(n.resting[3]).toBe(true);
      expect(n.justRested).toEqual([3]);
      expect(n.turn).toBe(1);
    });
    it('result winners and draw', function () {
      var s = two();
      s.placed[1] = 30; s.placed[2] = 20;
      var r = E.result(s);
      expect(r.scores).toEqual({ 1: 30, 2: 20 });
      expect(r.winners).toEqual([1]);
      expect(r.draw).toBe(false);
      s.placed[2] = 30;
      r = E.result(s);
      expect(r.winners).toEqual([1, 2]);
      expect(r.draw).toBe(true);
    });
    it('hands start in piece list order', function () {
      expect(two().hands[2]).toEqual(Pieces.LIST.map(function (p) { return p.id; }));
    });
  });
})(window.Ailand);
