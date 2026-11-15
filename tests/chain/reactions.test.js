(function (A) {
  'use strict';
  var describe = A.Test.describe, it = A.Test.it, expect = A.Test.expect;
  var R = A.games.chain.Reactions;
  var BAD = ['worried', 'sadness', 'anger', 'panic'];
  var FXS = ['clear', 'chain3', 'chain2', 'wake', 'pop', null];

  function pop(chain) { return { type: 'pop', chain: chain, cells: [] }; }
  var wake = { type: 'wake', cells: [], left: 3 };
  var lock = { type: 'lock', cells: [] };

  describe('chain/Reactions', function () {
    it('pop faces rise with the chain', function () {
      var r = R.create(function () { return 0; });
      expect(r.forPop(1)).toBe('joy');
      expect(r.forPop(2)).toBe('excited');
      expect(['cheer', 'love'].indexOf(r.forPop(3)) >= 0).toBe(true);
      expect(['cheer', 'love'].indexOf(r.forPop(7)) >= 0).toBe(true);
    });
    it('no bad faces after own actions', function () {
      var i, r, c;
      for (i = 0; i < 200; i++) {
        r = R.create(A.core.Rng.mulberry32(i));
        for (c = 1; c <= 5; c++) { expect(BAD.indexOf(r.forPop(c))).toBe(-1); }
        FXS.forEach(function (fx) { expect(BAD.indexOf(r.forSettled(fx).emotion)).toBe(-1); });
      }
    });
    it('turn is surprised at most', function () {
      expect(R.create(function () { return 0; }).forTurn()).toBe('surprised');
    });
    it('forSettled maps the screen effect to a face and a situation', function () {
      var r = R.create(function () { return 0; });
      expect(r.forSettled('chain3').situation).toBe('chain');
      expect(['cheer', 'love'].indexOf(r.forSettled('chain3').emotion) >= 0).toBe(true);
      expect(r.forSettled('chain2')).toEqual({ emotion: 'excited', situation: 'chain' });
      expect(r.forSettled('wake')).toEqual({ emotion: 'joy', situation: 'wake' });
      expect(r.forSettled('pop')).toEqual({ emotion: 'joy', situation: null });
      expect(r.forSettled(null)).toEqual({ emotion: null, situation: null });
    });
    it('same emotion never three times in a row', function () {
      [0, 0.5, 0.99].forEach(function (v) {
        var r = R.create(function () { return v; }), seq = [], i;
        for (i = 0; i < 100; i++) { seq.push(r.forSettled('chain3').emotion); }
        for (i = 2; i < seq.length; i++) {
          expect(seq[i] === seq[i - 1] && seq[i] === seq[i - 2]).toBe(false);
        }
      });
      var r2 = R.create(A.core.Rng.mulberry32(9)), s2 = [], j;
      for (j = 0; j < 100; j++) { s2.push(r2.forPop(3)); }
      for (j = 2; j < s2.length; j++) { expect(s2[j] === s2[j - 1] && s2[j] === s2[j - 2]).toBe(false); }
    });
    it('reset forgets the history', function () {
      var r = R.create(function () { return 0; });
      r.forPop(3); r.forPop(3);
      r.reset();
      expect(r.forPop(3)).toBe('cheer');
    });
    it('result faces', function () {
      [0, 0.5, 0.99].forEach(function (v) {
        var r = R.create(function () { return v; }), c;
        c = r.forResult('clear', false);
        expect(['excited', 'cheer'].indexOf(c.emotion) >= 0).toBe(true);
        expect(c.situation).toBe('clear');
        expect(r.forResult('clear', true).situation).toBe('record');
        expect(r.forResult('timeup', false)).toEqual({ emotion: 'worried', situation: 'timeup' });
        expect(r.forResult('blocked', false)).toEqual({ emotion: 'worried', situation: 'over' });
      });
    });
  });

  describe('chain/Reactions screenFx', function () {
    it('follows the priority', function () {
      expect(R.screenFx([lock, pop(1), pop(2), pop(3), { type: 'clear' }])).toBe('clear');
      expect(R.screenFx([lock, pop(1), pop(2), pop(3)])).toBe('chain3');
      expect(R.screenFx([lock, pop(1), pop(2), pop(4), wake])).toBe('chain3');
      expect(R.screenFx([lock, pop(1), pop(2), wake])).toBe('chain2');
      expect(R.screenFx([lock, pop(1), wake])).toBe('wake');
      expect(R.screenFx([lock, pop(1)])).toBe('pop');
      expect(R.screenFx([lock])).toBe(null);
      expect(R.screenFx([])).toBe(null);
    });
  });
})(window.Ailand);
