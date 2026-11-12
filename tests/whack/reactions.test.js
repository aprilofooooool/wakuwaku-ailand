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
      expect(['joy', 'excited', 'cheer', 'love'].indexOf(x.emotion) >= 0).toBe(true);
    });
    it('self never uses the panic-based surprised face', function () {
      var vals = [0, 0.3, 0.6, 0.99], seen = {};
      vals.forEach(function (v) {
        var r = R.create(function () { return v; });
        for (var i = 0; i < 6; i++) { seen[r.forHit(0, 'self').emotion] = true; }
      });
      expect(!!seen.surprised).toBe(false);
      expect(!!seen.cheer && !!seen.love).toBe(true);
    });
    it('every self emotion gets a deco', function () {
      [[0, 'joy'], [0.3, 'excited'], [0.6, 'cheer'], [0.99, 'love']].forEach(function (c) {
        var x = R.create(function () { return c[0]; }).forHit(0, 'self');
        expect(x.emotion).toBe(c[1]);
        expect(['note', 'heart', 'sparkle'].indexOf(x.deco) >= 0).toBe(true);
      });
    });
    it('keeps history per side', function () {
      var r = R.create(function () { return 0; });
      r.forHit(0, 'self'); r.forHit(0, 'self');
      expect(r.forHit(1, 'self').emotion).toBe('joy');
      expect(r.forHit(0, 'self').emotion !== 'joy').toBe(true);
    });
    it('rare is excited or surprised with sparkle; ng is smug', function () {
      expect(R.create(function () { return 0; }).forHit(0, 'rare')).toEqual({ emotion: 'excited', deco: 'sparkle' });
      expect(R.create(function () { return 0.99; }).forHit(0, 'rare')).toEqual({ emotion: 'surprised', deco: 'sparkle' });
      expect(R.create(function () { return 0; }).forHit(0, 'ng')).toEqual({ emotion: 'smug', deco: null });
    });
  });

  describe('whack/Reactions combo and result (B-3)', function () {
    function hits(r, side, kind, n) { var out = []; for (var i = 0; i < n; i++) { out.push(r.forHit(side, kind)); } return out; }
    function mk() { return R.create(function () { return 0.5; }); }
    it('combo on every 5th self hit', function () {
      var out = hits(mk(), 0, 'self', 10);
      expect(out[4]).toEqual({ emotion: 'cheer', deco: 'sparkle', combo: true });
      expect(out[9].combo).toBe(true);
      expect(out.filter(function (x) { return x.combo; }).length).toBe(2);
    });
    it('ng resets combo', function () {
      var r = mk();
      hits(r, 0, 'self', 4);
      r.forHit(0, 'ng');
      var out = hits(r, 0, 'self', 5);
      expect(out.map(function (x) { return !!x.combo; })).toEqual([false, false, false, false, true]);
    });
    it('rare counts but wins over combo', function () {
      var r = mk();
      hits(r, 0, 'self', 4);
      var rare = r.forHit(0, 'rare');
      expect(!!rare.combo).toBe(false);
      expect(rare.deco).toBe('sparkle');
      var out = hits(r, 0, 'self', 5);
      expect(out.map(function (x) { return !!x.combo; })).toEqual([false, false, false, false, true]);
    });
    it('sides are independent', function () {
      var r = mk();
      hits(r, 0, 'self', 4);
      r.forHit(1, 'self');
      expect(r.forHit(0, 'self').combo).toBe(true);
      expect(!!hits(r, 1, 'self', 3)[2].combo).toBe(false);
    });
    it('reset(side) restarts counting', function () {
      var r = mk();
      hits(r, 0, 'self', 4);
      r.reset(0);
      expect(!!r.forHit(0, 'self').combo).toBe(false);
      hits(r, 1, 'self', 4);
      r.reset();
      expect(!!r.forHit(1, 'self').combo).toBe(false);
    });
    it('forResult pools', function () {
      var pools = { record: ['excited', 'cheer', 'love'], solo: ['joy', 'cheer'], win: ['excited', 'cheer', 'love'],
        lose: ['sadness', 'worried'], draw: ['joy', 'love'] };
      [0, 0.5, 0.99].forEach(function (v) {
        var r = R.create(function () { return v; });
        Object.keys(pools).forEach(function (k) { expect(pools[k].indexOf(r.forResult(k)) >= 0).toBe(true); });
      });
      expect(R.create(function () { return 0.99; }).forResult('lose')).toBe('worried');
    });
  });
})(window.Ailand);
