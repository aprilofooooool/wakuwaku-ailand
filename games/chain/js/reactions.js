(function (G) {
  'use strict';

  // Faces after the player's own action are happy only (design 5.1). Turn is the only surprise.
  var BIG = ['cheer', 'love'];
  var CLEAR = ['excited', 'cheer'];

  // Chooses faces for chain. Same emotion never 3 times in a row (one variety key per candidate set).
  function create(rng) {
    var variety = Ailand.core.EmotionVariety.create(rng);

    function forPop(chain) {
      if (chain >= 3) { return variety.pick('big', BIG); }
      if (chain === 2) { return variety.pick('two', ['excited']); }
      return variety.pick('one', ['joy']);
    }

    // fx is the screenFx result; the emotion is null when nothing popped (no change of face).
    function forSettled(fx) {
      if (fx === 'chain3') { return { emotion: forPop(3), situation: 'chain' }; }
      if (fx === 'chain2') { return { emotion: forPop(2), situation: 'chain' }; }
      if (fx === 'wake') { return { emotion: forPop(1), situation: 'wake' }; }
      if (fx === 'pop') { return { emotion: forPop(1), situation: null }; }
      if (fx === 'clear') { return { emotion: variety.pick('clear', CLEAR), situation: null }; }
      return { emotion: null, situation: null };
    }

    function forTurn() { return variety.pick('turn', ['surprised']); }

    // worried appears only on the lose screens.
    function forResult(kind, newTime) {
      if (kind === 'clear') {
        return { emotion: variety.pick('clear', CLEAR), situation: newTime ? 'record' : 'clear' };
      }
      if (kind === 'timeup') { return { emotion: 'worried', situation: 'timeup' }; }
      return { emotion: 'worried', situation: 'over' };
    }

    function reset() { variety.reset(); }

    return { forPop: forPop, forSettled: forSettled, forTurn: forTurn, forResult: forResult, reset: reset };
  }

  // Picks one screen effect for the events of one lock. Priority: clear, chain3+, chain2, wake, pop.
  function screenFx(events) {
    var maxChain = 0, woke = false, clear = false, i, e;
    for (i = 0; i < events.length; i++) {
      e = events[i];
      if (e.type === 'clear') { clear = true; }
      if (e.type === 'wake') { woke = true; }
      if (e.type === 'pop' && e.chain > maxChain) { maxChain = e.chain; }
    }
    if (clear) { return 'clear'; }
    if (maxChain >= 3) { return 'chain3'; }
    if (maxChain === 2) { return 'chain2'; }
    if (woke) { return 'wake'; }
    if (maxChain >= 1) { return 'pop'; }
    return null;
  }

  G.Reactions = { create: create, screenFx: screenFx };
})(Ailand.games.chain);
