(function (A) {
  'use strict';
  var describe = A.Test.describe, it = A.Test.it, expect = A.Test.expect;
  var R = A.games.blocks.Reactions;
  var BAD = ['worried', 'sadness', 'anger', 'panic'];

  function clear(rows, mine) {
    var list = [], i;
    for (i = 0; i < rows; i++) { list.push(10 + i); }
    return { type: 'clear', rows: list, faces: [], mine: mine, collected: 0, almost: false };
  }

  describe('blocks/Reactions', function () {
    it('multi wins over mine', function () {
      var r = R.create(A.core.Rng.mulberry32(1)).forClear(clear(2, 3));
      expect(r.situation).toBe('multi');
      expect(['excited', 'surprised'].indexOf(r.emotion) >= 0).toBe(true);
    });
    it('mine picks a happy face', function () {
      var r = R.create(A.core.Rng.mulberry32(2)).forClear(clear(1, 1));
      expect(['joy', 'cheer', 'love'].indexOf(r.emotion) >= 0).toBe(true);
      expect(r.situation).toBe('mine');
    });
    it('a plain clear is joy with no situation', function () {
      expect(R.create(A.core.Rng.mulberry32(3)).forClear(clear(1, 0))).toEqual({ emotion: 'joy', situation: null });
    });
    it('no bad faces after a clear', function () {
      var i, r, x;
      for (i = 0; i < 200; i++) {
        r = R.create(A.core.Rng.mulberry32(i));
        [clear(1, 0), clear(1, 2), clear(3, 0), clear(4, 4)].forEach(function (c) {
          x = r.forClear(c);
          expect(BAD.indexOf(x.emotion)).toBe(-1);
        });
      }
    });
    it('same emotion never three times in a row', function () {
      [0, 0.5, 0.99].forEach(function (v) {
        var r = R.create(function () { return v; }), seq = [], i;
        for (i = 0; i < 100; i++) { seq.push(r.forClear(clear(1, 1)).emotion); }
        for (i = 2; i < seq.length; i++) {
          expect(seq[i] === seq[i - 1] && seq[i] === seq[i - 2]).toBe(false);
        }
      });
      var r2 = R.create(A.core.Rng.mulberry32(9)), s2 = [], j;
      for (j = 0; j < 100; j++) { s2.push(r2.forClear(clear(1, 1)).emotion); }
      for (j = 2; j < s2.length; j++) { expect(s2[j] === s2[j - 1] && s2[j] === s2[j - 2]).toBe(false); }
    });
    it('reset forgets the history', function () {
      var r = R.create(function () { return 0; });
      r.forClear(clear(1, 1)); r.forClear(clear(1, 1));
      r.reset();
      expect(r.forClear(clear(1, 1)).emotion).toBe('joy');
    });
    it('forStar is excited or cheer with the star situation', function () {
      var i, x;
      for (i = 0; i < 50; i++) {
        x = R.create(A.core.Rng.mulberry32(i)).forStar();
        expect(x.situation).toBe('star');
        expect(['excited', 'cheer'].indexOf(x.emotion) >= 0).toBe(true);
      }
    });
    it('forRecord is excited or cheer with the record situation', function () {
      var i, x;
      for (i = 0; i < 50; i++) {
        x = R.create(A.core.Rng.mulberry32(i)).forRecord();
        expect(x.situation).toBe('record');
        expect(['excited', 'cheer'].indexOf(x.emotion) >= 0).toBe(true);
      }
    });
    it('result faces', function () {
      [0, 0.5, 0.99].forEach(function (v) {
        var r = R.create(function () { return v; });
        expect(['excited', 'cheer'].indexOf(r.forResult('goal')) >= 0).toBe(true);
        expect(r.forResult('over')).toBe('worried');
      });
    });
  });

  describe('blocks/Reactions screenFx', function () {
    var lock = { type: 'lock', cells: [] };
    it('follows the priority', function () {
      expect(R.screenFx([lock, clear(4, 2), { type: 'goal', collected: 5, jar: 5 }])).toBe('goal');
      expect(R.screenFx([lock, clear(4, 2)])).toBe('quad');
      expect(R.screenFx([lock, clear(2, 1)])).toBe('multi');
      expect(R.screenFx([lock, clear(3, 0)])).toBe('multi');
      expect(R.screenFx([lock, clear(1, 1)])).toBe('mine');
      expect(R.screenFx([lock, clear(1, 0)])).toBe('single');
      expect(R.screenFx([lock, clear(4, 2), { type: 'star' }])).toBe('star');
      expect(R.screenFx([{ type: 'star' }, { type: 'goal', collected: 5, jar: 5 }])).toBe('goal');
      expect(R.screenFx([lock])).toBe(null);
      expect(R.screenFx([])).toBe(null);
    });
  });
})(window.Ailand);
