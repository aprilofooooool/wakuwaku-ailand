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
    return { shape: piece.shape, charId: piece.charId, x: piece.x + dx, y: piece.y + dy, rot: piece.rot, star: piece.star };
  }

  function canDown(game) { return fits(game, moved(game.piece, 0, 1)); }

  function ghostY(game) {
    var p = game.piece;
    var y = p.y;
    while (fits(game, moved(p, 0, y - p.y + 1))) { y++; }
    return y;
  }

  function rollStarIn(rng) { return K.STAR_MIN + Math.floor(rng() * (K.STAR_MAX - K.STAR_MIN + 1)); }

  // Star rolls use their own rng, so the shape and character order for a seed stays the same.
  function drawNext(game) {
    var star = null;
    game._starIn--;
    if (game._starIn <= 0) {
      star = Math.floor(game._starRng() * 4);
      game._starIn = rollStarIn(game._starRng);
    }
    game.next = { shape: game._shapeBag.next(), charId: game._charBag.next(), star: star };
  }

  // Puts `next` on the board top and draws a new `next`. Returns the events; ends the game if blocked.
  function spawn(game) {
    var n = game.next;
    game.piece = { shape: n.shape, charId: n.charId, x: 3, y: 0, rot: 0, star: n.star };
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

  // True once: the first time a collect leaves 1..ALMOST faces to go (a jump straight to the goal uses it up silently).
  // In challenge the target is the best (never true when best is 0).
  function checkAlmost(game) {
    var target = game.mode === 'challenge' ? game.best : game.goal;
    var left = target - game.collected;
    if (game._almostDone || left > K.ALMOST) { return false; }
    game._almostDone = true;
    return left > 0;
  }

  // Challenge only: [record event] the first time collected passes a best above 0, else [] (at most once per round).
  function checkRecord(game, viaStar) {
    if (game.mode !== 'challenge' || game.best <= 0 || game._recordDone || game.collected <= game.best) { return []; }
    game._recordDone = true;
    return [{ type: 'record', collected: game.collected, viaStar: viaStar }];
  }

  // Counts faces in the full rows, updates the totals and speed, and starts the settle wait.
  function startClear(game, rows) {
    var cfg = K.DIFFICULTY[game.difficulty];
    var faces = [];
    var mine = 0, other = 0, star = false;
    rows.forEach(function (r) {
      for (var c = 0; c < K.COLS; c++) {
        if (game.board[r][c].star) { star = true; }
        var isMine = game.board[r][c].charId === game.selfId;
        if (isMine) { mine++; } else { other++; }
        faces.push({ col: c, row: r, charId: game.board[r][c].charId, mine: isMine });
      }
    });
    game.collected += mine;
    game.jar += other;
    game.lines += rows.length;
    game.fallMs = Math.max(cfg.minMs, cfg.fallMs * Math.pow(K.SPEEDUP, Math.floor(game.lines / K.SPEEDUP_LINES)));
    var almost = checkAlmost(game);
    game.state = 'settling';
    game._settle = { kind: 'rows', rows: rows, star: star, acc: 0 };
    var events = [{ type: 'clear', rows: rows, faces: faces, mine: mine, collected: game.collected, almost: almost, star: star }];
    if (game.timeMs !== null && mine > 0) {
      game.timeMs += mine * cfg.faceMs;
      events.push({ type: 'time', addMs: mine * cfg.faceMs });
    }
    return events.concat(checkRecord(game, false));
  }

  function timeUp(game) {
    game.state = 'over';
    game.overReason = 'timeup';
    return [{ type: 'over', reason: 'timeup' }];
  }

  // The end of every settle: a reached goal wins, then time up, then the next piece.
  function endSettle(game, events) {
    if (game.goal !== null && game.collected >= game.goal) {
      game.state = 'goal';
      events.push({ type: 'goal', collected: game.collected, jar: game.jar });
      return events;
    }
    if (game.timeMs !== null && game.timeMs <= 0) { return events.concat(timeUp(game)); }
    game.state = 'falling';
    return events.concat(spawn(game));
  }

  // Collects every own face on the board, adds the star time and starts the star settle.
  // A face that carries another star stays: that star fires when its row clears (thrill design 2.2).
  function startStar(game) {
    var cfg = K.DIFFICULTY[game.difficulty];
    var faces = [];
    for (var r = 0; r < TOTAL_ROWS; r++) {
      for (var c = 0; c < K.COLS; c++) {
        var cell = game.board[r][c];
        if (cell !== null && cell.charId === game.selfId && !cell.star) { faces.push({ col: c, row: r, charId: cell.charId, mine: true }); }
      }
    }
    game.collected += faces.length;
    var almost = checkAlmost(game);
    game._settle = { kind: 'star', faces: faces, acc: 0 };
    var events = [{ type: 'star', faces: faces, collected: game.collected, almost: almost }];
    if (game.timeMs !== null) {
      var addMs = K.STAR_MS + faces.length * cfg.faceMs;
      game.timeMs += addMs;
      events.push({ type: 'time', addMs: addMs });
    }
    return events.concat(checkRecord(game, true));
  }

  // Removes each star face from its column; the cells above it in that column move down 1.
  function removeFaces(game, faces) {
    for (var c = 0; c < K.COLS; c++) {
      var rows = faces.filter(function (f) { return f.col === c; }).map(function (f) { return f.row; });
      if (rows.length === 0) { continue; }
      var col = game.board.map(function (row) { return row[c]; });
      for (var i = rows.length - 1; i >= 0; i--) { col.splice(rows[i], 1); }
      for (var n = 0; n < rows.length; n++) { col.unshift(null); }
      for (var r = 0; r < TOTAL_ROWS; r++) { game.board[r][c] = col[r]; }
    }
  }

  // Ends a settle. Rows: removes them and drops everything above, then a star (unless the goal is reached).
  // Star: removes the faces, then a chain clear or the usual end.
  function finishSettle(game) {
    var s = game._settle;
    game._settle = null;
    if (s.kind === 'star') {
      removeFaces(game, s.faces);
      var collapsed = [{ type: 'collapse', cells: s.faces.map(function (f) { return [f.col, f.row]; }) }];
      var full = fullRows(game);
      if (full.length > 0) { return collapsed.concat(startClear(game, full)); }
      return endSettle(game, collapsed);
    }
    var rows = s.rows;
    for (var i = rows.length - 1; i >= 0; i--) { game.board.splice(rows[i], 1); }
    for (var n = 0; n < rows.length; n++) {
      var row = [];
      for (var c = 0; c < K.COLS; c++) { row.push(null); }
      game.board.unshift(row);
    }
    var events = [{ type: 'collapse', rows: rows }];
    if (s.star && (game.goal === null || game.collected < game.goal)) { return events.concat(startStar(game)); }
    return endSettle(game, events);
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
    cells.forEach(function (c, i) {
      game.board[c[1]][c[0]] = i === p.star ? { charId: p.charId, star: true } : { charId: p.charId };
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
    var starRng = Ailand.core.Rng.mulberry32(opts.seed ^ 0x5bd1e995);
    var challenge = opts.mode === 'challenge';
    var best = typeof opts.best === 'number' && opts.best > 0 ? Math.floor(opts.best) : 0;
    var game = {
      mode: challenge ? 'challenge' : 'collect',
      best: challenge ? best : 0,
      board: emptyBoard(),
      piece: null,
      next: null,
      selfId: opts.selfId,
      goal: challenge ? null : cfg.goal,
      timeMs: challenge ? null : cfg.timeMs,
      overReason: null,
      collected: 0,
      jar: 0,
      lines: 0,
      fallMs: cfg.fallMs,
      state: 'falling',
      difficulty: opts.difficulty,
      _shapeBag: createBag(rng, P.SHAPES),
      _charBag: createBag(rng, CHARS),
      _starRng: starRng,
      _starIn: rollStarIn(starRng),
      _fallAcc: 0,
      _lockAcc: 0,
      _resets: 0,
      _settle: null,
      _almostDone: false,
      _recordDone: false
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
    if (game.timeMs !== null && (game.state === 'falling' || game.state === 'settling')) { game.timeMs = Math.max(0, game.timeMs - ms); }
    if (game.state === 'falling' && game.timeMs !== null && game.timeMs <= 0) { return timeUp(game); }
    if (game.state === 'settling') {
      game._settle.acc += ms;
      var wait = game._settle.kind === 'star' ? K.STAR_SETTLE_MS : K.SETTLE_MS;
      return game._settle.acc >= wait ? finishSettle(game) : events;
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
