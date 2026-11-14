(function (A) {
  'use strict';
  var describe = A.Test.describe, it = A.Test.it, expect = A.Test.expect;
  var E = A.games.blocks.Engine;
  var K = A.games.blocks.Constants;
  var P = A.games.blocks.Pieces;
  var CHARS = ['mametchi', 'kuchipatchi', 'mimitchi', 'flowertchi'];

  function mk(seed) { return E.create({ difficulty: 'normal', selfId: 'mametchi', seed: seed === undefined ? 1 : seed }); }
  function types(events) { return events.map(function (e) { return e.type; }); }
  function hasLock(events) { return types(events).indexOf('lock') >= 0; }
  function clearBoard(g) {
    g.board.forEach(function (row) { for (var c = 0; c < K.COLS; c++) { row[c] = null; } });
  }
  // Puts the current piece on the floor of the board.
  function toFloor(g) { g.piece.y = E.ghostY(g); }

  describe('blocks engine bag', function () {
    it('bags give every shape once per 7 and every character once per 4', function () {
      var bag = E.createBag(A.core.Rng.mulberry32(5), P.SHAPES);
      var got = [];
      var i;
      for (i = 0; i < 28; i++) { got.push(bag.next()); }
      for (i = 0; i < 4; i++) {
        expect(got.slice(i * 7, i * 7 + 7).sort()).toEqual(P.SHAPES.slice().sort());
      }
      var cb = E.createBag(A.core.Rng.mulberry32(5), CHARS);
      var cg = [];
      for (i = 0; i < 28; i++) { cg.push(cb.next()); }
      for (i = 0; i < 7; i++) {
        expect(cg.slice(i * 4, i * 4 + 4).sort()).toEqual(CHARS.slice().sort());
      }
    });

    // Draw order of a Game: first piece, then next, then each spawn event's piece.
    function drawn(g, n) {
      var seq = [{ shape: g.piece.shape, charId: g.piece.charId }, { shape: g.next.shape, charId: g.next.charId }];
      while (seq.length < n) {
        clearBoard(g);
        E.hardDrop(g);
        seq.push({ shape: g.next.shape, charId: g.next.charId });
      }
      return seq;
    }

    it('a game draws every shape once per 7 and every character once per 4', function () {
      var seq = drawn(mk(11), 28);
      var i;
      for (i = 0; i < 4; i++) {
        expect(seq.slice(i * 7, i * 7 + 7).map(function (s) { return s.shape; }).sort()).toEqual(P.SHAPES.slice().sort());
      }
      for (i = 0; i < 7; i++) {
        expect(seq.slice(i * 4, i * 4 + 4).map(function (s) { return s.charId; }).sort()).toEqual(CHARS.slice().sort());
      }
    });

    it('same seed gives the same sequence', function () {
      function key(seed) { return drawn(mk(seed), 20).map(function (s) { return s.shape + s.charId; }).join(); }
      expect(key(7)).toBe(key(7));
      expect(key(7) === key(8)).toBe(false);
    });
  });

  describe('blocks engine movement', function () {
    it('starts with a piece at x=3, y=0, rot=0', function () {
      var g = mk(1);
      expect(g.piece.x).toBe(3);
      expect(g.piece.y).toBe(0);
      expect(g.piece.rot).toBe(0);
      expect(g.state).toBe('falling');
      expect(g.board.length).toBe(K.ROWS + K.HIDDEN);
      expect(g.fallMs).toBe(650);
      expect(g.goal).toBe(20);
    });

    it('move stops at walls and blocks', function () {
      var g = mk(1);
      var results = [];
      for (var i = 0; i < 10; i++) { results.push(E.move(g, -1)); }
      expect(results[0]).toBe(true);
      expect(results[9]).toBe(false);
      var minX = Math.min.apply(null, P.cells(g.piece.shape, g.piece.rot).map(function (c) { return g.piece.x + c[0]; }));
      expect(minX).toBe(0);
      // a block right next to the piece on its right
      var g2 = mk(1);
      var maxX = Math.max.apply(null, P.cells(g2.piece.shape, g2.piece.rot).map(function (c) { return g2.piece.x + c[0]; }));
      g2.board[0][maxX + 1] = { charId: 'mametchi' };
      g2.board[1][maxX + 1] = { charId: 'mametchi' };
      var before = g2.piece.x;
      expect(E.move(g2, 1)).toBe(false);
      expect(g2.piece.x).toBe(before);
    });

    it('gravity drops one row per fallMs', function () {
      var g = mk(1);
      E.step(g, 649);
      expect(g.piece.y).toBe(0);
      E.step(g, 1);
      expect(g.piece.y).toBe(1);
      E.step(g, 1300);
      expect(g.piece.y).toBe(3);
    });

    it('softDrop moves one row and resets the gravity timer', function () {
      var g = mk(1);
      E.step(g, 600);
      expect(E.softDrop(g)).toBe(true);
      expect(g.piece.y).toBe(1);
      E.step(g, 649);
      expect(g.piece.y).toBe(1);
      E.step(g, 1);
      expect(g.piece.y).toBe(2);
    });

    it('rotate changes rot and everything fails when not falling', function () {
      var g = mk(1);
      g.piece.shape = 'T';
      g.piece.y = 5;
      expect(E.rotate(g)).toBe(true);
      expect(g.piece.rot).toBe(1);
      g.state = 'over';
      expect(E.rotate(g)).toBe(false);
      expect(E.move(g, 1)).toBe(false);
      expect(E.softDrop(g)).toBe(false);
      expect(E.hardDrop(g)).toEqual([]);
    });

    it('ghostY is the resting y', function () {
      var g = mk(1);
      var y = E.ghostY(g);
      var low = Math.max.apply(null, P.cells(g.piece.shape, g.piece.rot).map(function (c) { return y + c[1]; }));
      expect(low).toBe(K.ROWS + K.HIDDEN - 1);
    });
  });

  describe('blocks engine lock', function () {
    it('lock after 500ms on the floor and reset on move up to 15 times', function () {
      var g = mk(1);
      g.piece.shape = 'O';
      toFloor(g);
      expect(hasLock(E.step(g, 499))).toBe(false);
      expect(hasLock(E.step(g, 1))).toBe(true);

      var h = mk(1);
      h.piece.shape = 'O';
      toFloor(h);
      for (var i = 0; i < 15; i++) {
        expect(hasLock(E.step(h, 499))).toBe(false);
        expect(E.move(h, i % 2 === 0 ? 1 : -1)).toBe(true);
      }
      expect(hasLock(E.step(h, 499))).toBe(false);
      expect(E.move(h, 1)).toBe(true); // 16th: the timer is no longer reset
      expect(hasLock(E.step(h, 1))).toBe(true);
    });

    it('hardDrop locks at ghostY at once', function () {
      var g = mk(1);
      var gy = E.ghostY(g);
      var cells = P.cells(g.piece.shape, g.piece.rot);
      var expectBottom = gy + Math.max.apply(null, cells.map(function (c) { return c[1]; }));
      var ev = E.hardDrop(g);
      expect(ev[0].type).toBe('lock');
      expect(Math.max.apply(null, ev[0].cells.map(function (c) { return c[1]; }))).toBe(expectBottom);
      expect(ev[1].type).toBe('spawn');
      expect(g.piece.y).toBe(0);
      expect(g.state).toBe('falling');
    });

    it('locked cells carry the piece charId', function () {
      var g = mk(1);
      var id = g.piece.charId;
      var ev = E.hardDrop(g);
      ev[0].cells.forEach(function (c) { expect(g.board[c[1]][c[0]].charId).toBe(id); });
    });

    it('spawn blocked ends the game', function () {
      var g = mk(1);
      toFloor(g);
      var r, c;
      for (r = 0; r < 2; r++) { for (c = 3; c <= 6; c++) { g.board[r][c] = { charId: 'mametchi' }; } }
      var ev = E.hardDrop(g);
      expect(types(ev)).toEqual(['lock', 'over']);
      expect(g.state).toBe('over');
      expect(E.move(g, 1)).toBe(false);
      expect(E.step(g, 1000)).toEqual([]);
    });

    it('locking entirely in the hidden rows ends the game', function () {
      var g = mk(1);
      g.piece.shape = 'I';
      for (var c = 0; c < K.COLS; c++) { g.board[2][c] = { charId: 'mametchi' }; }
      var ev = E.hardDrop(g);
      expect(types(ev)).toEqual(['lock', 'over']);
      expect(g.state).toBe('over');
    });
  });
})(window.Ailand);
