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
      return [{ type: 'over' }];
    }
    return [{ type: 'spawn', shape: n.shape, charId: n.charId }];
  }

  // Writes the piece into the board and returns the events. Hook point for line clears (next task):
  // after the lock event, check full rows here and either settle or spawn.
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
      events.push({ type: 'over' });
      return events;
    }
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
      _resets: 0
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
    ghostY: ghostY
  };
})(Ailand.games.blocks);
