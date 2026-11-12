(function (G) {
  'use strict';

  // Happy faces only for an own-character hit.
  var EMOTIONS = ['joy', 'excited', 'cheer', 'love'];
  var DECOS = ['note', 'heart', 'sparkle'];
  // B-3: the kira card may also show the real "surprised" image (added 2026-11-12).
  var RARE = ['excited', 'surprised'];
  var COMBO_EVERY = 5;
  // B-3: result screen faces. A 2-player loser is sadness or worried (user decision 2026-11-12).
  var RESULT = {
    record: ['excited', 'cheer', 'love'],
    solo: ['joy', 'cheer'],
    win: ['excited', 'cheer', 'love'],
    lose: ['sadness', 'worried'],
    draw: ['joy', 'love']
  };

  function pick(list, rng) {
    var i = Math.floor(rng() * list.length);
    return list[Math.min(i, list.length - 1)];
  }

  // Chooses the reaction for a hit. Same emotion never 3 times in a row on one side.
  // Every 5th own-character hit in a row (no forbidden one in between) is a combo (B-3).
  function create(rng) {
    var variety = Ailand.core.EmotionVariety.create(rng);
    var streak = {}; // sideIndex -> hits in a row

    function forHit(sideIndex, kind) {
      var key = 'side' + sideIndex;
      if (kind === 'ng') { streak[sideIndex] = 0; return { emotion: 'smug', deco: null }; }
      streak[sideIndex] = (streak[sideIndex] || 0) + 1;
      if (kind === 'rare') { return { emotion: variety.pick(key, RARE), deco: 'sparkle' }; }
      if (streak[sideIndex] % COMBO_EVERY === 0) {
        return { emotion: variety.pick(key, ['cheer']), deco: 'sparkle', combo: true };
      }
      // The next hit is a combo (cheer): keep cheer out now so it never shows 3 times in a row.
      var pool = (streak[sideIndex] + 1) % COMBO_EVERY === 0 ? EMOTIONS.filter(function (e) { return e !== 'cheer'; }) : EMOTIONS;
      var emotion = variety.pick(key, pool);
      return { emotion: emotion, deco: pick(DECOS, rng) };
    }

    function forResult(role) { return pick(RESULT[role], rng); }

    // Restarts the combo count of one side, or of every side without an argument.
    function reset(sideIndex) {
      if (sideIndex === undefined) { streak = {}; } else { streak[sideIndex] = 0; }
    }

    return { forHit: forHit, forResult: forResult, reset: reset };
  }

  G.Reactions = { create: create };
})(Ailand.games.whack);
