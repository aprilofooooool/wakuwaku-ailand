(function () {
  'use strict';
  var LP = Ailand.core.LinePicker;
  var Rng = Ailand.core.Rng;

  describe('core/LinePicker', function () {
    it('prefers game lines, falls back to common lines, then empty', function () {
      var p = LP.create({
        gameLines: { mametchi: { start: ['G'] } },
        commonLines: { start: ['C'], win: ['W'] },
        rng: Rng.mulberry32(1)
      });
      expect(p.pick('mametchi', 'start')).toBe('G');
      expect(p.pick('mimitchi', 'start')).toBe('C');
      expect(p.pick('mametchi', 'win')).toBe('W');
      expect(p.pick('mametchi', 'draw')).toBe('');
    });
    it('never returns the same line twice in a row', function () {
      var p = LP.create({
        gameLines: { a: { s: ['x', 'y', 'z'] } },
        commonLines: {},
        rng: Rng.mulberry32(7)
      });
      var prev = p.pick('a', 's');
      for (var i = 0; i < 200; i++) {
        var cur = p.pick('a', 's');
        expect(cur === prev).toBe(false);
        prev = cur;
      }
    });
    it('also avoids repeats for common lines with two lines', function () {
      var p = LP.create({ gameLines: {}, commonLines: { s: ['x', 'y'] }, rng: Rng.mulberry32(3) });
      var prev = p.pick('a', 's');
      for (var i = 0; i < 50; i++) {
        var cur = p.pick('a', 's');
        expect(cur === prev).toBe(false);
        prev = cur;
      }
    });
    it('a single line may repeat', function () {
      var p = LP.create({ gameLines: {}, commonLines: { s: ['x'] }, rng: Rng.mulberry32(3) });
      expect(p.pick('a', 's')).toBe('x');
      expect(p.pick('a', 's')).toBe('x');
    });
    it('works without gameLines and rng', function () {
      var p = LP.create({ commonLines: { s: ['x', 'y'] } });
      expect(['x', 'y']).toContain(p.pick('a', 's'));
    });
  });
})();
