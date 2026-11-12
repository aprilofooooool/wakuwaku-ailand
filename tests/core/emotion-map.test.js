(function () {
  'use strict';
  var E = Ailand.core.EmotionMap;

  describe('core/EmotionMap', function () {
    it('expressions with their own image (added 2026-11-12) use it without a mark', function () {
      ['worried', 'surprised', 'excited', 'smug', 'cheer', 'love'].forEach(function (n) {
        expect(E.resolve(n)).toEqual({ image: n, mark: null });
      });
    });
    it('sleep uses its own image with the zzz mark (B-3)', function () {
      expect(E.resolve('sleep')).toEqual({ image: 'sleep', mark: 'zzz' });
    });
    it('angry-steam still borrows the anger image with a mark', function () {
      expect(E.resolve('angry-steam')).toEqual({ image: 'anger', mark: 'steam' });
    });
    it('basic expressions map to themselves without a mark', function () {
      ['normal', 'joy', 'anger', 'sadness', 'panic', 'thinking'].forEach(function (n) {
        expect(E.resolve(n)).toEqual({ image: n, mark: null });
      });
    });
    it('unknown names fall back to normal', function () {
      expect(E.resolve('unknown')).toEqual({ image: 'normal', mark: null });
      expect(E.resolve(undefined)).toEqual({ image: 'normal', mark: null });
      expect(E.resolve('toString')).toEqual({ image: 'normal', mark: null });
    });
    it('LOGICAL lists all 14 names', function () {
      expect(E.LOGICAL.length).toBe(14);
      E.LOGICAL.forEach(function (n) { expect(/^[a-z]+(-[a-z]+)*$/.test(n)).toBe(true); });
    });
  });
})();
