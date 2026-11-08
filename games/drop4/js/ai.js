(function (G) {
  'use strict';
  var E = G.Engine;
  var K = G.Constants;

  var WIN = 1000000;
  // Evaluation weights: open window with 3 / 2 pieces of one side, and each piece in the centre column(s).
  var W3 = 50, W2 = 10, CENTER = 6;
  // The search yields to the scheduler every SLICE_NODES nodes and reads the clock every CLOCK_NODES nodes.
  var SLICE_NODES = 2000;
  var CLOCK_NODES = 256;

  var windowCache = {};
  var rankCache = {};

  function defaultNow() {
    return (typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now();
  }

  function sideOf(state, seat) { return state.teams ? E.teamOf(state, seat) : seat; }

  // All 4-cell windows (cell indexes) of a cols x rows board.
  function windows(cols, rows) {
    var key = cols + 'x' + rows;
    if (windowCache[key]) { return windowCache[key]; }
    var out = [], dirs = [[1, 0], [0, 1], [1, 1], [1, -1]];
    for (var c = 0; c < cols; c++) {
      for (var r = 0; r < rows; r++) {
        dirs.forEach(function (d) {
          var ec = c + 3 * d[0], er = r + 3 * d[1];
          if (ec < 0 || ec >= cols || er < 0 || er >= rows) { return; }
          var w = [];
          for (var k = 0; k < 4; k++) { w.push((c + k * d[0]) * rows + (r + k * d[1])); }
          out.push(w);
        });
      }
    }
    windowCache[key] = out;
    return out;
  }

  // Column -> ordering rank, centre first (ties: lower column first).
  function colRank(cols) {
    if (rankCache[cols]) { return rankCache[cols]; }
    var center = (cols - 1) / 2, idx = [];
    for (var c = 0; c < cols; c++) { idx.push(c); }
    idx.sort(function (a, b) { return Math.abs(a - center) - Math.abs(b - center) || a - b; });
    var rank = [];
    idx.forEach(function (c, i) { rank[c] = i; });
    rankCache[cols] = rank;
    return rank;
  }

  // Moves ordered: drops centre first, then blocks centre first, then pops.
  function ordered(state, moves) {
    var rank = colRank(state.cols), typeRank = { drop: 0, block: 1, pop: 2 };
    return moves.slice().sort(function (a, b) {
      return typeRank[a.type] - typeRank[b.type] || rank[a.col] - rank[b.col];
    });
  }

  function evaluate(state, mySide) {
    var cells = state.cells, ws = windows(state.cols, state.rows), score = 0;
    for (var i = 0; i < ws.length; i++) {
      var w = ws[i], mine = 0, opp = 0, oppSide = -1, dead = false;
      for (var k = 0; k < 4; k++) {
        var v = cells[w[k]];
        if (v === K.EMPTY) { continue; }
        if (v === K.BLOCK) { dead = true; break; }
        var s = sideOf(state, v);
        if (s === mySide) { mine++; } else if (opp === 0 || s === oppSide) { oppSide = s; opp++; } else { dead = true; break; }
      }
      if (dead || (mine > 0 && opp > 0)) { continue; }
      if (mine === 3) { score += W3; } else if (mine === 2) { score += W2; } else if (opp === 3) { score -= W3; } else if (opp === 2) { score -= W2; }
    }
    var lo = Math.floor((state.cols - 1) / 2), hi = Math.ceil((state.cols - 1) / 2);
    for (var c = lo; c <= hi; c++) {
      for (var r = 0; r < state.rows; r++) {
        var x = cells[c * state.rows + r];
        if (x >= 1 && x <= state.players) { score += sideOf(state, x) === mySide ? CENTER : -CENTER; }
      }
    }
    return score;
  }

  function terminal(state, mySide, ply) {
    if (state.result.type !== 'win') { return 0; }
    var winSide = state.teams ? state.result.team : state.result.seats[0];
    return winSide === mySide ? WIN - ply : -WIN + ply;
  }

  // Paranoid minimax with alpha-beta (for 2 players this is plain negamax-equivalent minimax).
  // Blocks are not searched inside the tree (they only matter at the root as threat stoppers).
  function* minimax(ctx, state, depth, alpha, beta, ply) {
    ctx.nodes++;
    if (ctx.nodes % SLICE_NODES === 0) { yield; }
    if (ctx.deadline !== null && ctx.nodes % CLOCK_NODES === 0 && ctx.now() >= ctx.deadline) { ctx.timedOut = true; }
    if (ctx.timedOut) { return 0; }
    if (state.result) { return terminal(state, ctx.side, ply); }
    if (depth === 0) { return evaluate(state, ctx.side); }
    var moves = ordered(state, E.legalMoves(state).filter(function (m) { return m.type !== 'block'; }));
    var maximize = sideOf(state, E.currentSeat(state)) === ctx.side;
    var best = maximize ? -Infinity : Infinity;
    for (var i = 0; i < moves.length; i++) {
      var v = yield* minimax(ctx, E.apply(state, moves[i]), depth - 1, alpha, beta, ply + 1);
      if (ctx.timedOut) { return 0; }
      if (maximize) {
        if (v > best) { best = v; }
        if (best > alpha) { alpha = best; }
      } else {
        if (v < best) { best = v; }
        if (best < beta) { beta = best; }
      }
      if (alpha >= beta) { break; }
    }
    return best;
  }

  // Next seat in turn order that is not on the mover's side (the opponent who could win right after this move).
  function nextOpponent(state, seat) {
    var n = state.order.length, start = state.turnIndex % n;
    for (var i = 1; i < n; i++) {
      var s = state.order[(start + i) % n];
      if (sideOf(state, s) !== sideOf(state, seat)) { return s; }
    }
    return null;
  }

  function winningMoves(state, legal, seat) {
    return ordered(state, legal).filter(function (m) {
      if (m.type === 'block') { return false; }
      var r = E.apply(state, m).result;
      return !!r && terminal({ result: r, teams: state.teams }, sideOf(state, seat), 0) > 0;
    });
  }

  // Random pick weighted towards the centre column(s).
  function centerPick(state, moves, rng) {
    var center = (state.cols - 1) / 2, half = center + 1, total = 0, ws = [];
    moves.forEach(function (m) { var w = half - Math.abs(m.col - center); ws.push(w); total += w; });
    var x = rng() * total;
    for (var i = 0; i < moves.length; i++) {
      x -= ws[i];
      if (x < 0) { return moves[i]; }
    }
    return moves[moves.length - 1];
  }

  function weakMove(state, p, legal, wins, threats, rng) {
    if (wins.length > 0 && rng() < p.winRate) { return wins[Math.floor(rng() * wins.length)]; }
    if (threats.length > 0 && rng() < p.blockRate) {
      var col = threats[Math.floor(rng() * threats.length)];
      return legal.filter(function (m) { return m.type === 'drop' && m.col === col; })[0];
    }
    var blocks = legal.filter(function (m) { return m.type === 'block'; });
    if (blocks.length > 0 && rng() < p.blockUseRate) { return centerPick(state, blocks, rng); }
    // A win that was passed over is not picked by the random fallback either, so winRate is the real rate.
    var drops = legal.filter(function (m) {
      return m.type === 'drop' && !wins.some(function (w) { return w.type === 'drop' && w.col === m.col; });
    });
    if (drops.length === 0) { drops = legal.filter(function (m) { return m.type === 'drop'; }); }
    return centerPick(state, drops, rng);
  }

  function* decide(state, level, o) {
    var p = K.AI[level];
    if (!p) { throw new Error('unknown level: ' + level); }
    var rng = o.rng || Math.random, now = o.now || defaultNow;
    var legal = E.legalMoves(state);
    if (legal.length === 0) { return null; }
    var seat = E.currentSeat(state);
    var wins = winningMoves(state, legal, seat);
    var opp = nextOpponent(state, seat);
    var threats = opp === null ? [] : E.immediateWins(state, opp);
    if (level === 'weak') { return weakMove(state, p, legal, wins, threats, rng); }
    if (wins.length > 0) { return wins[0]; }

    // normal.missRate: chance of overlooking the opponent's immediate win (then threat columns are avoided too,
    // otherwise the search would still find the stop). Needed to reach the child-proxy target; see the measure report.
    if (threats.length > 0 && p.missRate > 0 && rng() < p.missRate) {
      var others = legal.filter(function (m) { return m.type !== 'block' && threats.indexOf(m.col) < 0; });
      if (others.length > 0) { threats = []; legal = others; }
    }
    var cands = threats.length > 0
      ? legal.filter(function (m) {
        return threats.indexOf(m.col) >= 0 && (m.type === 'drop' || (m.type === 'block' && level === 'strong'));
      })
      : legal.filter(function (m) { return m.type !== 'block'; });
    cands = ordered(state, cands);
    if (cands.length === 1) { return cands[0]; }

    var ctx = { side: sideOf(state, seat), nodes: 0, deadline: null, timedOut: false, now: now };
    var i, v;
    if (level === 'normal') {
      var bestM = null, bestV = -Infinity;
      for (i = 0; i < cands.length; i++) {
        v = yield* minimax(ctx, E.apply(state, cands[i]), p.depth - 1, -Infinity, Infinity, 1);
        v += p.noise * (2 * rng() - 1);
        if (v > bestV) { bestV = v; bestM = cands[i]; }
      }
      return bestM;
    }

    // strong: iterative deepening within budgetMs. Depth 1 always completes.
    var maxDepth = state.players === 2 ? p.maxDepth2p : p.maxDepthMulti;
    var deadline = now() + p.budgetMs;
    var order = cands.slice(), best = order[0];
    for (var d = 1; d <= maxDepth; d++) {
      ctx.deadline = d === 1 ? null : deadline;
      var alpha = -Infinity, iterBest = null, iterV = -Infinity;
      for (i = 0; i < order.length; i++) {
        v = yield* minimax(ctx, E.apply(state, order[i]), d - 1, alpha, Infinity, 1);
        if (ctx.timedOut) { break; }
        if (v > iterV) { iterV = v; iterBest = order[i]; }
        if (iterV > alpha) { alpha = iterV; }
      }
      if (ctx.timedOut) { break; }
      best = iterBest;
      order.splice(order.indexOf(best), 1);
      order.unshift(best);
      if (Math.abs(iterV) >= WIN - 1000) { break; }
    }
    return best;
  }

  // Synchronous: runs the same generator to the end.
  function chooseMove(state, level, o) {
    var g = decide(state, level, o || {});
    var r = g.next();
    while (!r.done) { r = g.next(); }
    return r.value;
  }

  // Asynchronous: one slice (SLICE_NODES nodes) per scheduler call. Same move as chooseMove for the same rng/now.
  function search(state, level, o) {
    var opt = o || {};
    var sched = opt.scheduler || function (fn) { setTimeout(fn, 0); };
    return new Promise(function (resolve, reject) {
      var g = null;
      function step() {
        try {
          if (g === null) { g = decide(state, level, opt); }
          var r = g.next();
          if (r.done) { resolve(r.value); } else { sched(step); }
        } catch (e) { reject(e); }
      }
      sched(step);
    });
  }

  G.Ai = { chooseMove: chooseMove, search: search };
})(Ailand.games.drop4);
