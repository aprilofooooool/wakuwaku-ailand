(function () {
  'use strict';
  var V = Ailand.core.EmotionVariety;
  function zero() { return 0; }

  describe('core/EmotionVariety', function () {
    it('picks from the pool', function () {
      var x = V.create(function () { return 0.5; }).pick('a', ['joy', 'cheer']);
      expect(['joy', 'cheer'].indexOf(x) >= 0).toBe(true);
    });
    it('never three in a row', function () {
      var v = V.create(zero), seq = [], i;
      for (i = 0; i < 10; i++) { seq.push(v.pick('a', ['joy', 'cheer'])); }
      for (i = 2; i < seq.length; i++) {
        expect(seq[i] === seq[i - 1] && seq[i] === seq[i - 2]).toBe(false);
      }
    });
    it('single pool repeats', function () {
      var v = V.create(zero);
      expect([v.pick('a', ['thinking']), v.pick('a', ['thinking']), v.pick('a', ['thinking'])]).toEqual(['thinking', 'thinking', 'thinking']);
    });
    it('keys are independent', function () {
      var v = V.create(zero);
      v.pick('a', ['joy', 'cheer']);
      v.pick('a', ['joy', 'cheer']);
      expect(v.pick('b', ['joy', 'cheer'])).toBe('joy');
    });
    it('reset clears history', function () {
      var v = V.create(zero);
      v.pick('a', ['joy', 'cheer']);
      v.pick('a', ['joy', 'cheer']);
      v.reset();
      expect(v.pick('a', ['joy', 'cheer'])).toBe('joy');
    });
  });
})();
