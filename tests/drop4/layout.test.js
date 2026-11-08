(function (A) {
  'use strict';
  var describe = A.Test.describe, it = A.Test.it, expect = A.Test.expect;
  var L = A.games.drop4.Layout;

  // The board (ghost row included) must fit inside the given area.
  function fits(r, w, h, cols, rows) {
    expect(r.boardW).toBeLessThanOrEqual(w - 32);
    expect(r.boardH + r.cell).toBeLessThanOrEqual(h);
    expect(r.boardW).toBe(cols * r.cell + (cols - 1) * L.GAP + 2 * L.PAD);
    expect(r.boardH).toBe(rows * r.cell + (rows - 1) * L.GAP + 2 * L.PAD);
  }

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
    it('10x8 on 390x844 stays on screen and colHit >= cell', function () {
      var r = L.compute({ width: 390, height: 844, cols: 10, rows: 8, players: 4 });
      fits(r, 390, 844, 10, 8);
      expect(r.colHit).toBeGreaterThanOrEqual(r.cell);
      expect(r.colHit).toBe(r.cell + L.GAP);
    });
    it('cell is the largest integer that fits (one more does not fit)', function () {
      var r = L.compute({ width: 390, height: 844, cols: 7, rows: 6, players: 2 });
      var w1 = 7 * (r.cell + 1) + 6 * L.GAP + 2 * L.PAD;
      var h1 = 6 * (r.cell + 1) + 5 * L.GAP + 2 * L.PAD + (r.cell + 1);
      expect(w1 > 390 - 32 || h1 > 844 - L.PORTRAIT_RESERVED_H || r.cell === L.CELL_MAX).toBe(true);
    });
    it('recomputing after a resize matches the new size', function () {
      var a = L.compute({ width: 390, height: 772, cols: 7, rows: 6, players: 2 });
      var b = L.compute({ width: 844, height: 318, cols: 7, rows: 6, players: 2 });
      expect(a.orientation).toBe('portrait');
      expect(b.orientation).toBe('landscape');
      fits(a, 390, 772, 7, 6);
      fits(b, 844, 318, 7, 6);
      expect(b.boardH + b.cell).toBeLessThanOrEqual(318 - L.TOOLS_H);
      var c = L.compute({ width: 390, height: 772, cols: 7, rows: 6, players: 2 });
      expect(JSON.stringify(c)).toBe(JSON.stringify(a));
    });
    it('iPad and PC sizes fit for every board size', function () {
      [[1024, 696], [1280, 728], [768, 952], [390, 772], [844, 318]].forEach(function (wh) {
        [[7, 6, 2], [9, 7, 3], [10, 8, 4]].forEach(function (b) {
          var r = L.compute({ width: wh[0], height: wh[1], cols: b[0], rows: b[1], players: b[2] });
          fits(r, wh[0], wh[1], b[0], b[1]);
          expect(r.cell).toBeGreaterThanOrEqual(1);
        });
      });
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
