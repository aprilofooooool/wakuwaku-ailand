(function (G) {
  'use strict';
  var K = G.Constants;
  var P = G.Pieces;
  var CHARS = ['mametchi', 'kuchipatchi', 'mimitchi', 'flowertchi'];
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

  function fits(game, piece) {
    var cs = P.cells(piece.shape, piece.rot);
    for (var i = 0; i < cs.length; i++) {
      var col = piece.x + cs[i][0], row = piece.y + cs[i][1];
      if (col < 0 || col >= K.COLS || row < 0 || row >= TOTAL_ROWS || game.board[row][col] !== null) { return false; }
    }
    return true;
  }

  function moved(piece, dx, dy) {
    return { shape: piece.shape, charId: piece.charId, x: piece.x + dx, y: piece.y + dy, rot: piece.rot };
  }

  function canDown(game) { return fits(game, moved(game.piece, 0, 1)); }

  function ghostY(game) {
    var p = game.piece;
    var y = p.y;
    while (fits(game, moved(p, 0, y - p.y + 1))) { y++; }
    return y;
  }

  function drawNext(game) {
    game.next = { shape: game._shapeBag.next(), charId: game._charBag.next() };
  }

  // Puts `next` on the board top and draws a new `next`. Returns the events; ends the game if blocked.
  function spawn(game) {
    var n = game.next;
    game.piece = { shape: n.shape, charId: n.charId, x: 3, y: 0, rot: 0 };
    game._fallAcc = 0;
    game._lockAcc = 0;
    game._resets = 0;
    drawNext(game);
    if (!fits(game, game.piece)) {
      game.state = 'over';
      game.overReason = 'blocked';
      return [{ type: 'over', reason: 'blocked' }];
    }
    // Lower it below the hidden rows at once while it fits, so it is visible right away (design 2.1).
    for (var i = 0; i < K.HIDDEN && fits(game, moved(game.piece, 0, 1)); i++) { game.piece = moved(game.piece, 0, 1); }
    return [{ type: 'spawn', shape: n.shape, charId: n.charId }];
  }

  function fullRows(game) {
    var rows = [];
    for (var r = 0; r < TOTAL_ROWS; r++) {
      if (game.board[r].every(function (cell) { return cell !== null; })) { rows.push(r); }
    }
    return rows;
  }

  // Counts faces in the full rows, updates the totals and speed, and starts the settle wait.
  function startClear(game, rows) {
    var cfg = K.DIFFICULTY[game.difficulty];
    var faces = [];
    var mine = 0, other = 0;
    rows.forEach(function (r) {
      for (var c = 0; c < K.COLS; c++) {
        var isMine = game.board[r][c].charId === game.selfId;
        if (isMine) { mine++; } else { other++; }
        faces.push({ col: c, row: r, charId: game.board[r][c].charId, mine: isMine });
      }
    });
    game.collected += mine;
    game.jar += other;
    game.lines += rows.length;
    game.fallMs = Math.max(cfg.minMs, cfg.fallMs * Math.pow(K.SPEEDUP, Math.floor(game.lines / K.SPEEDUP_LINES)));
    var left = game.goal - game.collected;
    var almost = false;
    if (!game._almostDone && left <= K.ALMOST) {
      game._almostDone = true;
      almost = left > 0;
    }
    game.state = 'settling';
    game._settle = { rows: rows, acc: 0 };
    var events = [{ type: 'clear', rows: rows, faces: faces, mine: mine, collected: game.collected, almost: almost }];
    if (mine > 0) {
      game.timeMs += mine * cfg.faceMs;
      events.push({ type: 'time', addMs: mine * cfg.faceMs });
    }
    return events;
  }

  function timeUp(game) {
    game.state = 'over';
    game.overReason = 'timeup';
    return [{ type: 'over', reason: 'timeup' }];
  }

  // Removes the cleared rows, drops everything above, then ends with goal, spawn or over.
  function finishSettle(game) {
    var rows = game._settle.rows;
    game._settle = null;
    for (var i = rows.length - 1; i >= 0; i--) { game.board.splice(rows[i], 1); }
    for (var n = 0; n < rows.length; n++) {
      var row = [];
      for (var c = 0; c < K.COLS; c++) { row.push(null); }
      game.board.unshift(row);
    }
    var events = [{ type: 'collapse', rows: rows }];
    if (game.collected >= game.goal) {
      game.state = 'goal';
      events.push({ type: 'goal', collected: game.collected, jar: game.jar });
      return events;
    }
    if (game.timeMs <= 0) { return events.concat(timeUp(game)); }
    game.state = 'falling';
    return events.concat(spawn(game));
  }

  // True when a settled cell sits in the top DANGER_ROWS visible rows (design 3.3).
  function dangerous(game) {
    for (var r = 0; r < K.HIDDEN + K.DANGER_ROWS; r++) {
      for (var c = 0; c < K.COLS; c++) {
        if (game.board[r][c] !== null) { return true; }
      }
    }
    return false;
  }

  // Writes the piece into the board and returns the events (lock, then clear, spawn or over).
  function lock(game) {
    var p = game.piece;
    var cells = P.cells(p.shape, p.rot).map(function (c) { return [p.x + c[0], p.y + c[1]]; });
    var allHidden = true;
    cells.forEach(function (c) {
      game.board[c[1]][c[0]] = { charId: p.charId };
      if (c[1] >= K.HIDDEN) { allHidden = false; }
    });
    var events = [{ type: 'lock', cells: cells }];
    if (allHidden) {
      game.state = 'over';
      game.overReason = 'blocked';
      events.push({ type: 'over', reason: 'blocked' });
      return events;
    }
    var full = fullRows(game);
    if (full.length > 0) { return events.concat(startClear(game, full)); }
    return events.concat(spawn(game));
  }

  function create(opts) {
    var cfg = K.DIFFICULTY[opts.difficulty];
    var rng = Ailand.core.Rng.mulberry32(opts.seed);
    var game = {
      board: emptyBoard(),
      piece: null,
      next: null,
      selfId: opts.selfId,
      goal: cfg.goal,
      timeMs: cfg.timeMs,
      overReason: null,
      collected: 0,
      jar: 0,
      lines: 0,
      fallMs: cfg.fallMs,
      state: 'falling',
      difficulty: opts.difficulty,
      _shapeBag: createBag(rng, P.SHAPES),
      _charBag: createBag(rng, CHARS),
      _fallAcc: 0,
      _lockAcc: 0,
      _resets: 0,
      _settle: null,
      _almostDone: false
    };
    drawNext(game);
    spawn(game);
    return game;
  }

  // Any successful move or rotate made while resting on the floor restarts the lock wait (up to LOCK_RESETS times).
  function apply(game, cand, wasOnFloor) {
    game.piece = cand;
    if (wasOnFloor && game._resets < K.LOCK_RESETS) {
      game._resets++;
      game._lockAcc = 0;
    }
    return true;
  }

  function move(game, dx) {
    if (game.state !== 'falling') { return false; }
    var cand = moved(game.piece, dx, 0);
    if (!fits(game, cand)) { return false; }
    return apply(game, cand, !canDown(game));
  }

  function rotate(game) {
    if (game.state !== 'falling') { return false; }
    var cand = P.tryRotate(game.piece, function (c) { return fits(game, c); });
    if (!cand) { return false; }
    return apply(game, cand, !canDown(game));
  }

  function softDrop(game) {
    if (game.state !== 'falling' || !canDown(game)) { return false; }
    game.piece = moved(game.piece, 0, 1);
    game._fallAcc = 0;
    game._lockAcc = 0;
    return true;
  }

  function hardDrop(game) {
    if (game.state !== 'falling') { return []; }
    game.piece = moved(game.piece, 0, ghostY(game) - game.piece.y);
    return lock(game);
  }

  function step(game, ms) {
    var events = [];
    var left = ms;
    if (game.state === 'falling' || game.state === 'settling') { game.timeMs = Math.max(0, game.timeMs - ms); }
    if (game.state === 'falling' && game.timeMs <= 0) { return timeUp(game); }
    if (game.state === 'settling') {
      game._settle.acc += ms;
      return game._settle.acc >= K.SETTLE_MS ? finishSettle(game) : events;
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
        game.piece = moved(game.piece, 0, 1);
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
    ghostY: ghostY,
    dangerous: dangerous
  };
})(Ailand.games.blocks);
