(function (A) {
  'use strict';
  var describe = A.Test.describe, it = A.Test.it, expect = A.Test.expect;
  var Fx = A.games.drop4.Fx;

  describe('drop4 Fx.drop', function () {
    it('resolves at once under reduced motion', function () {
      var F = A.core.Effects, orig = F.isReduced, done = false;
      F.isReduced = function () { return true; };
      var p = Fx.drop({}, 3).then(function () { done = true; });
      F.isReduced = orig;
      return p.then(function () { expect(done).toBe(true); });
    });
    it('play with null picked does nothing', function () { expect(Fx.play(null, {})).toBe(undefined); });
    it('stop with nothing on screen is safe', function () { Fx.stop(); expect(true).toBe(true); });
  });

  // Winner hero placement: the whole block (hero + bounce + caption) must stay inside the viewport,
  // below the header, for PC and phone sizes and any winning-line position.
  describe('drop4 Fx.heroSize / Fx.heroTop (hero always fully visible)', function () {
    var SIZES = [[1280, 800], [1920, 1080], [1024, 768], [844, 390], [390, 844]];
    var HEADER = 72, MARGIN = 8, CAPTION = 56, GAP = 12;
    SIZES.forEach(function (sz) {
      [1, 2, 3, 4].forEach(function (n) {
        ['top', 'middle', 'bottom'].forEach(function (where) {
          it(sz[0] + 'x' + sz[1] + ', ' + n + ' winner(s), line near the ' + where, function () {
            var vw = sz[0], vh = sz[1];
            var avail = vh - HEADER - 2 * MARGIN - GAP - CAPTION;
            var hs = Fx.heroSize({ vw: vw, vh: vh, n: n, avail: avail });
            expect(hs.size > 40).toBe(true);
            expect(hs.size <= Math.min(0.6 * vw, 0.7 * vh) + 0.001).toBe(true);
            var blockH = hs.height + hs.bounce + GAP + CAPTION;
            var boardTop = HEADER + 20, boardH = vh - boardTop - 20;
            var lineTop = where === 'top' ? boardTop + 10 : where === 'middle' ? boardTop + boardH / 2 - 30 : boardTop + boardH - 70;
            var top = Fx.heroTop({ vh: vh, headerBottom: HEADER, heroH: blockH, lineTop: lineTop, lineBottom: lineTop + 60, margin: MARGIN });
            expect(top >= HEADER + MARGIN - 0.001).toBe(true);
            expect(top + blockH <= vh - MARGIN + 0.001).toBe(true);
          });
        });
      });
    });
    it('prefers the side of the line with more room when it fits', function () {
      // Line near the bottom: lots of room above.
      var top = Fx.heroTop({ vh: 1000, headerBottom: 72, heroH: 300, lineTop: 800, lineBottom: 860, margin: 8 });
      expect(top + 300 <= 800 - 8).toBe(true);
      // Line near the top: goes below.
      top = Fx.heroTop({ vh: 1000, headerBottom: 72, heroH: 300, lineTop: 100, lineBottom: 160, margin: 8 });
      expect(top >= 160 + 8).toBe(true);
    });
    it('centers in the viewport when neither side fits', function () {
      var top = Fx.heroTop({ vh: 800, headerBottom: 72, heroH: 500, lineTop: 380, lineBottom: 440, margin: 8 });
      expect(top).toBe(150);
    });
  });

  describe('drop4 Fx.drop (reduced motion / no DOM)', function () {
    it('play with null picked does nothing', function () { expect(Fx.play(null, {})).toBe(undefined); });
  });
})(Ailand);
