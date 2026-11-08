(function (C) {
  'use strict';

  var TERMINAL = { win: 1, lose: 1, draw: 1 };

  function byKind(events, kind) {
    return events.filter(function (e) { return e.kind === kind; });
  }

  // Picks the single full-screen reaction for one move from the human side's point of view.
  // opts: { humans:number[], mover:number, priority:string[], teamOf:(seat)=>null|number }
  function pick(events, opts) {
    var kind = null, i;
    for (i = 0; i < opts.priority.length && !kind; i++) {
      if (byKind(events, opts.priority[i]).length > 0) { kind = opts.priority[i]; }
    }
    if (!kind) { return null; }
    var same = byKind(events, kind);
    var isHuman = function (seat) { return opts.humans.indexOf(seat) >= 0; };
    var bySeat = function (a, b) { return a.seat - b.seat; };

    if (TERMINAL[kind]) {
      if (kind === 'draw') { return { event: same[0], perspective: 'draw' }; }
      var wins = byKind(events, 'win');
      var humanWins = wins.filter(function (e) { return isHuman(e.seat); }).sort(bySeat);
      if (humanWins.length > 0) { return { event: humanWins[0], perspective: 'win' }; }
      // No human at all (CPU vs CPU): watch from the winner's side so the winner celebrates.
      var perspective = opts.humans.length === 0 && wins.length > 0 ? 'win' : 'lose';
      return { event: (wins.length ? wins : same).slice().sort(bySeat)[0], perspective: perspective };
    }

    // In-game: a human mover is the viewpoint; for a CPU mover, the first human (by seat) who is not on the mover's side.
    var mine = same.filter(function (e) { return e.seat === opts.mover; })[0];
    if (isHuman(opts.mover) && mine) { return { event: mine, perspective: 'normal' }; }
    var moverTeam = opts.teamOf(opts.mover);
    var victims = same.filter(function (e) {
      return isHuman(e.seat) && e.seat !== opts.mover && (moverTeam === null || opts.teamOf(e.seat) !== moverTeam);
    }).sort(bySeat);
    return { event: victims[0] || mine || same[0], perspective: 'normal' };
  }

  // Collects pushes made in the same task and hands them to onFlush once.
  function createBatcher(onFlush, scheduler) {
    var schedule = scheduler || function (fn) { return setTimeout(fn, 0); };
    var queue = [];
    return {
      push: function (event) {
        queue.push(event);
        if (queue.length === 1) {
          schedule(function () {
            var batch = queue;
            queue = [];
            onFlush(batch);
          });
        }
      }
    };
  }

  C.Reaction = { pick: pick, createBatcher: createBatcher };
})(Ailand.core);
