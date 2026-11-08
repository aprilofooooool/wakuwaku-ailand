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

    var wins = E.immediateWins(after, mover).length;
    if (wins >= 2) {
      addMoverAndOthers('double', 'excited', 'surprised', others);
    } else if (wins >= 1 && wins > E.immediateWins(before, mover).length) {
      addMoverAndOthers('reach', 'joy', 'worried', others);
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
