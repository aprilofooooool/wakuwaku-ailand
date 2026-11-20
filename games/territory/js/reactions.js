(function (G) {
  'use strict';
  var E = G.Engine, K = G.Constants, Pieces = G.Pieces;

  var PRIORITY = ['win', 'lose', 'draw', 'block', 'big', 'rest', 'endgame', 'place'];
  var BIG_CELLS = 5;

  function seatsOf(state) {
    var out = [];
    for (var s = 1; s <= state.players; s++) { out.push(s); }
    return out;
  }

  // Events for one move. before/after are engine states; ctx = { endgameFired:boolean }.
  // detect() sets ctx.endgameFired when it emits an endgame event.
  // Every event: { kind, seat, emotion, by } where by is the mover's seat; a mover's block event also has others.
  function detect(before, move, after, ctx) {
    var mover = move.seat, events = [], all = seatsOf(before);
    function add(kind, seat, emotion) {
      var e = { kind: kind, seat: seat, emotion: emotion, by: mover };
      events.push(e);
      return e;
    }

    if (E.isOver(after)) {
      var res = E.result(after);
      all.forEach(function (s) {
        if (res.winners.indexOf(s) >= 0) { add(res.draw ? 'draw' : 'win', s, res.draw ? 'joy' : 'excited'); }
        // The mover keeps a neutral face even when it loses (requirements 1.6).
        else { add('lose', s, s === mover ? 'normal' : 'sadness'); }
      });
      return events;
    }

    var blocked = all.filter(function (s) {
      if (s === mover || before.resting[s]) { return false; }
      return E.anchors(before, s).length - E.anchors(after, s).length >= K.BLOCK_MIN;
    });
    if (blocked.length > 0) {
      add('block', mover, 'joy').others = blocked;
      blocked.forEach(function (s) { add('block', s, 'surprised'); });
    }

    if (Pieces.byId(move.pieceId).cells.length === BIG_CELLS) { add('big', mover, 'joy'); }

    // The mover may rest on its own move (nothing left to place); it never gets a face for that.
    after.justRested.forEach(function (s) {
      if (s !== mover) { add('rest', s, 'worried'); }
    });

    var initial = before.players * Pieces.TOTAL_CELLS;
    if (!ctx.endgameFired && (E.remainingCells(after) * 4 <= initial || after.justRested.length > 0)) {
      all.forEach(function (s) { add('endgame', s, 'thinking'); });
      ctx.endgameFired = true;
    }

    if (events.length === 0) { add('place', mover, 'normal'); }
    return events;
  }

  // Face candidates per event kind, for the mover and for the others. The head of each list is the
  // emotion detect() gives. Mover lists hold no unpleasant face (requirements 1.6).
  var POOLS = {
    block: { mover: ['joy', 'smug'], other: ['surprised', 'worried'] },
    big: { mover: ['joy', 'cheer'], other: ['normal'] },
    rest: { mover: ['normal'], other: ['worried', 'sadness'] },
    endgame: { mover: ['thinking'], other: ['thinking'] },
    win: { mover: ['excited', 'cheer', 'love'], other: ['excited', 'cheer', 'love'] },
    lose: { mover: ['normal'], other: ['sadness', 'worried'] },
    draw: { mover: ['joy', 'cheer', 'love'], other: ['joy', 'cheer', 'love'] },
    place: { mover: ['normal'], other: ['normal'] }
  };

  // Re-picks the face of each seat's highest-priority event (the one the UI shows) from POOLS.
  // Other events keep detect()'s emotion. Returns new event objects; the input is not changed.
  function vary(events, variety) {
    var top = {};
    events.forEach(function (e, i) {
      var cur = top[e.seat];
      if (cur === undefined || PRIORITY.indexOf(e.kind) < PRIORITY.indexOf(events[cur].kind)) { top[e.seat] = i; }
    });
    return events.map(function (e, i) {
      var copy = { kind: e.kind, seat: e.seat, emotion: e.emotion, by: e.by };
      if (e.others) { copy.others = e.others.slice(); }
      if (top[e.seat] === i && POOLS[e.kind]) {
        copy.emotion = variety.pick('seat' + e.seat, POOLS[e.kind][e.seat === e.by ? 'mover' : 'other']);
      }
      return copy;
    });
  }

  G.Reactions = { detect: detect, PRIORITY: PRIORITY, POOLS: POOLS, vary: vary };
})(Ailand.games.territory);
