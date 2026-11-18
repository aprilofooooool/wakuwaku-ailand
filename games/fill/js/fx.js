(function (G) {
  'use strict';
  // fill effects (design 4.6, 5.2): the small bounce of a placed piece, the clear timeline, confetti and sparkles.
  // Particles live on the core fx layer. Reduced motion: no bounce, no shine, no confetti, no sparkles; the pieces
  // vanish and the picture simply appears.
  var F = Ailand.core.Effects;
  var POP_MS = 260;          // a placed piece bounces this long
  var POP_SIZE = 0.1;        // and grows by up to 10%

  // Scale of a bouncing piece `t` ms after it was placed (1 before and after the bounce).
  function popScale(t) {
    if (t <= 0 || t >= POP_MS) { return 1; }
    return 1 + POP_SIZE * Math.sin(Math.PI * t / POP_MS);
  }

  // Clear timeline in ms from the clear: pieces shine until `reveal`, the picture floats in, the name and
  // the cheer come at `cheer`, the done screen at `done`.
  function timeline(reduced) {
    return reduced ? { reveal: 0, cheer: 300, done: 1500 } : { reveal: 600, cheer: 1500, done: 2700 };
  }

  function confetti() { return F.isReduced() ? 0 : F.burst(F.getLayer(), 'confetti'); }
  function sparkle(at) { return F.isReduced() ? 0 : F.burst(F.getLayer(), 'sparkle', at); }
  // Removes every particle (leaving the screen).
  function stop() {
    var l = document.getElementById('fx-layer');
    if (l) { l.innerHTML = ''; }
  }

  G.Fx = { POP_MS: POP_MS, popScale: popScale, timeline: timeline, confetti: confetti, sparkle: sparkle, stop: stop };
})(Ailand.games.fill);
