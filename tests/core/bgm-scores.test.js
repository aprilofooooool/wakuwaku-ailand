(function (A) {
  'use strict';
  var describe = A.Test.describe, it = A.Test.it, expect = A.Test.expect;
  var Bgm = A.core.Bgm;

  function beats(steps) { return steps.reduce(function (s, x) { return s + x[1]; }, 0); }

  // Entry page and othello loops: 8 bars of 4/4, soft triangle melody over a sine bass, 100-1600 Hz.
  function checkScore(name, sc, bpmMin, bpmMax) {
    describe('BGM score: ' + name, function () {
      it('exists with a triangle melody and a bass line', function () {
        expect(!!sc).toBe(true);
        expect(sc.wave).toBe('triangle');
        expect(sc.bpm >= bpmMin && sc.bpm <= bpmMax).toBe(true);
        expect(sc.steps.length > 0 && sc.bass.length > 0).toBe(true);
      });
      it('melody and bass are 32 beats each (8 bars)', function () {
        expect(beats(sc.steps)).toBe(32);
        expect(beats(sc.bass)).toBe(32);
      });
      it('notesBetween over one loop returns melody and bass notes', function () {
        var n = Bgm.notesBetween(sc, sc.bpm, 0, 32);
        expect(n.filter(function (x) { return !x.bass; }).length > 8).toBe(true);
        expect(n.filter(function (x) { return x.bass; }).length > 4).toBe(true);
        expect(n.every(function (x) { return x.beat >= 0 && x.beat < 32 && x.len > 0; })).toBe(true);
      });
      it('every sounding note is within 100-1600 Hz; rests are 0', function () {
        sc.steps.concat(sc.bass).forEach(function (x) {
          expect(x[0] === 0 || (x[0] >= 100 && x[0] <= 1600)).toBe(true);
          expect(x[1] > 0).toBe(true);
        });
      });
    });
  }

  checkScore('entry page', A.top && A.top.BGM_SCORE, 90, 110);
  checkScore('othello', A.games.othello && A.games.othello.BGM_SCORE, 86, 106);
})(Ailand);
