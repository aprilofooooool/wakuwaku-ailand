(function (O) {
  'use strict';

  // B-3: the face shown on an avatar. The controller's emotion events stay as they are (the replay
  // golden records them); only the picture is re-picked here, with the UI's own rng.
  var DURING = {
    joy: ['joy', 'excited', 'cheer'],
    panic: ['panic', 'surprised', 'worried'],
    sadness: ['sadness', 'worried']
  };
  var FINAL = {
    win: ['excited', 'cheer', 'love'],
    lose: ['sadness', 'worried']
  };

  function create(rng) {
    var variety = Ailand.core.EmotionVariety.create(rng);
    return {
      during: function (player, logical) {
        return DURING[logical] ? variety.pick(player, DURING[logical]) : logical;
      },
      final: function (player, role) { return variety.pick(player, FINAL[role]); },
      reset: function () { variety.reset(); }
    };
  }

  O.FaceVariety = { create: create };
})(Ailand.games.othello);
