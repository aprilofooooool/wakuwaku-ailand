(function (A) {
  'use strict';
  var describe = A.Test.describe, it = A.Test.it, expect = A.Test.expect;
  var E = A.games.chain.Engine;
  var K = A.games.chain.Constants;
  var CHARS = K.CHARS;
  var DIFFS = ['easy', 'normal', 'hard'];

  function mk(seed, diff) { return E.create({ difficulty: diff || 'normal', seed: seed === undefined ? 1 : seed }); }
  function types(events) { return events.map(function (e) { return e.type; }); }
  function ball(id) { return { kind: 'ball', charId: id }; }
  function sleep(id) { return { kind: 'sleep', charId: id }; }
  // Empties the board but keeps one sleeper in the bottom-right corner so the game does not clear.
  function clearBoard(g) {
    g.board.forEach(function (row) { for (var c = 0; c < K.COLS; c++) { row[c] = null; } });
    g.board[K.ROWS + K.HIDDEN - 1][K.COLS - 1] = sleep('mametchi');
    g.sleepers = 1;
  }
  // Fills rows fromRow..bottom of a column with balls of two alternating colours (never a group).
  function fillCol(g, col, fromRow) {
    for (var r = fromRow; r < K.ROWS + K.HIDDEN; r++) { g.board[r][col] = ball(r % 2 === 0 ? 'mimitchi' : 'flowertchi'); }
  }
  // Letters for layout(): lower case = ball, upper case = sleeper, '.' = empty.
  var LETTERS = { m: 'mametchi', k: 'kuchipatchi', i: 'mimitchi', f: 'flowertchi' };
  // Empties the board and writes `lines` onto the bottom rows. Keeps g.sleepers in step with the board.
  function layout(g, lines) {
    g.board.forEach(function (row) { for (var c = 0; c < K.COLS; c++) { row[c] = null; } });
    g.sleepers = 0;
    var top = K.ROWS + K.HIDDEN - lines.length;
    lines.forEach(function (line, i) {
      for (var c = 0; c < K.COLS; c++) {
        var ch = line.charAt(c);
        if (ch === '.') { continue; }
        var low = ch.toLowerCase();
        g.board[top + i][c] = low === ch ? ball(LETTERS[low]) : sleep(LETTERS[low]);
        if (low !== ch) { g.sleepers++; }
      }
    });
  }
  // Hard-drops a pair at column x (rot 0 = child above the axis).
  function drop(g, x, axis, child) {
    g.pair = { x: x, y: K.SPAWN_Y, rot: 0, axis: LETTERS[axis], child: LETTERS[child] };
    return E.hardDrop(g);
  }
  // Steps the game in `ms` slices until the settle ends; returns the events.
  function run(g, ms) {
    var ev = [];
    var guard = 0;
    while (g.state === 'settling' && guard++ < 10000) { ev = ev.concat(E.step(g, ms || 10)); }
    return ev;
  }
  function find(ev, type) { return ev.filter(function (e) { return e.type === type; }); }
  function cellKey(c) { return c.col + ',' + c.row + ',' + c.charId; }

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
      expect(types(E.step(g, 1))).toEqual(['settled', 'spawn']);
      expect(g.state).toBe('falling');
    });

    it('a ball locked in the hidden row stays but never pops', function () {
      var g = mk(1);
      clearBoard(g);
      fillCol(g, 0, 2);
      // rows 1..3 become 3 visible mametchi; the 4th mametchi sits in the hidden row 0
      g.board[2][0] = ball('mametchi');
      g.board[3][0] = ball('mametchi');
      g.pair.axis = 'mametchi';
      g.pair.child = 'mametchi';
      E.move(g, -1);
      E.move(g, -1);
      expect(g.pair.x).toBe(0);
      var ev = E.hardDrop(g).concat(E.step(g, 1000));
      expect(find(ev, 'pop').length).toBe(0);
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

  describe('chain engine pop and wake', function () {
    it('four connected pop, three do not, diagonals do not', function () {
      var g = mk(1);
      layout(g, [
        'k.i...',
        'k..i..',
        'k...i.',
        'mmmm.i'
      ]);
      var gs = E.groups(g.board);
      expect(gs.length).toBe(1);
      expect(gs[0].charId).toBe('mametchi');
      expect(gs[0].cells.map(function (c) { return c.join(); }).sort()).toEqual(['0,12', '1,12', '2,12', '3,12']);
    });

    it('sleepers never join a group', function () {
      var g = mk(1);
      layout(g, ['mmmM..']);
      expect(E.groups(g.board)).toEqual([]);
    });

    it('two groups pop together', function () {
      var g = mk(1);
      layout(g, [
        '....k.',
        'mmm.kk'
      ]);
      var ev = drop(g, 3, 'm', 'k').concat(run(g));
      var pops = find(ev, 'pop');
      expect(pops.length).toBe(1);
      expect(pops[0].chain).toBe(1);
      expect(pops[0].cells.length).toBe(8);
    });

    it('a pop wakes adjacent sleepers of any colour, not diagonal ones', function () {
      var g = mk(1);
      layout(g, [
        'FK..I.',
        'mmm.K.'
      ]);
      var ev = drop(g, 3, 'm', 'k').concat(run(g));
      var wakes = find(ev, 'wake');
      expect(wakes.length).toBe(1);
      expect(wakes[0].cells.map(cellKey).sort()).toEqual(['0,11,flowertchi', '1,11,kuchipatchi', '4,12,kuchipatchi']);
      expect(wakes[0].left).toBe(1);
      expect(g.sleepers).toBe(1);
      expect(g.woke).toBe(3);
      expect(g.board[12][4]).toEqual(sleep('mimitchi'));
    });

    it('wake frees the cell and things above fall', function () {
      var g = mk(1);
      layout(g, [
        '....m.',
        '....F.',
        '....K.',
        'kkk.I.'
      ]);
      var ev = drop(g, 3, 'k', 'm').concat(run(g));
      var moves = [];
      find(ev, 'fall').forEach(function (e) { moves = moves.concat(e.moves); });
      var sleepMove = moves.filter(function (m) { return m.from[0] === 4 && m.from[1] === 11; })[0];
      expect(sleepMove.to).toEqual([4, 12]);
      expect(sleepMove.kind).toBe('sleep');
      expect(g.board[12][4]).toEqual(sleep('kuchipatchi'));
      expect(g.board[11][4]).toEqual(sleep('flowertchi'));
      expect(g.board[10][4]).toEqual(ball('mametchi'));
      expect(g.board[9][4]).toBe(null);
      expect(g.sleepers).toBe(2);
    });

    it('waking can trigger a chain', function () {
      var g = mk(1);
      layout(g, [
        'F...i.',
        'f...i.',
        'kkk.Mi'
      ]);
      var ev = drop(g, 3, 'k', 'i').concat(run(g));
      expect(find(ev, 'pop').map(function (e) { return e.chain; })).toEqual([1, 2]);
      var settled = find(ev, 'settled');
      expect(settled.length).toBe(1);
      expect(settled[0].chain).toBe(2);
      expect(settled[0].woke).toBe(1);
      expect(g.state).toBe('falling');
      // the next lock counts from 1 again
      g.board[12][1] = ball('mametchi');
      g.board[12][2] = ball('mametchi');
      g.board[12][3] = ball('mametchi');
      var ev2 = drop(g, 4, 'm', 'k');
      expect(g.chain).toBe(1);
      ev2 = ev2.concat(run(g));
      expect(find(ev2, 'pop').map(function (e) { return e.chain; })).toEqual([1]);
    });

    it('waking adds time and counts', function () {
      var g = mk(1);
      layout(g, [
        'F....K',
        'kkk.Kf'
      ]);
      var before = g.timeMs + g.elapsedMs;
      var ev = drop(g, 3, 'k', 'm').concat(run(g));
      var times = find(ev, 'time');
      expect(times.length).toBe(1);
      expect(times[0].addMs).toBe(2 * K.DIFFICULTY.normal.wakeMs);
      expect(g.woke).toBe(2);
      expect(g.timeMs + g.elapsedMs).toBe(before + 2 * K.DIFFICULTY.normal.wakeMs);
      expect(find(ev, 'settled')[0].woke).toBe(2);
    });
  });

  describe('chain engine end', function () {
    it('clear when no sleepers are left', function () {
      var g = mk(1);
      layout(g, ['kkk.F.']);
      var ev = drop(g, 3, 'k', 'm').concat(run(g));
      expect(ev[ev.length - 1]).toEqual({ type: 'clear' });
      expect(g.state).toBe('clear');
      expect(g.sleepers).toBe(0);
      expect(find(ev, 'settled').length).toBe(0);
      expect(find(ev, 'spawn').length).toBe(0);
      expect(E.step(g, 1000)).toEqual([]);
    });

    it('timeout while falling is timeup', function () {
      var g = mk(1);
      g.timeMs = 100;
      expect(E.step(g, 99)).toEqual([]);
      expect(E.step(g, 1)).toEqual([{ type: 'over', reason: 'timeup' }]);
      expect(g.timeMs).toBe(0);
      expect(g.state).toBe('over');
      expect(g.overReason).toBe('timeup');
    });

    it('timeout during a chain waits for the chain', function () {
      // stage 1 pops the k row, the i balls drop onto the floor, stage 2 pops 4 i
      // clear: the last sleeper wakes in stage 2 even though time is 0
      var g = mk(1);
      layout(g, [
        '.ii...',
        'kkk.iF'
      ]);
      var ev = drop(g, 3, 'k', 'i');
      expect(g.state).toBe('settling');
      g.timeMs = 0;
      ev = ev.concat(run(g, 100000));
      expect(find(ev, 'pop').map(function (e) { return e.chain; })).toEqual([1, 2]);
      expect(find(ev, 'wake').length).toBe(1);
      expect(ev[ev.length - 1]).toEqual({ type: 'clear' });
      expect(g.state).toBe('clear');

      // continue: the stage 2 wake adds time, one sleeper is left
      g = mk(1);
      layout(g, [
        '.ii..K',
        'kkk.iF'
      ]);
      ev = drop(g, 3, 'k', 'i');
      g.timeMs = 0;
      ev = ev.concat(run(g));
      expect(g.timeMs > 0).toBe(true);
      expect(types(ev).slice(-2)).toEqual(['settled', 'spawn']);
      expect(find(ev, 'settled')[0]).toEqual({ type: 'settled', chain: 2, woke: 1 });
      expect(g.state).toBe('falling');

      // timeup: the chain wakes nobody, time stays 0
      g = mk(1);
      layout(g, [
        '.ii..F',
        'kkk.im'
      ]);
      ev = drop(g, 3, 'k', 'i');
      g.timeMs = 0;
      ev = ev.concat(run(g));
      expect(find(ev, 'pop').map(function (e) { return e.chain; })).toEqual([1, 2]);
      expect(ev[ev.length - 1]).toEqual({ type: 'over', reason: 'timeup' });
      expect(find(ev, 'settled').length).toBe(0);
      expect(g.state).toBe('over');
      expect(g.overReason).toBe('timeup');
    });

    it('almost fires once', function () {
      // 2 -> 1: once, right after the wake
      var g = mk(1);
      layout(g, [
        '.....K',
        'kkk.Fm'
      ]);
      var ev = drop(g, 3, 'k', 'm').concat(run(g));
      expect(find(ev, 'almost').length).toBe(1);
      expect(types(ev).indexOf('almost')).toBe(types(ev).indexOf('wake') + 1);
      // a later lock with one sleeper left does not fire it again
      g.board[12][0] = ball('mimitchi');
      g.board[12][1] = ball('mimitchi');
      ev = drop(g, 0, 'i', 'i').concat(run(g));
      expect(find(ev, 'pop').length).toBe(1);
      expect(find(ev, 'almost').length).toBe(0);

      // 2 -> 0 at once: never fires
      g = mk(1);
      layout(g, [
        'K.....',
        'kkk.F.'
      ]);
      ev = drop(g, 3, 'k', 'm').concat(run(g));
      expect(find(ev, 'almost').length).toBe(0);
      expect(g.state).toBe('clear');
    });

    it('elapsed runs only while falling or settling', function () {
      var g = mk(1);
      clearBoard(g);
      var t0 = g.timeMs;
      E.step(g, 250);
      expect(g.elapsedMs).toBe(250);
      expect(g.timeMs).toBe(t0 - 250);
      // settling: a split fall; the full ms counts even when the wait ends early
      fillCol(g, 3, 11);
      g.pair = { x: 2, y: K.SPAWN_Y, rot: 1, axis: 'mametchi', child: 'kuchipatchi' };
      E.hardDrop(g);
      expect(g.state).toBe('settling');
      E.step(g, 1000);
      expect(g.elapsedMs).toBe(1250);
      expect(g.timeMs).toBe(t0 - 1250);
      // over: nothing counts any more
      g.timeMs = 5;
      E.step(g, 10);
      expect(g.state).toBe('over');
      expect(g.elapsedMs).toBe(1260);
      E.step(g, 1000);
      expect(g.elapsedMs).toBe(1260);
      expect(g.timeMs).toBe(0);
    });
  });

  describe('chain engine turn', function () {
    function hard(lines) {
      var g = mk(1, 'hard');
      layout(g, lines);
      g.fallMs = 1e9;   // keep the pair in the air so only the turn timer is tested
      return g;
    }

    it('no turns on easy and normal', function () {
      ['easy', 'normal'].forEach(function (d) {
        var g = mk(1, d);
        layout(g, ['Mf....']);
        g.fallMs = 1e9;
        g.timeMs = 1e9;
        var ev = [];
        for (var i = 0; i < 300; i++) { ev = ev.concat(E.step(g, 1000)); }
        expect(find(ev, 'turnWarn').length).toBe(0);
        expect(find(ev, 'turn').length).toBe(0);
      });
    });

    it('hard warns at 13s and turns at 15s', function () {
      var g = hard(['Mf....']);
      expect(E.step(g, 12999)).toEqual([]);
      expect(E.step(g, 1)).toEqual([{ type: 'turnWarn', sleeper: [0, 12], ball: [1, 12] }]);
      expect(E.step(g, 1999)).toEqual([]);
      expect(E.step(g, 1)).toEqual([{ type: 'turn', cell: [1, 12], charId: 'flowertchi', left: 2 }]);
      expect(g.board[12][1]).toEqual(sleep('flowertchi'));
      expect(g.sleepers).toBe(2);
      // the timer restarts from 0
      expect(E.step(g, 12999)).toEqual([]);
    });

    it('turn time does not run while settling', function () {
      var g = hard(['Mf....']);
      g.state = 'settling';
      g._settle = { phase: 'fall', acc: 0, wait: 1e9, cells: null, woke: 0 };
      expect(E.step(g, 20000)).toEqual([]);
      g.state = 'falling';
      g._settle = null;
      expect(E.step(g, 12999)).toEqual([]);
      expect(types(E.step(g, 1))).toEqual(['turnWarn']);
    });

    it('no candidate means no warn', function () {
      var g = hard(['M.....']);
      expect(E.step(g, 15000)).toEqual([]);
      g = hard(['.f....']);
      expect(E.step(g, 15000)).toEqual([]);
    });

    it('a ball in the hidden row is not a turn candidate', function () {
      var g = hard(['......']);
      var r;
      // column 0 is full: ball in the hidden row 0, a sleeper at the top visible row 1, sleepers below so nothing falls
      g.board[0][0] = ball('mametchi');
      for (r = K.HIDDEN; r < K.ROWS + K.HIDDEN; r++) { g.board[r][0] = sleep('mametchi'); }
      // the board holds 12 sleepers (the cap); report 11 so the cap does not hide a missing hidden-row check
      g.sleepers = K.MAX_SLEEPERS - 1;
      var before = JSON.stringify(g.board);
      var ev = [];
      for (var i = 0; i < 16; i++) { ev = ev.concat(E.step(g, 1000)); }
      expect(g.state).toBe('falling');
      expect(find(ev, 'turnWarn').length).toBe(0);
      expect(find(ev, 'turn').length).toBe(0);
      expect(JSON.stringify(g.board)).toBe(before);
    });

    it('stops at 12 sleepers', function () {
      var g = hard(['f.....', 'MMMMMM', 'MMMMMM']);
      expect(g.sleepers).toBe(12);
      expect(E.step(g, 15000)).toEqual([]);
      expect(g.sleepers).toBe(12);
    });

    it('a warned turn is cancelled when the board changed', function () {
      var g = hard(['Kkk..M']);
      expect(types(E.step(g, 13000))).toEqual(['turnWarn']);
      // popping the warned ball also wakes the warned sleeper
      var ev = drop(g, 3, 'k', 'k').concat(run(g));
      expect(find(ev, 'pop').length).toBe(1);
      expect(g.sleepers).toBe(1);
      expect(E.step(g, 2000)).toEqual([{ type: 'turnCancel' }]);
      expect(g.sleepers).toBe(1);
      expect(g.board[12][5]).toEqual(sleep('mametchi'));
    });

    it('almost does not fire again after a turn', function () {
      var g = hard(['.....K', 'kkk.Fm']);
      var ev = drop(g, 3, 'k', 'm').concat(run(g));
      expect(find(ev, 'almost').length).toBe(1);
      expect(g.sleepers).toBe(1);
      expect(types(E.step(g, 13000))).toEqual(['turnWarn']);
      expect(types(E.step(g, 2000))).toEqual(['turn']);
      expect(g.sleepers).toBe(2);
      // wake one: back to 1 sleeper, and almost stays quiet
      for (var c = 1; c <= 4; c++) { g.board[12][c] = ball('mimitchi'); }
      ev = drop(g, 0, 'k', 'm').concat(run(g));
      expect(find(ev, 'wake').length).toBe(1);
      expect(g.sleepers).toBe(1);
      expect(find(ev, 'almost').length).toBe(0);
    });
  });
})(Ailand);
