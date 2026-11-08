(function (C) {
  'use strict';

  // Synthesized sound effects (requirements 1.7). No audio files. Every API is a safe no-op when
  // AudioContext is missing (Node), suspended, or sound is off.
  var MASTER_VOLUME = 0.25;
  var SE_VOLUME = 1;
  var BGM_VOLUME = 0.5; // half of the effects

  var store = C.Storage.create('core');
  var ctx = null;
  var master = null;
  var seGain = null;
  var bgmGain = null;
  var volumes = { se: SE_VOLUME, bgm: BGM_VOLUME };
  var registry = {};
  var enabled = readEnabled();

  function readEnabled() {
    var s = store.get('settings.v1', null);
    return !(s && s.sound === false);
  }

  // One oscillator with a soft gain envelope. t = base audio time, start = offset from t (seconds).
  function note(c, dest, t, freq, start, dur, type, peak, endFreq, attack) {
    var t0 = t + start;
    var a = attack || 0.012;
    var osc = c.createOscillator();
    var g = c.createGain();
    osc.type = type || 'sine';
    osc.frequency.setValueAtTime(freq, t0);
    if (endFreq) { osc.frequency.exponentialRampToValueAtTime(endFreq, t0 + dur); }
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(peak || 0.5, t0 + Math.min(a, dur / 2));
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    osc.connect(g);
    g.connect(dest);
    osc.start(t0);
    osc.stop(t0 + dur + 0.02);
  }

  function seq(c, dest, t, freqs, step, dur, type, peak) {
    for (var i = 0; i < freqs.length; i++) { note(c, dest, t, freqs[i], i * step, dur, type, peak); }
  }

  function applyVolumes() {
    if (seGain) { seGain.gain.value = volumes.se; }
    if (bgmGain) { bgmGain.gain.value = volumes.bgm; }
  }

  function playable() { return !!(enabled && ctx && ctx.state === 'running'); }

  C.Sound = {
    note: note,
    seq: seq,
    // Call from the first user gesture. Creates the AudioContext lazily; resumes if suspended.
    unlock: function () {
      try {
        if (!ctx) {
          var AC = window.AudioContext || window.webkitAudioContext;
          if (!AC) { return; }
          ctx = new AC();
          master = ctx.createGain();
          master.gain.value = MASTER_VOLUME;
          master.connect(ctx.destination);
          seGain = ctx.createGain();
          seGain.connect(master);
          bgmGain = ctx.createGain();
          bgmGain.connect(master);
          applyVolumes();
        }
        if (ctx.state === 'suspended') {
          var p = ctx.resume();
          if (p && p.catch) { p.catch(function () {}); }
        }
      } catch (e) { /* audio unavailable: stay silent */ }
    },
    setEnabled: function (on) {
      enabled = !!on;
      store.set('settings.v1', { sound: enabled });
    },
    isEnabled: function () { return enabled; },
    register: function (name, fn) { registry[name] = fn; },
    // fn(ctx, dest, t, opts): dest is the effects bus, t is the current audio time.
    play: function (name, opts) {
      if (!playable() || !registry[name]) { return; }
      try { registry[name](ctx, seGain, ctx.currentTime, opts || {}); } catch (e) { /* never throw */ }
    },
    setVolumes: function (v) {
      if (v && typeof v.se === 'number' && v.se >= 0) { volumes.se = v.se; }
      if (v && typeof v.bgm === 'number' && v.bgm >= 0) { volumes.bgm = v.bgm; }
      applyVolumes();
    },
    // BGM bus, or null while nothing can be heard.
    bgmDest: function () { return playable() ? bgmGain : null; },
    context: function () { return playable() ? ctx : null; },
    // Test hook: forget the AudioContext so a fake one can be created by unlock().
    _reset: function () {
      ctx = null; master = null; seGain = null; bgmGain = null;
      volumes = { se: SE_VOLUME, bgm: BGM_VOLUME };
    }
  };
})(Ailand.core);
