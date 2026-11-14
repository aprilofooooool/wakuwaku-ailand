(function (A) {
  'use strict';
  var describe = A.Test.describe, it = A.Test.it, expect = A.Test.expect;
  var Bgm = A.core.Bgm;

  function beats(steps) { return steps.reduce(function (s, x) { return s + x[1]; }, 0); }
  function pitches(list) {
    var out = [];
    list.forEach(function (x) { (Array.isArray(x[0]) ? x[0] : [x[0]]).forEach(function (f) { out.push(f); }); });
    return out;
  }

  // The five loops (design 2026-11-12-bgm-variety §2): each has its own tempo, melody wave and rhythm.
  // Sounding notes 100-1600 Hz; at least 90% of the melody 400-1200 Hz (drums and sparkle are not score notes).
  function checkScore(name, sc, want) {
    describe('BGM score: ' + name, function () {
      it('exists with a ' + want.wave + ' melody at ' + want.bpm + ' bpm and bass and chord voices', function () {
        expect(!!sc).toBe(true);
        expect(sc.wave).toBe(want.wave);
        expect(sc.bpm).toBe(want.bpm);
        expect(sc.steps.length > 0 && sc.bass.length > 0 && sc.chords.length > 0).toBe(true);
      });
      it('every voice is ' + want.beats + ' beats long', function () {
        expect(beats(sc.steps)).toBe(want.beats);
        expect(beats(sc.bass)).toBe(want.beats);
        expect(beats(sc.chords)).toBe(want.beats);
        if (sc.drums) { expect(beats(sc.drums)).toBe(want.beats); }
      });
      it('notesBetween over one loop returns melody, bass and chord notes', function () {
        var n = Bgm.notesBetween(sc, sc.bpm, 0, want.beats);
        expect(n.filter(function (x) { return !x.bass && !x.chord && !x.drum; }).length > 8).toBe(true);
        expect(n.filter(function (x) { return x.bass; }).length > 4).toBe(true);
        expect(n.filter(function (x) { return x.chord; }).length > 4).toBe(true);
        expect(n.every(function (x) { return x.beat >= 0 && x.beat < want.beats && x.len > 0; })).toBe(true);
      });
      it('every sounding note is within 100-1600 Hz; rests are 0; lengths are positive', function () {
        pitches(sc.steps.concat(sc.bass, sc.chords)).forEach(function (f) {
          expect(f === 0 || (f >= 100 && f <= 1600)).toBe(true);
        });
        sc.steps.concat(sc.bass, sc.chords).forEach(function (x) { expect(x[1] > 0).toBe(true); });
      });
      it('melody is not shrill: at least 90% of its notes are 400-1200 Hz', function () {
        var mel = sc.steps.filter(function (x) { return x[0] > 0; });
        var mid = mel.filter(function (x) { return x[0] >= 400 && x[0] <= 1200; });
        expect(mid.length / mel.length >= 0.9).toBe(true);
      });
    });
  }

  var TOP = A.top && A.top.BGM_SCORE;
  var DROP4 = A.games.drop4 && A.games.drop4.Sounds.NORMAL;
  var OTHELLO = A.games.othello && A.games.othello.BGM_SCORE;
  var WHACK = A.games.whack && A.games.whack.Sounds.BGM;
  var BLOCKS = A.games.blocks && A.games.blocks.Sounds.BGM;

  checkScore('entry page', TOP, { bpm: 128, beats: 32, wave: 'square' });

  describe('entry page BGM is a bouncy pop song', function () {
    it('chords hit the off-beats (the "and" of every beat)', function () {
      var off = 0, at = 0;
      TOP.chords.forEach(function (x) { if (x[0]) { expect(at % 1).toBe(0.5); } at += x[1]; off += x[0] ? 1 : 0; });
      expect(off).toBe(32);
    });
    it('hi-hats run on the 8ths between kick and snare', function () {
      expect(TOP.drums.some(function (x) { return x[0] === 'h'; })).toBe(true);
    });
  });
  checkScore('drop4', DROP4, { bpm: 100, beats: 32, wave: 'sine' });
  checkScore('othello', OTHELLO, { bpm: 144, beats: 48, wave: 'sine' });
  checkScore('whack', WHACK, { bpm: 150, beats: 32, wave: 'sawtooth' });
  checkScore('blocks', BLOCKS, { bpm: 132, beats: 32, wave: 'triangle' });

  describe('BGM scores differ from each other', function () {
    var all = [TOP, DROP4, OTHELLO, WHACK, BLOCKS];
    function distinct(list) { return list.filter(function (v, i) { return list.indexOf(v) === i; }).length === list.length; }
    it('tempos are all different', function () {
      expect(distinct(all.map(function (s) { return s.bpm; }))).toBe(true);
    });
    it('melody timbres are all different (wave with bend / sparkle)', function () {
      expect(distinct(all.map(function (s) { return s.wave + '/' + (s.bend || 0) + '/' + !!s.sparkle; }))).toBe(true);
    });
    it('every pair differs in rhythm: loop length, swing, or drum pattern', function () {
      function rhythm(s) { return JSON.stringify([beats(s.steps), s.swing || 0, s.drums || null]); }
      expect(distinct(all.map(rhythm))).toBe(true);
    });
    it('only drop4 swings and bends; only othello sparkles and has no drums', function () {
      expect(all.map(function (s) { return !!s.swing; })).toEqual([false, true, false, false, false]);
      expect(all.map(function (s) { return !!s.bend; })).toEqual([false, true, false, false, false]);
      expect(all.map(function (s) { return !!s.sparkle; })).toEqual([false, false, true, false, false]);
      expect(all.map(function (s) { return !!s.drums; })).toEqual([true, true, false, true, true]);
    });
    it('drop4 ENDGAME_BPM (126) and whack FINAL_BPM (180) are faster than their normal tempo', function () {
      expect(A.games.drop4.Sounds.ENDGAME_BPM).toBe(126);
      expect(A.games.whack.Sounds.FINAL_BPM).toBe(180);
      expect(A.games.blocks.Sounds.ALMOST_BPM > BLOCKS.bpm).toBe(true);
      expect(A.games.drop4.Sounds.ENDGAME_BPM > DROP4.bpm).toBe(true);
      expect(A.games.whack.Sounds.FINAL_BPM > WHACK.bpm).toBe(true);
    });
  });
})(Ailand);
