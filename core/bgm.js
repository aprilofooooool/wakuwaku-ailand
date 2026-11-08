(function (C) {
  'use strict';

  // Looping BGM. score = { bpm, wave, bass: [[freq|0, beats], ...], steps: [[freq|0, beats], ...],
  //   chords (optional): [[freq|0, beats], ...] played as soft short sine plucks (off-beat "pah" / arpeggio) }.
  // Notes are scheduled slightly ahead of the audio clock (lookahead) from a setTimeout loop.
  var LOOKAHEAD = 0.1;   // seconds scheduled ahead
  var TICK_MS = 25;
  var MELODY_PEAK = 0.32;
  var BASS_PEAK = 0.38;
  var CHORD_PEAK = 0.12;   // quieter than melody and bass
  var CHORD_MAX_S = 0.12;  // chord plucks stay short (staccato)

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

  function pushNotes(out, steps, bpmNow, from, to, isBass, isChord) {
    if (!steps || !steps.length) { return; }
    var total = loopBeats(steps);
    if (total <= 0) { return; }
    var k0 = Math.floor(from / total);
    var k1 = Math.floor(to / total);
    for (var k = k0; k <= k1; k++) {
      var off = 0;
      for (var i = 0; i < steps.length; i++) {
        var beat = k * total + off;
        off += steps[i][1];
        if (steps[i][0] > 0 && beat >= from && beat < to) {
          var n = { beat: beat, freq: steps[i][0], len: steps[i][1] * 60 / bpmNow, bass: isBass };
          if (isChord) { n.chord = true; }
          out.push(n);
        }
      }
    }
  }

  // Pure. Notes whose start beat is in [fromBeat, toBeat); beats count up across loops.
  // len is in seconds at the given bpm; bass notes carry bass:true, chord-voice notes chord:true.
  function notesBetween(sc, bpmNow, fromBeat, toBeat) {
    var out = [];
    if (!sc || !(bpmNow > 0) || !(toBeat > fromBeat)) { return out; }
    pushNotes(out, sc.steps, bpmNow, fromBeat, toBeat, false);
    pushNotes(out, sc.bass, bpmNow, fromBeat, toBeat, true);
    pushNotes(out, sc.chords, bpmNow, fromBeat, toBeat, false, true);
    out.sort(function (a, b) { return a.beat - b.beat; });
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
            var at = nextTime + (n.beat - nextBeat) * 60 / bpm;
            var dur = n.chord ? Math.min(n.len * 0.6, CHORD_MAX_S) : n.len * 0.92;
            var osc = n.chord ? S.note(ctx, dest, at, n.freq, 0, dur, 'sine', CHORD_PEAK, 0, 0.01)
              : n.bass ? S.note(ctx, dest, at, n.freq, 0, dur, 'sine', BASS_PEAK, 0, 0.02)
                : S.note(ctx, dest, at, n.freq, 0, dur, score.wave || 'triangle', MELODY_PEAK, 0, 0.02);
            live.push({ osc: osc, end: at + dur + 0.05 });
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
