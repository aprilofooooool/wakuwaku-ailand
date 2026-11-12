(function () {
  'use strict';
  var V = Ailand.core.CharacterView;
  var Ch = Ailand.core.Characters;

  describe('core/CharacterView', function () {
    it('basePath is empty without a DOM', function () {
      expect(V.basePath()).toBe('');
    });
    it('candidates: resolved image then normal', function () {
      var p = Ch.get('mametchi');
      expect(V.candidates(p, 'angry-steam')).toEqual([
        'assets/characters/mametchi/anger.png',
        'assets/characters/mametchi/normal.png'
      ]);
    });
    it('candidates: normal has a single entry', function () {
      expect(V.candidates(Ch.get('mametchi'), 'normal')).toEqual(['assets/characters/mametchi/normal.png']);
    });
    it('candidates: own extra image, then normal; basic emotion keeps two', function () {
      var p = Ch.get('kuchipatchi');
      expect(V.candidates(p, 'sleep')).toEqual([
        'assets/characters/kuchipatchi/sleep.png',
        'assets/characters/kuchipatchi/normal.png'
      ]);
      expect(V.candidates(p, 'joy')).toEqual([
        'assets/characters/kuchipatchi/joy.png',
        'assets/characters/kuchipatchi/normal.png'
      ]);
    });
    it('markOf returns the mark of the logical emotion', function () {
      expect(V.markOf('angry-steam')).toBe('steam');
      expect(V.markOf('surprised')).toBe(null);
      expect(V.markOf('joy')).toBe(null);
    });
  });
})();
