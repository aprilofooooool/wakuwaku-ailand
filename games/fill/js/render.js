(function (G) {
  'use strict';
  // Canvas drawing for fill: the frame (thin dashed empty cells), the faint guide picture, pieces that carry
  // their slice of the dot picture with an outline, the drag ghost, the hint shadow, the dot picture and the
  // zukan's grey frame shadow. Sizes are CSS px; the caller sizes the canvas to css * dpr.
  // Never reads pixels back. DOM is not touched at load.
  var OUTLINE = '#3a2f5a';
  var FRAME_BG = '#ffffff';
  var FRAME_LINE = 'rgba(58, 47, 90, 0.22)';
  var SELECT = '#ffc83a';
  var HINT = '#ffd84a';
  var SHADOW = '#c9c3d6';
  var NO_DOT = '#f1ecf8';   // a dot with no colour inside a piece
  var GHOST_FILL = '#8fd0ff';
  var GHOST_ALPHA = 0.4;
  var HINT_ALPHA = 0.55;
  var N = G.Constants.DOTS_PER_CELL;

  function key(x, y) { return x + ',' + y; }
  function setOf(cells) {
    var s = {};
    cells.forEach(function (c) { s[key(c[0], c[1])] = true; });
    return s;
  }

  function begin(ctx, dpr) {
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, ctx.canvas.width / dpr, ctx.canvas.height / dpr);
  }

  // The outer edges of a cell set (edges with no neighbour of the same set), as one path.
  function edgePath(ctx, cells, cell, ox, oy) {
    var s = setOf(cells);
    ctx.beginPath();
    cells.forEach(function (c) {
      var x = ox + c[0] * cell, y = oy + c[1] * cell;
      if (!s[key(c[0], c[1] - 1)]) { ctx.moveTo(x, y); ctx.lineTo(x + cell, y); }
      if (!s[key(c[0] + 1, c[1])]) { ctx.moveTo(x + cell, y); ctx.lineTo(x + cell, y + cell); }
      if (!s[key(c[0], c[1] + 1)]) { ctx.moveTo(x, y + cell); ctx.lineTo(x + cell, y + cell); }
      if (!s[key(c[0] - 1, c[1])]) { ctx.moveTo(x, y); ctx.lineTo(x, y + cell); }
    });
  }

  // The N x N dots of picture cell (cx, cy) at (ox + cx * cell, oy + cy * cell). Edges are rounded so dots leave
  // no seams. Dots with no colour stay see-through.
  function cellDots(ctx, pic, cx, cy, cell, ox, oy) {
    var d = cell / N;
    for (var dy = 0; dy < N; dy++) {
      var row = pic.pixels[cy * N + dy] || '';
      for (var dx = 0; dx < N; dx++) {
        var ch = row.charAt(cx * N + dx);
        var col = (ch === '' || ch === '.') ? null : pic.palette[ch];
        if (!col) { continue; }
        var x0 = Math.round(ox + cx * cell + dx * d), x1 = Math.round(ox + cx * cell + (dx + 1) * d);
        var y0 = Math.round(oy + cy * cell + dy * d), y1 = Math.round(oy + cy * cell + (dy + 1) * d);
        ctx.fillStyle = col;
        ctx.fillRect(x0, y0, x1 - x0, y1 - y0);
      }
    }
  }

  // One piece in its answer orientation with its top-left cell at (ox, oy): its slice of the picture, the
  // outline, and a gold glow when selected. The slice is read from the picture at answer.x + c, answer.y + c.
  function drawPiece(ctx, pic, piece, cell, ox, oy, selected) {
    var lw = Math.max(2, Math.round(cell * 0.08));
    var cells = piece.cells;
    cells.forEach(function (c) {
      // picture cell = answer + local cell; drawn at the piece's own origin
      cellDotsShift(ctx, pic, piece.answer.x + c[0], piece.answer.y + c[1], c, cell, ox, oy);
    });
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    if (selected) {
      ctx.save();
      ctx.strokeStyle = SELECT;
      ctx.lineWidth = lw * 3;
      ctx.shadowColor = SELECT;
      ctx.shadowBlur = cell * 0.4;
      edgePath(ctx, cells, cell, ox, oy);
      ctx.stroke();
      ctx.restore();
    }
    ctx.strokeStyle = OUTLINE;
    ctx.lineWidth = lw;
    edgePath(ctx, cells, cell, ox, oy);
    ctx.stroke();
  }

  // Draws picture cell (px, py) at the local cell position c of a piece placed at (ox, oy).
  function cellDotsShift(ctx, pic, px, py, c, cell, ox, oy) {
    var d = cell / N;
    for (var dy = 0; dy < N; dy++) {
      var row = pic.pixels[py * N + dy] || '';
      for (var dx = 0; dx < N; dx++) {
        var ch = row.charAt(px * N + dx);
        var col = (ch === '' || ch === '.') ? null : pic.palette[ch];
        var x0 = Math.round(ox + c[0] * cell + dx * d), x1 = Math.round(ox + c[0] * cell + (dx + 1) * d);
        var y0 = Math.round(oy + c[1] * cell + dy * d), y1 = Math.round(oy + c[1] * cell + (dy + 1) * d);
        ctx.fillStyle = col || NO_DOT;
        ctx.fillRect(x0, y0, x1 - x0, y1 - y0);
      }
    }
  }

  function sizeOf(cells) {
    var w = 0, h = 0;
    cells.forEach(function (c) { w = Math.max(w, c[0] + 1); h = Math.max(h, c[1] + 1); });
    return { w: w, h: h };
  }

  // o: { frame, picture, guide (0..1), placed: [{ piece }], selected?, ghost: { cells }|null, hint: { cells }|null,
  //      pop: { id, scale }|null, cell, dpr }. The canvas is frame.w x frame.h cells.
  function board(ctx, o) {
    var cell = o.cell, frame = o.frame, pic = o.picture;
    begin(ctx, o.dpr || 1);
    // frame: white cells with a thin faint dashed edge
    ctx.fillStyle = FRAME_BG;
    frame.cells.forEach(function (c) { ctx.fillRect(c[0] * cell, c[1] * cell, cell, cell); });
    ctx.save();
    ctx.setLineDash([Math.max(2, cell * 0.12), Math.max(2, cell * 0.1)]);
    ctx.strokeStyle = FRAME_LINE;
    ctx.lineWidth = 1;
    frame.cells.forEach(function (c) { ctx.strokeRect(c[0] * cell + 1.5, c[1] * cell + 1.5, cell - 3, cell - 3); });
    ctx.restore();
    // guide: the picture faintly, inside the frame cells only
    if (o.guide > 0 && pic) {
      ctx.save();
      ctx.globalAlpha = o.guide;
      frame.cells.forEach(function (c) { cellDots(ctx, pic, c[0], c[1], cell, 0, 0); });
      ctx.restore();
    }
    ctx.strokeStyle = OUTLINE;
    ctx.lineWidth = 2;
    edgePath(ctx, frame.cells, cell, 0, 0);
    ctx.stroke();

    (o.placed || []).forEach(function (pl) {
      var pc = pl.piece, ox = pc.answer.x * cell, oy = pc.answer.y * cell;
      if (o.pop && o.pop.id === pc.id && o.pop.scale !== 1) {
        // a placed piece bounces: scaled around its own center
        var sz = sizeOf(pc.cells), cx = ox + sz.w * cell / 2, cy = oy + sz.h * cell / 2;
        ctx.save();
        ctx.translate(cx, cy);
        ctx.scale(o.pop.scale, o.pop.scale);
        ctx.translate(-cx, -cy);
        drawPiece(ctx, pic, pc, cell, ox, oy, false);
        ctx.restore();
      } else {
        drawPiece(ctx, pic, pc, cell, ox, oy, false);
      }
    });
    if (o.hint) {
      ctx.save();
      ctx.globalAlpha = HINT_ALPHA;
      ctx.fillStyle = HINT;
      o.hint.cells.forEach(function (c) { ctx.fillRect(c[0] * cell, c[1] * cell, cell, cell); });
      ctx.globalAlpha = 1;
      ctx.strokeStyle = SELECT;
      ctx.lineWidth = Math.max(3, cell * 0.12);
      ctx.shadowColor = HINT;
      ctx.shadowBlur = cell * 0.5;
      edgePath(ctx, o.hint.cells, cell, 0, 0);
      ctx.stroke();
      ctx.restore();
    }
    if (o.ghost) {
      ctx.save();
      ctx.globalAlpha = GHOST_ALPHA;
      ctx.fillStyle = GHOST_FILL;
      o.ghost.cells.forEach(function (c) { ctx.fillRect(c[0] * cell, c[1] * cell, cell, cell); });
      ctx.strokeStyle = OUTLINE;
      ctx.lineWidth = 2;
      edgePath(ctx, o.ghost.cells, cell, 0, 0);
      ctx.stroke();
      ctx.restore();
    }
  }

  // A single piece (tray or dragged) turned rot x 90 degrees clockwise: it is drawn in its answer orientation
  // and the canvas is rotated, so the picture slice turns with it. The canvas is the turned bounding box.
  // The tray shows the selection with CSS (fill.css .is-selected); `selected` adds a glow for other callers.
  function piece(ctx, picture, pc, rot, cell, dpr, selected) {
    begin(ctx, dpr || 1);
    var sz = sizeOf(pc.cells), W = sz.w * cell, H = sz.h * cell, r = ((rot % 4) + 4) % 4;
    ctx.save();
    if (r === 1) { ctx.translate(H, 0); } else if (r === 2) { ctx.translate(W, H); } else if (r === 3) { ctx.translate(0, W); }
    ctx.rotate(r * Math.PI / 2);
    drawPiece(ctx, picture, pc, cell, 0, 0, !!selected);
    ctx.restore();
  }

  // The dot picture, dotPx canvas px per dot (may be fractional: edges are rounded so dots never leave seams).
  // '.' is see-through.
  function picture(ctx, pic, dotPx) {
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
    pic.pixels.forEach(function (row, y) {
      var y0 = Math.round(y * dotPx), y1 = Math.round((y + 1) * dotPx);
      for (var x = 0; x < row.length; x++) {
        var ch = row.charAt(x);
        if (ch === '.' || !pic.palette[ch]) { continue; }
        var x0 = Math.round(x * dotPx);
        ctx.fillStyle = pic.palette[ch];
        ctx.fillRect(x0, y0, Math.round((x + 1) * dotPx) - x0, y1 - y0);
      }
    });
  }

  // The grey shape of a frame (zukan cards of pictures not done yet), cellPx canvas px per cell.
  function shadow(ctx, frame, cellPx) {
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
    ctx.fillStyle = SHADOW;
    frame.cells.forEach(function (c) { ctx.fillRect(c[0] * cellPx, c[1] * cellPx, cellPx, cellPx); });
  }

  G.Render = { board: board, piece: piece, picture: picture, shadow: shadow };
})(Ailand.games.fill);
