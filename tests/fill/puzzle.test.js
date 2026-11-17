(function (A) {
  'use strict';
  var describe = A.Test.describe, it = A.Test.it, expect = A.Test.expect;
  var F = A.games.fill, P = F.Piece, Z = F.Puzzle;

  function connected(cells) {
    var set = {}, i;
    for (i = 0; i < cells.length; i++) { set[cells[i][0] + ',' + cells[i][1]] = true; }
    var seen = {}, stack = [cells[0]], n = 0, d = [[1, 0], [-1, 0], [0, 1], [0, -1]];
    seen[cells[0][0] + ',' + cells[0][1]] = true;
    while (stack.length) {
      var c = stack.pop(); n++;
      for (i = 0; i < 4; i++) {
        var k = (c[0] + d[i][0]) + ',' + (c[1] + d[i][1]);
        if (set[k] && !seen[k]) { seen[k] = true; stack.push([c[0] + d[i][0], c[1] + d[i][1]]); }
      }
    }
    return n === cells.length;
  }

  function rectPicture(w, h) {
    var rows = [];
    for (var y = 0; y < h * 4; y++) { rows.push(new Array(w * 4 + 1).join('a')); }
    return { id: 'rect', name: 'rect', level: 'easy', palette: { a: '#000' }, pixels: rows };
  }

  describe('fill puzzle', function () {
    it('frameOf counts cells from dots', function () {
      var pic = { id: 't', name: 't', level: 'easy', palette: { a: '#000' }, pixels: [
        '..a.....', '........', '........', '........'
      ] };
      var f = Z.frameOf(pic);
      expect(f.w).toBe(2);
      expect(f.h).toBe(1);
      expect(f.on).toEqual([[true, false]]);
      expect(f.cells).toEqual([[0, 0]]);
      expect(f.count).toBe(1);
    });
    it('every picture makes a valid puzzle', function () {
      F.Pictures.forEach(function (pic) {
        for (var seed = 1; seed <= 20; seed++) {
          var pz = Z.make(pic, seed), seen = {}, total = 0;
          pz.pieces.forEach(function (p) {
            expect(p.cells.length).toBeGreaterThanOrEqual(4);
            expect(p.cells.length).toBeLessThanOrEqual(5);
            expect(connected(p.cells)).toBe(true);
            P.place(p.cells, p.answer.x, p.answer.y).forEach(function (c) {
              var k = c[0] + ',' + c[1];
              expect(seen[k]).toBeFalsy();
              seen[k] = true; total++;
            });
          });
          expect(total).toBe(pz.frame.count);
          expect(pz.tray.length).toBe(pz.pieces.length);
          var ids = pz.pieces.map(function (p) { return p.id; }).sort();
          expect(pz.tray.slice().sort()).toEqual(ids);
        }
      });
    });
    it('same seed same puzzle', function () {
      var pic = F.Pictures[0];
      expect(Z.make(pic, 5)).toEqual(Z.make(pic, 5));
    });
    it('different seeds usually differ', function () {
      var pic = F.Pictures[0], set = {};
      for (var s = 1; s <= 10; s++) { set[JSON.stringify(Z.make(pic, s).pieces)] = true; }
      expect(Object.keys(set).length).toBeGreaterThanOrEqual(2);
    });
    it('answer placement fills the frame', function () {
      var pic = F.Pictures[3], pz = Z.make(pic, 2), all = [];
      pz.pieces.forEach(function (p) { all = all.concat(P.place(p.cells, p.answer.x, p.answer.y)); });
      expect(P.normalize(all)).toEqual(P.normalize(pz.frame.cells));
      expect(all.length).toBe(pz.frame.count);
    });
    it('start is one of 8 orientations and color is 0 to 3', function () {
      var pz = Z.make(F.Pictures[0], 1);
      pz.pieces.forEach(function (p) {
        expect(p.start.rot >= 0 && p.start.rot <= 3).toBe(true);
        expect(p.start.flip === 0 || p.start.flip === 1).toBe(true);
        expect(p.color >= 0 && p.color <= 3).toBe(true);
      });
    });
    it('neighbors get different colors when possible', function () {
      var pz = Z.make(rectPicture(2, 4), 1);
      expect(pz.pieces.length).toBe(2);
      expect(pz.pieces[0].color === pz.pieces[1].color).toBe(false);
    });
  });
})(window.Ailand);
