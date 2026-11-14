(function (G) {
  'use strict';
  // Board drawing on Canvas (design 7): the 20 visible rows, the ghost and the falling piece.
  // Each cell is a rounded square in the character's main color with its normal image on top
  // (the face text when the image is not loaded). Never reads pixels back. DOM is not touched at load.
  var K = G.Constants, P = G.Pieces, E = G.Engine;
  var TOTAL_ROWS = K.ROWS + K.HIDDEN;
  var BG = '#fffdf8';
  var GRID = 'rgba(58, 47, 90, 0.08)';
  var MINE_EDGE = '#ffc83a';      // the chosen character's cells get a gold edge (design 1.3: tell them apart at a glance)
  var GHOST_ALPHA = 0.25;
  var STAR_FILL = '#ffd23a';
  var STAR_EDGE = '#3a2f5a';

  function profileOf(id) { return Ailand.core.Characters.get(id); }
  function imageReady(img) { return !!img && img.complete && img.naturalWidth > 0; }

  // Rounded rectangle path (ctx.roundRect is missing on older Safari).
  function roundRect(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  // Gold 5-point star with a dark outline, centered at (cx, cy), outer radius r.
  function drawStar(ctx, cx, cy, r) {
    var i, a, rr;
    ctx.beginPath();
    for (i = 0; i < 10; i++) {
      a = -Math.PI / 2 + i * Math.PI / 5;
      rr = i % 2 === 0 ? r : r * 0.42;
      if (i === 0) { ctx.moveTo(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr); }
      else { ctx.lineTo(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr); }
    }
    ctx.closePath();
    ctx.save();
    ctx.lineJoin = 'round';
    ctx.lineWidth = Math.max(1.5, r * 0.5);
    ctx.strokeStyle = STAR_EDGE;
    ctx.stroke();
    ctx.fillStyle = STAR_FILL;
    ctx.fill();
    ctx.restore();
  }

  // One cell at device pixels (x, y), size s. star: true draws the gold star over the face.
  function drawCell(ctx, x, y, s, charId, opts, alpha, star) {
    var pf = profileOf(charId);
    if (!pf) { return; }
    var pad = s * 0.05;
    ctx.globalAlpha = alpha;
    roundRect(ctx, x + pad, y + pad, s - pad * 2, s - pad * 2, s * 0.22);
    ctx.fillStyle = pf.colors.main;
    ctx.fill();
    if (opts.selfId === charId) {
      ctx.lineWidth = Math.max(2, s * 0.09);
      ctx.strokeStyle = MINE_EDGE;
      ctx.stroke();
    }
    var img = opts.images && opts.images[charId];
    if (imageReady(img)) {
      ctx.drawImage(img, x + s * 0.1, y + s * 0.1, s * 0.8, s * 0.8);
    } else {
      ctx.fillStyle = '#ffffff';
      ctx.font = '800 ' + Math.max(6, Math.floor(s * 0.3)) + 'px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(pf.face.normal, x + s / 2, y + s / 2, s * 0.9);
    }
    if (star) { drawStar(ctx, x + s * 0.73, y + s * 0.27, s * 0.225); }
    ctx.globalAlpha = 1;
  }

  function pieceCells(piece, y) {
    return P.cells(piece.shape, piece.rot).map(function (c) { return [piece.x + c[0], y + c[1]]; });
  }

  // opts: { cell (CSS px), dpr, images: { charId: Image }, hideRows?: [board rows], hideCells?: [[col, row]], selfId? }.
  function draw(ctx, game, opts) {
    var o = opts || {};
    var s = o.cell * (o.dpr || 1);
    var w = K.COLS * s, h = K.ROWS * s;
    var mine = { images: o.images, selfId: o.selfId || game.selfId };
    var hide = o.hideRows || [];
    var hideCell = {};   // star faces: their cells are flying away
    (o.hideCells || []).forEach(function (q) { hideCell[q[0] + ',' + q[1]] = true; });
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

    for (var r = K.HIDDEN; r < TOTAL_ROWS; r++) {
      if (hide.indexOf(r) >= 0) { continue; }   // cleared rows: their faces are flying away
      for (var c = 0; c < K.COLS; c++) {
        var cell = game.board[r][c];
        if (cell && !hideCell[c + ',' + r]) { drawCell(ctx, c * s, (r - K.HIDDEN) * s, s, cell.charId, mine, 1, !!cell.star); }
      }
    }
    if (game.state !== 'falling' || !game.piece) { return; }
    var p = game.piece;
    var ghost = E.ghostY(game);
    if (ghost !== p.y) {
      pieceCells(p, ghost).forEach(function (q, qi) {
        if (q[1] >= K.HIDDEN) { drawCell(ctx, q[0] * s, (q[1] - K.HIDDEN) * s, s, p.charId, mine, GHOST_ALPHA, p.star === qi); }
      });
    }
    pieceCells(p, p.y).forEach(function (q, qi) {
      if (q[1] >= K.HIDDEN) { drawCell(ctx, q[0] * s, (q[1] - K.HIDDEN) * s, s, p.charId, mine, 1, p.star === qi); }
    });
  }

  // "つぎ": the next piece centered in a 4 x 2 cell canvas, drawn the same way as the board.
  function drawNext(ctx, next, opts) {
    var o = opts || {};
    var s = o.cell * (o.dpr || 1);
    var w = 4 * s, h = 2 * s;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, w, h);
    if (!next) { return; }
    var cs = P.cells(next.shape, 0);
    var minX = 9, maxX = -1, minY = 9, maxY = -1;
    cs.forEach(function (c) {
      minX = Math.min(minX, c[0]); maxX = Math.max(maxX, c[0]);
      minY = Math.min(minY, c[1]); maxY = Math.max(maxY, c[1]);
    });
    var ox = (w - (maxX - minX + 1) * s) / 2, oy = (h - (maxY - minY + 1) * s) / 2;
    var mine = { images: o.images, selfId: o.selfId };
    cs.forEach(function (c, ci) { drawCell(ctx, ox + (c[0] - minX) * s, oy + (c[1] - minY) * s, s, next.charId, mine, 1, next.star === ci); });
  }

  G.Render = { draw: draw, drawNext: drawNext };
})(Ailand.games.blocks);
