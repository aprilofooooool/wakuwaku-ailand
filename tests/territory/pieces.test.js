(function (A) {
  'use strict';
  var describe = A.Test.describe, it = A.Test.it, expect = A.Test.expect;
  var Pieces = A.games.territory.Pieces, Piece = A.core.Piece;

  function connected(cells) {
    var set = {}, i;
    for (i = 0; i < cells.length; i++) { set[cells[i][0] + ',' + cells[i][1]] = true; }
    var seen = {}, stack = [cells[0]], n = 0, d = [[1, 0], [-1, 0], [0, 1], [0, -1]];
    seen[cells[0][0] + ',' + cells[0][1]] = true;
    while (stack.length) {
      var c = stack.pop(); n++;
      for (i = 0; i < 4; i++) {
        var nx = c[0] + d[i][0], ny = c[1] + d[i][1], k = nx + ',' + ny;
        if (set[k] && !seen[k]) { seen[k] = true; stack.push([nx, ny]); }
      }
    }
    return n === cells.length;
  }

  describe('territory pieces', function () {
    it('twelve pieces of 44 cells', function () {
      var total = 0;
      Pieces.LIST.forEach(function (p) { total += p.cells.length; });
      expect(Pieces.LIST.length).toBe(12);
      expect(total).toBe(44);
      expect(Pieces.TOTAL_CELLS).toBe(44);
      expect(Pieces.LIST.map(function (p) { return p.id; }).join(',')).toBe('p1,i2,i3,l3,i4,o4,t4,l4,s4,x5,l5,w5');
      expect(Pieces.byId('x5').cells.length).toBe(5);
      expect(Pieces.byId('nope')).toBe(null);
    });
    it('every piece is connected', function () {
      Pieces.LIST.forEach(function (p) {
        expect(connected(p.cells)).toBe(true);
        expect(JSON.stringify(p.cells)).toBe(JSON.stringify(Piece.normalize(p.cells)));
      });
    });
    it('no two pieces share a shape in any orientation', function () {
      var seen = {};
      Pieces.LIST.forEach(function (p) {
        var mine = Piece.orientations(p.cells);
        mine.forEach(function (o) { expect(seen[JSON.stringify(o.cells)]).toBe(undefined); });
        mine.forEach(function (o) { seen[JSON.stringify(o.cells)] = p.id; });
      });
    });
  });
})(window.Ailand);
