'use strict';
// Child-like opponent for drop4 strength measurement (Node only, design 6.3):
// takes an immediate win 80% of the time, stops the opponent's immediate win 50% of the time,
// otherwise drops at random weighted towards the centre. Never uses pops or blocks.
// Loading this module also loads the drop4 browser scripts into one vm context (exposed as `Ailand`).
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const FILES = [
  'core/namespace.js',
  'core/rng.js',
  'games/drop4/js/namespace.js',
  'games/drop4/js/constants.js',
  'games/drop4/js/engine.js',
  'games/drop4/js/ai.js'
];
const WIN_RATE = 0.8;
const BLOCK_RATE = 0.5;

const root = path.resolve(__dirname, '..', '..');
const sandbox = { console, setTimeout, clearTimeout, performance };
sandbox.window = sandbox;
const ctx = vm.createContext(sandbox);
for (const f of FILES) {
  const p = path.join(root, f);
  vm.runInContext(fs.readFileSync(p, 'utf-8'), ctx, { filename: p });
}
const Ailand = sandbox.Ailand;
const E = Ailand.games.drop4.Engine;

function nextSeat(state) { return state.order[(state.turnIndex + 1) % state.order.length]; }

function dropAt(state, col) { return { type: 'drop', col, seat: E.currentSeat(state) }; }

function centerDrop(state, rng) {
  const center = (state.cols - 1) / 2;
  const half = center + 1;
  const drops = E.legalMoves(state).filter((m) => m.type === 'drop');
  const ws = drops.map((m) => half - Math.abs(m.col - center));
  let x = rng() * ws.reduce((a, b) => a + b, 0);
  for (let i = 0; i < drops.length; i++) {
    x -= ws[i];
    if (x < 0) { return drops[i]; }
  }
  return drops[drops.length - 1];
}

function chooseChildMove(state, rng) {
  const wins = E.immediateWins(state, E.currentSeat(state));
  if (wins.length > 0 && rng() < WIN_RATE) { return dropAt(state, wins[Math.floor(rng() * wins.length)]); }
  const threats = E.immediateWins(state, nextSeat(state));
  if (threats.length > 0 && rng() < BLOCK_RATE) { return dropAt(state, threats[Math.floor(rng() * threats.length)]); }
  return centerDrop(state, rng);
}

module.exports = { Ailand, chooseChildMove };
