(function (G) {
  'use strict';
  var E = G.Engine, K = G.Constants;

  function defaultNow() {
    return (typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now();
  }

  // Lightweight view of a state used to count anchors with the move's cells temporarily on the board.
  function scratchOf(state) {
    var placed = {}, s;
    for (s = 1; s <= state.players; s++) { placed[s] = state.placed[s]; }
    return { players: state.players, size: state.size, board: state.board, placed: placed };
  }

  // Static value of a move for its seat: bigger piece, more own anchors, fewer anchors for the others.
  function evaluate(state, sc, move, w) {
    var seat = move.seat, cells = E.cellsOf(move), i, s, mine, opp = 0;
    for (i = 0; i < cells.length; i++) { state.board[cells[i][1]][cells[i][0]] = seat; }
    sc.placed[seat] += cells.length;
    try {
      mine = E.anchors(sc, seat).length;
      for (s = 1; s <= state.players; s++) {
        if (s !== seat && !state.resting[s]) { opp += E.anchors(sc, s).length; }
      }
    } finally {
      // Always undo the temporary placement, even if counting throws.
      sc.placed[seat] -= cells.length;
      for (i = 0; i < cells.length; i++) { state.board[cells[i][1]][cells[i][0]] = 0; }
    }
    return w.size * cells.length + w.mine * mine - w.opp * opp;
  }

  function scored(state, moves, w, rng) {
    var sc = scratchOf(state);
    return moves.map(function (m) {
      return { move: m, score: evaluate(state, sc, m, w) + rng() * (w.noise || 0.001) };
    });
  }

  function best(list) {
    var b = list[0], i;
    for (i = 1; i < list.length; i++) { if (list[i].score > b.score) { b = list[i]; } }
    return b;
  }

  function strongMove(state, list, w, now, rng) {
    var deadline = now() + w.budgetMs, top, i, chosen = null, bestVal = -Infinity;
    list.sort(function (a, b) { return b.score - a.score; });
    top = list.slice(0, w.topK);
    for (i = 0; i < top.length; i++) {
      if (i > 0 && now() >= deadline) { break; }
      var next = E.apply(state, top[i].move), val = top[i].score;
      // Reply of the next seat to move (looked at from its own point of view).
      if (!E.isOver(next)) {
        var reply = E.currentSeat(next);
        if (reply !== top[i].move.seat) {
          var r = best(scored(next, E.legalMoves(next, reply), w, rng));
          val -= w.reply * r.score;
        }
      }
      if (val > bestVal) { bestVal = val; chosen = top[i].move; }
    }
    return chosen;
  }

  // Chooses a move for the seat to play. Returns null when there is none.
  function chooseMove(state, level, opts) {
    var seat = E.currentSeat(state);
    if (seat === null) { return null; }
    var moves = E.legalMoves(state, seat);
    if (!moves.length) { return null; }
    var rng = opts.rng, now = opts.now || defaultNow, w = K.AI[level];
    var list = scored(state, moves, w, rng);
    if (level === 'strong') { return strongMove(state, list, w, now, rng); }
    return best(list).move;
  }

  G.Ai = { chooseMove: chooseMove };
})(Ailand.games.territory);
