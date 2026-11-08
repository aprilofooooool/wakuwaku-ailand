'use strict';
// Measures drop4 CPU strength (design 6.3): each level vs the child proxy and strong vs normal,
// 2 players 7x6, first player alternating. Prints win/draw rates and per-move think time (wall clock).
// Usage: node tests/tools/measure-drop4.js [--seed N] [--games N] [--strong-games N] [--only weak+normal+strong+vs] [--set level.key:value ...]
// (cmd.exe splits arguments on commas and '=', hence '+' and ':')
const { performance } = require('perf_hooks');
const { Ailand, chooseChildMove } = require('./child-proxy.js');

const E = Ailand.games.drop4.Engine;
const Ai = Ailand.games.drop4.Ai;
const mulberry32 = Ailand.core.Rng.mulberry32;

function parseArgs(argv) {
  const a = { seed: 1, games: 200, strongGames: 100, only: ['weak', 'normal', 'strong', 'vs'], set: [] };
  for (let i = 0; i < argv.length; i++) {
    const k = argv[i], v = argv[i + 1];
    if (k === '--seed') { a.seed = Number(v); i++; }
    else if (k === '--games') { a.games = Number(v); i++; }
    else if (k === '--strong-games') { a.strongGames = Number(v); i++; }
    else if (k === '--only') { a.only = v.split(/[+,]/); i++; }
    else if (k === '--set') { a.set.push(v); i++; }
    else { throw new Error('unknown argument: ' + k); }
  }
  return a;
}

const think = {};
function cpuPlayer(level) {
  think[level] = think[level] || { max: 0, sum: 0, n: 0 };
  return function (state, rng) {
    const t0 = performance.now();
    const m = Ai.chooseMove(state, level, { rng, now: () => performance.now() });
    const dt = performance.now() - t0;
    const t = think[level];
    if (dt > t.max) { t.max = dt; }
    t.sum += dt; t.n += 1;
    return m;
  };
}
function childPlayer() { return chooseChildMove; }

// Seat 1 = player a, seat 2 = player b. Returns 1, 2 or 0 (draw).
function playGame(a, b, firstSeat, rngA, rngB) {
  let s = E.create({ players: 2, teams: false, popOut: false, blocks: false, firstSeat });
  while (!s.result) {
    const seat = E.currentSeat(s);
    s = E.apply(s, seat === 1 ? a(s, rngA) : b(s, rngB));
  }
  return s.result.type === 'win' ? s.result.seats[0] : 0;
}

function match(label, a, b, games, seed) {
  const t0 = performance.now();
  let aWin = 0, bWin = 0, draw = 0;
  for (let g = 0; g < games; g++) {
    const base = seed * 1000003 + g * 2;
    const w = playGame(a, b, g % 2 === 0 ? 1 : 2, mulberry32(base), mulberry32(base + 1));
    if (w === 1) { aWin++; } else if (w === 2) { bWin++; } else { draw++; }
  }
  const pct = (x) => (100 * x / games).toFixed(1) + '%';
  console.log(label + ': games ' + games + ', ' + 'B win ' + pct(bWin) + ', A win ' + pct(aWin) +
    ', draw ' + pct(draw) + ' (' + ((performance.now() - t0) / 1000).toFixed(1) + ' s)');
}

const args = parseArgs(process.argv.slice(2));
// --set level.key:value overrides one AI parameter for this run only (tuning aid; constants.js is not changed).
args.set.forEach((x) => {
  const m = /^(\w+)\.(\w+):(.+)$/.exec(x);
  if (!m) { throw new Error('bad --set: ' + x); }
  Ailand.games.drop4.Constants.AI[m[1]][m[2]] = Number(m[3]);
});
console.log('measure-drop4 seed ' + args.seed + ', AI = ' + JSON.stringify(Ailand.games.drop4.Constants.AI));
if (args.only.includes('weak')) { match('A=weak   vs B=child', cpuPlayer('weak'), childPlayer(), args.games, args.seed); }
if (args.only.includes('normal')) { match('A=normal vs B=child', cpuPlayer('normal'), childPlayer(), args.games, args.seed + 1); }
if (args.only.includes('strong')) { match('A=strong vs B=child', cpuPlayer('strong'), childPlayer(), args.strongGames, args.seed + 2); }
if (args.only.includes('vs')) { match('A=strong vs B=normal', cpuPlayer('strong'), cpuPlayer('normal'), args.strongGames, args.seed + 3); }
['normal', 'strong'].forEach((lv) => {
  const t = think[lv];
  if (t && t.n > 0) {
    console.log('think ' + lv + ': max ' + t.max.toFixed(1) + ' ms, avg ' + (t.sum / t.n).toFixed(1) + ' ms (' + t.n + ' moves)');
  }
});
