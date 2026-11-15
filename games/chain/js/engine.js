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

  // Drops every unsupported ball and sleeper (design 2.4 step 4), bottom cell of each column first.
  // Sleepers only ever float after a wake. Returns the moves (and the largest distance in `maxDist`).
  function applyGravity(game) {
    var moves = [];
    var maxDist = 0;
    for (var c = 0; c < K.COLS; c++) {
      var floor = TOTAL_ROWS - 1;
      for (var r = TOTAL_ROWS - 1; r >= 0; r--) {
        var cell = game.board[r][c];
        if (cell === null) { continue; }
        if (r < floor) {
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

  // Same-coloured balls joined up/down/left/right, POP_MIN or more (design 2.1, 2.4).
  // Only visible rows count: the hidden row never pops.
  function groups(board) {
    var seen = {};
    var out = [];
    for (var r = K.HIDDEN; r < TOTAL_ROWS; r++) {
      for (var c = 0; c < K.COLS; c++) {
        var cell = board[r][c];
        if (cell === null || cell.kind !== 'ball' || seen[c + ',' + r]) { continue; }
        var cells = [];
        var stack = [[c, r]];
        seen[c + ',' + r] = true;
        while (stack.length > 0) {
          var p = stack.pop();
          cells.push(p);
          [[1, 0], [-1, 0], [0, 1], [0, -1]].forEach(function (d) {
            var nc = p[0] + d[0], nr = p[1] + d[1];
            if (nc < 0 || nc >= K.COLS || nr < K.HIDDEN || nr >= TOTAL_ROWS || seen[nc + ',' + nr]) { return; }
            var n = board[nr][nc];
            if (n !== null && n.kind === 'ball' && n.charId === cell.charId) {
              seen[nc + ',' + nr] = true;
              stack.push([nc, nr]);
            }
          });
        }
        if (cells.length >= K.POP_MIN) { out.push({ charId: cell.charId, cells: cells }); }
      }
    }
    return out;
  }

  // Removes the popped balls and wakes every sleeper next to one of them (design 2.4 step 3).
  function popAndWake(game, popped) {
    var events = [];
    popped.forEach(function (p) { game.board[p.row][p.col] = null; });
    var woken = [];
    popped.forEach(function (p) {
      [[1, 0], [-1, 0], [0, 1], [0, -1]].forEach(function (d) {
        var c = p.col + d[0], r = p.row + d[1];
        if (c < 0 || c >= K.COLS || r < 0 || r >= TOTAL_ROWS) { return; }
        var n = game.board[r][c];
        if (n !== null && n.kind === 'sleep') {
          woken.push({ col: c, row: r, charId: n.charId });
          game.board[r][c] = null;
        }
      });
    });
    if (woken.length === 0) { return events; }
    game.sleepers -= woken.length;
    game.woke += woken.length;
    game._settle.woke += woken.length;
    var addMs = woken.length * K.DIFFICULTY[game.difficulty].wakeMs;
    game.timeMs += addMs;
    events.push({ type: 'wake', cells: woken, left: game.sleepers });
    // design 3.3: once, the first time exactly one is left; dropping straight to 0 uses it up
    if (!game._almostUsed && game.sleepers <= 1) {
      game._almostUsed = true;
      if (game.sleepers === 1) { events.push({ type: 'almost' }); }
    }
    events.push({ type: 'time', addMs: addMs });
    return events;
  }

  // Design 2.7 (hard only): picks a visible sleeper that touches a visible ball, and one of those balls.
  function pickTurn(game) {
    var sleepers = [];
    var dirs = [[1, 0], [-1, 0], [0, 1], [0, -1]];
    var r, c;
    for (r = K.HIDDEN; r < TOTAL_ROWS; r++) {
      for (c = 0; c < K.COLS; c++) {
        var cell = game.board[r][c];
        if (cell === null || cell.kind !== 'sleep') { continue; }
        var balls = [];
        dirs.forEach(function (d) {
          var nc = c + d[0], nr = r + d[1];
          if (nc < 0 || nc >= K.COLS || nr < K.HIDDEN || nr >= TOTAL_ROWS) { return; }
          var n = game.board[nr][nc];
          if (n !== null && n.kind === 'ball') { balls.push({ col: nc, row: nr, cell: n }); }
        });
        if (balls.length > 0) { sleepers.push({ col: c, row: r, cell: cell, balls: balls }); }
      }
    }
    if (sleepers.length === 0) { return null; }
    var s = sleepers[Math.floor(game._turnRng() * sleepers.length)];
    var b = s.balls[Math.floor(game._turnRng() * s.balls.length)];
    return { sleeper: s, ball: b };
  }

  // Advances the turn timer by `ms` of falling time: warn at turnMs - TURN_WARN_MS, act at turnMs.
  function turnTick(game, ms) {
    var turnMs = K.DIFFICULTY[game.difficulty].turnMs;
    var events = [];
    if (turnMs === null) { return events; }
    game._turnAcc += ms;
    if (!game._turnWarned && game._turnAcc >= turnMs - K.TURN_WARN_MS) {
      game._turnWarned = true;
      var pick = game.sleepers >= K.MAX_SLEEPERS ? null : pickTurn(game);
      if (pick) {
        game._turnPending = pick;
        events.push({ type: 'turnWarn', sleeper: [pick.sleeper.col, pick.sleeper.row], ball: [pick.ball.col, pick.ball.row] });
      }
    }
    if (game._turnAcc >= turnMs) {
      var p = game._turnPending;
      if (p) {
        // same objects as at warn time means nothing was popped, woken or moved there
        if (game.board[p.sleeper.row][p.sleeper.col] === p.sleeper.cell && game.board[p.ball.row][p.ball.col] === p.ball.cell) {
          var charId = p.ball.cell.charId;
          game.board[p.ball.row][p.ball.col] = { kind: 'sleep', charId: charId };
          game.sleepers++;
          events.push({ type: 'turn', cell: [p.ball.col, p.ball.row], charId: charId, left: game.sleepers });
        } else {
          events.push({ type: 'turnCancel' });
        }
      }
      game._turnAcc = 0;
      game._turnWarned = false;
      game._turnPending = null;
    }
    return events;
  }

  // Design 2.5: clear, timeup (only judged here once the whole chain is over) or the next pair.
  function finishSettle(game) {
    var woke = game._settle.woke;
    game._settle = null;
    if (game.sleepers === 0) {
      game.state = 'clear';
      return [{ type: 'clear' }];
    }
    if (game.timeMs <= 0) {
      game.state = 'over';
      game.overReason = 'timeup';
      return [{ type: 'over', reason: 'timeup' }];
    }
    game.state = 'falling';
    return [{ type: 'settled', chain: game.chain, woke: woke }].concat(spawn(game));
  }

  // Called when the current settle wait ends. Phases (design 2.4):
  // 'fall' -> groups: pop (WOBBLE_MS wait) or finish; 'pop' -> remove, wake, gravity -> 'fall' (or groups at once).
  function advanceSettle(game) {
    var s = game._settle;
    var events = [];
    if (s.phase === 'pop') {
      events = events.concat(popAndWake(game, s.cells));
      var g = applyGravity(game);
      if (g.moves.length > 0) {
        events.push({ type: 'fall', moves: g.moves });
        s.phase = 'fall';
        s.acc = 0;
        s.wait = g.maxDist * K.FALL_CELL_MS;
        return events;
      }
    }
    var gs = groups(game.board);
    if (gs.length === 0) { return events.concat(finishSettle(game)); }
    game.chain++;
    var cells = [];
    gs.forEach(function (grp) {
      grp.cells.forEach(function (p) { cells.push({ col: p[0], row: p[1], charId: grp.charId }); });
    });
    events.push({ type: 'pop', chain: game.chain, cells: cells });
    s.phase = 'pop';
    s.cells = cells;
    s.acc = 0;
    s.wait = K.WOBBLE_MS;
    return events;
  }

  // Writes the pair into the board, lets the split balls fall and starts the settle wait.
  function lock(game) {
    var cells = P.cells(game.pair).map(function (c) { return { col: c.col, row: c.row, charId: c.charId }; });
    cells.forEach(function (c) { game.board[c.row][c.col] = { kind: 'ball', charId: c.charId }; });
    game.pair = null;
    game.chain = 0;
    var events = [{ type: 'lock', cells: cells }];
    var g = applyGravity(game);
    if (g.moves.length > 0) { events.push({ type: 'fall', moves: g.moves }); }
    game.state = 'settling';
    game._settle = { phase: 'fall', acc: 0, wait: g.maxDist * K.FALL_CELL_MS, cells: null, woke: 0 };
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
      _settle: null,
      _almostUsed: false,
      _turnAcc: 0,
      _turnWarned: false,
      _turnPending: null
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
    if (game.state !== 'falling' && game.state !== 'settling') { return events; }
    game.elapsedMs += ms;
    game.timeMs = Math.max(0, game.timeMs - ms);
    // design 2.5: while settling, time is judged only when the chain is over (finishSettle)
    if (game.state === 'falling' && game.timeMs === 0) {
      game.state = 'over';
      game.overReason = 'timeup';
      return [{ type: 'over', reason: 'timeup' }];
    }
    if (game.state === 'settling') {
      game._settle.acc += ms;
      return game._settle.acc >= game._settle.wait ? advanceSettle(game) : events;
    }
    if (game.state === 'falling') { events = events.concat(turnTick(game, ms)); }
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
    groups: groups,
    ghost: ghost,
    dangerous: dangerous
  };
})(Ailand.games.chain);
