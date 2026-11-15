(function (A) {
  'use strict';
  var describe = A.Test.describe, it = A.Test.it, expect = A.Test.expect;
  var E = A.games.chain.Engine;
  var K = A.games.chain.Constants;
  var CHARS = K.CHARS;
  var DIFFS = ['easy', 'normal', 'hard'];

  function mk(seed, diff) { return E.create({ difficulty: diff || 'normal', seed: seed === undefined ? 1 : seed }); }
  function types(events) { return events.map(function (e) { return e.type; }); }
  function clearBoard(g) {
    g.board.forEach(function (row) { for (var c = 0; c < K.COLS; c++) { row[c] = null; } });
  }
  function ball(id) { return { kind: 'ball', charId: id }; }
  // Fills rows fromRow..bottom of a column with balls.
  function fillCol(g, col, fromRow, id) {
    for (var r = fromRow; r < K.ROWS + K.HIDDEN; r++) { g.board[r][col] = ball(id || 'mimitchi'); }
  }

  describe('chain engine bag', function () {
    it('the bag gives each colour twice per 8', function () {
      var bag = E.createBag(A.core.Rng.mulberry32(5), CHARS.concat(CHARS));
      var got = [];
      var i;
      for (i = 0; i < 32; i++) { got.push(bag.next()); }
      for (i = 0; i < 4; i++) {
        var group = got.slice(i * 8, i * 8 + 8);
        CHARS.forEach(function (c) {
          expect(group.filter(function (x) { return x === c; }).length).toBe(2);
        });
      }
    });

    it('same seed gives the same pairs and the same first board', function () {
      function key(seed) {
        var g = mk(seed, 'hard');
        var first = JSON.stringify(g.board);
        var seq = [g.pair.axis, g.pair.child, g.next.axis, g.next.child];
        for (var i = 0; i < 4; i++) {
          clearBoard(g);
          E.hardDrop(g);
          E.step(g, 1000);
          seq.push(g.next.axis, g.next.child);
        }
        return first + seq.join();
      }
      expect(key(7)).toBe(key(7));
      expect(key(7) === key(8)).toBe(false);
    });
  });

  describe('chain engine first board', function () {
    it('first board follows the rules', function () {
      DIFFS.forEach(function (d) {
        for (var seed = 1; seed <= 20; seed++) {
          var g = mk(seed, d);
          var count = 0;
          var perCol = [0, 0, 0, 0, 0, 0];
          for (var r = 0; r < K.ROWS + K.HIDDEN; r++) {
            for (var c = 0; c < K.COLS; c++) {
              var cell = g.board[r][c];
              if (cell === null) { continue; }
              expect(cell.kind).toBe('sleep');
              expect(CHARS.indexOf(cell.charId) >= 0).toBe(true);
              count++;
              perCol[c]++;
              if (r < K.ROWS + K.HIDDEN - 1) { expect(g.board[r + 1][c] !== null).toBe(true); }
            }
          }
          expect(count).toBe(K.DIFFICULTY[d].sleepers);
          expect(g.sleepers).toBe(K.DIFFICULTY[d].sleepers);
          expect(perCol[K.SPAWN_X]).toBe(0);
          perCol.forEach(function (n) { expect(n <= K.MAX_PER_COLUMN).toBe(true); });
        }
      });
    });

    it('create spawns the first pair at the spawn cell', function () {
      var g = mk(3);
      expect(g.pair.x).toBe(K.SPAWN_X);
      expect(g.pair.y).toBe(K.SPAWN_Y);
      expect(g.pair.rot).toBe(0);
      expect(g.state).toBe('falling');
      expect(g.fallMs).toBe(K.DIFFICULTY.normal.fallMs);
      expect(g.timeMs).toBe(K.DIFFICULTY.normal.timeMs);
      expect(g.woke).toBe(0);
      expect(g.chain).toBe(0);
    });
  });

  describe('chain engine movement', function () {
    it('move stops at walls', function () {
      var g = mk(1);
      clearBoard(g);
      var i;
      for (i = 0; i < 10; i++) { E.move(g, -1); }
      expect(g.pair.x).toBe(0);
      expect(E.move(g, -1)).toBe(false);
      for (i = 0; i < 10; i++) { E.move(g, 1); }
      expect(g.pair.x).toBe(K.COLS - 1);
      expect(E.move(g, 1)).toBe(false);
    });

    it('rotate turns clockwise and kicks off a wall', function () {
      var g = mk(1);
      clearBoard(g);
      expect(E.rotate(g)).toBe(true);
      expect(g.pair.rot).toBe(1);
      g.pair.x = K.COLS - 1;
      g.pair.rot = 0;
      expect(E.rotate(g)).toBe(true);
      expect(g.pair.x).toBe(K.COLS - 2);
      expect(g.pair.rot).toBe(1);
    });

    it('gravity drops one row per fallMs', function () {
      var g = mk(1);
      clearBoard(g);
      var y0 = g.pair.y;
      E.step(g, g.fallMs - 1);
      expect(g.pair.y).toBe(y0);
      E.step(g, 1);
      expect(g.pair.y).toBe(y0 + 1);
      E.step(g, g.fallMs * 2);
      expect(g.pair.y).toBe(y0 + 3);
    });

    it('softDrop moves one row and returns false on the floor', function () {
      var g = mk(1);
      clearBoard(g);
      var y0 = g.pair.y;
      expect(E.softDrop(g)).toBe(true);
      expect(g.pair.y).toBe(y0 + 1);
      while (E.softDrop(g)) { /* drop to the floor */ }
      expect(g.pair.y).toBe(K.ROWS + K.HIDDEN - 1);
      expect(E.softDrop(g)).toBe(false);
    });

    it('lock after 500ms and reset up to 15 times', function () {
      var g = mk(1);
      clearBoard(g);
      while (E.softDrop(g)) { /* floor */ }
      var ev = E.step(g, K.LOCK_MS - 1);
      expect(types(ev).indexOf('lock')).toBe(-1);
      // each move while resting on the floor restarts the wait, up to LOCK_RESETS times
      for (var i = 0; i < K.LOCK_RESETS; i++) {
        expect(E.move(g, i % 2 === 0 ? -1 : 1)).toBe(true);
        ev = E.step(g, K.LOCK_MS - 10);
        expect(types(ev).indexOf('lock')).toBe(-1);
      }
      // the budget is used up: this move no longer restarts the wait
      expect(E.move(g, -1)).toBe(true);
      ev = E.step(g, 10);
      expect(types(ev)[0]).toBe('lock');
    });

    it('hardDrop locks at once and matches the ghost', function () {
      var g = mk(2);
      clearBoard(g);
      fillCol(g, K.SPAWN_X, 9);
      var ghost = E.ghost(g);
      var ev = E.hardDrop(g);
      expect(ev[0].type).toBe('lock');
      var key = function (c) { return c.col + ',' + c.row + ',' + c.charId; };
      expect(ev[0].cells.map(key).sort()).toEqual(ghost.map(key).sort());
      expect(ghost.map(function (c) { return c.row; }).sort()).toEqual([7, 8]);
    });
  });

  describe('chain engine settle', function () {
    it('split: only the unsupported ball falls', function () {
      var g = mk(1);
      clearBoard(g);
      fillCol(g, 3, 11);            // col 3 has height 2 (rows 11, 12), col 2 is empty
      g.pair.rot = 1;               // axis at col 2, child at col 3
      g.pair.x = 2;
      var ev = E.hardDrop(g);
      expect(ev[0].type).toBe('lock');
      expect(ev[1].type).toBe('fall');
      expect(ev[1].moves.length).toBe(1);
      var m = ev[1].moves[0];
      expect(m.from[0]).toBe(2);
      expect(m.to).toEqual([2, 12]);
      expect(m.kind).toBe('ball');
      expect(g.board[12][2].charId).toBe(m.charId);
      expect(g.state).toBe('settling');
      var wait = (m.to[1] - m.from[1]) * K.FALL_CELL_MS;
      expect(types(E.step(g, wait - 1))).toEqual([]);
      expect(types(E.step(g, 1))).toEqual(['spawn']);
      expect(g.state).toBe('falling');
    });

    it('a ball locked in the hidden row stays', function () {
      var g = mk(1);
      clearBoard(g);
      fillCol(g, 0, 2);
      E.move(g, -1);
      E.move(g, -1);
      expect(g.pair.x).toBe(0);
      E.hardDrop(g);
      E.step(g, 1000);
      expect(g.board[0][0].kind).toBe('ball');
      expect(g.board[1][0].kind).toBe('ball');
      expect(g.state).toBe('falling');
    });

    it('blocked spawn ends the game', function () {
      var g = mk(1);
      clearBoard(g);
      fillCol(g, K.SPAWN_X, 2);
      var ev = E.hardDrop(g).concat(E.step(g, 1000));
      expect(ev[ev.length - 1]).toEqual({ type: 'over', reason: 'blocked' });
      expect(g.state).toBe('over');
      expect(g.overReason).toBe('blocked');
      expect(E.move(g, 1)).toBe(false);
      expect(E.step(g, 1000)).toEqual([]);
    });

    it('dangerous when the spawn column is high', function () {
      var g = mk(1);
      clearBoard(g);
      expect(E.dangerous(g)).toBe(false);
      g.board[K.DANGER_ROWS + 1][K.SPAWN_X] = ball('mimitchi');
      expect(E.dangerous(g)).toBe(false);
      g.board[K.DANGER_ROWS][K.SPAWN_X] = ball('mimitchi');
      expect(E.dangerous(g)).toBe(true);
      g.board[K.DANGER_ROWS][K.SPAWN_X] = null;
      g.board[1][K.SPAWN_X] = ball('mimitchi');
      expect(E.dangerous(g)).toBe(true);
      g.board[1][K.SPAWN_X] = null;
      g.board[0][K.SPAWN_X] = ball('mimitchi');
      expect(E.dangerous(g)).toBe(false);
    });
  });
})(Ailand);
