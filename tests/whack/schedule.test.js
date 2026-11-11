(function (A) {
  'use strict';
  var describe = A.Test.describe, it = A.Test.it, expect = A.Test.expect;
  var W = A.games.whack, E = W.Engine, K = W.Constants;

  function avgGap(sch, from, to) {
    var xs = sch.filter(function (s) { return s.at >= from && s.at < to; });
    var sum = 0, i;
    for (i = 1; i < xs.length; i++) { sum += xs[i].at - xs[i - 1].at; }
    return sum / (xs.length - 1);
  }

  describe('whack buildSchedule', function () {
    it('same seed gives the same schedule', function () {
      expect(E.buildSchedule('normal', 42)).toEqual(E.buildSchedule('normal', 42));
      expect(JSON.stringify(E.buildSchedule('normal', 42)) === JSON.stringify(E.buildSchedule('normal', 43))).toBe(false);
    });
    it('schedule stays inside 50s and is sorted', function () {
      ['easy', 'normal', 'hard'].forEach(function (d) {
        var sch = E.buildSchedule(d, 7);
        expect(sch.length > 0).toBe(true);
        sch.forEach(function (s, i) {
          expect(s.at < 50000).toBe(true);
          expect(s.hole >= 0 && s.hole <= 8).toBe(true);
          expect(s.busyUntil).toBe(s.at + s.upMs + 600);
          if (i > 0) { expect(s.at >= sch[i - 1].at).toBe(true); }
        });
      });
    });
    it('gaps shrink over time and in the final 10s', function () {
      var sch = E.buildSchedule('normal', 1);
      var a = avgGap(sch, 0, 10000), b = avgGap(sch, 30000, 40000), c = avgGap(sch, 40000, 50000);
      expect(a > b).toBe(true);
      expect(b > c).toBe(true);
    });
    it('visible count never exceeds the cap', function () {
      ['easy', 'normal', 'hard'].forEach(function (d) {
        var cfg = K.DIFFICULTY[d];
        var sch = E.buildSchedule(d, 3);
        sch.forEach(function (s) {
          var n = sch.filter(function (o) { return o.at <= s.at && o.busyUntil > s.at; }).length;
          var cap = s.at >= K.DURATION_MS - K.FINAL_MS ? cfg.maxFinal : cfg.maxStart;
          expect(n <= cap).toBe(true);
        });
      });
    });
    it('a hole rests 300ms before it is used again', function () {
      var sch = E.buildSchedule('hard', 5), last = {};
      sch.forEach(function (s) {
        if (last[s.hole] !== undefined) { expect(s.at >= last[s.hole] + 300).toBe(true); }
        last[s.hole] = s.busyUntil;
      });
    });
    it('rare appears a fixed number of times, single and spaced', function () {
      var want = { easy: 2, normal: 3, hard: 5 };
      Object.keys(want).forEach(function (d) {
        for (var seed = 1; seed <= 100; seed++) {
          var rares = E.buildSchedule(d, seed).filter(function (s) { return s.kind === 'rare'; });
          expect(rares.length).toBe(want[d]);
          rares.forEach(function (r, i) {
            if (i > 0) {
              expect(r.at - rares[i - 1].at >= 2000).toBe(true);
              expect(r.at >= rares[i - 1].busyUntil).toBe(true);
            }
          });
        }
      });
    });
    it('rares are spread one per equal window', function () {
      var rares = E.buildSchedule('hard', 5).filter(function (s) { return s.kind === 'rare'; });
      rares.forEach(function (r, i) {
        expect(r.at >= i * 10000).toBe(true);
        expect(r.at < (i + 1) * 10000).toBe(true);
      });
    });
    it('ng share is near the rate', function () {
      var ng = 0, all = 0, seed;
      for (seed = 1; seed <= 20; seed++) {
        E.buildSchedule('hard', seed).forEach(function (s) { all++; if (s.kind === 'ng') { ng++; } });
      }
      var share = ng / all;
      expect(share >= 0.18 && share <= 0.32).toBe(true);
    });
    it('ngIdsFor excludes self', function () {
      expect(E.ngIdsFor('mimitchi')).toEqual(['mametchi', 'kuchipatchi', 'flowertchi']);
    });
  });
})(window.Ailand);
