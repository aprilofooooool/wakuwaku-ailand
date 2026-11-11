(function (A) {
  'use strict';
  var describe = A.Test.describe, it = A.Test.it, expect = A.Test.expect;
  var R = A.games.whack.Reactions;

  describe('whack/Reactions', function () {
    it('self emotion never repeats three times', function () {
      var r = R.create(function () { return 0; });
      var seq = [], i;
      for (i = 0; i < 10; i++) { seq.push(r.forHit(0, 'self').emotion); }
      for (i = 2; i < seq.length; i++) {
        expect(seq[i] === seq[i - 1] && seq[i] === seq[i - 2]).toBe(false);
      }
    });
    it('self picks emotion and deco from the allowed sets', function () {
      var r = R.create(function () { return 0.5; });
      var x = r.forHit(0, 'self');
      expect(['joy', 'excited', 'surprised'].indexOf(x.emotion) >= 0).toBe(true);
      expect(['note', 'heart', 'sparkle'].indexOf(x.deco) >= 0).toBe(true);
    });
    it('keeps history per side', function () {
      var r = R.create(function () { return 0; });
      r.forHit(0, 'self'); r.forHit(0, 'self');
      expect(r.forHit(1, 'self').emotion).toBe('joy');
      expect(r.forHit(0, 'self').emotion !== 'joy').toBe(true);
    });
    it('rare and ng are fixed', function () {
      var r = R.create(function () { return 0; });
      expect(r.forHit(0, 'rare')).toEqual({ emotion: 'excited', deco: 'sparkle' });
      expect(r.forHit(0, 'ng')).toEqual({ emotion: 'smug', deco: null });
    });
  });
})(window.Ailand);
