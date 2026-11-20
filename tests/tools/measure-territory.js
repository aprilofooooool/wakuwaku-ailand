'use strict';
// Measures territory CPU strength (design 6.2): each level vs the child proxy and strong vs normal on 2 players 11x11
// (first seat alternating), plus the think time of "normal" on 4 players 14x14.
// Usage: node tests/tools/measure-territory.js [--seed N] [--games N] [--strong-games N] [--think-games N]
//   [--only weak+normal+strong+vs+think] [--set level.key:value ...]
// (cmd.exe splits arguments on commas and '=', hence '+' and ':')
const { performance } = require('perf_hooks');
const { Ailand, childMove } = require('./child-territory.js');

const G = Ailand.games.territory;
const E = G.Engine;
const Ai = G.Ai;
const mulberry32 = Ailand.core.Rng.mulberry32;

function parseArgs(argv) {
  const a = { seed: 1, games: 200, strongGames: 100, thinkGames: 20, only: ['weak', 'normal', 'strong', 'vs', 'think'], set: [] };
  for (let i = 0; i < argv.length; i++) {
    const k = argv[i], v = argv[i + 1];
    if (k === '--seed') { a.seed = Number(v); i++; }
    else if (k === '--games') { a.games = Number(v); i++; }
    else if (k === '--strong-games') { a.strongGames = Number(v); i++; }
    else if (k === '--think-games') { a.thinkGames = Number(v); i++; }
    else if (k === '--only') { a.only = v.split(/[+,]/); i++; }
    else if (k === '--set') { a.set.push(v); i++; }
    else { throw new Error('unknown argument: ' + k); }
  }
  return a;
}

const think = {};
function cpuPlayer(level, key) {
  const name = key || level;
  think[name] = think[name] || { max: 0, sum: 0, n: 0 };
  return function (state, rng) {
    const t0 = performance.now();
    const m = Ai.chooseMove(state, level, { rng, now: () => performance.now() });
    const dt = performance.now() - t0;
    const t = think[name];
    if (dt > t.max) { t.max = dt; }
    t.sum += dt; t.n += 1;
    return m;
  };
}

// players[seat - 1] = move function. Returns the result.
function playGame(players, firstSeat, rngs) {
  let s = E.create({ players: players.length, firstSeat });
  while (!E.isOver(s)) {
    const seat = E.currentSeat(s);
    s = E.apply(s, players[seat - 1](s, rngs[seat - 1]));
  }
  return E.result(s);
}

// A = seat 1 or 2 alternating; reports B's score (draw counts half).
function match(label, a, b, games, seed) {
  const t0 = performance.now();
  let bPoints = 0, draws = 0;
  for (let g = 0; g < games; g++) {
    const base = seed * 1000003 + g * 2;
    const bSeat = g % 2 === 0 ? 2 : 1;
    const players = bSeat === 2 ? [a, b] : [b, a];
    const rngs = bSeat === 2 ? [mulberry32(base), mulberry32(base + 1)] : [mulberry32(base + 1), mulberry32(base)];
    const r = playGame(players, g % 4 < 2 ? 1 : 2, rngs);
    if (r.draw) { bPoints += 0.5; draws++; }
    else if (r.winners[0] === bSeat) { bPoints += 1; }
  }
  console.log(label + ': games ' + games + ', B win rate ' + (100 * bPoints / games).toFixed(1) + '% (draw halves; draws ' + draws +
    ') (' + ((performance.now() - t0) / 1000).toFixed(1) + ' s)');
}

const args = parseArgs(process.argv.slice(2));
// --set level.key:value overrides one AI parameter for this run only (tuning aid; constants.js is not changed).
args.set.forEach((x) => {
  const m = /^(\w+)\.(\w+):(.+)$/.exec(x);
  if (!m) { throw new Error('bad --set: ' + x); }
  G.Constants.AI[m[1]][m[2]] = Number(m[3]);
});
console.log('measure-territory seed ' + args.seed + ', AI = ' + JSON.stringify(G.Constants.AI));
if (args.only.includes('weak')) { match('A=weak   vs B=child', cpuPlayer('weak'), childMove, args.games, args.seed); }
if (args.only.includes('normal')) { match('A=normal vs B=child', cpuPlayer('normal'), childMove, args.games, args.seed + 1); }
if (args.only.includes('strong')) { match('A=strong vs B=child', cpuPlayer('strong'), childMove, args.strongGames, args.seed + 2); }
if (args.only.includes('vs')) { match('A=normal vs B=strong', cpuPlayer('normal'), cpuPlayer('strong'), args.strongGames, args.seed + 3); }
if (args.only.includes('think')) {
  const p = cpuPlayer('normal', 'normal-4p');
  for (let g = 0; g < args.thinkGames; g++) {
    const base = args.seed * 1000003 + 500 + g * 4;
    playGame([p, p, p, childMove], 1 + (g % 4), [0, 1, 2, 3].map((i) => mulberry32(base + i)));
  }
}
['weak', 'normal', 'strong', 'normal-4p'].forEach((k) => {
  const t = think[k];
  if (t && t.n > 0) {
    console.log('think ' + k + ': max ' + t.max.toFixed(1) + ' ms, avg ' + (t.sum / t.n).toFixed(1) + ' ms (' + t.n + ' moves)');
  }
});
