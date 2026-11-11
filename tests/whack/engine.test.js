(function (A) {
  'use strict';
  var describe = A.Test.describe, it = A.Test.it, expect = A.Test.expect;
  var E = A.games.whack.Engine;

  function sp(at, hole, kind, extra) {
    var s = { at: at, hole: hole, kind: kind, ngPick: 0, upMs: 800, busyUntil: at + 800 + 600 };
    if (extra) { Object.keys(extra).forEach(function (k) { s[k] = extra[k]; }); }
    return s;
  }
  function side(schedule, selfId) {
    return E.createSide({ schedule: schedule, selfId: selfId || 'mimitchi', ngIds: ['a', 'b', 'c'] });
  }

  describe('whack engine side', function () {
    it('step shows spawns when their time comes', function () {
      var s = side([sp(100, 4, 'self')]);
      expect(E.step(s, 99)).toEqual([]);
      var ev = E.step(s, 100);
      expect(ev.length).toBe(1);
      expect(ev[0]).toEqual({ type: 'show', hole: 4, kind: 'self', charId: 'mimitchi', upMs: 800 });
    });
    it('ng spawn picks its character by ngPick', function () {
      var s = side([sp(0, 1, 'ng', { ngPick: 0.7 })]);
      expect(E.step(s, 0)[0].charId).toBe('c');
    });
    it('missed character hides after upMs', function () {
      var s = side([sp(100, 2, 'self')]);
      E.step(s, 100);
      expect(E.step(s, 899)).toEqual([]);
      expect(E.step(s, 900)).toEqual([{ type: 'hide', hole: 2, missed: true }]);
    });
    it('hit scores and hides after the reaction', function () {
      var s = side([sp(100, 2, 'self')]);
      E.step(s, 100);
      var hit = E.press(s, 2, 500);
      expect(hit.kind).toBe('self');
      expect(hit.points).toBe(1);
      expect(hit.score).toBe(1);
      expect(E.step(s, 1099)).toEqual([]);
      expect(E.step(s, 1100)).toEqual([{ type: 'hide', hole: 2, missed: false }]);
    });
    it('press at the hide boundary and after a hit does nothing', function () {
      var s = side([sp(100, 2, 'self'), sp(100, 3, 'self')]);
      E.step(s, 100);
      expect(E.press(s, 2, 900)).toBe(null);
      expect(E.press(s, 3, 500) !== null).toBe(true);
      expect(E.press(s, 3, 510)).toBe(null);
      expect(E.press(s, 7, 500)).toBe(null);
    });
    it('score never goes below zero', function () {
      var s = side([sp(0, 0, 'ng'), sp(0, 1, 'rare')]);
      E.step(s, 0);
      var ng = E.press(s, 0, 100);
      expect(ng.points).toBe(-3);
      expect(ng.score).toBe(0);
      var rare = E.press(s, 1, 100);
      expect(rare.points).toBe(5);
      expect(rare.score).toBe(5);
    });
    it('end hides everything once', function () {
      var s = side([sp(49900, 5, 'self')]);
      E.step(s, 49900);
      var ev = E.step(s, 50000);
      expect(ev).toEqual([{ type: 'hide', hole: 5, missed: false }, { type: 'end', score: 0 }]);
      expect(E.step(s, 50100)).toEqual([]);
      expect(E.press(s, 5, 50100)).toBe(null);
    });
    it('two sides with the same schedule stay identical', function () {
      var sch = E.buildSchedule('normal', 9);
      var a = E.createSide({ schedule: sch, selfId: 'mimitchi', ngIds: E.ngIdsFor('mimitchi') });
      var b = E.createSide({ schedule: sch, selfId: 'mametchi', ngIds: E.ngIdsFor('mametchi') });
      var t;
      for (t = 0; t <= 50000; t += 16) {
        var ea = E.step(a, t), eb = E.step(b, t);
        expect(ea.length).toBe(eb.length);
        ea.forEach(function (e, i) {
          expect(e.type).toBe(eb[i].type);
          expect(e.hole).toBe(eb[i].hole);
          expect(e.kind).toBe(eb[i].kind);
        });
      }
    });
  });
})(window.Ailand);
