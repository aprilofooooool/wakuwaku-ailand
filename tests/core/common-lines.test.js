(function () {
  'use strict';
  var L = Ailand.core.CommonLines;
  var SITUATIONS = ['start', 'reach', 'reached', 'block', 'blocked', 'double', 'doubled',
    'endgame', 'win', 'lose', 'draw', 'thinking'];

  describe('core/CommonLines', function () {
    it('has 12 situations with 3+ lines of at most 20 chars', function () {
      expect(Object.keys(L).sort()).toEqual(SITUATIONS.slice().sort());
      SITUATIONS.forEach(function (s) {
        expect(L[s].length).toBeGreaterThanOrEqual(3);
        L[s].forEach(function (line) {
          expect(typeof line).toBe('string');
          expect(line.length > 0).toBe(true);
          expect(line.length).toBeLessThanOrEqual(20);
        });
      });
    });
    it('lines are character-neutral (no signature endings)', function () {
      SITUATIONS.forEach(function (s) {
        L[s].forEach(function (line) {
          expect(/だっち|ぴょん/.test(line)).toBe(false);
        });
      });
    });
  });
})();
