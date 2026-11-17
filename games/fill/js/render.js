(function (G) {
  'use strict';
  // Canvas drawing for fill (design 2.1, 4.3, 4.4): the frame (dashed empty cells), pieces with an outline,
  // the drag ghost, the hint shadow, the dot picture and the zukan's grey frame shadow.
  // Sizes are CSS px; the caller sizes the canvas to css * dpr. Never reads pixels back. DOM is not touched at load.
  var OUTLINE = '#3a2f5a';
  var FRAME_BG = '#ffffff';
  var FRAME_LINE = 'rgba(58, 47, 90, 0.35)';
  var SELECT = '#ffc83a';
  var HINT = '#ffd84a';
  var SHADOW = '#c9c3d6';
  // Piece colors by Puzzle color index 0-3 (pale, so the outline reads well).
  var COLORS = ['#ff9ec4', '#8fd0ff', '#a6e39a', '#ffd77a'];
  var GHOST_ALPHA = 0.35;
  var HINT_ALPHA = 0.55;

  function key(x, y) { return x + ',' + y; }
  function setOf(cells) {
    var s = {};
    cells.forEach(function (c) { s[key(c[0], c[1])] = true; });
    return s;
  }
  function colorOf(i) { return COLORS[((i % COLORS.length) + COLORS.length) % COLORS.length]; }

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

  // One piece: cells filled in its color, a soft top-left shine, the outline; a gold glow when selected.
  function drawPiece(ctx, cells, color, cell, ox, oy, selected) {
    var lw = Math.max(2, Math.round(cell * 0.08));
    ctx.fillStyle = colorOf(color);
    cells.forEach(function (c) { ctx.fillRect(ox + c[0] * cell, oy + c[1] * cell, cell, cell); });
    ctx.fillStyle = 'rgba(255, 255, 255, 0.45)';
    cells.forEach(function (c) {
      ctx.fillRect(ox + c[0] * cell + cell * 0.15, oy + c[1] * cell + cell * 0.15, cell * 0.22, cell * 0.22);
    });
    ctx.lineCap = 'round';
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
    // thin lines between the cells of one piece, then the piece outline
    ctx.strokeStyle = 'rgba(58, 47, 90, 0.18)';
    ctx.lineWidth = 1;
    cells.forEach(function (c) { ctx.strokeRect(ox + c[0] * cell + 0.5, oy + c[1] * cell + 0.5, cell - 1, cell - 1); });
    ctx.strokeStyle = OUTLINE;
    ctx.lineWidth = lw;
    edgePath(ctx, cells, cell, ox, oy);
    ctx.stroke();
  }

  // o: { frame, pieces: { id: { cells (absolute), color } }, selected, ghost: { cells, color }|null,
  //      hint: { cells }|null, cell, dpr }. The canvas is frame.w x frame.h cells.
  function board(ctx, o) {
    var cell = o.cell, frame = o.frame;
    begin(ctx, o.dpr || 1);
    // frame: white cells with a dashed edge (design 2.1)
    ctx.fillStyle = FRAME_BG;
    frame.cells.forEach(function (c) { ctx.fillRect(c[0] * cell, c[1] * cell, cell, cell); });
    ctx.save();
    ctx.setLineDash([Math.max(2, cell * 0.12), Math.max(2, cell * 0.1)]);
    ctx.strokeStyle = FRAME_LINE;
    ctx.lineWidth = 1.5;
    frame.cells.forEach(function (c) { ctx.strokeRect(c[0] * cell + 2, c[1] * cell + 2, cell - 4, cell - 4); });
    ctx.restore();
    ctx.strokeStyle = OUTLINE;
    ctx.lineWidth = 2;
    edgePath(ctx, frame.cells, cell, 0, 0);
    ctx.stroke();

    var ids = Object.keys(o.pieces || {});
    ids.forEach(function (id) {
      if (id !== o.selected) { drawPiece(ctx, o.pieces[id].cells, o.pieces[id].color, cell, 0, 0, false); }
    });
    if (o.selected && o.pieces && o.pieces[o.selected]) {
      drawPiece(ctx, o.pieces[o.selected].cells, o.pieces[o.selected].color, cell, 0, 0, true);
    }
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
      ctx.fillStyle = colorOf(o.ghost.color);
      o.ghost.cells.forEach(function (c) { ctx.fillRect(c[0] * cell, c[1] * cell, cell, cell); });
      ctx.strokeStyle = OUTLINE;
      ctx.lineWidth = 2;
      edgePath(ctx, o.ghost.cells, cell, 0, 0);
      ctx.stroke();
      ctx.restore();
    }
  }

  // A single piece (tray or dragged), its normalized shape at the canvas top-left. The tray shows
  // the selection with CSS (fill.css .is-selected), so no glow here.
  function piece(ctx, cells, color, cell, dpr) {
    begin(ctx, dpr || 1);
    drawPiece(ctx, cells, color, cell, 0, 0, false);
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

  G.Render = { board: board, piece: piece, picture: picture, shadow: shadow, COLORS: COLORS };
})(Ailand.games.fill);
