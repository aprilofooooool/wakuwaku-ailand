(function (G) {
  'use strict';

  // Faces are happy only (design 5.1). Hints are a calm "thinking" face.
  var CLEAR = ['excited', 'cheer'];
  var SPARKLE = ['excited', 'cheer', 'love'];

  // Chooses faces for fill. Same emotion never 3 times in a row (one variety key per candidate set).
  function create(rng) {
    var variety = Ailand.core.EmotionVariety.create(rng);

    // Only about 1 in 3 placements gets a reaction, so the puzzle stays calm.
    function forPlaced() {
      if (rng() >= G.Constants.PLACE_REACT_RATE) { return null; }
      return { emotion: variety.pick('place', ['joy']), situation: 'place' };
    }

    function forLast() { return { emotion: variety.pick('last', ['excited']), situation: 'last' }; }

    function forHint() { return { emotion: variety.pick('hint', ['thinking']), situation: 'hint' }; }

    function forClear(sparkle, pageDone) {
      var situation = pageDone ? 'pageDone' : (sparkle ? 'sparkle' : 'clear');
      return { emotion: variety.pick('clear', sparkle ? SPARKLE : CLEAR), situation: situation };
    }

    function reset() { variety.reset(); }

    return { forPlaced: forPlaced, forLast: forLast, forHint: forHint, forClear: forClear, reset: reset };
  }

  G.Reactions = { create: create };
})(Ailand.games.fill);
