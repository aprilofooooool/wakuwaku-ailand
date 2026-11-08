'use strict';
// Replays full games through GameController with a seeded rng, a fake clock and an instant scheduler,
// and compares the record with tests/golden/othello-replay.json.
// Usage: node tests/tools/replay-othello.js [--write] [--verbose] [--only <key prefix>]
const fs = require('fs');
const path = require('path');
const vm = require('vm');

// Files loaded into the vm, in dependency order (the non-test part of tests/test.html).
// Task 3 rewrites this list after the files move.
const FILES = [
  'js/core/namespace.js',
  'js/core/event-bus.js',
  'js/core/storage.js',
  'js/config/version.js',
  'js/config/constants.js',
  'js/data/characters.js',
  'js/data/rulesets.js',
  'js/engine/reversi-engine.js',
  'js/engine/reversi-ai.js',
  'js/engine/four-engine.js',
  'js/engine/four-ai.js',
  'js/game/reaction-engine.js',
  'js/game/line-picker.js',
  'js/game/game-controller.js'
];
// Namespace object of the app inside the vm, as a dotted path (Task 3 switches it to the ported one).
const NS = 'Otc';
// Fake clock: every performance.now() call advances this many ms (0.05 made four/strong take over an hour per game).
const CLOCK_STEP_MS = 10;
const SEEDS = [1, 2, 3, 4, 5];
const LEVELS = ['easy', 'normal', 'strong'];
const RULES_2P = ['standard', 'anti', 'mini', 'mini-anti'];
const MAX_EVENTS = 100000;

const root = path.resolve(__dirname, '..', '..');
const goldenPath = path.join(root, 'tests', 'golden', 'othello-replay.json');

function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Fresh vm context per game: no state is shared between games.
function createWorld() {
  let clock = 0;
  let nowMs = 0;
  let seq = 0;
  let timers = [];
  const sched = {
    setTimeout(fn, ms) { seq += 1; timers.push({ id: seq, due: nowMs + (ms || 0), fn }); return seq; },
    clearTimeout(id) { timers = timers.filter((t) => t.id !== id); },
    now() { return nowMs; }
  };
  const sandbox = {
    console,
    setTimeout: sched.setTimeout,
    clearTimeout: sched.clearTimeout,
    performance: { now() { clock += CLOCK_STEP_MS; return clock; } }
  };
  sandbox.window = sandbox;
  const ctx = vm.createContext(sandbox);
  for (const f of FILES) {
    const p = path.join(root, f);
    vm.runInContext(fs.readFileSync(p, 'utf-8'), ctx, { filename: p });
  }
  function runNext() {
    if (timers.length === 0) { return false; }
    let next = timers[0];
    for (const t of timers) { if (t.due < next.due || (t.due === next.due && t.id < next.id)) { next = t; } }
    timers = timers.filter((t) => t !== next);
    if (next.due > nowMs) { nowMs = next.due; }
    next.fn();
    return true;
  }
  return { ns: NS.split('.').reduce((o, k) => o[k], sandbox), sched, runNext };
}

function memStorage(ns) {
  const data = {};
  const st = Object.create(ns.Storage);
  st._backend = {
    getItem: (k) => (Object.prototype.hasOwnProperty.call(data, k) ? data[k] : null),
    setItem: (k, v) => { data[k] = String(v); },
    removeItem: (k) => { delete data[k]; }
  };
  return st;
}

function playGame(combo) {
  const w = createWorld();
  const api = w.ns;
  const rng = mulberry32(combo.seed);
  const bus = api.createBus();
  const rec = { moves: [], board: [], emotions: [], result: null };
  bus.on('moved', (p) => { rec.moves.push(p.mover + ':' + p.index); });
  bus.on('emotion', (p) => { rec.emotions.push({ player: p.player, emotion: p.emotion }); });
  bus.on('gameover', (p) => {
    rec.result = { result: p.result, winner: p.winner === undefined ? null : p.winner, winners: p.winners || null, ranks: p.ranks || null };
  });
  const ctrl = api.GameController.create({ bus, scheduler: w.sched, rng, storage: memStorage(api) });
  const names = ['mametchi', 'kuchipatchi', 'mimitchi', 'flowertchi'];
  let settings;
  if (combo.mode === 'four') {
    settings = { mode: 'four', humans: 1, p1: names[0], p2: names[1], p3: names[2], p4: names[3], level: combo.level, ruleSetId: 'four', assist: false };
  } else {
    settings = { mode: combo.mode, p1: names[0], p2: names[1], first: 'p1', level: combo.level, handicapLevel: 0, handicapReceiver: 'p1', ruleSetId: combo.rule, assist: false };
  }
  ctrl.start(settings);
  for (let i = 0; i < MAX_EVENTS && rec.result === null; i++) {
    const v = ctrl.getView();
    // Human seat: pick a legal move with the seeded rng through the public input method.
    if (!v.isCpuTurn && !v.busy && v.legal.length > 0) {
      ctrl.play(v.legal[Math.floor(rng() * v.legal.length)]);
      continue;
    }
    if (!w.runNext()) { break; }
  }
  if (rec.result === null) { throw new Error('game did not finish: ' + JSON.stringify(combo)); }
  rec.board = Array.from(ctrl.getView().state.cells);
  ctrl.stop();
  return rec;
}

function buildCombos() {
  const combos = [];
  for (const mode of ['solo', 'duo', 'four']) {
    // duo has no CPU, so the level does not matter: it runs once per rule and seed.
    const levels = mode === 'duo' ? ['normal'] : LEVELS;
    const rules = mode === 'four' ? ['four'] : RULES_2P;
    for (const rule of rules) {
      for (const level of levels) {
        for (const seed of SEEDS) {
          combos.push({ key: [mode, rule, level, seed].join('/'), mode, rule, level, seed });
        }
      }
    }
  }
  return combos;
}

function main() {
  const write = process.argv.includes('--write');
  const t0 = Date.now();
  const onlyAt = process.argv.indexOf('--only');
  const only = onlyAt >= 0 ? process.argv[onlyAt + 1] : null;
  const combos = buildCombos().filter((c) => !only || c.key.startsWith(only));
  const games = {};
  for (const c of combos) {
    const g0 = Date.now();
    games[c.key] = playGame(c);
    if (process.argv.includes('--verbose')) { console.log(c.key + ' ' + (Date.now() - g0) + 'ms'); }
  }
  const secs = ((Date.now() - t0) / 1000).toFixed(1);
  const out = { clockStepMs: CLOCK_STEP_MS, games };
  const text = JSON.stringify(out, null, 1) + '\n';
  if (write) {
    fs.writeFileSync(goldenPath, text, 'utf-8');
    console.log('replay: wrote ' + combos.length + ' games to ' + path.relative(root, goldenPath) + ' (' + secs + 's)');
    return 0;
  }
  const golden = JSON.parse(fs.readFileSync(goldenPath, 'utf-8'));
  const actual = JSON.parse(text);
  let match = 0;
  for (const c of combos) {
    if (JSON.stringify(golden.games[c.key]) === JSON.stringify(actual.games[c.key])) { match += 1; }
    else { console.log('MISMATCH ' + c.key); }
  }
  const extra = Object.keys(golden.games).filter((k) => !(k in games));
  extra.forEach((k) => console.log('MISSING ' + k));
  console.log('replay: ' + match + '/' + combos.length + ' match (' + secs + 's)');
  return match === combos.length && extra.length === 0 && golden.clockStepMs === CLOCK_STEP_MS ? 0 : 1;
}

process.exit(main());
