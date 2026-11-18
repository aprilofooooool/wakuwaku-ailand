(function (A) {
  'use strict';
  var describe = A.Test.describe, it = A.Test.it, expect = A.Test.expect;
  var R = A.games.fill.Reactions;
  var BAD = ['worried', 'sadness', 'anger', 'panic'];

  function all(r) {
    return [r.forPlaced(), r.forLast(), r.forHint(),
      r.forClear(false, false), r.forClear(true, false), r.forClear(false, true), r.forClear(true, true)];
  }

  describe('fill/Reactions', function () {
    it('placed reacts about one in three', function () {
      var r = R.create(A.core.Rng.mulberry32(7)), n = 3000, hit = 0, i, x;
      for (i = 0; i < n; i++) {
        x = r.forPlaced();
        if (x) { hit++; expect(x).toEqual({ emotion: 'joy', situation: 'place' }); }
      }
      expect(hit / n >= 0.28 && hit / n <= 0.39).toBe(true);
    });
    it('last, hint and clear faces', function () {
      var r = R.create(function () { return 0; });
      expect(r.forLast()).toEqual({ emotion: 'excited', situation: 'last' });
      expect(r.forHint()).toEqual({ emotion: 'thinking', situation: 'hint' });
    });
    it('no bad faces', function () {
      var i, r;
      for (i = 0; i < 200; i++) {
        r = R.create(A.core.Rng.mulberry32(i));
        all(r).forEach(function (x) { if (x) { expect(BAD.indexOf(x.emotion)).toBe(-1); } });
      }
    });
    it('clear situations', function () {
      var r = R.create(function () { return 0; });
      expect(r.forClear(false, false).situation).toBe('clear');
      expect(r.forClear(true, false).situation).toBe('sparkle');
      expect(r.forClear(false, true).situation).toBe('pageDone');
      expect(r.forClear(true, true).situation).toBe('pageDone');
    });
    it('clear emotions come from the allowed set', function () {
      [0, 0.5, 0.99].forEach(function (v) {
        var r = R.create(function () { return v; });
        expect(['excited', 'cheer'].indexOf(r.forClear(false, false).emotion) >= 0).toBe(true);
        expect(['excited', 'cheer', 'love'].indexOf(r.forClear(true, false).emotion) >= 0).toBe(true);
      });
    });
    it('same emotion never three times in a row', function () {
      [0, 0.5, 0.99].forEach(function (v) {
        var r = R.create(function () { return v; }), seq = [], i;
        for (i = 0; i < 100; i++) { seq.push(r.forClear(true, false).emotion); }
        for (i = 2; i < seq.length; i++) {
          expect(seq[i] === seq[i - 1] && seq[i] === seq[i - 2]).toBe(false);
        }
      });
      var r2 = R.create(A.core.Rng.mulberry32(9)), s2 = [], j;
      for (j = 0; j < 100; j++) { s2.push(r2.forClear(false, false).emotion); }
      for (j = 2; j < s2.length; j++) { expect(s2[j] === s2[j - 1] && s2[j] === s2[j - 2]).toBe(false); }
    });
    it('reset forgets the history', function () {
      var r = R.create(function () { return 0; });
      r.forClear(false, false); r.forClear(false, false);
      r.reset();
      expect(r.forClear(false, false).emotion).toBe('excited');
    });
  });
})(window.Ailand);
