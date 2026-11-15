(function (G) {
  'use strict';
  // Board drawing on Canvas (design 7): the 12 visible rows (hidden row 0 is never drawn), sleepers,
  // the ghost and the falling pair. Balls are round in the character's main color with the normal image;
  // same-color neighbours are joined by a bridge (design 5.2). Sleepers are pale rounded squares with a dashed
  // edge, the sleep image and a "z". Never reads pixels back. DOM is not touched at load.
  var K = G.Constants, P = G.Pair, E = G.Engine;
  var TOTAL_ROWS = K.ROWS + K.HIDDEN;
  var BG = '#fffaf4';
  var GRID = 'rgba(58, 47, 90, 0.07)';
  var OUTLINE = '#3a2f5a';
  var GHOST_ALPHA = 0.28;
  var BALL_R = 0.44;       // ball radius (cells)
  var BRIDGE = 0.56;       // bridge thickness between joined balls (cells)

  function profileOf(id) { return Ailand.core.Characters.get(id); }
  function imageReady(img) { return !!img && img.complete && img.naturalWidth > 0; }
  function key(c, r) { return c + ',' + r; }

  function roundRect(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  function faceText(ctx, text, cx, cy, s) {
    ctx.fillStyle = OUTLINE;
    ctx.font = '800 ' + Math.max(6, Math.floor(s * 0.26)) + 'px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, cx, cy, s * 0.9);
  }

  // One ball centered in the cell at device pixels (x, y), size s.
  function drawBall(ctx, x, y, s, charId, images, alpha) {
    var pf = profileOf(charId);
    if (!pf) { return; }
    ctx.globalAlpha = alpha;
    ctx.beginPath();
    ctx.arc(x + s / 2, y + s / 2, s * BALL_R, 0, Math.PI * 2);
    ctx.fillStyle = pf.colors.main;
    ctx.fill();
    ctx.lineWidth = Math.max(1, s * 0.04);
    ctx.strokeStyle = OUTLINE;
    ctx.stroke();
    var img = images && images.normal && images.normal[charId];
    if (imageReady(img)) {
      ctx.drawImage(img, x + s * 0.14, y + s * 0.14, s * 0.72, s * 0.72);
    } else {
      faceText(ctx, pf.face.normal, x + s / 2, y + s / 2, s);
    }
    ctx.globalAlpha = 1;
  }

  // One sleeper: a pale square with a dashed edge (clearly not a ball), the sleep image and a "z".
  function drawSleeper(ctx, x, y, s, charId, images) {
    var pf = profileOf(charId);
    if (!pf) { return; }
    var pad = s * 0.06;
    roundRect(ctx, x + pad, y + pad, s - pad * 2, s - pad * 2, s * 0.2);
    ctx.fillStyle = pf.colors.sub;
    ctx.fill();
    ctx.save();
    ctx.setLineDash([Math.max(2, s * 0.1), Math.max(2, s * 0.07)]);
    ctx.lineWidth = Math.max(1.5, s * 0.06);
    ctx.strokeStyle = pf.colors.main;
    ctx.stroke();
    ctx.restore();
    var img = images && images.sleep && images.sleep[charId];
    if (imageReady(img)) {
      ctx.drawImage(img, x + s * 0.12, y + s * 0.14, s * 0.76, s * 0.76);
    } else {
      faceText(ctx, pf.face.normal, x + s / 2, y + s / 2, s);
    }
    ctx.fillStyle = OUTLINE;
    ctx.font = '900 ' + Math.max(6, Math.floor(s * 0.28)) + 'px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('z', x + s * 0.8, y + s * 0.2);
  }

  // Bridges between same-color balls that touch to the right or below (drawn under the balls).
  function drawBridges(ctx, game, s, pos, moving) {
    for (var r = K.HIDDEN; r < TOTAL_ROWS; r++) {
      for (var c = 0; c < K.COLS; c++) {
        var a = game.board[r][c];
        if (!a || a.kind !== 'ball' || moving[key(c, r)]) { continue; }
        var pf = profileOf(a.charId);
        if (!pf) { continue; }
        var p = pos(c, r);
        ctx.fillStyle = pf.colors.main;
        var right = c + 1 < K.COLS ? game.board[r][c + 1] : null;
        if (right && right.kind === 'ball' && right.charId === a.charId && !moving[key(c + 1, r)]) {
          ctx.fillRect(p.x + s / 2, p.y + s * (1 - BRIDGE) / 2, s, s * BRIDGE);
        }
        var down = r + 1 < TOTAL_ROWS ? game.board[r + 1][c] : null;
        if (down && down.kind === 'ball' && down.charId === a.charId && !moving[key(c, r + 1)]) {
          ctx.fillRect(p.x + s * (1 - BRIDGE) / 2, p.y + s / 2, s * BRIDGE, s);
        }
      }
    }
  }

  // opts: { cell (CSS px), dpr, images: { normal: { charId: Image }, sleep: { charId: Image } },
  //   wobble?: { 'col,row': dx in cells }, falling?: { 'col,row': dy in cells (negative = still above) } }.
  function draw(ctx, game, opts) {
    var o = opts || {};
    var s = o.cell * (o.dpr || 1);
    var w = K.COLS * s, h = K.ROWS * s;
    var wobble = o.wobble || {}, falling = o.falling || {};
    var moving = {};
    Object.keys(wobble).forEach(function (k) { moving[k] = true; });
    Object.keys(falling).forEach(function (k) { moving[k] = true; });
    function pos(c, r) {
      var k = key(c, r);
      return { x: (c + (wobble[k] || 0)) * s, y: (r - K.HIDDEN + (falling[k] || 0)) * s };
    }
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalAlpha = 1;
    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = BG;
    ctx.fillRect(0, 0, w, h);
    ctx.strokeStyle = GRID;
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (var gx = 1; gx < K.COLS; gx++) { ctx.moveTo(gx * s + 0.5, 0); ctx.lineTo(gx * s + 0.5, h); }
    for (var gy = 1; gy < K.ROWS; gy++) { ctx.moveTo(0, gy * s + 0.5); ctx.lineTo(w, gy * s + 0.5); }
    ctx.stroke();

    drawBridges(ctx, game, s, pos, moving);
    for (var r = K.HIDDEN; r < TOTAL_ROWS; r++) {
      for (var c = 0; c < K.COLS; c++) {
        var cell = game.board[r][c];
        if (!cell) { continue; }
        var p = pos(c, r);
        if (cell.kind === 'sleep') { drawSleeper(ctx, p.x, p.y, s, cell.charId, o.images); }
        else { drawBall(ctx, p.x, p.y, s, cell.charId, o.images, 1); }
      }
    }
    if (game.state !== 'falling' || !game.pair) { return; }
    var cells = P.cells(game.pair);
    var ghost = E.ghost(game);
    if (ghost[0].row !== cells[0].row) {
      ghost.forEach(function (q) {
        if (q.row >= K.HIDDEN) { drawBall(ctx, q.col * s, (q.row - K.HIDDEN) * s, s, q.charId, o.images, GHOST_ALPHA); }
      });
    }
    cells.forEach(function (q) {
      if (q.row >= K.HIDDEN) { drawBall(ctx, q.col * s, (q.row - K.HIDDEN) * s, s, q.charId, o.images, 1); }
    });
  }

  // "つぎ": the next pair standing up (child on top, axis below) in a 1 x 2 cell canvas.
  function drawNext(ctx, next, opts) {
    var o = opts || {};
    var s = o.cell * (o.dpr || 1);
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, s, 2 * s);
    if (!next) { return; }
    drawBall(ctx, 0, 0, s, next.child, o.images, 1);
    drawBall(ctx, 0, s, s, next.axis, o.images, 1);
  }

  G.Render = { draw: draw, drawNext: drawNext };
})(Ailand.games.chain);
