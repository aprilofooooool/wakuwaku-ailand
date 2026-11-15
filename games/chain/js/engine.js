(function (G) {
  'use strict';
  var K = G.Constants;
  var P = G.Pair;
  var TOTAL_ROWS = K.ROWS + K.HIDDEN;

  // Shuffles a copy of `items` for each round and hands them out one at a time (design 2.2).
  function createBag(rng, items) {
    var queue = [];
    function refill() {
      var a = items.slice();
      for (var i = a.length - 1; i > 0; i--) {
        var j = Math.floor(rng() * (i + 1));
        var t = a[i]; a[i] = a[j]; a[j] = t;
      }
      queue = a;
    }
    return {
      next: function () {
        if (queue.length === 0) { refill(); }
        return queue.shift();
      }
    };
  }

  function emptyBoard() {
    var b = [];
    for (var r = 0; r < TOTAL_ROWS; r++) {
      var row = [];
      for (var c = 0; c < K.COLS; c++) { row.push(null); }
      b.push(row);
    }
    return b;
  }

  // Design 2.9: pick a column at random (never SPAWN_X, at most MAX_PER_COLUMN each), stack from the bottom.
  function placeSleepers(board, rng, count) {
    var heights = [];
    var c;
    for (c = 0; c < K.COLS; c++) { heights.push(0); }
    for (var n = 0; n < count; n++) {
      var open = [];
      for (c = 0; c < K.COLS; c++) {
        if (c !== K.SPAWN_X && heights[c] < K.MAX_PER_COLUMN) { open.push(c); }
      }
      var col = open[Math.floor(rng() * open.length)];
      var charId = K.CHARS[Math.floor(rng() * K.CHARS.length)];
      board[TOTAL_ROWS - 1 - heights[col]][col] = { kind: 'sleep', charId: charId };
      heights[col]++;
    }
  }

  function fits(game, pair) {
    var cs = P.cells(pair);
    for (var i = 0; i < cs.length; i++) {
      var col = cs[i].col, row = cs[i].row;
      if (col < 0 || col >= K.COLS || row < 0 || row >= TOTAL_ROWS || game.board[row][col] !== null) { return false; }
    }
    return true;
  }

  function moved(pair, dx, dy) {
    return { x: pair.x + dx, y: pair.y + dy, rot: pair.rot, axis: pair.axis, child: pair.child };
  }

  function canDown(game) { return fits(game, moved(game.pair, 0, 1)); }

  function ghostPair(game) {
    var p = game.pair;
    var dy = 0;
    while (fits(game, moved(p, 0, dy + 1))) { dy++; }
    return moved(p, 0, dy);
  }

  function ghost(game) {
    return P.cells(ghostPair(game)).map(function (c) { return { col: c.col, row: c.row, charId: c.charId }; });
  }

  function drawNext(game) {
    game.next = { axis: game._bag.next(), child: game._bag.next() };
  }

  // Puts `next` at the spawn cell and draws a new `next`. Ends the game when the spawn cells are taken.
  function spawn(game) {
    var n = game.next;
    game.pair = { x: K.SPAWN_X, y: K.SPAWN_Y, rot: 0, axis: n.axis, child: n.child };
    game._fallAcc = 0;
    game._lockAcc = 0;
    game._resets = 0;
    drawNext(game);
    if (game.board[0][K.SPAWN_X] !== null || game.board[1][K.SPAWN_X] !== null) {
      game.state = 'over';
      game.overReason = 'blocked';
      return [{ type: 'over', reason: 'blocked' }];
    }
    return [{ type: 'spawn', pair: game.pair }];
  }

  // Drops every unsupported ball, bottom ball of each column first, one ball at a time.
  // Sleepers never move. Returns the moves (and the largest distance in `maxDist`).
  function applyGravity(game) {
    var moves = [];
    var maxDist = 0;
    for (var c = 0; c < K.COLS; c++) {
      var floor = TOTAL_ROWS - 1;
      for (var r = TOTAL_ROWS - 1; r >= 0; r--) {
        var cell = game.board[r][c];
        if (cell === null) { continue; }
        if (cell.kind === 'ball' && r < floor) {
          game.board[floor][c] = cell;
          game.board[r][c] = null;
          moves.push({ from: [c, r], to: [c, floor], kind: cell.kind, charId: cell.charId });
          if (floor - r > maxDist) { maxDist = floor - r; }
          floor--;
        } else {
          floor = r - 1;
        }
      }
    }
    return { moves: moves, maxDist: maxDist };
  }

  // Settle phases: 'fall' (split balls drop, wait) -> spawn.
  // Task 3 inserts groups -> pop (WOBBLE_MS wait) -> wake -> gravity between 'fall' and the spawn.
  function advanceSettle(game) {
    game._settle = null;
    game.state = 'falling';
    return spawn(game);
  }

  // Writes the pair into the board, lets the split balls fall and starts the settle wait.
  function lock(game) {
    var cells = P.cells(game.pair).map(function (c) { return { col: c.col, row: c.row, charId: c.charId }; });
    cells.forEach(function (c) { game.board[c.row][c.col] = { kind: 'ball', charId: c.charId }; });
    game.pair = null;
    var events = [{ type: 'lock', cells: cells }];
    var g = applyGravity(game);
    if (g.moves.length > 0) { events.push({ type: 'fall', moves: g.moves }); }
    game.state = 'settling';
    game._settle = { phase: 'fall', acc: 0, wait: g.maxDist * K.FALL_CELL_MS };
    if (game._settle.wait === 0) { events = events.concat(advanceSettle(game)); }
    return events;
  }

  function dangerous(game) {
    for (var r = 1; r <= K.DANGER_ROWS; r++) {
      if (game.board[r][K.SPAWN_X] !== null) { return true; }
    }
    return false;
  }

  function create(opts) {
    var cfg = K.DIFFICULTY[opts.difficulty];
    var rng = Ailand.core.Rng.mulberry32(opts.seed);
    var game = {
      board: emptyBoard(),
      pair: null,
      next: null,
      state: 'falling',
      overReason: null,
      difficulty: opts.difficulty,
      fallMs: cfg.fallMs,
      timeMs: cfg.timeMs,
      elapsedMs: 0,
      sleepers: cfg.sleepers,
      woke: 0,
      chain: 0,
      _bag: createBag(rng, K.CHARS.concat(K.CHARS)),
      _turnRng: Ailand.core.Rng.mulberry32(opts.seed ^ 0x5bd1e995),
      _fallAcc: 0,
      _lockAcc: 0,
      _resets: 0,
      _settle: null
    };
    placeSleepers(game.board, rng, cfg.sleepers);
    drawNext(game);
    spawn(game);
    return game;
  }

  // Any successful move or rotate made while resting on the floor restarts the lock wait (up to LOCK_RESETS times).
  function apply(game, cand, wasOnFloor) {
    game.pair = cand;
    if (wasOnFloor && game._resets < K.LOCK_RESETS) {
      game._resets++;
      game._lockAcc = 0;
    }
    return true;
  }

  function move(game, dx) {
    if (game.state !== 'falling') { return false; }
    var cand = moved(game.pair, dx, 0);
    if (!fits(game, cand)) { return false; }
    return apply(game, cand, !canDown(game));
  }

  function rotate(game) {
    if (game.state !== 'falling') { return false; }
    var cand = P.tryRotate(game.pair, function (c) { return fits(game, c); });
    if (!cand) { return false; }
    return apply(game, cand, !canDown(game));
  }

  function softDrop(game) {
    if (game.state !== 'falling' || !canDown(game)) { return false; }
    game.pair = moved(game.pair, 0, 1);
    game._fallAcc = 0;
    game._lockAcc = 0;
    return true;
  }

  function hardDrop(game) {
    if (game.state !== 'falling') { return []; }
    game.pair = ghostPair(game);
    return lock(game);
  }

  function step(game, ms) {
    var events = [];
    var left = ms;
    if (game.state === 'settling') {
      game._settle.acc += ms;
      return game._settle.acc >= game._settle.wait ? advanceSettle(game) : events;
    }
    while (game.state === 'falling' && left > 0) {
      if (!canDown(game)) {
        game._lockAcc += left;
        left = 0;
        if (game._lockAcc >= K.LOCK_MS) { events = events.concat(lock(game)); }
        break;
      }
      var need = game.fallMs - game._fallAcc;
      if (left >= need) {
        left -= need;
        game._fallAcc = 0;
        game._lockAcc = 0;
        game.pair = moved(game.pair, 0, 1);
      } else {
        game._fallAcc += left;
        left = 0;
      }
    }
    return events;
  }

  G.Engine = {
    createBag: createBag,
    create: create,
    move: move,
    rotate: rotate,
    softDrop: softDrop,
    hardDrop: hardDrop,
    step: step,
    ghost: ghost,
    dangerous: dangerous
  };
})(Ailand.games.chain);
