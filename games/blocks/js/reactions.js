(function (G) {
  'use strict';

  // Only happy or excited faces after the player's own action (design 3.5, 5.1).
  var MULTI = ['excited', 'surprised'];
  var MINE = ['joy', 'cheer', 'love'];
  var GOAL = ['excited', 'cheer'];
  var STAR = ['excited', 'cheer'];
  var RECORD = ['excited', 'cheer'];

  // Chooses the face for a clear. Same emotion never 3 times in a row (a pool of one may repeat).
  function create(rng) {
    var variety = Ailand.core.EmotionVariety.create(rng);

    function forClear(clear) {
      if (clear.rows.length >= 2) { return { emotion: variety.pick('clear', MULTI), situation: 'multi' }; }
      if (clear.mine > 0) { return { emotion: variety.pick('clear', MINE), situation: 'mine' }; }
      return { emotion: variety.pick('clear', ['joy']), situation: null };
    }

    // The star comeback: a happy, excited face.
    function forStar() { return { emotion: variety.pick('star', STAR), situation: 'star' }; }

    // A new personal best: a happy, excited face.
    function forRecord() { return { emotion: variety.pick('record', RECORD), situation: 'record' }; }

    // 'over' is the only place a worried face may appear.
    function forResult(kind) {
      if (kind === 'over') { return 'worried'; }
      return variety.pick('result', GOAL);
    }

    function reset() { variety.reset(); }

    return { forClear: forClear, forStar: forStar, forRecord: forRecord, forResult: forResult, reset: reset };
  }

  // Picks one screen effect for the events of a single lock. Priority: goal, star, quad, multi, mine, single.
  function screenFx(events) {
    var maxRows = 0, mine = false, goal = false, star = false, i, e;
    for (i = 0; i < events.length; i++) {
      e = events[i];
      if (e.type === 'goal') { goal = true; }
      if (e.type === 'star') { star = true; }
      if (e.type === 'clear') {
        if (e.rows.length > maxRows) { maxRows = e.rows.length; }
        if (e.mine > 0) { mine = true; }
      }
    }
    if (goal) { return 'goal'; }
    if (star) { return 'star'; }
    if (maxRows >= 4) { return 'quad'; }
    if (maxRows >= 2) { return 'multi'; }
    if (maxRows >= 1 && mine) { return 'mine'; }
    if (maxRows >= 1) { return 'single'; }
    return null;
  }

  G.Reactions = { create: create, screenFx: screenFx };
})(Ailand.games.blocks);
