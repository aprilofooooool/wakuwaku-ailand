(function (G) {
  'use strict';
  // Canvas drawing for territory (design 2.5, 7.1): the grid, placed pieces in seat colours, faint start corners,
  // the drag ghost (legal: translucent seat colour; illegal: grey dashed outline), the CPU flash, the anchor dots
  // (own canvas, so CSS can blink it) and single pieces for the tray and the dragged piece.
  // Sizes are CSS px; the caller sizes the canvas to css * dpr. Never reads pixels back. No DOM at load.
  var OUTLINE = '#3a2f5a';
  var BOARD_BG = '#ffffff';
  var GRID = 'rgba(58, 47, 90, 0.14)';
  var OFF = '#c9c3d6';          // a piece that cannot be placed anywhere (tray)
  var BAD = '#8a8499';          // illegal ghost outline
  var GHOST_ALPHA = 0.45;
  var CORNER_ALPHA = 0.18;

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

  // The outer edges of a cell set, as one path.
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

  // One cell of a piece: colour block with a soft light corner and a thin inner line.
  function block(ctx, x, y, cell, color) {
    ctx.fillStyle = color;
    ctx.fillRect(x, y, cell, cell);
    ctx.fillStyle = 'rgba(255, 255, 255, 0.35)';
    ctx.fillRect(x + cell * 0.12, y + cell * 0.12, cell * 0.28, cell * 0.12);
    ctx.strokeStyle = 'rgba(58, 47, 90, 0.35)';
    ctx.lineWidth = 1;
    ctx.strokeRect(x + 0.5, y + 0.5, cell - 1, cell - 1);
  }

  // Cells of one colour with an outline around each connected shape.
  function shape(ctx, cells, cell, ox, oy, color) {
    cells.forEach(function (c) { block(ctx, ox + c[0] * cell, oy + c[1] * cell, cell, color); });
    ctx.strokeStyle = OUTLINE;
    ctx.lineWidth = Math.max(2, Math.round(cell * 0.08));
    ctx.lineCap = 'round';
    edgePath(ctx, cells, cell, ox, oy);
    ctx.stroke();
  }

  // o: { size, cell, dpr, board (rows of 0|seat), colors {seat: css}, corners [{x, y, color}] (empty start corners),
  //      pieces [{seat, cells}] (optional: outline each piece on its own instead of each connected region),
  //      ghost {cells, ok, color}|null, flash {cells, color}|null }.
  function board(ctx, o) {
    var cell = o.cell, n = o.size, x, y;
    begin(ctx, o.dpr || 1);
    ctx.fillStyle = BOARD_BG;
    ctx.fillRect(0, 0, n * cell, n * cell);
    (o.corners || []).forEach(function (c) {
      ctx.save();
      ctx.globalAlpha = CORNER_ALPHA;
      ctx.fillStyle = c.color;
      ctx.fillRect(c.x * cell, c.y * cell, cell, cell);
      ctx.restore();
    });
    ctx.strokeStyle = GRID;
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (var i = 1; i < n; i++) {
      ctx.moveTo(i * cell + 0.5, 0); ctx.lineTo(i * cell + 0.5, n * cell);
      ctx.moveTo(0, i * cell + 0.5); ctx.lineTo(n * cell, i * cell + 0.5);
    }
    ctx.stroke();
    if (o.pieces) {
      // The caller knows each piece: outline every one on its own (the how-to pictures need touching pieces apart).
      o.pieces.forEach(function (p) { shape(ctx, p.cells, cell, 0, 0, o.colors[p.seat]); });
    } else {
      // placed cells, grouped per seat so each seat's shapes get one outline
      var bySeat = {};
      for (y = 0; y < n; y++) {
        for (x = 0; x < n; x++) {
          var s = o.board[y][x];
          if (s) { (bySeat[s] = bySeat[s] || []).push([x, y]); }
        }
      }
      Object.keys(bySeat).forEach(function (s) { shape(ctx, bySeat[s], cell, 0, 0, o.colors[s]); });
    }
    if (o.flash) {
      ctx.save();
      ctx.fillStyle = '#fffbe0';
      o.flash.cells.forEach(function (c) { ctx.fillRect(c[0] * cell, c[1] * cell, cell, cell); });
      ctx.strokeStyle = o.flash.color;
      ctx.lineWidth = Math.max(3, cell * 0.16);
      ctx.shadowColor = o.flash.color;
      ctx.shadowBlur = cell * 0.6;
      edgePath(ctx, o.flash.cells, cell, 0, 0);
      ctx.stroke();
      ctx.restore();
    }
    if (o.ghost) {
      ctx.save();
      if (o.ghost.ok) {
        ctx.globalAlpha = GHOST_ALPHA;
        ctx.fillStyle = o.ghost.color;
        o.ghost.cells.forEach(function (c) { ctx.fillRect(c[0] * cell, c[1] * cell, cell, cell); });
        ctx.globalAlpha = 1;
        ctx.strokeStyle = OUTLINE;
        ctx.lineWidth = 2;
      } else {
        ctx.setLineDash([Math.max(3, cell * 0.2), Math.max(2, cell * 0.14)]);
        ctx.strokeStyle = BAD;
        ctx.lineWidth = Math.max(2, cell * 0.1);
      }
      edgePath(ctx, o.ghost.cells, cell, 0, 0);
      ctx.stroke();
      ctx.restore();
    }
    ctx.strokeStyle = OUTLINE;
    ctx.lineWidth = 2;
    ctx.strokeRect(1, 1, n * cell - 2, n * cell - 2);
  }

  // Anchor dots (design 2.5) on their own canvas. o: { cell, dpr, color, dots [{x, y, big}], keep? }.
  // keep draws over what is there (the how-to pictures) instead of clearing first.
  function dots(ctx, o) {
    var cell = o.cell;
    if (o.keep) { ctx.setTransform(o.dpr || 1, 0, 0, o.dpr || 1, 0, 0); } else { begin(ctx, o.dpr || 1); }
    o.dots.forEach(function (d) {
      var r = cell * (d.big ? 0.36 : 0.18);
      ctx.beginPath();
      ctx.arc((d.x + 0.5) * cell, (d.y + 0.5) * cell, r, 0, Math.PI * 2);
      ctx.fillStyle = o.color;
      ctx.fill();
      ctx.lineWidth = d.big ? 3 : 2;
      ctx.strokeStyle = '#ffffff';
      ctx.stroke();
    });
  }

  // One piece (normalized cells) on its own canvas; off = grey (cannot be placed now).
  function piece(ctx, cells, cell, dpr, color, off) {
    begin(ctx, dpr || 1);
    shape(ctx, cells, cell, 0, 0, off ? OFF : color);
  }

  G.Render = { board: board, dots: dots, piece: piece };
})(Ailand.games.territory);
