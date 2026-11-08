(function (G) {
  'use strict';
  var E = G.Engine;

  var PRIORITY = ['win', 'lose', 'draw', 'double', 'block', 'reach', 'endgame', 'place'];

  function sameSide(state, a, b) {
    return state.teams ? E.teamOf(state, a) === E.teamOf(state, b) : a === b;
  }

  function seatsOf(state) {
    var out = [];
    for (var s = 1; s <= state.players; s++) { out.push(s); }
    return out;
  }

  // Events for one move. before/after are engine states; ctx = { endgameFired:boolean }.
  // The caller must set ctx.endgameFired once an endgame event was emitted, even if another event won pick().
  // Every event: { kind, seat, emotion, by } where by is the mover's seat.
  function detect(before, move, after, ctx) {
    var mover = move.seat, events = [];
    var all = seatsOf(before);
    var others = all.filter(function (s) { return !sameSide(before, s, mover); });
    function add(kind, seat, emotion) { events.push({ kind: kind, seat: seat, emotion: emotion, by: mover }); }
    function addMoverAndOthers(kind, moverEmotion, otherEmotion, targets) {
      add(kind, mover, moverEmotion);
      targets.forEach(function (s) { add(kind, s, otherEmotion); });
    }

    var result = after.result;
    if (result) {
      if (result.type === 'draw') {
        all.forEach(function (s) { add('draw', s, 'joy'); });
      } else {
        all.forEach(function (s) {
          if (result.seats.indexOf(s) >= 0) { add('win', s, 'excited'); }
          // A pop can complete an opponent's line; the mover keeps a neutral face then.
          else { add('lose', s, s === mover ? 'normal' : 'sadness'); }
        });
      }
      return events;
    }

    // reach/double need a winning column this move newly created (not one that already existed).
    var winsAfter = E.immediateWins(after, mover);
    var winsBefore = E.immediateWins(before, mover);
    var fresh = winsAfter.filter(function (c) { return winsBefore.indexOf(c) < 0; });
    if (fresh.length > 0) {
      if (winsAfter.length >= 2) { addMoverAndOthers('double', 'excited', 'surprised', others); }
      else { addMoverAndOthers('reach', 'joy', 'worried', others); }
    }

    if (move.type === 'drop' || move.type === 'block') {
      var blocked = others.filter(function (s) { return E.immediateWins(before, s).indexOf(move.col) >= 0; });
      if (blocked.length > 0) { addMoverAndOthers('block', 'joy', 'anger', blocked); }
    }

    if (!ctx.endgameFired && E.emptyCount(after) * 4 <= after.cells.length) {
      all.forEach(function (s) { add('endgame', s, 'thinking'); });
    }

    if (events.length === 0) { add('place', mover, 'normal'); }
    return events;
  }

  G.Reactions = { detect: detect, PRIORITY: PRIORITY };
})(Ailand.games.drop4);
