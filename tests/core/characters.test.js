(function () {
  'use strict';
  var Ch = Ailand.core.Characters;
  var FACES = ['normal', 'joy', 'anger', 'sadness', 'panic', 'thinking'];

  describe('core/Characters', function () {
    it('lists the 4 characters in order', function () {
      expect(Ch.list().map(function (c) { return c.id; }))
        .toEqual(['mametchi', 'kuchipatchi', 'mimitchi', 'flowertchi']);
    });
    it('profiles have the required shape and no lines/hasDisc', function () {
      Ch.list().forEach(function (c) {
        expect(/^[a-z0-9-]+$/.test(c.id)).toBe(true);
        expect(c.image.dir).toBe('assets/characters/' + c.id + '/');
        expect(c.image.ext).toBe('png');
        expect('hasDisc' in c.image).toBe(false);
        expect('lines' in c).toBe(false);
        expect(typeof c.name).toBe('string');
        expect(/^#[0-9a-f]{6}$/i.test(c.colors.main)).toBe(true);
        expect(/^#[0-9a-f]{6}$/i.test(c.colors.sub)).toBe(true);
        FACES.forEach(function (f) { expect(typeof c.face[f]).toBe('string'); });
        expect(typeof c.voice.firstPerson).toBe('string');
        expect('ending' in c.voice).toBe(true);
      });
    });
    it('get returns null for unknown ids', function () {
      expect(Ch.get('nobody')).toBe(null);
      expect(Ch.get('mametchi').name).toBe('まめっち');
    });
    it('list returns copies that cannot corrupt the registry', function () {
      Ch.list()[0].name = 'x';
      expect(Ch.get('mametchi').name).toBe('まめっち');
    });
  });
})();
