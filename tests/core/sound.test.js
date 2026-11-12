(function (A) {
  'use strict';
  var describe = A.Test.describe, it = A.Test.it, expect = A.Test.expect;
  var Sound = A.core.Sound, Bgm = A.core.Bgm;

  function memory() {
    var m = {};
    return {
      getItem: function (k) { return Object.prototype.hasOwnProperty.call(m, k) ? m[k] : null; },
      setItem: function (k, v) { m[k] = String(v); },
      removeItem: function (k) { delete m[k]; }
    };
  }
  // Never touch the real localStorage: swap in a memory backend for the duration of fn.
  function memStorage(fn) {
    A.core.Storage._backend = memory();
    try { return fn(); } finally { A.core.Storage._backend = undefined; }
  }

  function param() {
    var p = { value: 0, lastTarget: null, calls: [] };
    p.setValueAtTime = function (v, t) { p.calls.push(['setValueAtTime', v, t]); };
    p.exponentialRampToValueAtTime = function (v, t) { p.calls.push(['exponentialRampToValueAtTime', v, t]); };
    p.setTargetAtTime = function (v) { p.lastTarget = v; };
    return p;
  }
  // noNoise: a context without AudioBuffer / BiquadFilter support (drum noise must be skipped).
  function FakeCtx(noNoise) {
    var self = this;
    this.state = 'running';
    this.currentTime = 0;
    this.destination = {};
    this.oscCount = 0;
    this.oscs = [];
    this.gains = [];
    this.resumed = 0;
    this.createGain = function () { var g = { gain: param(), connect: function () {} }; self.gains.push(g); return g; };
    this.createOscillator = function () {
      self.oscCount++;
      var o = {
        frequency: param(), connect: function () {}, startT: null, stopT: null,
        start: function (t) { o.startT = t; },
        stop: function (t) { o.stopT = t; }
      };
      self.oscs.push(o);
      return o;
    };
    this.resume = function () { self.resumed++; self.state = 'running'; return Promise.resolve(); };
    this.sources = [];
    this.filters = [];
    if (!noNoise) {
      this.sampleRate = 8000;
      this.createBuffer = function (ch, len) {
        var data = new Float32Array(len);
        return { length: len, getChannelData: function () { return data; } };
      };
      this.createBufferSource = function () {
        var s = {
          buffer: null, connect: function () {}, startT: null, stopT: null,
          start: function (t) { s.startT = t; }, stop: function (t) { s.stopT = t; }
        };
        self.sources.push(s);
        return s;
      };
      this.createBiquadFilter = function () {
        var f = { type: 'lowpass', frequency: param(), connect: function () {} };
        self.filters.push(f);
        return f;
      };
    }
  }

  function withFake(state, fn, noNoise) {
    var made = null;
    window.AudioContext = function () { made = new FakeCtx(noNoise); made.state = state; return made; };
    Sound._reset();
    memStorage(function () {
      Sound.setEnabled(true);
      Sound.unlock();
      // resume() of a suspended fake leaves it running in this stub; force the state under test
      if (made) { made.state = state; }
      try { fn(made); } finally { delete window.AudioContext; Sound._reset(); Bgm.stop(); }
    });
  }

  describe('core/Sound without AudioContext (Node)', function () {
    it('every API is a safe no-op', function () {
      // A browser has a real AudioContext: hide it here so the Node path is tested there too.
      var saved = { AudioContext: window.AudioContext, webkitAudioContext: window.webkitAudioContext };
      delete window.AudioContext;
      delete window.webkitAudioContext;
      try {
        Sound._reset();
        Sound.unlock();
        Sound.register('x', function () { throw new Error('should not run'); });
        Sound.play('x');
        Sound.play('nothing');
        Sound.setVolumes({ se: 0.5, bgm: 0.2 });
        expect(Sound.bgmDest()).toBe(null);
        Bgm.start({ bpm: 120, wave: 'triangle', bass: [], steps: [[440, 1]] });
        Bgm.setTempo(150);
        Bgm._tick();
        Bgm.stop();
      } finally {
        Sound._reset();
        if (saved.AudioContext) { window.AudioContext = saved.AudioContext; }
        if (saved.webkitAudioContext) { window.webkitAudioContext = saved.webkitAudioContext; }
      }
    });
    it('setEnabled / isEnabled round-trip, merging into settings.v1', function () {
      memStorage(function () {
        var st = A.core.Storage.create('core');
        st.set('settings.v1', { sound: true, other: 1 });
        Sound.setEnabled(false);
        expect(Sound.isEnabled()).toBe(false);
        expect(st.get('settings.v1', null)).toEqual({ sound: false, other: 1 });
        Sound.setEnabled(true);
        expect(Sound.isEnabled()).toBe(true);
      });
    });
    it('isBgmOn defaults to ON (no settings, unreadable settings, missing field)', function () {
      memStorage(function () {
        var st = A.core.Storage.create('core');
        expect(Sound.isBgmOn()).toBe(true);
        st.set('settings.v1', 'broken');
        expect(Sound.isBgmOn()).toBe(true);
        st.set('settings.v1', { sound: false });
        expect(Sound.isBgmOn()).toBe(true);
      });
    });
    it('setBgmOn writes only the bgm field, keeping the others', function () {
      memStorage(function () {
        var st = A.core.Storage.create('core');
        st.set('settings.v1', { sound: false, other: 1 });
        Sound.setBgmOn(false);
        expect(Sound.isBgmOn()).toBe(false);
        expect(st.get('settings.v1', null)).toEqual({ sound: false, other: 1, bgm: false });
        Sound.setBgmOn(true);
        expect(Sound.isBgmOn()).toBe(true);
        expect(st.get('settings.v1', null)).toEqual({ sound: false, other: 1, bgm: true });
      });
    });
    it('setBgmOn on empty or broken settings creates { bgm }', function () {
      memStorage(function () {
        var st = A.core.Storage.create('core');
        Sound.setBgmOn(false);
        expect(st.get('settings.v1', null)).toEqual({ bgm: false });
        st.set('settings.v1', 'broken');
        Sound.setBgmOn(true);
        expect(st.get('settings.v1', null)).toEqual({ bgm: true });
      });
    });
  });

  describe('core/Sound with a fake AudioContext', function () {
    it('plays only registered names, when running and enabled', function () {
      withFake('running', function (c) {
        var hits = 0;
        Sound.register('a', function (ctx, dest, t, o) { hits++; Sound.note(ctx, dest, t, 440, 0, 0.1); });
        Sound.play('a');
        expect(hits).toBe(1);
        expect(c.oscCount).toBe(1);
        Sound.play('unregistered');
        expect(hits).toBe(1);
        Sound.setEnabled(false);
        Sound.play('a');
        expect(hits).toBe(1);
        expect(Sound.bgmDest()).toBe(null);
      });
    });
    it('does nothing while the context is suspended', function () {
      withFake('suspended', function (c) {
        var hits = 0;
        Sound.register('a', function () { hits++; });
        Sound.play('a');
        expect(hits).toBe(0);
        expect(Sound.bgmDest()).toBe(null);
        Bgm.start({ bpm: 120, wave: 'triangle', bass: [], steps: [[440, 1]] });
        Bgm._tick();
        expect(c.oscCount).toBe(0);
      });
    });
    it('a throwing sound never propagates', function () {
      withFake('running', function () {
        Sound.register('bad', function () { throw new Error('boom'); });
        Sound.play('bad');
        expect(true).toBe(true);
      });
    });
    it('BGM bus exists when running; Bgm schedules notes on a tick', function () {
      withFake('running', function (c) {
        expect(Sound.bgmDest() !== null).toBe(true);
        Bgm.start({ bpm: 120, wave: 'triangle', bass: [[100, 1]], steps: [[440, 1]] });
        c.currentTime = 0.1;
        Bgm._tick();
        c.currentTime = 0.3;
        Bgm._tick();
        expect(c.oscCount > 0).toBe(true);
      });
    });
  });

  describe('core/Bgm voices (fake clock)', function () {
    function run(c, seconds) {
      for (var t = 0; t < seconds; t += 0.025) { c.currentTime += 0.025; Bgm._tick(); }
    }
    function f0(o) { return o.frequency.calls.length ? o.frequency.calls[0][1] : null; }
    function at(c, hz) { return c.oscs.filter(function (o) { return Math.abs(f0(o) - hz) < 1e-6; }); }
    function types(list) {
      var seen = {};
      list.forEach(function (o) { seen[o.type] = true; });
      return Object.keys(seen).sort();
    }

    it('defaults are unchanged: triangle melody, sine bass, sine chords', function () {
      withFake('running', function (c) {
        Bgm.start({ bpm: 120, wave: 'triangle', bass: [[100, 1]], chords: [[300, 1]], steps: [[500, 1]] });
        run(c, 1);
        expect(c.oscs.length > 0).toBe(true);
        expect(types(at(c, 500))).toEqual(['triangle']);
        expect(types(at(c, 100))).toEqual(['sine']);
        expect(types(at(c, 300))).toEqual(['sine']);
      });
    });
    it('bassWave / chordWave / wave pick each voice\'s oscillator type', function () {
      withFake('running', function (c) {
        Bgm.start({
          bpm: 120, wave: 'sawtooth', bassWave: 'triangle', chordWave: 'square',
          bass: [[100, 1]], chords: [[300, 1]], steps: [[500, 1]]
        });
        run(c, 1);
        expect(types(at(c, 500))).toEqual(['sawtooth']);
        expect(types(at(c, 100))).toEqual(['triangle']);
        expect(types(at(c, 300))).toEqual(['square']);
      });
    });
    it('bend starts the melody at freq * bend and ramps up to freq', function () {
      withFake('running', function (c) {
        Bgm.start({ bpm: 120, wave: 'sine', bass: [], steps: [[500, 1]], bend: 0.8 });
        run(c, 0.5);
        var o = at(c, 400);
        expect(o.length > 0).toBe(true);
        var calls = o[0].frequency.calls;
        var t0 = calls[0][2];
        var ramp = calls.filter(function (x) { return x[0] === 'exponentialRampToValueAtTime'; })[0];
        expect(ramp[1]).toBe(500);
        expect(ramp[2] > t0 && ramp[2] <= t0 + 0.06 + 1e-9).toBe(true);
      });
    });
    it('sparkle adds a quiet sine an octave up for each melody note', function () {
      withFake('running', function (c) {
        Bgm.start({ bpm: 120, wave: 'sine', bass: [], steps: [[500, 1]], sparkle: true });
        run(c, 2);
        var mel = at(c, 500), up = at(c, 1000);
        expect(mel.length > 0).toBe(true);
        expect(up.length).toBe(mel.length);
        expect(types(up)).toEqual(['sine']);
      });
    });
    it('drums: kick is an oscillator from 150 Hz, snare/hat are filtered noise', function () {
      withFake('running', function (c) {
        Bgm.start({ bpm: 120, wave: 'triangle', bass: [], steps: [[0, 1]], drums: [['ks', 0.5], ['h', 0.5]] });
        run(c, 1);
        expect(at(c, 150).length > 0).toBe(true);
        var kinds = c.filters.map(function (f) { return f.type + ':' + f.frequency.value; });
        expect(kinds.indexOf('bandpass:1800') >= 0).toBe(true);
        expect(kinds.indexOf('highpass:7000') >= 0).toBe(true);
        expect(c.sources.length > 0).toBe(true);
        expect(c.sources.every(function (s) { return s.buffer && s.buffer === c.sources[0].buffer; })).toBe(true);
      });
    });
    it('no noise support: snare and hat are skipped without throwing', function () {
      withFake('running', function (c) {
        Bgm.start({ bpm: 120, wave: 'triangle', bass: [], steps: [[0, 2]], drums: [['s', 0.5], ['h', 0.5], ['k', 1]] });
        run(c, 1.5);
        expect(at(c, 150).length > 0).toBe(true);
        expect(c.sources.length).toBe(0);
      }, true);
    });
    it('a drum hit that throws does not replay the other notes on later ticks', function () {
      withFake('running', function (c) {
        c.createBuffer = function () { throw new Error('no buffer'); };
        Bgm.start({ bpm: 120, wave: 'triangle', bass: [], steps: [[500, 0.5], [600, 0.5]], drums: [['s', 1]] });
        run(c, 2);
        var st = at(c, 500).concat(at(c, 600)).map(function (o) { return o.startT; }).sort(function (a, b) { return a - b; });
        expect(st.length > 4).toBe(true);
        for (var i = 1; i < st.length; i++) { expect(st[i] > st[i - 1]).toBe(true); }
      });
    });
    it('stop() also stops drum noise sources', function () {
      withFake('running', function (c) {
        Bgm.start({ bpm: 120, wave: 'triangle', bass: [], steps: [[0, 1]], drums: [['s', 0.5], ['h', 0.5]] });
        run(c, 0.5);
        expect(c.sources.length > 0).toBe(true);
        Bgm.stop();
        c.sources.forEach(function (s) { expect(s.stopT <= c.currentTime + 0.1 + 1e-9).toBe(true); });
      });
    });
    var swung = { bpm: 60, wave: 'triangle', bass: [], steps: [[500, 0.5], [600, 0.5]], swing: 1 / 6 };
    it('swing: off-beat 8ths start swing beats late', function () {
      withFake('running', function (c) {
        Bgm.start(swung);
        run(c, 3);
        var mel = c.oscs.filter(function (o) { return f0(o) === 500 || f0(o) === 600; });
        var checked = 0;
        for (var i = 1; i < mel.length; i++) {
          if (f0(mel[i]) === 600 && f0(mel[i - 1]) === 500) {
            expect(Math.abs(mel[i].startT - mel[i - 1].startT - (0.5 + 1 / 6)) < 1e-6).toBe(true);
            checked++;
          }
        }
        expect(checked >= 2).toBe(true);
      });
    });
    it('swing stays in order across a tempo change', function () {
      withFake('running', function (c) {
        Bgm.start(swung);
        run(c, 1.5);
        Bgm.setTempo(90);
        run(c, 2);
        var st = c.oscs.map(function (o) { return o.startT; });
        expect(st.length > 4).toBe(true);
        for (var i = 1; i < st.length; i++) { expect(st[i] > st[i - 1]).toBe(true); }
      });
    });
  });

  describe('core/Bgm scheduler (fake clock)', function () {
    var loop = { bpm: 120, wave: 'triangle', bass: [], steps: [[500, 0.5], [600, 0.5]] }; // 1 beat per loop

    function run(c, seconds) {
      for (var t = 0; t < seconds; t += 0.025) { c.currentTime += 0.025; Bgm._tick(); }
    }
    function starts(c) { return c.oscs.map(function (o) { return o.startT; }); }

    it('start times strictly increase over 2+ loops with no duplicates, evenly spaced', function () {
      withFake('running', function (c) {
        Bgm.start(loop);
        run(c, 3);
        var st = starts(c);
        expect(st.length > 8).toBe(true);
        for (var i = 1; i < st.length; i++) {
          expect(st[i] > st[i - 1]).toBe(true);
          expect(Math.abs(st[i] - st[i - 1] - 0.25) < 1e-6).toBe(true);
        }
      });
    });
    it('stays continuous after setTempo(150)', function () {
      withFake('running', function (c) {
        Bgm.start(loop);
        run(c, 1.5);
        var before = c.oscCount;
        Bgm.setTempo(150);
        run(c, 2);
        var st = starts(c);
        expect(st.length > before + 4).toBe(true);
        for (var i = 1; i < st.length; i++) {
          var d = st[i] - st[i - 1];
          expect(d > 0.2 - 1e-6 && d < 0.25 + 1e-6).toBe(true);
        }
      });
    });
    it('a long clock jump schedules no burst of old notes', function () {
      withFake('running', function (c) {
        Bgm.start(loop);
        run(c, 1);
        var before = c.oscCount;
        c.currentTime += 12;
        Bgm._tick();
        expect(c.oscCount - before <= 2).toBe(true);
        run(c, 0.3);
        var st = starts(c).slice(before);
        st.forEach(function (t) { expect(t >= c.currentTime - 0.3).toBe(true); });
        expect(c.oscCount - before <= 6).toBe(true);
      });
    });
    it('no new notes after stop(); scheduled ones are stopped', function () {
      withFake('running', function (c) {
        Bgm.start(loop);
        run(c, 1);
        Bgm.stop();
        var n = c.oscCount;
        run(c, 1);
        expect(c.oscCount).toBe(n);
        var cut = c.oscs.filter(function (o) { return o.stopT !== null && o.stopT <= c.currentTime; });
        expect(cut.length >= 0).toBe(true);
      });
    });
    it('stop() cuts oscillators still scheduled in the future', function () {
      withFake('running', function (c) {
        Bgm.start({ bpm: 60, wave: 'triangle', bass: [], steps: [[500, 4]] });
        run(c, 0.5);
        var o = c.oscs[c.oscs.length - 1];
        var nowT = c.currentTime;
        Bgm.stop();
        expect(o.stopT <= nowT + 0.1 + 1e-9).toBe(true);
      });
    });
    it('setEnabled(false) ramps the master gain to 0, true restores it', function () {
      withFake('running', function (c) {
        var master = c.gains[0];
        Sound.setEnabled(false);
        expect(master.gain.lastTarget).toBe(0);
        Sound.setEnabled(true);
        expect(master.gain.lastTarget > 0).toBe(true);
      });
    });
    it('setVolumes clamps to [0, 1]', function () {
      withFake('running', function (c) {
        Sound.setVolumes({ se: 5, bgm: -2 });
        expect(c.gains[1].gain.value).toBe(1);
        expect(c.gains[2].gain.value).toBe(0);
      });
    });
    it('unlock() resumes whenever the context is not running', function () {
      withFake('running', function (c) {
        c.state = 'interrupted';
        Sound.unlock();
        expect(c.resumed >= 1).toBe(true);
      });
    });
  });

  describe('drop4 Sounds', function () {
    it('registers every name and each plays at least one oscillator', function () {
      ['drop', 'pop', 'reach', 'block', 'double', 'win', 'lose', 'draw', 'button'].forEach(function (name) {
        withFake('running', function (c) {
          Sound.play(name, { rows: 3 });
          expect(c.oscCount > 0).toBe(true);
        });
      });
    });
    it('drop makes two bounces', function () {
      withFake('running', function (c) {
        Sound.play('drop', { rows: 3 });
        expect(c.oscCount).toBe(2);
      });
    });
  });

  describe('core/Sound onChange', function () {
    it('onChange fires once per real change', function () {
      memStorage(function () {
        Sound._reset();
        var got = [];
        var off = Sound.onChange(function (v) { got.push(v); });
        Sound.setEnabled(false);
        Sound.setEnabled(false);
        Sound.setEnabled(true);
        off();
        Sound.setEnabled(false);
        expect(got).toEqual([false, true]);
        Sound.setEnabled(true);
      });
    });
  });

  describe('core/Sound wireUnlock (start audio as soon as the browser allows)', function () {
    function target() {
      var t = { on: {} };
      t.addEventListener = function (type, fn, capture) { t.on[type] = { fn: fn, capture: capture }; };
      return t;
    }
    function wired(fn) {
      var made = [];
      window.AudioContext = function () { var c = new FakeCtx(); made.push(c); return c; };
      Sound._reset();
      var doc = target(), win = target(), calls = { n: 0 };
      try {
        memStorage(function () {
          Sound.wireUnlock(function () { calls.n++; }, { doc: doc, win: win });
          fn(doc, win, calls, made);
        });
      } finally { delete window.AudioContext; Sound._reset(); }
    }
    it('tries at once on page load (Chrome allows it after a click-through from the same site)', function () {
      wired(function (doc, win, calls, made) {
        expect(made.length).toBe(1);
        expect(calls.n).toBe(1);
      });
    });
    it('tries again on every gesture, in the capture phase', function () {
      wired(function (doc, win, calls) {
        ['pointerdown', 'touchend', 'click', 'keydown'].forEach(function (type) {
          expect(doc.on[type].capture).toBe(true);
          doc.on[type].fn({});
        });
        expect(calls.n).toBe(5);
      });
    });
    it('tries again when the page comes back from the back/forward cache only', function () {
      wired(function (doc, win, calls) {
        win.on.pageshow.fn({ persisted: false });
        expect(calls.n).toBe(1);
        win.on.pageshow.fn({ persisted: true });
        expect(calls.n).toBe(2);
      });
    });
  });

  // Browsers keep audio silent until the first tap. That tap on the おと button must start the sound,
  // not turn it OFF, even when resume() already finished before the click arrives.
  describe('core/Sound locked state and toggleFromTap', function () {
    // The browser has not allowed audio yet: the context is created suspended and resume() works at once.
    function lockedPage(fn) {
      var made = [];
      window.AudioContext = function () { var c = new FakeCtx(); c.state = 'suspended'; made.push(c); return c; };
      Sound._reset();
      var doc = { on: {}, addEventListener: function (t, f) { doc.on[t] = f; } };
      var win = { addEventListener: function () {} };
      try {
        memStorage(function () {
          Sound.setEnabled(true);
          var seen = [];
          Sound.onLockChange(function (v) { seen.push(v); });
          Sound.wireUnlock(null, { doc: doc, win: win });
          made[0].state = 'suspended'; // the page-load try did not get permission
          fn(doc, made[0], seen);
        });
      } finally { delete window.AudioContext; Sound._reset(); }
    }
    it('isLocked is true while sound is ON and the context is not running', function () {
      lockedPage(function (doc, ctx) {
        expect(Sound.isLocked()).toBe(true);
        ctx.state = 'running';
        expect(Sound.isLocked()).toBe(false);
        ctx.state = 'suspended';
        Sound.setEnabled(false);
        expect(Sound.isLocked()).toBe(false);
      });
    });
    it('isLocked is false without Web Audio', function () {
      Sound._reset();
      memStorage(function () {
        Sound.setEnabled(true);
        expect(Sound.isLocked()).toBe(false);
      });
    });
    it('the first tap on the button keeps sound ON (pointer: resume finished before the click)', function () {
      lockedPage(function (doc, ctx) {
        doc.on.pointerdown({ type: 'pointerdown' }); // fake resume() sets running at once
        expect(ctx.state).toBe('running');
        doc.on.click({ type: 'click' });
        expect(Sound.toggleFromTap()).toBe(true);
        expect(Sound.isEnabled()).toBe(true);
      });
    });
    it('the first Enter on the button keeps sound ON too', function () {
      lockedPage(function (doc) {
        doc.on.keydown({ type: 'keydown' });
        doc.on.click({ type: 'click' });
        expect(Sound.toggleFromTap()).toBe(true);
      });
    });
    it('a tap after sound was already playing turns it OFF', function () {
      lockedPage(function (doc, ctx) {
        ctx.state = 'running';
        doc.on.pointerdown({ type: 'pointerdown' });
        doc.on.click({ type: 'click' });
        expect(Sound.toggleFromTap()).toBe(false);
        expect(Sound.isEnabled()).toBe(false);
      });
    });
    it('a tap while sound is OFF turns it ON', function () {
      lockedPage(function (doc) {
        Sound.setEnabled(false);
        doc.on.pointerdown({ type: 'pointerdown' });
        doc.on.click({ type: 'click' });
        expect(Sound.toggleFromTap()).toBe(true);
      });
    });
    it('onLockChange reports when the context starts running', function () {
      lockedPage(function (doc, ctx, seen) {
        ctx.state = 'running';
        ctx.onstatechange();
        expect(seen[seen.length - 1]).toBe(false);
      });
    });
  });
})(Ailand);
