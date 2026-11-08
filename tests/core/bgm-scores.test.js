(function (A) {
  'use strict';
  var describe = A.Test.describe, it = A.Test.it, expect = A.Test.expect;
  var Bgm = A.core.Bgm;

  function beats(steps) { return steps.reduce(function (s, x) { return s + x[1]; }, 0); }

  // Entry page and othello loops: 8 bars of 4/4, triangle melody over a sine bass plus a light off-beat
  // chord voice, all 100-1600 Hz; bright tempos (entry 132, othello 120).
  function checkScore(name, sc, bpm) {
    describe('BGM score: ' + name, function () {
      it('exists with a triangle melody, a bass line and a chord voice at ' + bpm + ' bpm', function () {
        expect(!!sc).toBe(true);
        expect(sc.wave).toBe('triangle');
        expect(sc.bpm).toBe(bpm);
        expect(sc.steps.length > 0 && sc.bass.length > 0 && sc.chords.length > 0).toBe(true);
      });
      it('melody, bass and chords are 32 beats each (8 bars)', function () {
        expect(beats(sc.steps)).toBe(32);
        expect(beats(sc.bass)).toBe(32);
        expect(beats(sc.chords)).toBe(32);
      });
      it('notesBetween over one loop returns melody, bass and chord notes', function () {
        var n = Bgm.notesBetween(sc, sc.bpm, 0, 32);
        expect(n.filter(function (x) { return !x.bass && !x.chord; }).length > 8).toBe(true);
        expect(n.filter(function (x) { return x.bass; }).length > 4).toBe(true);
        expect(n.filter(function (x) { return x.chord; }).length > 4).toBe(true);
        expect(n.every(function (x) { return x.beat >= 0 && x.beat < 32 && x.len > 0; })).toBe(true);
      });
      it('every sounding note is within 100-1600 Hz; rests are 0', function () {
        sc.steps.concat(sc.bass, sc.chords).forEach(function (x) {
          expect(x[0] === 0 || (x[0] >= 100 && x[0] <= 1600)).toBe(true);
          expect(x[1] > 0).toBe(true);
        });
      });
      it('melody is not shrill: at least 90% of its notes are 400-1200 Hz', function () {
        var mel = sc.steps.filter(function (x) { return x[0] > 0; });
        var mid = mel.filter(function (x) { return x[0] >= 400 && x[0] <= 1200; });
        expect(mid.length / mel.length >= 0.9).toBe(true);
      });
    });
  }

  checkScore('entry page', A.top && A.top.BGM_SCORE, 132);
  checkScore('othello', A.games.othello && A.games.othello.BGM_SCORE, 120);

  describe('BGM scores differ from each other and from drop4 NORMAL', function () {
    it('the three melodies are not the same', function () {
      var a = JSON.stringify(A.top.BGM_SCORE.steps), b = JSON.stringify(A.games.othello.BGM_SCORE.steps);
      var c = JSON.stringify(A.games.drop4.Sounds.NORMAL.steps);
      expect(a !== b && a !== c && b !== c).toBe(true);
    });
  });
})(Ailand);
