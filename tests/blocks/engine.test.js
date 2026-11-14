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
      expect(g.goal).toBe(30);
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
      g.goal = 20;
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

    it('almost fires when one clear crosses into the last ALMOST', function () {
      var g = mk(1);
      g.goal = 20;
      g.collected = 11;
      setupClear(g, 6);
      var ev = E.hardDrop(g);
      expect(ev[1].collected).toBe(17);
      expect(ev[1].almost).toBe(true);
    });

    it('almost does not fire when the clear jumps straight to the goal', function () {
      var h = mk(1);
      h.goal = 20;
      h.collected = 14;
      setupClear(h, 6);
      var ev3 = E.hardDrop(h);
      expect(ev3[1].collected).toBe(20);
      expect(ev3[1].almost).toBe(false);
    });

    it('goal ends after the collapse', function () {
      var g = mk(1);
      g.goal = 20;
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
      g.goal = 20;
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

  describe('blocks engine time', function () {
    function mkd(d) { return E.create({ difficulty: d, selfId: 'mametchi', seed: 1 }); }
    it('create sets timeMs and goal per difficulty', function () {
      var want = { easy: [180000, 15], normal: [150000, 30], hard: [120000, 50] };
      Object.keys(want).forEach(function (d) {
        var g = mkd(d);
        expect(g.timeMs).toBe(want[d][0]);
        expect(g.goal).toBe(want[d][1]);
        expect(g.overReason).toBe(null);
      });
    });

    it('step lowers timeMs while falling', function () {
      var g = mk(1);
      E.step(g, 1000);
      expect(g.timeMs).toBe(149000);
    });

    it('own faces add faceMs after the clear event', function () {
      ['normal', 'hard'].forEach(function (d) {
        var g = mkd(d);
        setupClear(g, 3);
        var ev = E.hardDrop(g);
        expect(types(ev)).toEqual(['lock', 'clear', 'time']);
        expect(ev[2].addMs).toBe(d === 'normal' ? 9000 : 6000);
        expect(g.timeMs).toBe(K.DIFFICULTY[d].timeMs + ev[2].addMs);
      });
    });

    it('a clear without own faces emits no time event', function () {
      var g = mk(1);
      setupClear(g, 0);
      expect(types(E.hardDrop(g))).toEqual(['lock', 'clear']);
    });

    it('running out of time while falling ends the game', function () {
      var g = mk(1);
      g.timeMs = 500;
      var ev = E.step(g, 600);
      expect(g.state).toBe('over');
      expect(g.overReason).toBe('timeup');
      expect(g.timeMs).toBe(0);
      expect(ev[ev.length - 1]).toEqual({ type: 'over', reason: 'timeup' });
    });

    it('blocked spawn gives reason blocked', function () {
      var g = mk(1);
      toFloor(g);
      var r, c;
      for (r = 0; r < 2; r++) { for (c = 3; c <= 6; c++) { g.board[r][c] = { charId: 'mametchi' }; } }
      var ev = E.hardDrop(g);
      expect(ev[ev.length - 1]).toEqual({ type: 'over', reason: 'blocked' });
      expect(g.overReason).toBe('blocked');
    });

    it('goal wins over time up while settling', function () {
      var g = mk(1);
      setupClear(g, 1);
      g.goal = g.collected + 1;
      E.hardDrop(g);
      g.timeMs = 100;
      var ev = E.step(g, 300);
      expect(g.timeMs).toBe(0);
      expect(g.state).toBe('goal');
      expect(types(ev)).toEqual(['collapse', 'goal']);
    });

    it('time up at the end of a settle without the goal ends the game', function () {
      var g = mk(1);
      setupClear(g, 0);
      E.hardDrop(g);
      g.timeMs = 100;
      var ev = E.step(g, 300);
      expect(g.state).toBe('over');
      expect(g.overReason).toBe('timeup');
      expect(types(ev)).toEqual(['collapse', 'over']);
      expect(ev[1].reason).toBe('timeup');
    });
  });

  describe('blocks engine star', function () {
    // Every drawn piece in order (first piece, next, then each new next), with its star.
    function drawnStars(g, n) {
      var seq = [g.piece, g.next];
      while (seq.length < n) {
        clearBoard(g);
        E.hardDrop(g);
        seq.push(g.next);
      }
      return seq.map(function (p) { return { shape: p.shape, charId: p.charId, star: p.star }; });
    }
    // A vertical I that lands in col 9 (I at rot 1 sits in box col 2).
    function setI9(g) {
      g.piece = { shape: 'I', charId: 'kuchipatchi', x: 7, y: 0, rot: 1, star: null };
    }

    it('star pieces come every 12 to 18 draws', function () {
      var seq = drawnStars(mk(3), 200);
      var at = [];
      seq.forEach(function (p, i) {
        if (p.star !== null) {
          expect(p.star >= 0 && p.star <= 3).toBe(true);
          at.push(i + 1);
        }
      });
      expect(at.length).toBeGreaterThanOrEqual(10);
      expect(at[0]).toBeLessThanOrEqual(18);
      for (var i = 1; i < at.length; i++) {
        expect(at[i] - at[i - 1]).toBeGreaterThanOrEqual(12);
        expect(at[i] - at[i - 1]).toBeLessThanOrEqual(18);
      }
    });

    it('star rolls do not change the shapes and characters', function () {
      var rng = A.core.Rng.mulberry32(11);
      var sb = E.createBag(rng, P.SHAPES);
      var cb = E.createBag(rng, CHARS);
      var want = [];
      for (var i = 0; i < 28; i++) { want.push(sb.next() + cb.next()); }
      expect(drawnStars(mk(11), 28).map(function (p) { return p.shape + p.charId; })).toEqual(want);
    });

    it('lock writes star only on the star cell', function () {
      var g = mk(1);
      clearBoard(g);
      g.piece = { shape: 'T', charId: 'mimitchi', x: 4, y: 2, rot: 1, star: 2 };
      var y = E.ghostY(g);
      var sc = P.cells('T', 1)[2];
      E.hardDrop(g);
      var stars = [];
      g.board.forEach(function (row, r) {
        row.forEach(function (cell, c) { if (cell && cell.star) { stars.push([c, r]); } });
      });
      expect(stars).toEqual([[4 + sc[0], y + sc[1]]]);
      expect(g.board[y + sc[1]][4 + sc[0]]).toEqual({ charId: 'mimitchi', star: true });
    });

    it('a star clear collects every own face and collapses their columns', function () {
      var g = mk(1);
      clearBoard(g);
      fillSides(g, 21, ['mametchi', 'kuchipatchi', 'kuchipatchi', 'kuchipatchi', 'kuchipatchi', 'kuchipatchi']);
      g.board[20][0] = { charId: 'kuchipatchi' };
      g.board[19][0] = { charId: 'mimitchi' };
      g.board[18][0] = { charId: 'mametchi' };
      g.board[17][0] = { charId: 'flowertchi' };
      g.board[20][8] = { charId: 'mametchi' };
      g.piece = { shape: 'I', charId: 'kuchipatchi', x: 3, y: 0, rot: 0, star: 1 };
      var ev = E.hardDrop(g);
      expect(types(ev)).toEqual(['lock', 'clear', 'time']);
      expect(ev[1].star).toBe(true);
      expect(g.collected).toBe(1);
      var t0 = g.timeMs;
      var ev2 = E.step(g, K.SETTLE_MS);
      expect(types(ev2)).toEqual(['collapse', 'star', 'time']);
      expect(ev2[0].rows).toEqual([21]);
      expect(ev2[1].faces).toEqual([
        { col: 0, row: 19, charId: 'mametchi', mine: true },
        { col: 8, row: 21, charId: 'mametchi', mine: true }
      ]);
      expect(ev2[1].collected).toBe(3);
      expect(ev2[2].addMs).toBe(15000 + 2 * 3000);
      expect(g.timeMs).toBe(t0 - K.SETTLE_MS + 21000);
      expect(g.state).toBe('settling');
      expect(types(E.step(g, K.STAR_SETTLE_MS - 1))).toEqual([]);
      var ev3 = E.step(g, 1);
      expect(types(ev3)).toEqual(['collapse', 'spawn']);
      expect(ev3[0].cells).toEqual([[0, 19], [8, 21]]);
      // flowertchi was above the removed face (row 18 after the row collapse) and moves down 1.
      expect(g.board[19][0].charId).toBe('flowertchi');
      expect(g.board[18][0]).toBe(null);
      // mimitchi was below the removed face: shifted by the row collapse only (19 -> 20).
      expect(g.board[20][0].charId).toBe('mimitchi');
      expect(g.board[21][0].charId).toBe('kuchipatchi');
      expect(g.board[21][8]).toBe(null);
      expect(g.collected).toBe(3);
      expect(g.state).toBe('falling');
    });

    it('a star removal that fills a row clears it as a chain', function () {
      var g = mk(1);
      clearBoard(g);
      fillSides(g, 21, others(6));
      g.board[20][0] = { charId: 'mametchi' };
      for (var c = 1; c < K.COLS; c++) { g.board[19][c] = { charId: 'kuchipatchi' }; }
      g.board[18][0] = { charId: 'kuchipatchi' };
      // The I goes straight to row 21 under the row 19 overhang.
      g.piece = { shape: 'I', charId: 'kuchipatchi', x: 3, y: 20, rot: 0, star: 0 };
      E.hardDrop(g);
      expect(types(E.step(g, K.SETTLE_MS))).toEqual(['collapse', 'star', 'time']);
      var ev = E.step(g, K.STAR_SETTLE_MS);
      expect(types(ev)).toEqual(['collapse', 'clear']);
      expect(ev[0].cells).toEqual([[0, 21]]);
      expect(ev[1].rows).toEqual([20]);
      expect(ev[1].star).toBe(false);
      expect(types(E.step(g, K.SETTLE_MS))).toEqual(['collapse', 'spawn']);
    });

    it('a star cell left on the board fires on the next clear of its row', function () {
      var g = mk(1);
      clearBoard(g);
      g.piece = { shape: 'I', charId: 'kuchipatchi', x: 3, y: 0, rot: 0, star: 3 };
      var ev = E.hardDrop(g);
      expect(types(ev)).toEqual(['lock', 'spawn']);
      expect(g.board[21][6]).toEqual({ charId: 'kuchipatchi', star: true });
      [0, 1, 2, 7, 8].forEach(function (c) { g.board[21][c] = { charId: c === 0 ? 'mametchi' : 'kuchipatchi' }; });
      setI9(g);
      var ev2 = E.hardDrop(g);
      expect(types(ev2)).toEqual(['lock', 'clear', 'time']);
      expect(ev2[1].star).toBe(true);
      expect(types(E.step(g, K.SETTLE_MS))).toEqual(['collapse', 'star', 'time']);
    });

    it('two stars in one clear fire one star event', function () {
      var g = mk(1);
      clearBoard(g);
      for (var r = 20; r <= 21; r++) {
        for (var c = 0; c < 9; c++) { g.board[r][c] = { charId: 'kuchipatchi' }; }
      }
      g.board[21][1] = { charId: 'kuchipatchi', star: true };
      g.board[20][4] = { charId: 'kuchipatchi', star: true };
      g.board[19][2] = { charId: 'mametchi' };
      setI9(g);
      E.hardDrop(g);
      var all = E.step(g, K.SETTLE_MS).concat(E.step(g, K.STAR_SETTLE_MS));
      expect(types(all)).toEqual(['collapse', 'star', 'time', 'collapse', 'spawn']);
    });

    it('a star clear that reaches the goal ends with goal and no star', function () {
      var g = mk(1);
      clearBoard(g);
      fillSides(g, 21, ['mametchi'].concat(others(5)));
      g.board[20][8] = { charId: 'mametchi' };
      g.goal = 1;
      g.piece = { shape: 'I', charId: 'kuchipatchi', x: 3, y: 0, rot: 0, star: 0 };
      E.hardDrop(g);
      var ev = E.step(g, K.SETTLE_MS);
      expect(types(ev)).toEqual(['collapse', 'goal']);
      expect(g.state).toBe('goal');
    });

    // The row 21 clear collects 1 own face (col 0); the star wave then finds 2 more (both on row 21 after the collapse).
    function starWave(g) {
      clearBoard(g);
      fillSides(g, 21, ['mametchi'].concat(others(5)));
      g.board[20][0] = { charId: 'mametchi' };
      g.board[20][8] = { charId: 'mametchi' };
      g.piece = { shape: 'I', charId: 'kuchipatchi', x: 3, y: 0, rot: 0, star: 1 };
    }

    it('a star wave that reaches the goal ends with goal, even at 0 time', function () {
      var g = mk(1);
      starWave(g);
      g.goal = 3;
      var ev = E.hardDrop(g);
      expect(ev[1].collected).toBe(1);
      expect(types(E.step(g, K.SETTLE_MS))).toEqual(['collapse', 'star', 'time']);
      expect(g.collected).toBe(3);
      g.timeMs = 100;   // runs out during the star settle
      var ev2 = E.step(g, K.STAR_SETTLE_MS);
      expect(g.timeMs).toBe(0);
      expect(types(ev2)).toEqual(['collapse', 'goal']);
      expect(ev2[1].collected).toBe(3);
      expect(g.state).toBe('goal');
      expect(g.overReason).toBe(null);
    });

    it('a star wave that leaves ALMOST or fewer raises almost once', function () {
      var g = mk(1);
      starWave(g);
      g.goal = 5;   // 4 left after the row clear, 2 after the star
      var ev = E.hardDrop(g);
      expect(ev[1].almost).toBe(false);
      var ev2 = E.step(g, K.SETTLE_MS);
      expect(ev2[1].type).toBe('star');
      expect(ev2[1].collected).toBe(3);
      expect(ev2[1].almost).toBe(true);
      var h = mk(1);
      starWave(h);
      h.goal = 5;
      h._almostDone = true;   // already said by an earlier clear
      E.hardDrop(h);
      expect(E.step(h, K.SETTLE_MS)[1].almost).toBe(false);
    });

    it('a star wave leaves own faces that carry a star', function () {
      var g = mk(1);
      starWave(g);
      g.board[20][8] = { charId: 'mametchi', star: true };
      E.hardDrop(g);
      var ev = E.step(g, K.SETTLE_MS);
      expect(ev[1].faces).toEqual([{ col: 0, row: 21, charId: 'mametchi', mine: true }]);
      expect(g.collected).toBe(2);
      E.step(g, K.STAR_SETTLE_MS);
      expect(g.board[21][8]).toEqual({ charId: 'mametchi', star: true });
    });
  });

  describe('blocks engine challenge', function () {
    function mkc(best, seed) { return E.create({ difficulty: 'normal', selfId: 'mametchi', seed: seed === undefined ? 1 : seed, mode: 'challenge', best: best }); }
    function starSetup(g) {
      clearBoard(g);
      fillSides(g, 21, ['mametchi', 'kuchipatchi', 'kuchipatchi', 'kuchipatchi', 'kuchipatchi', 'kuchipatchi']);
      g.board[20][0] = { charId: 'kuchipatchi' };
      g.board[19][0] = { charId: 'mimitchi' };
      g.board[18][0] = { charId: 'mametchi' };
      g.board[17][0] = { charId: 'flowertchi' };
      g.board[20][8] = { charId: 'mametchi' };
      g.piece = { shape: 'I', charId: 'kuchipatchi', x: 3, y: 0, rot: 0, star: 1 };
    }

    it('create without mode is collect with goal, time and best 0', function () {
      var g = mk(1);
      expect(g.mode).toBe('collect');
      expect(g.goal).toBe(30);
      expect(g.timeMs).toBe(150000);
      expect(g.best).toBe(0);
    });

    it('best defaults to 0 for a non-number or negative value', function () {
      expect(mkc(undefined).best).toBe(0);
      expect(mkc('7').best).toBe(0);
      expect(mkc(-3).best).toBe(0);
      expect(mkc(7).best).toBe(7);
    });

    it('challenge has no goal and a 3 minute clock for every difficulty', function () {
      ['easy', 'normal', 'hard'].forEach(function (d) {
        var g = E.create({ difficulty: d, selfId: 'mametchi', seed: 1, mode: 'challenge', best: 0 });
        expect(g.mode).toBe('challenge');
        expect(g.goal).toBe(null);
        expect(g.timeMs).toBe(180000);
        expect(g.elapsedMs).toBe(0);
      });
    });

    it('step lowers the clock and raises elapsedMs while falling (both modes)', function () {
      var g = mkc(0);
      E.step(g, 1000);
      expect(g.timeMs).toBe(179000);
      expect(g.elapsedMs).toBe(1000);
      var c = mk(1);
      E.step(c, 1000);
      expect(c.timeMs).toBe(149000);
      expect(c.elapsedMs).toBe(1000);
    });

    it('a collect clear that adds time leaves elapsedMs alone', function () {
      var g = mk(1);
      setupClear(g, 2);
      E.hardDrop(g);
      expect(g.elapsedMs).toBe(0);
    });

    it('challenge faces and star wave add no time and emit no time event', function () {
      var g = mkc(0);
      setupClear(g, 2);
      expect(types(E.hardDrop(g))).toEqual(['lock', 'clear']);
      expect(g.timeMs).toBe(180000);
      var s = mkc(0);
      starSetup(s);
      E.hardDrop(s);
      var ev = E.step(s, K.SETTLE_MS);
      expect(types(ev)).toEqual(['collapse', 'star']);
      expect(s.timeMs).toBe(180000 - K.SETTLE_MS);
    });

    it('challenge running out of time while falling ends the game', function () {
      var g = mkc(0);
      g.timeMs = 500;
      var ev = E.step(g, 600);
      expect(g.state).toBe('over');
      expect(g.overReason).toBe('timeup');
      expect(ev[ev.length - 1]).toEqual({ type: 'over', reason: 'timeup' });
    });

    it('challenge clear in progress counts, then time up', function () {
      var g = mkc(0);
      setupClear(g, 2);
      E.hardDrop(g);
      g.timeMs = 100;
      var ev = E.step(g, 300);
      expect(g.collected).toBe(2);
      expect(g.state).toBe('over');
      expect(types(ev)).toEqual(['collapse', 'over']);
      expect(ev[1].reason).toBe('timeup');
    });

    it('a clear adds the own faces, emits no time and never reaches goal', function () {
      var g = mkc(0);
      setupClear(g, 2);
      g.collected = 999;
      var ev = E.hardDrop(g);
      expect(types(ev)).toEqual(['lock', 'clear']);
      expect(g.collected).toBe(1001);
      expect(types(E.step(g, K.SETTLE_MS))).toEqual(['collapse', 'spawn']);
      expect(g.state).toBe('falling');
    });

    it('a star clear emits star with no time and counts the faces', function () {
      var g = mkc(0);
      starSetup(g);
      expect(types(E.hardDrop(g))).toEqual(['lock', 'clear']);
      var ev = E.step(g, K.SETTLE_MS);
      expect(types(ev)).toEqual(['collapse', 'star']);
      expect(g.collected).toBe(3);
    });

    it('locking into the hidden rows is over blocked', function () {
      var g = mkc(0);
      g.piece.shape = 'I';
      g.piece.y = 0;
      for (var c = 0; c < K.COLS; c++) { g.board[2][c] = { charId: 'mametchi' }; }
      var ev = E.hardDrop(g);
      expect(g.state).toBe('over');
      expect(g.overReason).toBe('blocked');
      expect(types(ev)).toContain('over');
    });

    it('beating the best emits record once after clear', function () {
      var g = mkc(5);
      g.collected = 4;
      setupClear(g, 2);
      var ev = E.hardDrop(g);
      expect(types(ev)).toEqual(['lock', 'clear', 'record']);
      expect(ev[2]).toEqual({ type: 'record', collected: 6, viaStar: false });
      E.step(g, K.SETTLE_MS);
      setupClear(g, 2);
      expect(types(E.hardDrop(g))).toEqual(['lock', 'clear']);
    });

    it('almost uses best as the target', function () {
      var g = mkc(5);
      g.collected = 1;
      setupClear(g, 1);
      var ev = E.hardDrop(g);
      expect(ev[1].almost).toBe(true);
      expect(types(ev)).toEqual(['lock', 'clear']);
      var g2 = mkc(5);
      g2.collected = 1;
      setupClear(g2, 5);
      var ev2 = E.hardDrop(g2);
      expect(ev2[1].almost).toBe(false);
      expect(types(ev2)).toEqual(['lock', 'clear', 'record']);
    });

    it('best 0 never gives almost or record', function () {
      var g = mkc(0);
      setupClear(g, 3);
      var ev = E.hardDrop(g);
      expect(ev[1].almost).toBe(false);
      expect(types(ev)).toEqual(['lock', 'clear']);
    });

    it('a record from the star wave has viaStar after the star event', function () {
      var g = mkc(2);
      starSetup(g);
      expect(types(E.hardDrop(g))).toEqual(['lock', 'clear']);
      var ev = E.step(g, K.SETTLE_MS);
      expect(types(ev)).toEqual(['collapse', 'star', 'record']);
      expect(ev[2]).toEqual({ type: 'record', collected: 3, viaStar: true });
    });

    it('a star row that first passes the best leaves the record to the star wave', function () {
      var g = mkc(1);
      starSetup(g);
      g.board[21][1] = { charId: 'mametchi' };   // the star row now holds 2 own faces: collected 2 > best 1
      var ev = E.hardDrop(g);
      expect(types(ev)).toEqual(['lock', 'clear']);
      expect(ev[1].star).toBe(true);
      expect(ev[1].collected).toBe(2);
      var ev2 = E.step(g, K.SETTLE_MS);
      expect(types(ev2)).toEqual(['collapse', 'star', 'record']);
      expect(ev2[2].viaStar).toBe(true);
      expect(ev2[2].collected).toBe(ev2[1].collected);
    });

    it('collect mode never emits record', function () {
      var g = mk(1);
      g.collected = 4;
      setupClear(g, 2);
      expect(types(E.hardDrop(g))).toEqual(['lock', 'clear', 'time']);
    });
  });
})(window.Ailand);
