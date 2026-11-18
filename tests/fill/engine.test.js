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
    return { id: id, cells: cells, answer: { x: ax, y: ay }, start: { rot: 0 } };
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
  function types(ev) { return ev.map(function (e) { return e.type; }); }

  describe('fill engine', function () {
    it('starts with every piece in the tray in its start orientation', function () {
      var pz = twoO();
      pz.pieces[1].start = { rot: 1 };
      var e = E.create(pz);
      expect(e.inTray()).toEqual([0, 1]);
      expect(e.state(1)).toEqual({ rot: 1, at: null });
      expect(e.shape(1)).toEqual(P.orient(O, 1));
      expect(e.placedCount()).toBe(0);
      expect(e.isClear()).toBe(false);
      expect(e.hintUsed()).toBe(false);
    });
    it('drop places at the answer position', function () {
      var e = E.create(twoO());
      var ev = e.drop(0, 0, 0);
      expect(ev).toEqual([{ type: 'placed', id: 0 }, { type: 'last' }]);
      expect(e.state(0).at).toEqual({ x: 0, y: 0 });
      expect(e.occupied()).toEqual({ '0,0': 0, '1,0': 0, '0,1': 0, '1,1': 0 });
      expect(e.inTray()).toEqual([1]);
      expect(e.placedCount()).toBe(1);
    });
    it('snaps within one cell, returns at two', function () {
      var ax = 2, ay = 2;
      function fresh() {
        var pz = { frame: full(6, 6), seed: 1, pieces: [piece(0, O, ax, ay), piece(1, O, 0, 0), piece(2, O, 4, 4)], tray: [0, 1, 2] };
        return E.create(pz);
      }
      [[0, 0], [1, 0], [-1, 1], [1, 1], [-1, -1]].forEach(function (d) {
        var e = fresh();
        expect(types(e.drop(0, ax + d[0], ay + d[1]))).toEqual(['placed']);
        expect(e.state(0).at).toEqual({ x: ax, y: ay });
      });
      [[2, 0], [0, -2], [-2, 2], [0, 3]].forEach(function (d) {
        var e = fresh();
        expect(types(e.drop(0, ax + d[0], ay + d[1]))).toEqual(['returned']);
        expect(e.state(0).at).toBe(null);
      });
    });
    it('wrong turn does not snap', function () {
      var pz = twoO();
      pz.pieces[0] = piece(0, [[0, 0], [0, 1], [1, 1]], 0, 0);
      pz.pieces[0].start = { rot: 1 };
      var e = E.create(pz);
      expect(types(e.drop(0, 0, 0))).toEqual(['returned']);
      expect(e.state(0).at).toBe(null);
      e.turn(0); e.turn(0); e.turn(0);
      expect(e.state(0).rot).toBe(0);
      expect(types(e.drop(0, 0, 0))[0]).toBe('placed');
    });
    it('a symmetric shape in the wrong turn does not snap', function () {
      var pz = twoO();
      pz.pieces[0].start = { rot: 2 };
      var e = E.create(pz);
      expect(types(e.drop(0, 0, 0))).toEqual(['returned']);
      expect(e.state(0).at).toBe(null);
    });
    it('turn rotates a tray piece clockwise like Piece.orient', function () {
      var pz = twoO();
      pz.pieces[0] = piece(0, [[0, 0], [0, 1], [1, 1]], 0, 0);
      var e = E.create(pz), r;
      for (r = 1; r <= 5; r++) {
        expect(types(e.turn(0))).toEqual(['turned']);
        expect(e.state(0).rot).toBe(r % 4);
        expect(e.shape(0)).toEqual(P.orient(pz.pieces[0].cells, r % 4));
      }
    });
    it('a placed piece is locked', function () {
      var e = E.create(twoO());
      e.drop(0, 0, 0);
      var before = JSON.stringify(e.state(0)), occ = JSON.stringify(e.occupied());
      expect(e.drop(0, 0, 0)).toEqual([]);
      expect(e.drop(0, 1, 1)).toEqual([]);
      expect(e.turn(0)).toEqual([]);
      expect(JSON.stringify(e.state(0))).toBe(before);
      expect(JSON.stringify(e.occupied())).toBe(occ);
      expect(e.placedCount()).toBe(1);
    });
    it('last fires once', function () {
      var e = E.create(rows());
      e.drop(0, 0, 0);
      e.drop(1, 0, 1);
      expect(types(e.drop(2, 0, 2))).toEqual(['placed', 'last']);
      expect(types(e.drop(3, 0, 3))).toEqual(['placed', 'clear']);
      expect(e.isClear()).toBe(true);
    });
    it('clear fires once when everything is on its answer', function () {
      var e = E.create(twoO()), all = [];
      all = all.concat(e.drop(1, 0, 2), e.drop(0, 0, 0));
      expect(types(all).filter(function (t) { return t === 'clear'; }).length).toBe(1);
      expect(e.placedCount()).toBe(2);
    });
    it('hint prefers the given tray piece', function () {
      var e = E.create(rows());
      var h = e.hint(A.core.Rng.mulberry32(1), 2);
      expect(h.id).toBe(2);
      expect(h.x).toBe(0);
      expect(h.y).toBe(2);
      expect(h.cells).toEqual(P.place(I5, 0, 2));
      expect(e.hintUsed()).toBe(true);
      e.drop(1, 0, 1);
      for (var s = 1; s <= 10; s++) {
        var h2 = e.hint(A.core.Rng.mulberry32(s), 1);
        expect(h2.id === 0 || h2.id === 2 || h2.id === 3).toBe(true);
      }
    });
    it('hint picks from the tray only', function () {
      var e = E.create(rows());
      e.drop(0, 0, 0);
      for (var s = 1; s <= 10; s++) {
        var h = e.hint(A.core.Rng.mulberry32(s));
        expect(h.id === 1 || h.id === 2 || h.id === 3).toBe(true);
        expect(h.cells).toEqual(P.place(I5, 0, h.id));
      }
    });
    it('snapTarget matches drop', function () {
      var e = E.create(rows());
      expect(e.snapTarget(2, 1, 3)).toEqual({ x: 0, y: 2 });
      expect(e.snapTarget(2, 2, 2)).toBe(null);
      e.turn(2);
      expect(e.snapTarget(2, 0, 2)).toBe(null);
      e.drop(0, 0, 0);
      expect(e.snapTarget(0, 0, 0)).toBe(null);
    });
    it('works with string piece ids like the real puzzle', function () {
      var pz = twoO();
      pz.pieces[0].id = 'p0'; pz.pieces[1].id = 'p1'; pz.tray = ['p0', 'p1'];
      var e = E.create(pz);
      expect(types(e.drop('p0', 0, 0)).join(',')).toBe('placed,last');
      expect(types(e.drop('p1', 0, 2)).join(',')).toBe('placed,clear');
    });
    it('hint marks hintUsed', function () {
      var e = E.create(twoO());
      expect(e.hintUsed()).toBe(false);
      e.hint(A.core.Rng.mulberry32(1));
      expect(e.hintUsed()).toBe(true);
    });
  });
})(window.Ailand);
