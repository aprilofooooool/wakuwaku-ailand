'use strict';
// Child-like opponent for territory strength measurement (Node only, design 6.2):
// 70% of the time a random move among those using the biggest piece available, otherwise any legal move at random.
// Loading this module also loads the territory browser scripts into one vm context (exposed as `Ailand`).
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const FILES = [
  'core/namespace.js',
  'core/rng.js',
  'core/piece.js',
  'games/territory/js/namespace.js',
  'games/territory/js/constants.js',
  'games/territory/js/pieces.js',
  'games/territory/js/engine.js',
  'games/territory/js/ai.js'
];
const BIG_RATE = 0.7;

const root = path.resolve(__dirname, '..', '..');
const sandbox = { console, setTimeout, clearTimeout, performance };
sandbox.window = sandbox;
const ctx = vm.createContext(sandbox);
for (const f of FILES) {
  const p = path.join(root, f);
  vm.runInContext(fs.readFileSync(p, 'utf-8'), ctx, { filename: p });
}
const Ailand = sandbox.Ailand;
const G = Ailand.games.territory;

function childMove(state, rng) {
  const seat = G.Engine.currentSeat(state);
  const moves = G.Engine.legalMoves(state, seat);
  if (moves.length === 0) { return null; }
  let pool = moves;
  if (rng() < BIG_RATE) {
    const size = (m) => G.Pieces.byId(m.pieceId).cells.length;
    const top = Math.max(...moves.map(size));
    pool = moves.filter((m) => size(m) === top);
  }
  return pool[Math.floor(rng() * pool.length)];
}

module.exports = { Ailand, childMove };
