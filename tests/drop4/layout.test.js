(function (A) {
  'use strict';
  var describe = A.Test.describe, it = A.Test.it, expect = A.Test.expect;
  var L = A.games.drop4.Layout;

  // The board, its ghost row, its frame/shadow and every reserved row/column must fit inside w x h.
  // Spelled out with the constants (not via L.reserved) so the test checks compute() independently.
  function fits(r, w, h, cols, rows) {
    expect(r.boardW).toBe(cols * r.cell + (cols - 1) * L.GAP + 2 * L.PAD);
    expect(r.boardH).toBe(rows * r.cell + (rows - 1) * L.GAP + 2 * L.PAD);
    expect(r.colHit).toBe(r.cell + L.GAP);
    if (r.orientation === 'portrait') {
      expect(r.boardW + L.DECOR_W + 2 * L.SIDE).toBeLessThanOrEqual(w);
      expect(r.boardH + r.cell + L.TOOLS_H + L.CHARS_H + 2 * L.VPAD + L.DECOR_H).toBeLessThanOrEqual(h);
    } else {
      expect(r.boardW + L.DECOR_W + 2 * L.SIDE + 2 * L.SIDE_W + L.TOOLS_W).toBeLessThanOrEqual(w);
      expect(r.boardH + r.cell + 2 * L.VPAD_L + L.DECOR_H).toBeLessThanOrEqual(h);
    }
  }
  // Game-area sizes = viewport minus the header (72px; 67px in the compact landscape header at height <= 500px).
  var VIEWPORTS = [[390, 844, 772], [844, 390, 323], [1024, 768, 696], [1280, 800, 728]];
  var BOARDS = [[7, 6, 2], [9, 7, 3], [10, 8, 4]];

  describe('drop4 Layout.compute', function () {
    it('390x844 with 7x6 is portrait and the board fits the width', function () {
      var r = L.compute({ width: 390, height: 844, cols: 7, rows: 6, players: 2 });
      expect(r.orientation).toBe('portrait');
      expect(r.cell * 7).toBeLessThanOrEqual(390 - 32);
      expect(r.cell % 1).toBe(0);
      fits(r, 390, 844, 7, 6);
    });
    it('844x390 is landscape', function () {
      var r = L.compute({ width: 844, height: 390, cols: 7, rows: 6, players: 2 });
      expect(r.orientation).toBe('landscape');
      fits(r, 844, 390, 7, 6);
    });
    it('landscape phone (844x390, compact header) keeps 7x6 cells >= 38px', function () {
      var r = L.compute({ width: 844, height: 323, cols: 7, rows: 6, players: 2 });
      expect(r.orientation).toBe('landscape');
      expect(r.cell).toBeGreaterThanOrEqual(38);
    });
    it('10x8 on 390x844 stays on screen and colHit >= cell', function () {
      var r = L.compute({ width: 390, height: 844, cols: 10, rows: 8, players: 4 });
      fits(r, 390, 844, 10, 8);
      expect(r.colHit).toBeGreaterThanOrEqual(r.cell);
    });
    it('cell is the largest integer that fits (one more does not fit)', function () {
      VIEWPORTS.forEach(function (v) {
        BOARDS.forEach(function (b) {
          var r = L.compute({ width: v[0], height: v[2], cols: b[0], rows: b[1], players: b[2] });
          var res = L.reserved(r.orientation), c = r.cell + 1;
          var w1 = b[0] * c + (b[0] - 1) * L.GAP + 2 * L.PAD;
          var h1 = (b[1] + 1) * c + (b[1] - 1) * L.GAP + 2 * L.PAD;
          expect(w1 > v[0] - res.w || h1 > v[2] - res.h || r.cell === L.CELL_MAX).toBe(true);
        });
      });
    });
    it('recomputing after a resize matches the new size', function () {
      var a = L.compute({ width: 390, height: 772, cols: 7, rows: 6, players: 2 });
      var b = L.compute({ width: 844, height: 323, cols: 7, rows: 6, players: 2 });
      expect(a.orientation).toBe('portrait');
      expect(b.orientation).toBe('landscape');
      fits(a, 390, 772, 7, 6);
      fits(b, 844, 323, 7, 6);
      var c = L.compute({ width: 390, height: 772, cols: 7, rows: 6, players: 2 });
      expect(JSON.stringify(c)).toBe(JSON.stringify(a));
    });
    it('the 4 check viewports fit every board size (with and without the header)', function () {
      VIEWPORTS.forEach(function (v) {
        BOARDS.forEach(function (b) {
          [v[1], v[2]].forEach(function (h) {
            var r = L.compute({ width: v[0], height: h, cols: b[0], rows: b[1], players: b[2] });
            fits(r, v[0], h, b[0], b[1]);
            expect(r.cell).toBeGreaterThanOrEqual(1);
          });
        });
      });
    });
    it('reserved space matches the orientation', function () {
      expect(L.reserved('portrait').h).toBe(2 * L.VPAD + L.TOOLS_H + L.CHARS_H + L.DECOR_H);
      expect(L.reserved('landscape').w).toBe(2 * L.SIDE + 2 * L.SIDE_W + L.TOOLS_W + L.DECOR_W);
    });
  });

  describe('drop4 Layout.colAt', function () {
    function lay() { return L.compute({ width: 390, height: 844, cols: 7, rows: 6, players: 2 }); }
    it('maps x over the full column width (gaps included) to a column', function () {
      var r = lay();
      expect(L.colAt(L.PAD + 1, r, 7)).toBe(0);
      expect(L.colAt(L.PAD + r.cell + L.GAP / 2 - 1, r, 7)).toBe(0);
      expect(L.colAt(L.PAD + r.colHit + 1, r, 7)).toBe(1);
      expect(L.colAt(r.boardW - 1, r, 7)).toBe(6);
    });
    it('padding belongs to the edge columns; outside the board is -1', function () {
      var r = lay();
      expect(L.colAt(0, r, 7)).toBe(0);
      expect(L.colAt(-1, r, 7)).toBe(-1);
      expect(L.colAt(r.boardW + 1, r, 7)).toBe(-1);
    });
  });
})(window.Ailand);
