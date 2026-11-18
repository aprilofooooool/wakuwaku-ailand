(function (A) {
  'use strict';
  var describe = A.Test.describe, it = A.Test.it, expect = A.Test.expect;
  var F = A.games.fill, C = F.Constants, P = F.Piece, Z = F.Puzzle;

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
    for (var y = 0; y < h * 2; y++) { rows.push(new Array(w * 2 + 1).join('a')); }
    return { id: 'rect', name: 'rect', level: 'easy', palette: { a: '#000' }, pixels: rows };
  }

  describe('fill puzzle', function () {
    it('frameOf counts cells from dots', function () {
      var pic = { id: 't', name: 't', level: 'easy', palette: { a: '#000' }, pixels: [
        '.a..', '....'
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
        var count = C.LEVEL[pic.level].pieces;
        for (var seed = 1; seed <= 30; seed++) {
          var pz = Z.make(pic, seed), seen = {}, total = 0, avg = pz.frame.count / count;
          expect(pz.pieces.length).toBe(count);
          pz.pieces.forEach(function (p) {
            expect(p.cells.length).toBeGreaterThanOrEqual(Math.ceil(0.5 * avg));
            expect(p.cells.length).toBeLessThanOrEqual(Math.floor(1.5 * avg));
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
    it('start rot follows the level', function () {
      F.Pictures.forEach(function (pic) {
        var pz = Z.make(pic, 1), rotates = C.LEVEL[pic.level].rotate;
        pz.pieces.forEach(function (p) {
          expect(p.start.flip).toBe(undefined);
          expect(p.color).toBe(undefined);
          if (rotates) { expect(p.start.rot >= 0 && p.start.rot <= 3).toBe(true); }
          else { expect(p.start.rot).toBe(0); }
        });
      });
    });
  });
})(window.Ailand);
