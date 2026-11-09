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
  var listeners = [];
  var lockListeners = [];
  var armed = null; // locked state when the current tap/key began; null = no gesture in progress

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
    return osc;
  }

  function seq(c, dest, t, freqs, step, dur, type, peak) {
    for (var i = 0; i < freqs.length; i++) { note(c, dest, t, freqs[i], i * step, dur, type, peak); }
  }

  function applyVolumes() {
    if (seGain) { seGain.gain.value = volumes.se; }
    if (bgmGain) { bgmGain.gain.value = volumes.bgm; }
  }

  function playable() { return !!(enabled && ctx && ctx.state === 'running'); }

  function hasAudio() { return typeof window !== 'undefined' && !!(window.AudioContext || window.webkitAudioContext); }
  // Sound is wanted but the browser has not let it play yet (no tap so far, or iOS suspended it).
  function isLocked() { return !!(enabled && hasAudio() && !(ctx && ctx.state === 'running')); }
  function notifyLock() {
    var v = isLocked();
    lockListeners.slice().forEach(function (fn) { fn(v); });
  }

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
          ctx.onstatechange = notifyLock;
          notifyLock(); // a context the browser allowed is running from the start (no statechange)
        }
        if (ctx.state !== 'running') {
          var p = ctx.resume();
          if (p && p.then) { p.then(notifyLock, function () {}); }
        }
      } catch (e) { /* audio unavailable: stay silent */ }
    },
    // One wiring for every page: unlock at once (Chrome lets a page reached by a same-site click start
    // audio without a new gesture), again on each gesture (iOS needs one and can re-suspend), and after a
    // back/forward-cache restore. fn (e.g. a BGM sync) runs after each try. opts { doc, win } is for tests.
    wireUnlock: function (fn, opts) {
      var doc = (opts && opts.doc) || document;
      var win = (opts && opts.win) || window;
      function go(e) {
        var type = e && e.type;
        // Remember whether audio was locked when this gesture began: resume() may finish before the click.
        if (type === 'pointerdown' || type === 'keydown') { armed = isLocked(); }
        else if (type === 'click' && armed === null) { armed = isLocked(); }
        C.Sound.unlock();
        if (fn) { fn(); }
        if (type === 'click') { setTimeout(function () { armed = null; }, 0); }
      }
      ['pointerdown', 'touchend', 'click', 'keydown'].forEach(function (type) {
        doc.addEventListener(type, go, true);
      });
      win.addEventListener('pageshow', function (e) { if (e && e.persisted) { go(); } });
      go();
    },
    setEnabled: function (on) {
      var changed = enabled !== !!on;
      enabled = !!on;
      var s = store.get('settings.v1', null);
      s = (s && typeof s === 'object') ? s : {};
      s.sound = enabled;
      store.set('settings.v1', s);
      // Silence (or restore) notes that are already scheduled.
      try { if (master && ctx) { master.gain.setTargetAtTime(enabled ? MASTER_VOLUME : 0, ctx.currentTime, 0.02); } } catch (e) { /* ignore */ }
      if (changed) { listeners.slice().forEach(function (fn) { fn(enabled); }); }
    },
    // fn(on) runs after every real ON/OFF change, from any page part. Returns off().
    onChange: function (fn) {
      listeners.push(fn);
      return function off() {
        var i = listeners.indexOf(fn);
        if (i !== -1) { listeners.splice(i, 1); }
      };
    },
    isEnabled: function () { return enabled; },
    isLocked: isLocked,
    // fn(locked) after the browser lets audio play (or suspends it again). Returns off().
    onLockChange: function (fn) {
      lockListeners.push(fn);
      return function off() {
        var i = lockListeners.indexOf(fn);
        if (i !== -1) { lockListeners.splice(i, 1); }
      };
    },
    // For every おと button. The tap that only lets the browser play keeps sound ON; later taps flip it.
    toggleFromTap: function () {
      var locked = armed !== null ? armed : isLocked();
      if (enabled && locked) { C.Sound.unlock(); return true; }
      C.Sound.setEnabled(!enabled);
      return enabled;
    },
    _notifyLock: notifyLock,
    // BGM ON/OFF lives next to `sound` in ailand:core:settings.v1 (default ON). Shared by every page.
    isBgmOn: function () {
      var s = store.get('settings.v1', null);
      return !(s && typeof s === 'object' && s.bgm === false);
    },
    setBgmOn: function (on) {
      var s = store.get('settings.v1', null);
      s = (s && typeof s === 'object') ? s : {};
      s.bgm = !!on;
      store.set('settings.v1', s);
    },
    register: function (name, fn) { registry[name] = fn; },
    // fn(ctx, dest, t, opts): dest is the effects bus, t is the current audio time.
    play: function (name, opts) {
      if (!playable() || !registry[name]) { return; }
      try { registry[name](ctx, seGain, ctx.currentTime, opts || {}); } catch (e) { /* never throw */ }
    },
    setVolumes: function (v) {
      if (v && typeof v.se === 'number' && v.se === v.se) { volumes.se = Math.max(0, Math.min(1, v.se)); }
      if (v && typeof v.bgm === 'number' && v.bgm === v.bgm) { volumes.bgm = Math.max(0, Math.min(1, v.bgm)); }
      applyVolumes();
    },
    // BGM bus, or null while nothing can be heard.
    bgmDest: function () { return playable() ? bgmGain : null; },
    // Fade the BGM bus out now (stop) or back in after `delay` seconds (start).
    fadeBgm: function (on, delay) {
      try {
        if (!bgmGain || !ctx) { return; }
        bgmGain.gain.setTargetAtTime(on ? volumes.bgm : 0, ctx.currentTime + (delay || 0), on ? 0.01 : 0.02);
      } catch (e) { /* ignore */ }
    },
    context: function () { return playable() ? ctx : null; },
    // Test hook: forget the AudioContext so a fake one can be created by unlock().
    _reset: function () {
      ctx = null; enabled = true; listeners = []; lockListeners = []; armed = null; master = null; seGain = null; bgmGain = null;
      volumes = { se: SE_VOLUME, bgm: BGM_VOLUME };
    }
  };
})(Ailand.core);
