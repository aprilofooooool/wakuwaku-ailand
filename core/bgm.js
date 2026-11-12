(function (C) {
  'use strict';

  // Looping BGM. score = { bpm, wave, bass: [[freq|0, beats], ...], steps: [[freq|0, beats], ...],
  //   chords (optional): [[freq|[freq, ...]|0, beats], ...] played as soft short plucks (an array sounds together),
  //   drums (optional): [['k'|'s'|'h'|'ks'|0, beats], ...] kick / snare / hi-hat / kick+snare,
  //   swing (optional): beats to delay every off-beat 8th (0.5 into a beat), e.g. 1/6 for a triplet shuffle,
  //   gate, melodyPeak, bassWave, chordWave, chordLen, bend, sparkle (optional voice settings; see tick) }.
  // Every optional field left out keeps the original sound.
  // Notes are scheduled slightly ahead of the audio clock (lookahead) from a setTimeout loop.
  var LOOKAHEAD = 0.1;   // seconds scheduled ahead
  var TICK_MS = 25;
  var MELODY_PEAK = 0.32;  // default for score.melodyPeak
  var MELODY_GATE = 0.92;  // default for score.gate: share of the written length that sounds
  var BASS_PEAK = 0.34;
  var CHORD_PEAK = 0.08;   // per chord tone; quieter than melody and bass
  var CHORD_MAX_S = 0.12;  // default for score.chordLen: chord plucks stay short (staccato)
  var BEND_S = 0.06;       // score.bend: time to glide up into the written pitch
  var SPARKLE_PEAK = 0.06; // score.sparkle: quiet sine an octave up
  var SPARKLE_MAX_S = 0.5;
  var KICK = { from: 150, to: 50, dur: 0.14, peak: 0.55 };
  var NOISE = { s: { type: 'bandpass', freq: 1800, dur: 0.12, peak: 0.32 }, h: { type: 'highpass', freq: 7000, dur: 0.04, peak: 0.18 } };
  var NOISE_S = 0.5;       // length of the shared white-noise buffer
  var noiseCtx = null;
  var noiseBuf = null;

  var score = null;
  var bpm = 120;
  var nextBeat = 0;      // first beat not yet scheduled (absolute, grows across loops)
  var nextTime = null;   // audio time of nextBeat; null = re-anchor at the next audible tick
  var timer = null;
  var live = [];         // oscillators scheduled but maybe not finished: [{ osc, end }]
  var START_DELAY = 0.15; // lets a previous stop() fade finish before new notes begin

  function loopBeats(steps) {
    var sum = 0;
    for (var i = 0; i < steps.length; i++) { sum += steps[i][1]; }
    return sum;
  }

  // kind: 'bass' | 'chord' | 'drum' | undefined (melody).
  function pushNotes(out, steps, bpmNow, from, to, kind) {
    if (!steps || !steps.length) { return; }
    var total = loopBeats(steps);
    if (total <= 0) { return; }
    var k0 = Math.floor(from / total);
    var k1 = Math.floor(to / total);
    for (var k = k0; k <= k1; k++) {
      var off = 0;
      for (var i = 0; i < steps.length; i++) {
        var beat = k * total + off;
        var v = steps[i][0];
        off += steps[i][1];
        if (!v || beat < from || beat >= to) { continue; }
        var len = steps[i][1] * 60 / bpmNow;
        if (kind === 'drum') {
          out.push({ beat: beat, freq: 0, len: len, bass: false, drum: v });
          continue;
        }
        var freqs = Array.isArray(v) ? v : [v];
        for (var j = 0; j < freqs.length; j++) {
          if (!(freqs[j] > 0)) { continue; }
          var n = { beat: beat, freq: freqs[j], len: len, bass: kind === 'bass' };
          if (kind === 'chord') { n.chord = true; }
          out.push(n);
        }
      }
    }
  }

  // Pure. Notes whose start beat is in [fromBeat, toBeat); beats count up across loops.
  // len is in seconds at the given bpm; bass notes carry bass:true, chord-voice notes chord:true,
  // drum hits drum:<kind> (freq 0). at = the beat to sound on: beat, or beat + swing for an off-beat 8th.
  function notesBetween(sc, bpmNow, fromBeat, toBeat) {
    var out = [];
    if (!sc || !(bpmNow > 0) || !(toBeat > fromBeat)) { return out; }
    pushNotes(out, sc.steps, bpmNow, fromBeat, toBeat);
    pushNotes(out, sc.bass, bpmNow, fromBeat, toBeat, 'bass');
    pushNotes(out, sc.chords, bpmNow, fromBeat, toBeat, 'chord');
    pushNotes(out, sc.drums, bpmNow, fromBeat, toBeat, 'drum');
    var swing = sc.swing > 0 ? sc.swing : 0;
    out.forEach(function (n) {
      var f = n.beat - Math.floor(n.beat);
      n.at = swing && Math.abs(f - 0.5) < 1e-9 ? n.beat + swing : n.beat;
    });
    out.sort(function (a, b) { return a.beat - b.beat; });
    return out;
  }

  // Same envelope as Sound.note, but the pitch starts at freq * bend and glides up into freq ("boing").
  function bendNote(ctx, dest, t0, freq, dur, type, peak, attack, bend) {
    var osc = ctx.createOscillator();
    var g = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq * bend, t0);
    osc.frequency.exponentialRampToValueAtTime(freq, t0 + Math.min(BEND_S, dur / 2));
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(peak, t0 + Math.min(attack, dur / 2));
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    osc.connect(g);
    g.connect(dest);
    osc.start(t0);
    osc.stop(t0 + dur + 0.02);
    return osc;
  }

  // One white-noise buffer per AudioContext; null when the context cannot make buffers or filters.
  function noise(ctx) {
    if (!ctx.createBuffer || !ctx.createBufferSource || !ctx.createBiquadFilter || !(ctx.sampleRate > 0)) { return null; }
    if (noiseCtx !== ctx) {
      var len = Math.floor(ctx.sampleRate * NOISE_S);
      noiseBuf = ctx.createBuffer(1, len, ctx.sampleRate);
      var d = noiseBuf.getChannelData(0);
      for (var i = 0; i < len; i++) { d[i] = Math.random() * 2 - 1; }
      noiseCtx = ctx;
    }
    return noiseBuf;
  }

  function noiseHit(ctx, dest, t0, spec) {
    var buf = noise(ctx);
    if (!buf) { return null; }
    var src = ctx.createBufferSource();
    var f = ctx.createBiquadFilter();
    var g = ctx.createGain();
    src.buffer = buf;
    f.type = spec.type;
    f.frequency.value = spec.freq;
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(spec.peak, t0 + 0.002);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + spec.dur);
    src.connect(f);
    f.connect(g);
    g.connect(dest);
    src.start(t0);
    src.stop(t0 + spec.dur + 0.02);
    return src;
  }

  // Schedules one note of notesBetween at audio time t0; returns [{ osc, end }] for stop().
  function sound(S, ctx, dest, n, t0) {
    var out = [];
    function keep(node, dur) { if (node) { out.push({ osc: node, end: t0 + dur + 0.05 }); } }
    if (n.drum) {
      if (n.drum === 'k' || n.drum === 'ks') {
        keep(S.note(ctx, dest, t0, KICK.from, 0, KICK.dur, 'sine', KICK.peak, KICK.to, 0.003), KICK.dur);
      }
      if (n.drum === 's' || n.drum === 'ks') { keep(noiseHit(ctx, dest, t0, NOISE.s), NOISE.s.dur); }
      if (n.drum === 'h') { keep(noiseHit(ctx, dest, t0, NOISE.h), NOISE.h.dur); }
      return out;
    }
    var dur;
    if (n.chord) {
      dur = Math.min(n.len * 0.6, score.chordLen > 0 ? score.chordLen : CHORD_MAX_S);
      keep(S.note(ctx, dest, t0, n.freq, 0, dur, score.chordWave || 'sine', CHORD_PEAK, 0, 0.01), dur);
    } else if (n.bass) {
      dur = n.len * 0.92;
      keep(S.note(ctx, dest, t0, n.freq, 0, dur, score.bassWave || 'sine', BASS_PEAK, 0, 0.02), dur);
    } else {
      dur = n.len * (score.gate > 0 ? score.gate : MELODY_GATE);
      var wave = score.wave || 'triangle';
      var peak = score.melodyPeak > 0 ? score.melodyPeak : MELODY_PEAK;
      keep(score.bend > 0 ? bendNote(ctx, dest, t0, n.freq, dur, wave, peak, 0.02, score.bend)
        : S.note(ctx, dest, t0, n.freq, 0, dur, wave, peak, 0, 0.02), dur);
      if (score.sparkle) {
        var sd = Math.min(n.len, SPARKLE_MAX_S);
        keep(S.note(ctx, dest, t0, n.freq * 2, 0, sd, 'sine', SPARKLE_PEAK, 0, 0.004), sd);
      }
    }
    return out;
  }

  function tick() {
    timer = null;
    if (!score) { return; }
    try {
      var S = C.Sound;
      var dest = S.bgmDest();
      var ctx = S.context();
      var hidden = typeof document !== 'undefined' && document.hidden === true;
      if (!dest || !ctx || hidden) {
        nextTime = null; // silent now: resume from the current beat when audible again
      } else {
        var now = ctx.currentTime;
        if (nextTime === null || nextTime < now - LOOKAHEAD) { nextTime = now + START_DELAY; }
        var horizon = now + LOOKAHEAD;
        if (horizon > nextTime) {
          var toBeat = nextBeat + (horizon - nextTime) * bpm / 60;
          var notes = notesBetween(score, bpm, nextBeat, toBeat);
          for (var i = 0; i < notes.length; i++) {
            var n = notes[i];
            // One failing note is skipped; the window still advances, so earlier notes are never replayed.
            try { live = live.concat(sound(S, ctx, dest, n, nextTime + (n.at - nextBeat) * 60 / bpm)); } catch (e) { /* skip */ }
          }
          live = live.filter(function (l) { return l.end > now; });
          nextTime += (toBeat - nextBeat) * 60 / bpm;
          nextBeat = toBeat;
        }
      }
    } catch (e) { /* never throw */ }
    if (score) { timer = setTimeout(tick, TICK_MS); }
  }

  function stop() {
    if (timer !== null) { clearTimeout(timer); timer = null; }
    score = null;
    // Silence notes already scheduled: fade the bus and stop their oscillators.
    try {
      var S = C.Sound;
      var ctx = S.context();
      if (ctx && live.length) {
        S.fadeBgm(false);
        live.forEach(function (l) { try { l.osc.stop(ctx.currentTime + 0.1); } catch (e) { /* ended */ } });
      }
    } catch (e) { /* ignore */ }
    live = [];
  }

  C.Bgm = {
    notesBetween: notesBetween,
    start: function (sc) {
      stop();
      if (!sc || !sc.steps) { return; }
      score = sc;
      bpm = sc.bpm > 0 ? sc.bpm : 120;
      nextBeat = 0;
      nextTime = null;
      C.Sound.fadeBgm(true, START_DELAY - 0.03);
      timer = setTimeout(tick, 0);
    },
    stop: stop,
    // Beat position stays continuous; only the time per beat changes.
    setTempo: function (b) { if (typeof b === 'number' && b > 0 && isFinite(b)) { bpm = b; } },
    getTempo: function () { return bpm; },
    _tick: function () { if (timer !== null) { clearTimeout(timer); timer = null; } tick(); }
  };
})(Ailand.core);
