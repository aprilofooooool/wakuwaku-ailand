(function (G) {
  'use strict';
  var K = G.Constants;
  var DIRS = [[1, 0], [0, 1], [1, 1], [1, -1]];

  function at(state, c, r) { return state.cells[c * state.rows + r]; }

  function teamOf(state, seat) {
    return state.teams ? (seat % 2 === 1 ? 0 : 1) : null;
  }

  function currentSeat(state) { return state.order[state.turnIndex % state.order.length]; }

  // Two cells belong to the same side: same seat, or same team in team mode. Empty and block never match.
  function sameSide(state, a, b) {
    if (a < 1 || a > state.players || b < 1 || b > state.players) { return false; }
    return state.teams ? teamOf(state, a) === teamOf(state, b) : a === b;
  }

  function create(settings) {
    var players = settings.players;
    var size = K.SIZES[players];
    var first = settings.firstSeat || 1;
    var teams = !!settings.teams && players === 4;
    var order = [];
    for (var i = 0; i < players; i++) { order.push(((first - 1 + i) % players) + 1); }
    var cells = [];
    for (var k = 0; k < size.cols * size.rows; k++) { cells.push(K.EMPTY); }
    var blocksLeft = {};
    for (var s = 1; s <= players; s++) { blocksLeft[s] = settings.blocks ? 2 : 0; }
    return {
      cols: size.cols, rows: size.rows, cells: cells, players: players, teams: teams,
      popOut: !!settings.popOut, blocks: !!settings.blocks, order: order, turnIndex: 0,
      moveCount: 0, blocksLeft: blocksLeft, lastMove: null, result: null
    };
  }

  function emptyCount(state) {
    var n = 0;
    for (var i = 0; i < state.cells.length; i++) { if (state.cells[i] === K.EMPTY) { n++; } }
    return n;
  }

  // Lowest empty row of column c, or -1 if full.
  function dropRow(state, c) {
    for (var r = 0; r < state.rows; r++) { if (at(state, c, r) === K.EMPTY) { return r; } }
    return -1;
  }

  // Winning runs (>= 4) passing through (c, r), judged as if `seat` owned that cell. One run per direction.
  function linesThrough(state, cells, c, r, seat) {
    var lines = [];
    DIRS.forEach(function (d) {
      var run = [[c, r]];
      [1, -1].forEach(function (sg) {
        var x = c + sg * d[0], y = r + sg * d[1];
        while (x >= 0 && x < state.cols && y >= 0 && y < state.rows &&
               sameSide(state, cells[x * state.rows + y], seat)) {
          if (sg === 1) { run.push([x, y]); } else { run.unshift([x, y]); }
          x += sg * d[0]; y += sg * d[1];
        }
      });
      if (run.length >= 4) { lines.push(run); }
    });
    return lines;
  }

  function winResult(state, cells, lines, seat) {
    var seen = {};
    lines.forEach(function (ln) {
      ln.forEach(function (p) { seen[cells[p[0] * state.rows + p[1]]] = true; });
    });
    var seats = Object.keys(seen).map(Number).sort(function (a, b) { return a - b; });
    return { type: 'win', seats: seats, team: teamOf(state, seat), lines: lines };
  }

  function legalMoves(state) {
    if (state.result) { return []; }
    var seat = currentSeat(state), moves = [];
    for (var c = 0; c < state.cols; c++) {
      if (dropRow(state, c) >= 0) { moves.push({ type: 'drop', col: c, seat: seat }); }
    }
    if (state.blocks && state.blocksLeft[seat] > 0) {
      for (var b = 0; b < state.cols; b++) {
        if (dropRow(state, b) >= 0) { moves.push({ type: 'block', col: b, seat: seat }); }
      }
    }
    if (state.popOut) {
      for (var p = 0; p < state.cols; p++) {
        if (at(state, p, 0) === seat) { moves.push({ type: 'pop', col: p, seat: seat }); }
      }
    }
    return moves;
  }

  // After a pop: check every piece left in the column, then pick the winning side.
  // Popper's side first; otherwise the first seat after the popper (turn order) that has a line.
  function popResult(state, cells, col, popper) {
    var found = [];
    for (var r = 0; r < state.rows; r++) {
      var owner = cells[col * state.rows + r];
      if (owner < 1 || owner > state.players) { continue; }
      linesThrough(state, cells, col, r, owner).forEach(function (ln) { found.push({ owner: owner, line: ln }); });
    }
    if (found.length === 0) { return null; }
    var winner = null;
    var start = state.order.indexOf(popper);
    for (var i = 0; i < state.order.length && winner === null; i++) {
      var s = state.order[(start + i) % state.order.length];
      if (found.some(function (f) { return sameSide(state, f.owner, s); })) { winner = s; }
    }
    var seen = {}, lines = [];
    found.forEach(function (f) {
      if (!sameSide(state, f.owner, winner)) { return; }
      var key = JSON.stringify(f.line);
      if (!seen[key]) { seen[key] = true; lines.push(f.line); }
    });
    return winResult(state, cells, lines, winner);
  }

  function apply(state, move) {
    var legal = legalMoves(state).some(function (m) {
      return m.type === move.type && m.col === move.col && m.seat === move.seat;
    });
    if (!legal) { throw new Error('illegal move'); }
    var cells = state.cells.slice();
    var blocksLeft = {};
    for (var k in state.blocksLeft) { blocksLeft[k] = state.blocksLeft[k]; }
    var next = {
      cols: state.cols, rows: state.rows, cells: cells, players: state.players, teams: state.teams,
      popOut: state.popOut, blocks: state.blocks, order: state.order, turnIndex: state.turnIndex + 1,
      moveCount: state.moveCount + 1, blocksLeft: blocksLeft,
      lastMove: { type: move.type, col: move.col, seat: move.seat }, result: null
    };
    var lines = [];
    if (move.type === 'pop') {
      for (var y = 0; y < state.rows - 1; y++) { cells[move.col * state.rows + y] = cells[move.col * state.rows + y + 1]; }
      cells[move.col * state.rows + state.rows - 1] = K.EMPTY;
      next.result = popResult(state, cells, move.col, move.seat);
    } else {
      var r = dropRow(state, move.col);
      if (move.type === 'block') {
        cells[move.col * state.rows + r] = K.BLOCK;
        blocksLeft[move.seat] -= 1;
      } else {
        cells[move.col * state.rows + r] = move.seat;
        lines = linesThrough(state, cells, move.col, r, move.seat);
        if (lines.length > 0) { next.result = winResult(state, cells, lines, move.seat); }
      }
    }
    if (!next.result) {
      if (!hasDrop(next)) {
        next.result = { type: 'draw', reason: 'full' };
      } else if (next.moveCount >= state.cols * state.rows * 2) {
        next.result = { type: 'draw', reason: 'limit' };
      }
    }
    return next;
  }

  function hasDrop(state) {
    for (var c = 0; c < state.cols; c++) { if (dropRow(state, c) >= 0) { return true; } }
    return false;
  }

  // Columns where dropping now by `seat` wins (team mode counts teammates' pieces).
  function immediateWins(state, seat) {
    var out = [];
    if (state.result) { return out; }
    for (var c = 0; c < state.cols; c++) {
      var r = dropRow(state, c);
      if (r >= 0 && linesThrough(state, state.cells, c, r, seat).length > 0) { out.push(c); }
    }
    return out;
  }

  G.Engine = {
    SIZES: K.SIZES, EMPTY: K.EMPTY, BLOCK: K.BLOCK,
    create: create, at: at, currentSeat: currentSeat, teamOf: teamOf, legalMoves: legalMoves,
    apply: apply, immediateWins: immediateWins, emptyCount: emptyCount
  };
})(Ailand.games.drop4);
