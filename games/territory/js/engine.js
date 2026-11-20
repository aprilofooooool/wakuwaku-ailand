(function (G, C) {
  'use strict';

  // Pure rules engine. State is never mutated; functions return new states.
  var Piece = C.Piece, Pieces = G.Pieces, K = G.Constants;
  var EDGES = [[1, 0], [-1, 0], [0, 1], [0, -1]];
  var DIAGS = [[1, 1], [1, -1], [-1, 1], [-1, -1]];

  function create(opts) {
    var n = opts.players, size = K.SIZES[n];
    var board = [], hands = {}, resting = {}, placed = {}, y, s;
    for (y = 0; y < size; y++) {
      var row = [];
      for (var x = 0; x < size; x++) { row.push(0); }
      board.push(row);
    }
    var ids = Pieces.LIST.map(function (p) { return p.id; });
    for (s = 1; s <= n; s++) {
      hands[s] = ids.slice();
      resting[s] = false;
      placed[s] = 0;
    }
    return { players: n, size: size, board: board, hands: hands, turn: opts.firstSeat, resting: resting, placed: placed, moves: 0, justRested: [] };
  }

  function cornerOf(state, seat) {
    var m = state.size - 1;
    var code = K.CORNERS[state.players][seat];
    if (code === 'tl') { return [0, 0]; }
    if (code === 'tr') { return [m, 0]; }
    if (code === 'br') { return [m, m]; }
    return [0, m];
  }

  function cellsOf(move) {
    var piece = Pieces.byId(move.pieceId);
    return Piece.place(Piece.orient(piece.cells, move.rot, move.flip), move.x, move.y);
  }

  function inBoard(state, x, y) { return x >= 0 && y >= 0 && x < state.size && y < state.size; }
  function isOwn(state, seat, x, y) { return inBoard(state, x, y) && state.board[y][x] === seat; }

  function check(state, move) {
    var seat = move.seat, cells = cellsOf(move), i, j;
    for (i = 0; i < cells.length; i++) {
      if (!inBoard(state, cells[i][0], cells[i][1])) { return { ok: false, reason: 'out' }; }
    }
    for (i = 0; i < cells.length; i++) {
      if (state.board[cells[i][1]][cells[i][0]] !== 0) { return { ok: false, reason: 'overlap' }; }
    }
    if (state.hands[seat].indexOf(move.pieceId) === -1) { return { ok: false, reason: 'gone' }; }
    if (state.placed[seat] === 0) {
      var c = cornerOf(state, seat);
      for (i = 0; i < cells.length; i++) {
        if (cells[i][0] === c[0] && cells[i][1] === c[1]) { return { ok: true }; }
      }
      return { ok: false, reason: 'start' };
    }
    var corner = false;
    for (i = 0; i < cells.length; i++) {
      for (j = 0; j < 4; j++) {
        if (isOwn(state, seat, cells[i][0] + EDGES[j][0], cells[i][1] + EDGES[j][1])) { return { ok: false, reason: 'edge' }; }
        if (isOwn(state, seat, cells[i][0] + DIAGS[j][0], cells[i][1] + DIAGS[j][1])) { corner = true; }
      }
    }
    return corner ? { ok: true } : { ok: false, reason: 'corner' };
  }

  // Empty cells where the next piece may put one of its cells (sorted by y, then x).
  function anchors(state, seat) {
    var out = [], x, y, j;
    if (state.placed[seat] === 0) {
      var c = cornerOf(state, seat);
      return state.board[c[1]][c[0]] === 0 ? [c] : [];
    }
    for (y = 0; y < state.size; y++) {
      for (x = 0; x < state.size; x++) {
        if (state.board[y][x] !== 0) { continue; }
        var diag = false, edge = false;
        for (j = 0; j < 4; j++) {
          if (isOwn(state, seat, x + EDGES[j][0], y + EDGES[j][1])) { edge = true; break; }
          if (isOwn(state, seat, x + DIAGS[j][0], y + DIAGS[j][1])) { diag = true; }
        }
        if (diag && !edge) { out.push([x, y]); }
      }
    }
    return out;
  }

  // Calls visit(move) for each legal move (deduplicated); stops early when visit returns true.
  function eachMove(state, seat, ids, visit) {
    if (state.resting[seat]) { return; }
    var anc = anchors(state, seat), seen = {}, a, p, o, c;
    if (!anc.length) { return; }
    for (p = 0; p < ids.length; p++) {
      var oris = Piece.orientations(Pieces.byId(ids[p]).cells);
      for (o = 0; o < oris.length; o++) {
        var cells = oris[o].cells;
        for (a = 0; a < anc.length; a++) {
          for (c = 0; c < cells.length; c++) {
            var move = { seat: seat, pieceId: ids[p], rot: oris[o].rot, flip: oris[o].flip, x: anc[a][0] - cells[c][0], y: anc[a][1] - cells[c][1] };
            var key = ids[p] + ':' + oris[o].rot + ':' + oris[o].flip + ':' + move.x + ':' + move.y;
            if (seen[key]) { continue; }
            seen[key] = true;
            if (check(state, move).ok && visit(move)) { return; }
          }
        }
      }
    }
  }

  function legalMoves(state, seat) {
    var out = [];
    eachMove(state, seat, state.hands[seat], function (m) { out.push(m); return false; });
    return out;
  }

  function canPlace(state, seat, pieceId) {
    var found = false;
    if (state.hands[seat].indexOf(pieceId) === -1) { return false; }
    eachMove(state, seat, [pieceId], function () { found = true; return true; });
    return found;
  }

  function hasMove(state, seat) {
    var found = false;
    eachMove(state, seat, state.hands[seat], function () { found = true; return true; });
    return found;
  }

  function copy(state) {
    var hands = {}, resting = {}, placed = {}, s;
    for (s = 1; s <= state.players; s++) {
      hands[s] = state.hands[s].slice();
      resting[s] = state.resting[s];
      placed[s] = state.placed[s];
    }
    return {
      players: state.players, size: state.size,
      board: state.board.map(function (r) { return r.slice(); }),
      hands: hands, turn: state.turn, resting: resting, placed: placed, moves: state.moves, justRested: []
    };
  }

  function apply(state, move) {
    var n = copy(state), cells = cellsOf(move), seat = move.seat, i;
    for (i = 0; i < cells.length; i++) { n.board[cells[i][1]][cells[i][0]] = seat; }
    n.hands[seat].splice(n.hands[seat].indexOf(move.pieceId), 1);
    n.placed[seat] += cells.length;
    n.moves = state.moves + 1;
    n.turn = null;
    // The mover rests right away when nothing is left to place (e.g. all pieces used).
    if (!hasMove(n, seat)) {
      n.resting[seat] = true;
      n.justRested.push(seat);
    }
    for (i = 1; i <= n.players; i++) {
      var s = ((seat - 1 + i) % n.players) + 1;
      if (n.resting[s]) { continue; }
      if (hasMove(n, s)) { n.turn = s; break; }
      n.resting[s] = true;
      n.justRested.push(s);
    }
    return n;
  }

  function isOver(state) { return state.turn === null; }

  function result(state) {
    var scores = {}, best = -1, winners = [], s;
    for (s = 1; s <= state.players; s++) {
      scores[s] = state.placed[s];
      if (scores[s] > best) { best = scores[s]; }
    }
    for (s = 1; s <= state.players; s++) { if (scores[s] === best) { winners.push(s); } }
    return { scores: scores, winners: winners, draw: winners.length > 1 };
  }

  function currentSeat(state) { return state.turn; }

  function remainingCells(state) {
    var total = 0, s;
    for (s = 1; s <= state.players; s++) {
      state.hands[s].forEach(function (id) { total += Pieces.byId(id).cells.length; });
    }
    return total;
  }

  G.Engine = {
    create: create, cornerOf: cornerOf, cellsOf: cellsOf, check: check, anchors: anchors,
    legalMoves: legalMoves, canPlace: canPlace, hasMove: hasMove, apply: apply,
    isOver: isOver, result: result, currentSeat: currentSeat, remainingCells: remainingCells
  };
})(Ailand.games.territory, Ailand.core);
