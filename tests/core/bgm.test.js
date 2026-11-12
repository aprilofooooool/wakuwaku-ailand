(function (A) {
  'use strict';
  var describe = A.Test.describe, it = A.Test.it, expect = A.Test.expect;
  var Bgm = A.core.Bgm;

  var score = {
    bpm: 120,
    wave: 'triangle',
    bass: [[100, 4], [0, 4]],
    steps: [[500, 1], [0, 1], [600, 2], [700, 4]] // 8 beats
  };

  function melody(list) { return list.filter(function (n) { return !n.bass; }); }

  describe('core/Bgm.notesBetween', function () {
    it('returns notes inside [from, to) and skips rests', function () {
      var n = melody(Bgm.notesBetween(score, 120, 0, 4));
      expect(n.map(function (x) { return x.beat; })).toEqual([0, 2]);
      expect(n.map(function (x) { return x.freq; })).toEqual([500, 600]);
    });
    it('wraps to the loop start: 7.5 to 8.5 includes the first note again', function () {
      var n = melody(Bgm.notesBetween(score, 120, 7.5, 8.5));
      expect(n.length).toBe(1);
      expect(n[0].beat).toBe(8);
      expect(n[0].freq).toBe(500);
    });
    it('len is in seconds at the given bpm', function () {
      var n = melody(Bgm.notesBetween(score, 120, 0, 1));
      expect(n[0].len).toBe(0.5);
      var m = melody(Bgm.notesBetween(score, 60, 0, 1));
      expect(m[0].len).toBe(1);
    });
    it('beats stay continuous across a tempo change', function () {
      var whole = melody(Bgm.notesBetween(score, 120, 0, 16)).map(function (x) { return x.beat; });
      var a = melody(Bgm.notesBetween(score, 120, 0, 5));
      var b = melody(Bgm.notesBetween(score, 150, 5, 16));
      expect(a.concat(b).map(function (x) { return x.beat; })).toEqual(whole);
    });
    it('includes bass notes flagged bass:true', function () {
      var n = Bgm.notesBetween(score, 120, 0, 8).filter(function (x) { return x.bass; });
      expect(n.length).toBe(1);
      expect(n[0].freq).toBe(100);
    });
    it('a tiny window at beat 0 still returns the note at beat 0', function () {
      expect(melody(Bgm.notesBetween(score, 120, 0, 1e-12)).length).toBe(1);
    });
    it('empty for bad input', function () {
      expect(Bgm.notesBetween(null, 120, 0, 4)).toEqual([]);
      expect(Bgm.notesBetween(score, 0, 0, 4)).toEqual([]);
      expect(Bgm.notesBetween(score, 120, 4, 4)).toEqual([]);
    });
  });

  describe('core/Bgm.notesBetween optional chords voice', function () {
    var withChords = {
      bpm: 120, wave: 'triangle',
      bass: [[100, 4], [0, 4]],
      steps: [[500, 8]],
      chords: [[0, 1], [300, 1], [0, 1], [350, 1]] // 4-beat loop of off-beat ticks
    };
    function chords(list) { return list.filter(function (n) { return n.chord; }); }
    it('chord notes are flagged chord:true (not bass) and loop on their own length', function () {
      var n = chords(Bgm.notesBetween(withChords, 120, 0, 8));
      expect(n.map(function (x) { return x.beat; })).toEqual([1, 3, 5, 7]);
      expect(n.map(function (x) { return x.freq; })).toEqual([300, 350, 300, 350]);
      expect(n.every(function (x) { return x.bass === false && x.len === 0.5; })).toBe(true);
    });
    it('a score without chords yields no chord notes', function () {
      expect(chords(Bgm.notesBetween(score, 120, 0, 16)).length).toBe(0);
    });
  });

  describe('core/Bgm.notesBetween new score options', function () {
    var opt = {
      bpm: 120, wave: 'triangle', bass: [[100, 4]], steps: [[500, 0.5], [600, 0.5], [0, 3]],
      chords: [[[300, 350], 1], [0, 3]],
      drums: [['k', 0.5], ['h', 0.5]], // 1-beat loop
      swing: 1 / 6
    };
    it('chord arrays give one note per pitch on the same beat', function () {
      var c = Bgm.notesBetween(opt, 120, 0, 4).filter(function (n) { return n.chord; });
      expect(c.map(function (n) { return n.freq; })).toEqual([300, 350]);
      expect(c.every(function (n) { return n.beat === 0; })).toBe(true);
    });
    it('drums loop on their own length and carry drum kind with freq 0', function () {
      var d = Bgm.notesBetween(opt, 120, 0, 2).filter(function (n) { return n.drum; });
      expect(d.map(function (n) { return n.drum; })).toEqual(['k', 'h', 'k', 'h']);
      expect(d.map(function (n) { return n.beat; })).toEqual([0, 0.5, 1, 1.5]);
      expect(d.every(function (n) { return n.freq === 0 && n.bass === false; })).toBe(true);
    });
    it('swing moves only off-beat 8ths: at = beat + swing; beat is unchanged', function () {
      var m = Bgm.notesBetween(opt, 120, 0, 1).filter(function (n) { return !n.bass && !n.chord && !n.drum; });
      expect(m.map(function (n) { return n.beat; })).toEqual([0, 0.5]);
      expect(Math.abs(m[1].at - (0.5 + 1 / 6)) < 1e-9).toBe(true);
      expect(m[0].at).toBe(0);
    });
    it('without swing, at equals beat for every note', function () {
      Bgm.notesBetween(score, 120, 0, 16).forEach(function (n) { expect(n.at).toBe(n.beat); });
    });
  });

  describe('core/Bgm without audio', function () {
    it('start / setTempo / stop never throw when AudioContext is missing', function () {
      Bgm.start(score);
      Bgm.setTempo(150);
      Bgm.setTempo(-1);
      Bgm.setTempo('x');
      Bgm._tick();
      Bgm.stop();
      Bgm.stop();
      Bgm.start(null);
      expect(Bgm.getTempo()).toBe(150);
    });
  });

  describe('drop4 Sounds.NORMAL score', function () {
    it('melody and bass are both 32 beats (8 bars of 4/4) at 100 bpm', function () {
      var N = A.games.drop4.Sounds.NORMAL;
      function sum(s) { return s.reduce(function (t, x) { return t + x[1]; }, 0); }
      expect(N.bpm).toBe(100);
      expect(sum(N.steps)).toBe(32);
      expect(sum(N.bass)).toBe(32);
    });
    it('melody stays within a gentle range (Bb4 to D6)', function () {
      var N = A.games.drop4.Sounds.NORMAL;
      N.steps.forEach(function (s) { if (s[0] > 0) { expect(s[0] >= 466.16 && s[0] <= 1174.66).toBe(true); } });
    });
  });
})(Ailand);
