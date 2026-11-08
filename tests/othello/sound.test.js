(function (O) {
  'use strict';

  describe('Sound (no AudioContext)', function () {
    it('isEnabled follows core sound', function () {
      var S = Ailand.core.Sound;
      try {
        S.setEnabled(false);
        expect(O.Sound.isEnabled()).toBe(false);
        S.setEnabled(true);
        expect(O.Sound.isEnabled()).toBe(true);
      } finally { S.setEnabled(true); }
    });
    it('play is silent while core sound is off', function () {
      var S = Ailand.core.Sound;
      try {
        S.setEnabled(false);
        expect(O.Sound.isEnabled()).toBe(false);
        O.Sound.play('place');
      } finally { S.setEnabled(true); }
    });
    it('play before unlock does not throw', function () {
      ['place', 'flip', 'reaction', 'pass', 'win', 'lose', 'draw', 'button', 'unknown'].forEach(function (n) {
        O.Sound.play(n, { count: 3, emotion: 'joy' });
      });
    });
    it('unlock without Web Audio does not throw', function () {
      O.Sound.unlock();
      O.Sound.play('place');
    });
  });
  describe('BgmLink.wanted', function () {
    it('needs core sound and BGM both ON', function () {
      var S = Ailand.core.Sound;
      var m = {}; // memory backend: never touch the real localStorage
      Ailand.core.Storage._backend = {
        getItem: function (k) { return Object.prototype.hasOwnProperty.call(m, k) ? m[k] : null; },
        setItem: function (k, v) { m[k] = String(v); },
        removeItem: function (k) { delete m[k]; }
      };
      try {
        S.setEnabled(false); S.setBgmOn(true);
        expect(O.BgmLink.wanted()).toBe(false);
        S.setEnabled(true); S.setBgmOn(false);
        expect(O.BgmLink.wanted()).toBe(false);
        S.setBgmOn(true);
        expect(O.BgmLink.wanted()).toBe(true);
      } finally { S.setEnabled(true); S.setBgmOn(true); Ailand.core.Storage._backend = undefined; }
    });
  });
})(Ailand.games.othello);
