(function (C) {
  'use strict';

  // Picks an emotion from a pool per key (a seat or a side). Requirements 1.6: when the last two
  // picks for a key are the same, that emotion is left out, so it never shows 3 times in a row.
  function create(rng) {
    var history = {}; // key -> last emotions (max 2), oldest first

    function pick(key, pool) {
      var h = history[key] || (history[key] = []);
      var list = pool;
      if (pool.length > 1 && h.length === 2 && h[0] === h[1]) {
        list = pool.filter(function (e) { return e !== h[0]; });
      }
      var emotion = list[Math.min(Math.floor(rng() * list.length), list.length - 1)];
      h.push(emotion);
      if (h.length > 2) { h.shift(); }
      return emotion;
    }

    function reset() { history = {}; }

    return { pick: pick, reset: reset };
  }

  C.EmotionVariety = { create: create };
})(Ailand.core);
