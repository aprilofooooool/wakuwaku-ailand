(function (A) {
  'use strict';
  var describe = A.Test.describe, it = A.Test.it, expect = A.Test.expect;
  var F = A.games.fill, P = F.Piece, E = F.Engine;

  function full(w, h) {
    var on = [], cells = [], x, y;
    for (y = 0; y < h; y++) {
      on.push([]);
      for (x = 0; x < w; x++) { on[y].push(true); cells.push([x, y]); }
    }
    return { w: w, h: h, on: on, cells: cells, count: w * h };
  }
  function piece(id, cells, ax, ay) {
    return { id: id, cells: cells, answer: { x: ax, y: ay }, start: { rot: 0, flip: 0 }, color: 0 };
  }
  var O = [[0, 0], [1, 0], [0, 1], [1, 1]];
  var I5 = [[0, 0], [1, 0], [2, 0], [3, 0], [4, 0]];

  // 2 wide, 4 high: two O pieces.
  function twoO() {
    return { frame: full(2, 4), seed: 1, pieces: [piece(0, O, 0, 0), piece(1, O, 0, 2)], tray: [0, 1] };
  }
  // 5 wide, 4 high: four horizontal I5 pieces.
  function rows() {
    var ps = [], i;
    for (i = 0; i < 4; i++) { ps.push(piece(i, I5, 0, i)); }
    return { frame: full(5, 4), seed: 1, pieces: ps, tray: [0, 1, 2, 3] };
  }
  // 3x3 frame with one L piece.
  function oneL() {
    return { frame: full(3, 3), seed: 1, pieces: [piece(0, [[0, 0], [0, 1], [1, 1]], 0, 0)], tray: [0] };
  }
  function types(ev) { return ev.map(function (e) { return e.type; }); }

  describe('fill engine', function () {
    it('starts with every piece in the tray in its start orientation', function () {
      var pz = twoO();
      pz.pieces[1].start = { rot: 1, flip: 1 };
      var e = E.create(pz);
      expect(e.inTray()).toEqual([0, 1]);
      expect(e.state(1)).toEqual({ rot: 1, flip: 1, at: null });
      expect(e.shape(1)).toEqual(P.orient(O, 1, true));
      expect(e.placedCount()).toBe(0);
      expect(e.isClear()).toBe(false);
      expect(e.hintUsed()).toBe(false);
    });
    it('drop places when it fits', function () {
      var e = E.create(twoO());
      var ev = e.drop(0, 0, 1);
      expect(ev).toEqual([{ type: 'placed', id: 0 }, { type: 'last' }]);
      expect(e.state(0).at).toEqual({ x: 0, y: 1 });
      expect(e.occupied()).toEqual({ '0,1': 0, '1,1': 0, '0,2': 0, '1,2': 0 });
      expect(e.inTray()).toEqual([1]);
      expect(e.placedCount()).toBe(1);
    });
    it('out of frame or overlap returns to the tray', function () {
      var e = E.create(twoO());
      e.drop(0, 0, 0);
      var before = JSON.stringify(e.occupied());
      expect(types(e.drop(1, 1, 3))).toEqual(['returned']);
      expect(e.state(1).at).toBe(null);
      expect(types(e.drop(1, 0, 1))).toEqual(['returned']);
      expect(e.state(1).at).toBe(null);
      expect(JSON.stringify(e.occupied())).toBe(before);
      expect(e.inTray()).toEqual([1]);
    });
    it('moving a placed piece frees the old spot', function () {
      var e = E.create(twoO());
      e.drop(0, 0, 0);
      expect(types(e.drop(0, 0, 2))).toEqual(['placed']);
      expect(e.occupied()['0,0']).toBe(undefined);
      expect(e.occupied()['0,2']).toBe(0);
      expect(e.placedCount()).toBe(1);
      // Shifting by one overlaps only its own old cells: allowed.
      expect(types(e.drop(0, 0, 1))).toEqual(['placed']);
      expect(e.state(0).at).toEqual({ x: 0, y: 1 });
    });
    it('a failed move sends the placed piece back to the tray', function () {
      var e = E.create(twoO());
      e.drop(0, 0, 0);
      expect(types(e.drop(0, 1, 3))).toEqual(['returned']);
      expect(e.state(0).at).toBe(null);
      expect(e.occupied()).toEqual({});
    });
    it('toTray returns a placed piece', function () {
      var e = E.create(twoO());
      e.drop(0, 0, 0);
      expect(e.toTray(0)).toEqual([{ type: 'returned', id: 0 }]);
      expect(e.state(0).at).toBe(null);
      expect(e.inTray()).toEqual([0, 1]);
      expect(e.occupied()).toEqual({});
    });
    it('rotate and flip match Piece for a tray piece', function () {
      var pz = oneL();
      pz.pieces[0].start = { rot: 1, flip: 0 };
      var e = E.create(pz), r, f;
      for (r = 0; r < 4; r++) {
        for (f = 0; f < 2; f++) {
          var before = e.shape(0);
          expect(types(e.turn(0, 'rotate'))).toEqual(['turned']);
          expect(e.shape(0)).toEqual(P.rotate(before));
          before = e.shape(0);
          expect(types(e.turn(0, 'flip'))).toEqual(['turned']);
          expect(e.shape(0)).toEqual(P.flip(before));
        }
      }
      expect(e.state(0).at).toBe(null);
    });
    it('turning a placed piece stays or returns', function () {
      var e = E.create(oneL());
      e.drop(0, 1, 1);
      var ev = e.turn(0, 'flip');
      expect(ev).toEqual([{ type: 'turned', id: 0 }]);
      expect(e.state(0).at).toEqual({ x: 1, y: 1 });
      expect(e.occupied()).toEqual({ '2,1': 0, '1,2': 0, '2,2': 0 });
      // Rotating at the edge: the new shape sticks out, so it goes back to the tray.
      var e2 = E.create(rows());
      e2.drop(0, 0, 0);
      var ev2 = e2.turn(0, 'rotate');
      expect(ev2).toEqual([{ type: 'turned', id: 0 }, { type: 'returned', id: 0 }]);
      expect(e2.state(0).at).toBe(null);
      expect(e2.state(0).rot).toBe(1);
      expect(e2.occupied()).toEqual({});
      expect(e2.inTray()).toEqual([0, 1, 2, 3]);
    });
    it('turning into an overlap returns the piece', function () {
      var pz = { frame: full(3, 3), seed: 1, pieces: [piece(0, [[0, 0], [1, 0]], 0, 0), piece(1, [[0, 0]], 2, 2)], tray: [0, 1] };
      var e = E.create(pz);
      e.drop(0, 0, 1);
      e.drop(1, 0, 2);
      expect(types(e.turn(0, 'rotate'))).toEqual(['turned', 'returned']);
      expect(e.occupied()).toEqual({ '0,2': 1 });
    });
    it('clear with a different arrangement', function () {
      var e = E.create(twoO());
      e.drop(0, 0, 2);
      var ev = e.drop(1, 0, 0);
      expect(types(ev)).toEqual(['placed', 'clear']);
      expect(e.isClear()).toBe(true);
      expect(e.placedCount()).toBe(2);
    });
    it('last fires once', function () {
      var e = E.create(rows());
      e.drop(0, 0, 0);
      e.drop(1, 0, 1);
      expect(types(e.drop(2, 0, 2))).toEqual(['placed', 'last']);
      e.toTray(2);
      expect(types(e.drop(2, 0, 2))).toEqual(['placed']);
      e.toTray(1);
      expect(types(e.drop(3, 0, 3))).toEqual(['placed']);
      expect(types(e.drop(1, 0, 1))).toEqual(['placed', 'clear']);
    });
    it('hint prefers tray pieces and returns the answer cells', function () {
      var e = E.create(rows());
      e.drop(0, 0, 1);
      for (var s = 1; s <= 10; s++) {
        var h = e.hint(A.core.Rng.mulberry32(s));
        expect(h.id === 1 || h.id === 2 || h.id === 3).toBe(true);
        expect(h.x).toBe(0);
        expect(h.y).toBe(h.id);
        expect(h.cells).toEqual(P.place(I5, 0, h.id));
      }
    });
    it('hint skips correctly placed pieces', function () {
      var e = E.create(rows());
      e.drop(0, 0, 0);
      e.drop(1, 0, 1);
      e.drop(2, 0, 3);
      e.drop(3, 0, 2);
      expect(e.inTray()).toEqual([]);
      for (var s = 1; s <= 10; s++) {
        var h = e.hint(A.core.Rng.mulberry32(s));
        expect(h.id === 2 || h.id === 3).toBe(true);
        expect(h.cells).toEqual(P.place(I5, 0, h.id));
      }
    });
    it('hint treats an equal-cell placement as correct', function () {
      var e = E.create(twoO());
      e.drop(1, 0, 0);
      e.drop(0, 0, 2);
      // Both are swapped: wrong by cells, so the hint still points somewhere.
      expect(e.hint(A.core.Rng.mulberry32(1)).cells.length).toBe(4);
      var e2 = E.create(twoO());
      e2.drop(0, 0, 0);
      expect(e2.hint(A.core.Rng.mulberry32(1)).id).toBe(1);
    });
    it('hint marks hintUsed', function () {
      var e = E.create(twoO());
      expect(e.hintUsed()).toBe(false);
      e.hint(A.core.Rng.mulberry32(1));
      expect(e.hintUsed()).toBe(true);
    });
  });
})(window.Ailand);
