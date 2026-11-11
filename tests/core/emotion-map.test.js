(function () {
  'use strict';
  var E = Ailand.core.EmotionMap;

  describe('core/EmotionMap', function () {
    it('maps the extended expressions', function () {
      expect(E.resolve('surprised')).toEqual({ image: 'panic', mark: 'bang' });
      expect(E.resolve('worried')).toEqual({ image: 'panic', mark: 'sweat' });
      expect(E.resolve('excited')).toEqual({ image: 'joy', mark: 'sparkle' });
      expect(E.resolve('sleep')).toEqual({ image: 'normal', mark: 'zzz' });
      expect(E.resolve('angry-steam')).toEqual({ image: 'anger', mark: 'steam' });
      expect(E.resolve('smug')).toEqual({ image: 'joy', mark: 'smirk' });
      expect(E.resolve('cheer')).toEqual({ image: 'joy', mark: 'cheer' });
      expect(E.resolve('love')).toEqual({ image: 'joy', mark: 'love' });
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
