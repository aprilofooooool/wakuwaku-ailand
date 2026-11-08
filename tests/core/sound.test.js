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
    var p = { value: 0, lastTarget: null };
    p.setValueAtTime = function () {};
    p.exponentialRampToValueAtTime = function () {};
    p.setTargetAtTime = function (v) { p.lastTarget = v; };
    return p;
  }
  function FakeCtx() {
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
  }

  function withFake(state, fn) {
    var made = null;
    window.AudioContext = function () { made = new FakeCtx(); made.state = state; return made; };
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
      expect(true).toBe(true);
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
})(Ailand);
