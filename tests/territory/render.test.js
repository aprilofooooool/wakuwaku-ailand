(function (A) {
  'use strict';
  var describe = A.Test.describe, it = A.Test.it, expect = A.Test.expect;
  var R = A.games.territory.Render;

  // A recording 2d context: counts outline strokes (one per drawn shape) and ignores everything else.
  function fakeCtx() {
    var ctx = { outlines: 0, canvas: { width: 100, height: 100 }, strokeStyle: '', fillStyle: '' };
    ['setTransform', 'clearRect', 'fillRect', 'strokeRect', 'beginPath', 'moveTo', 'lineTo', 'save', 'restore',
      'arc', 'fill', 'setLineDash'].forEach(function (n) { ctx[n] = function () {}; });
    ctx.stroke = function () { if (ctx.strokeStyle === '#3a2f5a') { ctx.outlines++; } };
    return ctx;
  }
  function empty(n) {
    var b = [];
    for (var y = 0; y < n; y++) { b.push([]); for (var x = 0; x < n; x++) { b[y].push(0); } }
    return b;
  }

  describe('territory/Render.board pieces', function () {
    it('touching same-colour cells share one outline without pieces', function () {
      var b = empty(4);
      [[0, 0], [1, 0], [0, 1], [2, 0], [2, 1]].forEach(function (c) { b[c[1]][c[0]] = 1; });
      var ctx = fakeCtx();
      R.board(ctx, { size: 4, cell: 10, board: b, colors: { 1: '#f00' } });
      expect(ctx.outlines).toBe(1);
    });
    it('each piece gets its own outline when pieces are given', function () {
      var b = empty(4);
      var a = [[0, 0], [1, 0], [0, 1]], c = [[2, 0], [2, 1]];
      a.concat(c).forEach(function (p) { b[p[1]][p[0]] = 1; });
      var ctx = fakeCtx();
      R.board(ctx, { size: 4, cell: 10, board: b, colors: { 1: '#f00' }, pieces: [{ seat: 1, cells: a }, { seat: 1, cells: c }] });
      expect(ctx.outlines).toBe(2);
    });
  });
})(Ailand);
