(function (O) {
  'use strict';
  // One full-screen effect and one reaction sound per move. The emotion events of a move are emitted
  // synchronously, so they are collected by core/reaction.js createBatcher and the single winner is
  // picked by O.Reaction.pickEffect (othello's own rule) when the batch flushes.
  // The mover is not a batch item: like before, a 'moved'/'pass' alone schedules nothing and its
  // player is kept until the next flush (which clears it).

  // opts: { context: () => ({ mode, humans }), onPick: (pick) => void, scheduler?: (fn) => void }
  function create(opts) {
    var mover = null;
    var batcher = Ailand.core.Reaction.createBatcher(function (items) {
      var who = mover;
      mover = null;
      var emotions = [];
      var over = null;
      items.forEach(function (it) {
        if (it.type === 'over') { over = it.value; }
        else if (it.value.emotion !== 'normal') { emotions.push(it.value); }
      });
      var ctx = opts.context();
      var pick = O.Reaction.pickEffect(emotions, who, over, ctx.mode, ctx.humans);
      if (pick) { opts.onPick(pick); }
    }, opts.scheduler);

    return {
      mover: function (player) { mover = player; },
      emotion: function (e) { batcher.push({ type: 'emotion', value: e }); },
      over: function (o) { batcher.push({ type: 'over', value: o }); }
    };
  }

  O.MoveReaction = { create: create };
})(Ailand.games.othello);
