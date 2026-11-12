(function (G) {
  'use strict';

  // Happy faces only (surprised maps to the panic image, so it is not used).
  var EMOTIONS = ['joy', 'excited', 'cheer', 'love'];
  var DECOS = ['note', 'heart', 'sparkle'];

  function pick(list, rng) {
    var i = Math.floor(rng() * list.length);
    return list[Math.min(i, list.length - 1)];
  }

  // Chooses the reaction for a hit. Same emotion never 3 times in a row on one side.
  function create(rng) {
    var history = {}; // sideIndex -> last emotions (max 2)

    function forHit(sideIndex, kind) {
      if (kind === 'rare') { return { emotion: 'excited', deco: 'sparkle' }; }
      if (kind === 'ng') { return { emotion: 'smug', deco: null }; }
      var h = history[sideIndex] || (history[sideIndex] = []);
      var pool = EMOTIONS;
      if (h.length === 2 && h[0] === h[1]) {
        pool = EMOTIONS.filter(function (e) { return e !== h[0]; });
      }
      var emotion = pick(pool, rng);
      h.push(emotion);
      if (h.length > 2) { h.shift(); }
      return { emotion: emotion, deco: pick(DECOS, rng) };
    }

    return { forHit: forHit };
  }

  G.Reactions = { create: create };
})(Ailand.games.whack);
