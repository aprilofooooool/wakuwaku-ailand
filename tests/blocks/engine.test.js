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
    it('starts with a piece at x=3, y=HIDDEN, rot=0', function () {
      var g = mk(1);
      expect(g.piece.x).toBe(3);
      expect(g.piece.y).toBe(K.HIDDEN);
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
      g2.board[g2.piece.y][maxX + 1] = { charId: 'mametchi' };
      g2.board[g2.piece.y + 1][maxX + 1] = { charId: 'mametchi' };
      var before = g2.piece.x;
      expect(E.move(g2, 1)).toBe(false);
      expect(g2.piece.x).toBe(before);
    });

    it('gravity drops one row per fallMs', function () {
      var g = mk(1);
      var y0 = g.piece.y;
      E.step(g, 649);
      expect(g.piece.y).toBe(y0);
      E.step(g, 1);
      expect(g.piece.y).toBe(y0 + 1);
      E.step(g, 1300);
      expect(g.piece.y).toBe(y0 + 3);
    });

    it('softDrop moves one row and resets the gravity timer', function () {
      var g = mk(1);
      var y0 = g.piece.y;
      E.step(g, 600);
      expect(E.softDrop(g)).toBe(true);
      expect(g.piece.y).toBe(y0 + 1);
      E.step(g, 649);
      expect(g.piece.y).toBe(y0 + 1);
      E.step(g, 1);
      expect(g.piece.y).toBe(y0 + 2);
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
      expect(g.piece.y).toBe(K.HIDDEN);
      expect(g.state).toBe('falling');
    });

    it('new piece appears in the visible rows', function () {
      var g = mk(1);
      for (var i = 0; i < 3; i++) {
        P.cells(g.piece.shape, g.piece.rot).forEach(function (c) { expect(g.piece.y + c[1] >= K.HIDDEN).toBe(true); });
        E.hardDrop(g);
      }
    });

    it('spawn shifts only as far as it fits', function () {
      // O at x=3 covers cols 4-5 and rows y, y+1. The current piece is a vertical I at col 0, out of the way.
      [[3, 1], [2, 0]].forEach(function (t) {
        var g = mk(1);
        clearBoard(g);
        g.board[t[0]][4] = { charId: 'mametchi' };
        g.piece = { shape: 'I', charId: 'mametchi', x: -2, y: 0, rot: 1 };
        g.next = { shape: 'O', charId: 'kuchipatchi' };
        var ev = E.hardDrop(g);
        expect(types(ev)).toEqual(['lock', 'spawn']);
        expect(g.piece.shape).toBe('O');
        expect(g.piece.y).toBe(t[1]);
      });
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
      g.piece.y = 0;
      for (var c = 0; c < K.COLS; c++) { g.board[2][c] = { charId: 'mametchi' }; }
      var ev = E.hardDrop(g);
      expect(types(ev)).toEqual(['lock', 'over']);
      expect(g.state).toBe('over');
    });
  });

  // Row helpers for line clear tests. An I piece at x=3, y=0 lands flat on row 21 and fills cols 3-6.
  function fillSides(g, row, ids) {
    var cols = [0, 1, 2, 7, 8, 9];
    cols.forEach(function (c, i) { g.board[row][c] = { charId: ids[i] }; });
  }
  function setI(g, charId) {
    g.piece = { shape: 'I', charId: charId, x: 3, y: 0, rot: 0 };
  }
  function others(n) { var a = []; for (var i = 0; i < n; i++) { a.push('kuchipatchi'); } return a; }
  // Sets up one clear on row 21: `mine` faces of 'mametchi' among the 6 side cells, the piece is another character.
  function setupClear(g, mine) {
    clearBoard(g);
    var ids = [];
    for (var i = 0; i < 6; i++) { ids.push(i < mine ? 'mametchi' : 'kuchipatchi'); }
    fillSides(g, 21, ids);
    setI(g, 'kuchipatchi');
  }

  describe('blocks engine line clear', function () {
    it('one full row clears, waits 250ms, then collapses', function () {
      var g = mk(1);
      setupClear(g, 0);
      var ev = E.hardDrop(g);
      expect(types(ev)).toEqual(['lock', 'clear']);
      expect(ev[1].rows).toEqual([21]);
      expect(g.state).toBe('settling');
      expect(types(E.step(g, 249))).toEqual([]);
      var ev2 = E.step(g, 1);
      expect(types(ev2)).toEqual(['collapse', 'spawn']);
      expect(g.state).toBe('falling');
      expect(g.board[21].every(function (c) { return c === null; })).toBe(true);
    });

    it('a step-triggered lock also clears', function () {
      var g = mk(1);
      setupClear(g, 0);
      g.piece.y = 20;
      var ev = E.step(g, 500);
      expect(types(ev)).toEqual(['lock', 'clear']);
    });

    it('non-adjacent rows clear and cells keep their faces', function () {
      var g = mk(1);
      setupClear(g, 0);
      for (var c = 0; c < K.COLS; c++) { g.board[19][c] = { charId: 'flowertchi' }; }
      g.board[20][0] = { charId: 'mimitchi' };
      g.board[18][1] = { charId: 'mametchi' };
      g.piece.y = 20;
      var ev = E.hardDrop(g);
      expect(ev[1].rows).toEqual([19, 21]);
      E.step(g, 250);
      expect(g.board[21][0].charId).toBe('mimitchi');
      expect(g.board[20][1].charId).toBe('mametchi');
      expect(g.board[20][0]).toBe(null);
      expect(g.board[19].every(function (c2) { return c2 === null; })).toBe(true);
    });

    it("only the chosen character's faces count", function () {
      var g = mk(1);
      setupClear(g, 3);
      var ev = E.hardDrop(g);
      expect(ev[1].mine).toBe(3);
      expect(ev[1].collected).toBe(3);
      expect(g.collected).toBe(3);
      expect(g.jar).toBe(7);
      expect(ev[1].faces.length).toBe(10);
      expect(ev[1].faces.filter(function (f) { return f.mine; }).length).toBe(3);
      expect(g.lines).toBe(1);
    });

    it('almost fires once', function () {
      var g = mk(1);
      g.collected = 16;
      setupClear(g, 1);
      var ev = E.hardDrop(g);
      expect(ev[1].collected).toBe(17);
      expect(ev[1].almost).toBe(true);
      E.step(g, 250);
      setupClear(g, 1);
      var ev2 = E.hardDrop(g);
      expect(ev2[1].collected).toBe(18);
      expect(ev2[1].almost).toBe(false);
    });

    it('almost does not fire when the clear jumps straight to the goal', function () {
      var g = mk(1);
      g.collected = 11;
      setupClear(g, 6);
      var ev = E.hardDrop(g);
      expect(ev[1].collected).toBe(17);
      expect(ev[1].almost).toBe(true);
      var h = mk(1);
      h.collected = 14;
      setupClear(h, 6);
      var ev3 = E.hardDrop(h);
      expect(ev3[1].collected).toBe(20);
      expect(ev3[1].almost).toBe(false);
    });

    it('goal ends after the collapse', function () {
      var g = mk(1);
      g.collected = 19;
      setupClear(g, 1);
      var ev = E.hardDrop(g);
      expect(ev[1].almost).toBe(false);
      var ev2 = E.step(g, 250);
      expect(types(ev2)).toEqual(['collapse', 'goal']);
      expect(ev2[1].collected).toBe(20);
      expect(ev2[1].jar).toBe(g.jar);
      expect(g.state).toBe('goal');
      expect(E.step(g, 5000)).toEqual([]);
    });

    it('goal wins over a blocked spawn', function () {
      var g = mk(1);
      g.collected = 19;
      setupClear(g, 1);
      g.piece.y = 20;
      var r, c;
      for (r = 0; r < 2; r++) { for (c = 3; c <= 6; c++) { g.board[r][c] = { charId: 'mametchi' }; } }
      E.hardDrop(g);
      var ev = E.step(g, 250);
      expect(types(ev)).toEqual(['collapse', 'goal']);
      expect(g.state).toBe('goal');
    });

    it('inputs during settle do nothing', function () {
      var g = mk(1);
      setupClear(g, 0);
      E.hardDrop(g);
      expect(E.move(g, 1)).toBe(false);
      expect(E.rotate(g)).toBe(false);
      expect(E.softDrop(g)).toBe(false);
      expect(E.hardDrop(g)).toEqual([]);
    });

    it('speed rises every 4 lines down to the floor', function () {
      var g = mk(1);
      g.lines = 3;
      setupClear(g, 0);
      E.hardDrop(g);
      expect(g.lines).toBe(4);
      expect(Math.abs(g.fallMs - 650 * 0.92)).toBeLessThanOrEqual(1);
      var h = mk(1);
      h.lines = 1000;
      setupClear(h, 0);
      E.hardDrop(h);
      expect(h.fallMs).toBe(200);
    });

    it('dangerous looks at the top 4 visible rows', function () {
      var g = mk(1);
      clearBoard(g);
      expect(E.dangerous(g)).toBe(false);
      g.board[6][0] = { charId: 'mametchi' };
      expect(E.dangerous(g)).toBe(false);
      g.board[5][0] = { charId: 'mametchi' };
      expect(E.dangerous(g)).toBe(true);
    });

    it('lock wait restarts after the piece falls again', function () {
      var g = mk(1);
      clearBoard(g);
      g.piece = { shape: 'O', charId: 'mametchi', x: 3, y: 8, rot: 0 };
      g.board[10][4] = { charId: 'mametchi' };
      g.board[10][5] = { charId: 'mametchi' };
      for (var i = 0; i < 15; i++) {
        expect(hasLock(E.step(g, 499))).toBe(false);
        expect(E.move(g, i % 2 === 0 ? -1 : 1)).toBe(true);
      }
      expect(hasLock(E.step(g, 499))).toBe(false);
      expect(E.move(g, -1)).toBe(true);
      expect(E.move(g, -1)).toBe(true);
      expect(g.piece.x).toBe(0);
      expect(hasLock(E.step(g, 12 * 650))).toBe(false);
      expect(g.piece.y).toBe(20);
      expect(hasLock(E.step(g, 499))).toBe(false);
      expect(hasLock(E.step(g, 1))).toBe(true);
    });
  });
})(window.Ailand);
