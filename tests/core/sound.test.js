(function (A) {
  'use strict';
  var describe = A.Test.describe, it = A.Test.it, expect = A.Test.expect;
  var Sound = A.core.Sound, Bgm = A.core.Bgm;

  function param() {
    return { value: 0, setValueAtTime: function () {}, exponentialRampToValueAtTime: function () {} };
  }
  function FakeCtx() {
    var self = this;
    this.state = 'running';
    this.currentTime = 0;
    this.destination = {};
    this.oscCount = 0;
    this.createGain = function () { return { gain: param(), connect: function () {} }; };
    this.createOscillator = function () {
      self.oscCount++;
      return { frequency: param(), connect: function () {}, start: function () {}, stop: function () {} };
    };
    this.resume = function () { self.state = 'running'; return Promise.resolve(); };
  }

  function withFake(state, fn) {
    var made = null;
    window.AudioContext = function () { made = new FakeCtx(); made.state = state; return made; };
    Sound._reset();
    Sound.setEnabled(true);
    Sound.unlock();
    // resume() of a suspended fake leaves it running in this stub; force the state under test
    if (made) { made.state = state; }
    try { fn(made); } finally { delete window.AudioContext; Sound._reset(); Sound.setEnabled(true); Bgm.stop(); }
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
    it('setEnabled / isEnabled round-trip', function () {
      Sound.setEnabled(false);
      expect(Sound.isEnabled()).toBe(false);
      Sound.setEnabled(true);
      expect(Sound.isEnabled()).toBe(true);
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
        Bgm._tick();
        expect(c.oscCount > 0).toBe(true);
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
})(Ailand);
