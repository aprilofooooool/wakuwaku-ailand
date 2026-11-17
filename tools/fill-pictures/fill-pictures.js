'use strict';
// Draws the fill (ピタうめっち) pictures from shape parts and writes games/fill/js/pictures.js
// and the review page .claude/docs/specs/ui-drafts/fill-samples.html (design 3.2, 6).
// Usage: scripts\run.bat fill-pictures [show]   (show: also print every picture as text)
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..', '..');
const D = 4; // dots per cell (Constants.DOTS_PER_CELL)
const LEVEL = { easy: [20, 30, 24], normal: [30, 40, 28], hard: [40, 50, 32] }; // min cells, max cells, max dots (same as Constants.LEVEL)

// ---- shape parts (a dot is inside when its center is inside the shape) ----
function Pic(w, h) {
  this.w = w; this.h = h;
  this.g = [];
  for (let y = 0; y < h; y++) { this.g.push(new Array(w).fill('.')); }
}
Pic.prototype.set = function (x, y, ch) {
  x = Math.floor(x); y = Math.floor(y);
  if (x >= 0 && y >= 0 && x < this.w && y < this.h) { this.g[y][x] = ch; }
};
Pic.prototype.get = function (x, y) {
  return (x >= 0 && y >= 0 && x < this.w && y < this.h) ? this.g[y][x] : '.';
};
Pic.prototype.each = function (inside, ch) {
  for (let y = 0; y < this.h; y++) {
    for (let x = 0; x < this.w; x++) { if (inside(x + 0.5, y + 0.5)) { this.g[y][x] = ch; } }
  }
  return this;
};
// Rectangle: (x0, y0) top left, w x h dots. ch '.' erases.
// Ellipse with center (cx, cy) and radii (rx, ry). ch '.' erases.
Pic.prototype.ell = function (cx, cy, rx, ry, ch) {
  return this.each((x, y) => ((x - cx) / rx) * ((x - cx) / rx) + ((y - cy) / ry) * ((y - cy) / ry) <= 1, ch);
};
Pic.prototype.tri = function (ax, ay, bx, by, cx, cy, ch) {
  function s(px, py, qx, qy, rx, ry) { return (px - rx) * (qy - ry) - (qx - rx) * (py - ry); }
  return this.each((x, y) => {
    const d1 = s(x, y, ax, ay, bx, by), d2 = s(x, y, bx, by, cx, cy), d3 = s(x, y, cx, cy, ax, ay);
    return !((d1 < 0 || d2 < 0 || d3 < 0) && (d1 > 0 || d2 > 0 || d3 > 0));
  }, ch);
};
Pic.prototype.rect = function (x0, y0, w, h, ch) {
  return this.each((x, y) => x >= x0 && x < x0 + w && y >= y0 && y < y0 + h, ch);
};
// Dots: list of [x, y].
Pic.prototype.pts = function (list, ch) {
  list.forEach((p) => this.set(p[0], p[1], ch));
  return this;
};
// Only change dots that are already one of the chars in 'only' (for patterns inside a body).
Pic.prototype.within = function (only, fn) {
  const before = this.g.map((r) => r.slice());
  fn(this);
  for (let y = 0; y < this.h; y++) {
    for (let x = 0; x < this.w; x++) { if (only.indexOf(before[y][x]) < 0) { this.g[y][x] = before[y][x]; } }
  }
  return this;
};
// Outer 1-dot outline: empty dots next (up/down/left/right) to the picture.
Pic.prototype.outline = function (ch) {
  const add = [];
  for (let y = 0; y < this.h; y++) {
    for (let x = 0; x < this.w; x++) {
      if (this.g[y][x] !== '.') { continue; }
      if (this.get(x + 1, y) !== '.' || this.get(x - 1, y) !== '.' || this.get(x, y + 1) !== '.' || this.get(x, y - 1) !== '.') { add.push([x, y]); }
    }
  }
  return this.pts(add, ch);
};
// Shade on the lower right: a body dot whose right or bottom neighbour is the outline becomes darker.
Pic.prototype.shade = function (map, line) {
  const add = [];
  for (let y = 0; y < this.h; y++) {
    for (let x = 0; x < this.w; x++) {
      const c = this.g[y][x];
      if (map[c] && (this.get(x + 1, y) === line || this.get(x, y + 1) === line)) { add.push([x, y, map[c]]); }
    }
  }
  add.forEach((a) => this.set(a[0], a[1], a[2]));
  return this;
};
// Eye: 'mid' = 2x2, 'big' = 2x3, dark k with the light w on the top left. (x, y) = top left.
Pic.prototype.eye = function (x, y, size, k, w) {
  const h = size === 'big' ? 3 : 2;
  this.rect(x, y, 2, h, k);
  this.set(x, y, w);
  return this;
};
// Layer: draw with fn on an empty sheet and lay it on top. Its outline is laid only over the picture below
// (a line between a part in front and the part behind); the outside line comes from outline() at the end.
Pic.prototype.layer = function (fn, line) {
  const t = new Pic(this.w, this.h);
  fn(t);
  const body = t.g.map((r) => r.slice());
  t.outline(line);
  for (let y = 0; y < this.h; y++) {
    for (let x = 0; x < this.w; x++) {
      if (body[y][x] !== '.') { this.g[y][x] = body[y][x]; } else if (t.g[y][x] !== '.' && this.g[y][x] !== '.') { this.g[y][x] = line; }
    }
  }
  return this;
};
Pic.prototype.rows = function () { return this.g.map((r) => r.join('')); };

// ---- pictures (one function per picture) ----
const BG = '#fffdf6'; // review page background (same as the sample)

function apple() {
  // Approved sample (fill-samples.html 2026-11-17), kept as is.
  return [
    '........................', '........................', '...........kk..kkk......', '..........kbbkkgggkk....',
    '..........kbbgggggggk...', '........k.kbbgggggggk...', '.....kkkdkkbbkkgggkk....', '....krrrrrrbbrrrrrdk....',
    '...krrrrrrrrrrrrrrrdk...', '..krrrrrrrrrrrrrrrrrdk..', '.krrrrwwrrrrrrrrrrrrrdk.', '.krrrwwrrrrrrrrrrrrrrdk.',
    '.krrrwrrrrrrrrrrrrrrrdk.', '.krrrrrrrrrrrrrrrrrrrdk.', '.krrrrrrrrrrrrrrrrrrrdk.', '.krrrrrrrrrrrrrrrrrrrdk.',
    '.krrrrrrrrrrrrrrrrrrrdk.', '.kdrrrrrrrrrrrrrrrrrrdk.', '..kdrrrrrrrrrrrrrrrrdk..', '...kdrrrrrrrrrrrrrrdk...',
    '....kddrrrrrrrrrrddk....', '.....kkddddddddddkk.....', '.......kkkkkkkkkk.......', '........................'
  ];
}

function poop() {
  // Approved sample (fill-samples.html 2026-11-17), kept as is.
  return [
    '........................', '........................', '........................', '..............k.........',
    '.............kdk........', '............kndk........', '...........knndk........', '.........kknnndk........',
    '.......kknnnnndkk.......', '......knnnnnnnnndk......', '.....knnnnnwwnnnndk.....', '.....kdnnnnnnnnnndk.....',
    '.....kknnnnnnnnndkk.....', '....knnnnnnnnnnnnndk....', '...knnnnknnnnnnknnndk...', '...kdnnnknnnnnnknnndk...',
    '...kknpnnnnnnnnnnpdkk...', '..knnnnnnnknnknnnnnndk..', '.knnnnnnnnnkknnnnnnnndk.', 'kdnnnnnnnnnnnnnnnnnnnndk',
    '.kdnnnnnnnnnnnnnnnnnndk.', '..kdddnnnnnnnnnnnndddk..', '...kkkddddddddddddkkk...', '......kkkkkkkkkkkk......'
  ];
}

function cat() {
  // Approved sample (fill-samples.html 2026-11-17), kept as is.
  return [
    '............................', '............................', '............................', '............................',
    '....kk................kk....', '...kodk..............kodk...', '...koodkk..........kkoodk...', '...kopoodkkkkkkkkkkooopdk...',
    '...koppooooooooooooooppdk...', '...koppppooooddooooppppdk...', '...kopppppododdodopppppdk...', '...kopppooodoooodooopppdk...',
    '...kopoooooooooooooooopdk...', '..kooooooooooooooooooooodk..', '..kooooooooooooooooooooodk..', '..kooooowkoooooooowkoooodk..',
    '..koooookkooooooookkoooodk..', '..koooookkooooooookkoooodk..', '..kooooooooooooooooooooodk..', '..koooccoooooppoooooccoodk..',
    '..kdoooooooookkooooooooodk..', '...kdoooooookookooooooodk...', '....kdoooooooooooooooodk....', '.....kddooooooooooooddk.....',
    '......kkddooooooooddkk......', '........kkddddddddkk........', '..........kkkkkkkk..........', '............................'
  ];
}

function strawberry() {
  const p = new Pic(24, 24);
  p.ell(12, 12.5, 9.5, 5.5, 'r').ell(12, 15, 8.4, 5.6, 'r').ell(12, 18, 5.6, 4, 'r').ell(12, 20.2, 2.8, 2.2, 'r');
  p.layer((q) => {
    q.tri(12, 7, 12, 10.5, 3.5, 10, 'g').tri(12, 7, 12, 10.5, 20.5, 10, 'g');
    q.tri(10, 8.5, 12.5, 9, 7.5, 13.5, 'g').tri(14, 8.5, 11.5, 9, 16.5, 13.5, 'g');
    q.rect(11, 3, 2, 6, 'g');
  }, 'k');
  p.outline('k').shade({ r: 'd', g: 'h' }, 'k');
  p.pts([[9, 14], [15, 14], [5, 13], [19, 13], [12, 16], [7, 16], [17, 16], [10, 18], [14, 18], [12, 20]], 'y');
  p.pts([[4, 11], [3, 12], [3, 13]], 'w');
  return p;
}

function orange() {
  const p = new Pic(24, 24);
  p.ell(12, 14.5, 10.5, 8.5, 'o');
  p.rect(11, 4, 2, 2, 'b');
  p.ell(16.5, 4.5, 3.5, 1.6, 'g');
  p.outline('k').shade({ o: 'd' }, 'k');
  p.pts([[11, 7], [12, 7], [10, 8], [13, 8]], 'd');
  p.pts([[5, 11], [5, 12], [6, 10], [7, 10]], 'w');
  p.pts([[9, 16], [15, 13], [16, 18], [8, 12], [12, 19]], 'd');
  return p;
}

function cherry() {
  const p = new Pic(24, 24);
  p.ell(6.5, 17.5, 4.8, 4.8, 'r');
  p.layer((q) => q.ell(17.5, 17.5, 4.8, 4.8, 'r'), 'k');
  const stem = [[6, 12], [6, 11], [7, 10], [7, 9], [8, 8], [9, 7], [10, 6], [11, 5], [12, 4], [13, 3],
    [17, 12], [17, 11], [16, 10], [16, 9], [16, 8], [15, 7], [15, 6], [14, 5], [14, 4]];
  p.pts(stem, 'b');
  p.ell(18, 4, 3.5, 1.7, 'g');
  p.outline('k').shade({ r: 'd' }, 'k');
  p.pts([[3, 16], [3, 15], [4, 14], [14, 16], [14, 15], [15, 14]], 'w');
  return p;
}

function chick() {
  const p = new Pic(24, 24);
  p.ell(12, 13.5, 9, 8, 'y');
  p.tri(11, 6, 13, 6, 11.5, 2, 'y').tri(10.5, 6.5, 12, 6, 8, 3.5, 'y').tri(12, 6, 13.5, 6.5, 15.5, 3, 'y');
  p.rect(8, 20, 3, 2, 'o').rect(13, 20, 3, 2, 'o');
  p.outline('k').shade({ y: 'd' }, 'k');
  const wing = [[17, 14], [18, 14], [16, 15], [17, 15], [18, 15], [19, 15], [17, 16], [18, 16], [19, 16], [18, 17], [19, 17]];
  p.pts(wing, 'd').pts(wing.map((w) => [23 - w[0], w[1]]), 'd');
  p.eye(8, 10, 'mid', 'k', 'w').eye(14, 10, 'mid', 'k', 'w');
  p.pts([[11, 12], [12, 12], [10, 13], [11, 13], [12, 13], [13, 13], [11, 14], [12, 14]], 'o');
  p.pts([[6, 12], [7, 12], [16, 12], [17, 12]], 'p');
  return p;
}

function fish() {
  const p = new Pic(24, 24);
  p.ell(10, 12.5, 8.5, 6.5, 'b');
  p.tri(16, 12.5, 23, 6, 23, 19, 'b');
  p.tri(8, 6.5, 13, 6.5, 13, 3.5, 'b');
  p.outline('k').shade({ b: 'd' }, 'k');
  p.within('b', (q) => q.ell(10, 16.5, 7, 2.6, 'l'));
  p.eye(5, 10, 'mid', 'k', 'w');
  p.pts([[4, 14], [5, 14]], 'p');
  p.pts([[2, 13]], 'k');
  p.pts([[8, 9], [9, 10], [9, 11], [9, 12], [9, 13], [9, 14], [8, 15]], 'd');
  return p;
}

function ghost() {
  const p = new Pic(24, 24);
  p.ell(12, 13, 8.5, 8.5, 'w').rect(3.5, 13, 17, 7.5, 'w');
  p.ell(6.3, 20.5, 2.8, 2.4, 'w').ell(12, 20.5, 2.8, 2.4, 'w').ell(17.7, 20.5, 2.8, 2.4, 'w');
  p.tri(3.5, 13, 3.5, 17, 1, 16, 'w').tri(20.5, 13, 20.5, 17, 23, 16, 'w');
  p.outline('k').shade({ w: 's' }, 'k');
  p.eye(8, 12, 'big', 'k', 'k').eye(14, 12, 'big', 'k', 'k');
  p.pts([[6, 16], [7, 16], [16, 16], [17, 16]], 'p');
  p.rect(11, 16, 2, 2, 'k');
  return p;
}

function dog() {
  const p = new Pic(28, 28);
  p.ell(14, 14.5, 9, 9, 't');
  p.outline('k').shade({ t: 'd' }, 'k');
  p.layer((q) => q.ell(4.6, 13.5, 2.6, 6.5, 'e').ell(23.4, 13.5, 2.6, 6.5, 'e').ell(7, 7.5, 3, 2, 'e').ell(21, 7.5, 3, 2, 'e'), 'k');
  p.outline('k').shade({ e: 'f' }, 'k');
  p.layer((q) => q.ell(14, 19.5, 5, 3.6, 'm'), 'd');
  p.eye(9, 12, 'big', 'k', 'w').eye(17, 12, 'big', 'k', 'w');
  p.rect(12, 16, 4, 2, 'k').set(12, 16, 'w');
  p.pts([[13, 18], [14, 18], [12, 19], [15, 19], [11, 19], [16, 19]], 'k');
  p.pts([[13, 19], [14, 19], [13, 20], [14, 20]], 'p');
  p.pts([[7, 17], [8, 17], [19, 17], [20, 17]], 'p');
  return p;
}

function rabbit() {
  const p = new Pic(28, 28);
  p.ell(14, 18.5, 10, 8, 'w');
  p.ell(9.5, 8, 2.8, 6.8, 'w').ell(18.5, 8, 2.8, 6.8, 'w');
  p.outline('k').shade({ w: 's' }, 'k');
  p.ell(9.5, 8.5, 1.2, 4.6, 'p').ell(18.5, 8.5, 1.2, 4.6, 'p');
  p.eye(9, 16, 'big', 'k', 'w').eye(17, 16, 'big', 'k', 'w');
  p.pts([[13, 20], [14, 20]], 'n');
  p.pts([[13, 21], [14, 21], [12, 22], [15, 22]], 'k');
  p.pts([[6, 20], [7, 20], [20, 20], [21, 20]], 'p');
  return p;
}

function panda() {
  const p = new Pic(28, 28);
  p.ell(14, 24.5, 9.5, 6, 'b');
  p.layer((q) => q.ell(8, 6, 3.2, 3.2, 'b').ell(20, 6, 3.2, 3.2, 'b'), 'k');
  p.layer((q) => q.ell(14, 12, 11.5, 7.5, 'w'), 'k');
  p.outline('k').shade({ w: 's' }, 'k');
  p.ell(8.5, 11.5, 2.3, 2.8, 'b').ell(7.5, 13.5, 2, 1.8, 'b').ell(19.5, 11.5, 2.3, 2.8, 'b').ell(20.5, 13.5, 2, 1.8, 'b');
  p.rect(8, 10, 2, 2, 'k').set(8, 10, 'w');
  p.rect(18, 10, 2, 2, 'k').set(18, 10, 'w');
  p.rect(12, 14, 4, 1, 'k').rect(13, 15, 2, 1, 'k');
  p.pts([[12, 16], [15, 16]], 'k');
  p.pts([[4, 15], [5, 15], [22, 15], [23, 15]], 'p');
  return p;
}

function grapes() {
  const p = new Pic(28, 28);
  const g = [[5.5, 10], [14, 10], [22.5, 10], [9.75, 17], [18.25, 17], [14, 23.5]];
  p.rect(13, 2, 2, 5, 'b');
  p.ell(19, 4.5, 4, 1.8, 'g');
  g.forEach((c) => p.layer((q) => q.ell(c[0], c[1], 4.4, 4.4, 'v'), 'k'));
  p.outline('k').shade({ v: 'd' }, 'k');
  g.forEach((c) => p.pts([[c[0] - 2.5, c[1] - 2], [c[0] - 2.5, c[1] - 1], [c[0] - 1.5, c[1] - 3]], 'w'));
  return p;
}

function banana() {
  const p = new Pic(28, 28);
  const R = 16, cx = 5, cy = 6;
  const arc = (r, t) => {
    const a = (-8 + 106 * t) * Math.PI / 180;
    return [cx + r * Math.cos(a), cy + r * Math.sin(a)];
  };
  for (let i = 0; i <= 50; i++) {
    const t = i / 50, c = arc(R, t), r = 1.2 + 4.2 * Math.pow(Math.sin(Math.PI * t), 0.7);
    p.ell(c[0], c[1], r, r, 'y');
  }
  const tip = arc(R, 1), end = arc(R, 0);
  p.ell(tip[0], tip[1], 1.3, 1.3, 'b');
  for (let i = 0; i <= 3; i++) { p.ell(end[0] + 0.3 * i, end[1] - 1.1 * i, 1.1, 1.1, 'b'); }
  p.outline('k').shade({ y: 'd' }, 'k');
  for (let i = 10; i <= 34; i++) {
    const c = arc(R - 2.2, i / 50);
    p.within('y', (q) => q.set(c[0], c[1], 'l'));
  }
  return p;
}

function watermelon() {
  const p = new Pic(28, 28);
  p.ell(14, 7, 13.5, 18.5, 'g');
  p.ell(14, 7, 12, 17, 'w');
  p.ell(14, 7, 11, 16, 'r');
  p.rect(0, 0, 28, 7, '.');
  p.outline('k').shade({ g: 'h' }, 'k');
  p.pts([[8, 10], [8, 11], [14, 10], [14, 11], [20, 10], [20, 11], [11, 14], [11, 15], [17, 14], [17, 15],
    [8, 17], [8, 18], [14, 18], [14, 19], [20, 17], [20, 18]], 'k');
  return p;
}

function cake() {
  const p = new Pic(28, 28);
  p.ell(14, 21, 11, 3.5, 'y').rect(3, 13, 22, 8, 'y');
  p.ell(14, 13, 11, 3.5, 'w');
  p.rect(3, 18, 22, 2, 'w').rect(6, 18, 2, 2, 'r').rect(11, 18, 2, 2, 'r').rect(16, 18, 2, 2, 'r').rect(21, 18, 2, 2, 'r');
  [[8, 10.5], [14, 9.5], [20, 10.5]].forEach((c) => p.ell(c[0], c[1], 2.4, 2.6, 'r')
    .pts([[c[0] - 1, c[1] - 3], [c[0], c[1] - 3], [c[0], c[1] - 4]], 'g'));
  p.outline('k').shade({ y: 'd', w: 's', r: 'e' }, 'k');
  p.within('w', (q) => q.rect(3, 15, 22, 1, 's'));
  p.pts([[7, 10], [13, 9], [19, 10]], 'w');
  return p;
}

function bear() {
  const p = new Pic(32, 32);
  p.ell(7.5, 9, 4.2, 4.2, 'b').ell(24.5, 9, 4.2, 4.2, 'b');
  p.layer((q) => q.ell(16, 18.5, 12, 10.5, 'b'), 'k');
  p.outline('k').shade({ b: 'd' }, 'k');
  p.ell(7.5, 9, 2.2, 2.2, 'l').ell(24.5, 9, 2.2, 2.2, 'l');
  p.ell(16, 22, 5.5, 4.2, 'l');
  p.eye(10, 15, 'big', 'k', 'w').eye(20, 15, 'big', 'k', 'w');
  p.rect(14, 19, 4, 2, 'k');
  p.pts([[15, 21], [16, 21], [15, 22], [16, 22], [14, 23], [17, 23], [13, 23], [18, 23]], 'k');
  p.pts([[7, 20], [8, 20], [23, 20], [24, 20]], 'p');
  return p;
}

function elephant() {
  const p = new Pic(32, 32);
  p.ell(19, 15.5, 9.5, 7.5, 'g');
  p.rect(12, 19, 4, 8, 'g').rect(17, 20, 3, 7, 'g').rect(22, 20, 3, 7, 'g').rect(26, 18, 3, 9, 'g');
  p.pts([[29, 13], [30, 14], [30, 15], [30, 16], [30, 17]], 'g');
  p.layer((q) => {
    q.ell(10, 13, 6.5, 6, 'g');
    [[5.5, 15, 2.6], [4.5, 17, 2.4], [4, 19, 2.2], [4, 21, 2], [4.3, 23, 1.8], [5.2, 24.8, 1.6], [6.6, 25.6, 1.4]]
      .forEach((c) => q.ell(c[0], c[1], c[2], c[2], 'g'));
  }, 'k');
  p.layer((q) => q.ell(13.5, 12.5, 3.5, 4.5, 'e'), 'k');
  p.outline('k').shade({ g: 'h', e: 'f' }, 'k');
  p.eye(7, 11, 'big', 'k', 'w');
  p.pts([[5, 14], [6, 14]], 'p');
  p.pts([[8, 18], [9, 18], [9, 19]], 'w');
  return p;
}

function penguin() {
  const p = new Pic(32, 32);
  p.ell(16, 20.5, 10, 9, 'b');
  p.ell(16, 10.5, 8.5, 7.5, 'b');
  p.tri(7, 15, 9, 20, 2.5, 25, 'b').tri(25, 15, 23, 20, 29.5, 25, 'b');
  p.ell(12.5, 29.5, 2.8, 1.3, 'o').ell(19.5, 29.5, 2.8, 1.3, 'o');
  p.outline('k').shade({ b: 'c' }, 'k');
  p.ell(16, 21.5, 7, 7, 'w');
  p.ell(13, 11.5, 3.6, 4, 'w').ell(19, 11.5, 3.6, 4, 'w').ell(16, 14.5, 4, 2.5, 'w');
  p.eye(12, 10, 'big', 'k', 'w').eye(18, 10, 'big', 'k', 'w');
  p.pts([[14, 13], [15, 13], [16, 13], [17, 13], [15, 14], [16, 14]], 'o');
  p.pts([[10, 14], [11, 14], [20, 14], [21, 14]], 'p');
  return p;
}

function frog() {
  const p = new Pic(32, 32);
  p.ell(16, 20.5, 13, 8.8, 'g');
  p.ell(9, 11, 5, 5, 'g').ell(23, 11, 5, 5, 'g');
  p.outline('k').shade({ g: 'h' }, 'k');
  p.ell(9, 11, 3.3, 3.3, 'w').ell(23, 11, 3.3, 3.3, 'w');
  p.rect(8, 10, 2, 3, 'k').rect(22, 10, 2, 3, 'k');
  p.pts([[8, 10], [22, 10]], 'w');
  p.ell(16, 25.5, 7.5, 3, 'l');
  p.pts([[9, 19], [10, 20], [11, 21], [12, 21], [13, 22], [14, 22], [15, 22], [16, 22], [17, 22], [18, 22], [19, 21],
    [20, 21], [21, 20], [22, 19]], 'k');
  p.pts([[5, 19], [6, 19], [7, 19], [24, 19], [25, 19], [26, 19]], 'p');
  return p;
}

function pineapple() {
  const p = new Pic(32, 32);
  p.tri(5.5, 8, 11, 13.5, 16, 13.5, 'g').tri(26.5, 8, 16, 13.5, 21, 13.5, 'g');
  p.layer((q) => q.tri(9, 3, 11, 13, 17, 13, 'g').tri(23, 3, 15, 13, 21, 13, 'g'), 'k');
  p.layer((q) => q.tri(16, 0.8, 12, 13, 20, 13, 'g'), 'k');
  p.layer((q) => q.ell(16, 21.5, 9.5, 9.5, 'y'), 'k');
  p.outline('k').shade({ y: 'd', g: 'h' }, 'k');
  p.within('y', (q) => q.each((x, y) => {
    const a = Math.floor(x + y) % 5, b = ((Math.floor(x - y) % 5) + 5) % 5;
    return a === 0 || b === 0;
  }, 'o'));
  return p;
}

function melon() {
  const p = new Pic(32, 32);
  p.ell(16, 19.5, 12, 11, 'g');
  p.rect(15, 5, 2, 4, 'b').rect(12, 5, 8, 1, 'b');
  p.layer((q) => q.ell(24, 5, 3.5, 1.8, 'v'), 'k');
  p.outline('k').shade({ g: 'h' }, 'k');
  p.within('g', (q) => q.each((x, y) => {
    const a = Math.floor(x + y * 0.8) % 6, b = ((Math.floor(x - y * 0.8) % 6) + 6) % 6;
    return a === 0 || b === 0;
  }, 'l'));
  p.within('gl', (q) => q.pts([[9, 13], [10, 12], [11, 12], [8, 14]], 'w'));
  return p;
}

function rainbowPoop() {
  const p = new Pic(32, 32);
  p.ell(16, 27, 14.5, 3.6, 'v');
  p.ell(16, 22.2, 11.5, 3.4, 'b');
  p.ell(16, 17.4, 9, 3.2, 'g');
  p.ell(16, 12.8, 6.6, 2.9, 'y');
  p.ell(15.5, 8.6, 4.4, 2.6, 'o');
  p.tri(13.5, 7, 19.5, 7, 19.8, 2.5, 'r').ell(17.5, 5.5, 2.2, 2, 'r');
  p.outline('k');
  p.eye(11, 15, 'big', 'k', 'w').eye(19, 15, 'big', 'k', 'w');
  p.pts([[14, 18], [17, 18], [15, 19], [16, 19]], 'k');
  p.pts([[8, 18], [9, 18], [22, 18], [23, 18]], 'r');
  p.pts([[13, 11], [14, 11], [8, 26], [9, 26], [10, 26]], 'w');
  return p;
}

function donut() {
  const p = new Pic(32, 32);
  p.ell(16, 16.5, 13, 12, 'b');
  p.ell(16, 15.5, 11.5, 10.5, 'p');
  p.within('p', (q) => q.ell(6, 20.5, 2.3, 2.8, 'b').ell(12, 24, 2.3, 2.3, 'b').ell(20, 24.2, 2.3, 2.3, 'b').ell(26, 20.5, 2.1, 2.8, 'b'));
  p.ell(16, 15.5, 3.8, 3.4, '.');
  p.outline('k').shade({ b: 'd', p: 'q' }, 'k');
  p.within('p', (q) => q.pts([[10, 8], [11, 8], [21, 9], [21, 10], [8, 15], [8, 16], [24, 15], [25, 15], [13, 21], [14, 21],
    [19, 21], [19, 22], [15, 7], [16, 7]], 'y'));
  p.within('p', (q) => q.pts([[18, 6], [9, 12], [10, 12], [23, 12], [23, 13], [10, 19], [11, 20], [22, 19], [21, 18], [17, 10]], 'v'));
  p.within('p', (q) => q.pts([[7, 11], [8, 10], [9, 9]], 'w'));
  return p;
}

// ---- picture list (order = easy 8, normal 8, hard 8; design 3.1) ----
const PICTURES = [
  { id: 'apple', name: 'りんご', level: 'easy', draw: apple, palette: { r: '#ef4a4a', d: '#c73636', w: '#ffffff', b: '#8a5a2b', g: '#5cb85c', k: '#5a2424' } },
  { id: 'strawberry', name: 'いちご', level: 'easy', draw: strawberry, palette: { r: '#f04a5a', d: '#c8344a', y: '#ffe48a', w: '#ffffff', g: '#5cb85c', h: '#3f9a42', k: '#5a2430' } },
  { id: 'orange', name: 'みかん', level: 'easy', draw: orange, palette: { o: '#ffa630', d: '#e07f1c', w: '#fff3d6', b: '#8a5a2b', g: '#5cb85c', k: '#5a3414' } },
  { id: 'cherry', name: 'さくらんぼ', level: 'easy', draw: cherry, palette: { r: '#e8384a', d: '#b8243a', w: '#ffffff', b: '#7a8a2b', g: '#5cb85c', k: '#4a1c24' } },
  { id: 'poop', name: 'うんち', level: 'easy', draw: poop, palette: { n: '#b8783a', d: '#93592a', k: '#4a2c14', w: '#f5e1c8', p: '#ff9aa8' } },
  { id: 'chick', name: 'ひよこ', level: 'easy', draw: chick, palette: { y: '#ffe04a', d: '#f0b82a', o: '#ff9a2a', w: '#ffffff', p: '#ffa8b0', k: '#5a4214' } },
  { id: 'fish', name: 'さかな', level: 'easy', draw: fish, palette: { b: '#4aa8f0', d: '#2f7fc8', l: '#bfe4ff', w: '#ffffff', p: '#ffa8c0', k: '#1c3a5a' } },
  { id: 'ghost', name: 'おばけ', level: 'easy', draw: ghost, palette: { w: '#ffffff', s: '#d8d2ee', p: '#ffa8c8', k: '#4a3a6a' } },
  { id: 'cat', name: 'ねこ', level: 'normal', draw: cat, palette: { o: '#f5a742', d: '#d9822b', k: '#4a3020', p: '#ffb3c0', w: '#ffffff', c: '#ff8fa0' } },
  { id: 'dog', name: 'いぬ', level: 'normal', draw: dog, palette: { t: '#e8c08a', d: '#c89a62', e: '#9a6a3a', f: '#7a5028', m: '#fff1dc', p: '#ff9aa8', w: '#ffffff', k: '#3a2614' } },
  { id: 'rabbit', name: 'うさぎ', level: 'normal', draw: rabbit, palette: { w: '#ffffff', s: '#ddd6e4', p: '#ffb0c4', n: '#ff7a9a', k: '#4a3a48' } },
  { id: 'panda', name: 'パンダ', level: 'normal', draw: panda, palette: { w: '#ffffff', s: '#dcdcdc', b: '#3a3a3a', p: '#ffa8b8', k: '#1e1e1e' } },
  { id: 'grapes', name: 'ぶどう', level: 'normal', draw: grapes, palette: { v: '#9a5ad0', d: '#6e3aa0', w: '#f2e4ff', b: '#8a5a2b', g: '#5cb85c', k: '#3a1c50' } },
  { id: 'banana', name: 'バナナ', level: 'normal', draw: banana, palette: { y: '#ffe04a', d: '#e8b82a', l: '#fff4b0', b: '#7a5a2b', k: '#5a4214' } },
  { id: 'watermelon', name: 'すいか', level: 'normal', draw: watermelon, palette: { g: '#3fae4a', h: '#2a8a36', w: '#f4ffe8', r: '#ff5a6a', k: '#1c3a1c' } },
  { id: 'cake', name: 'ケーキ', level: 'normal', draw: cake, palette: { y: '#ffd88a', d: '#e8b45e', w: '#ffffff', s: '#efe2d6', r: '#f04a5a', e: '#c8344a', g: '#5cb85c', k: '#5a3a24' } },
  { id: 'bear', name: 'くま', level: 'hard', draw: bear, palette: { b: '#b07a48', d: '#8a5a32', l: '#f0d2a8', w: '#ffffff', p: '#ff9aa8', k: '#3a2414' } },
  { id: 'elephant', name: 'ぞう', level: 'hard', draw: elephant, palette: { g: '#a8b8cc', h: '#8496ae', e: '#94a6be', f: '#7486a0', p: '#ffb8c8', w: '#ffffff', k: '#2e3a4e' } },
  { id: 'penguin', name: 'ペンギン', level: 'hard', draw: penguin, palette: { b: '#3a4a6a', c: '#2a3650', w: '#ffffff', o: '#ffa630', p: '#ffa8b8', k: '#141c2e' } },
  { id: 'frog', name: 'かえる', level: 'hard', draw: frog, palette: { g: '#6cc84a', h: '#4aa02e', l: '#c8f0a0', w: '#ffffff', p: '#ffa8b0', k: '#1e3a14' } },
  { id: 'pineapple', name: 'パイナップル', level: 'hard', draw: pineapple, palette: { y: '#ffd23a', d: '#e8a82a', o: '#d88a1c', g: '#4ab84a', h: '#2e8a32', k: '#4a3010' } },
  { id: 'melon', name: 'メロン', level: 'hard', draw: melon, palette: { g: '#9ad86a', h: '#74b84a', l: '#e8f8d0', w: '#ffffff', b: '#7a8a3a', v: '#5cb85c', k: '#2e4a1c' } },
  { id: 'rainbow-poop', name: 'にじいろうんち', level: 'hard', draw: rainbowPoop, palette: { r: '#ff6a7a', o: '#ffa64a', y: '#ffe04a', g: '#7ad26a', b: '#5ab4f0', v: '#a87ae0', w: '#ffffff', k: '#3a2a4a' } },
  { id: 'donut', name: 'ドーナツ', level: 'hard', draw: donut, palette: { b: '#d8a05a', d: '#b07a3a', p: '#ff9ac0', q: '#f07aa8', y: '#ffe04a', v: '#7ac8f0', w: '#ffffff', k: '#5a3418' } }
];

// ---- check, write ----
function frameCells(rows) {
  let n = 0;
  for (let cy = 0; cy < rows.length / D; cy++) {
    for (let cx = 0; cx < rows[0].length / D; cx++) {
      let on = false;
      for (let j = 0; j < D; j++) { if (rows[cy * D + j].substr(cx * D, D) !== '....') { on = true; } }
      if (on) { n++; }
    }
  }
  return n;
}

function build() {
  return PICTURES.map((d) => {
    const r = d.draw();
    const rows = Array.isArray(r) ? r : r.rows();
    return { id: d.id, name: d.name, level: d.level, palette: d.palette, pixels: rows };
  });
}

function q(s) { return "'" + s + "'"; }
function pictureText(p, indent) {
  const pal = Object.keys(p.palette).map((k) => k + ': ' + q(p.palette[k])).join(', ');
  return indent + '{ id: ' + q(p.id) + ', name: ' + q(p.name) + ', level: ' + q(p.level) + ', palette: { ' + pal + ' }, pixels: [\n' +
    p.pixels.map((row) => indent + '  ' + q(row)).join(',\n') + '\n' + indent + '] }';
}

function writePicturesJs(pics) {
  const text = '// 道具が書き出したファイル。手で直さない（tools/fill-pictures/fill-pictures.js を直して scripts\\run.bat fill-pictures）\n' +
    '(function (G) {\n  \'use strict\';\n  G.Pictures = [\n' +
    pics.map((p) => pictureText(p, '    ')).join(',\n') + '\n  ];\n})(Ailand.games.fill);\n';
  fs.writeFileSync(path.join(root, 'games', 'fill', 'js', 'pictures.js'), text, { encoding: 'utf-8' });
}

function writeSamples(pics) {
  const text = `<!doctype html>
<html lang="ja"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>ピタうめっち 絵の見本</title>
<style>
body{margin:0;padding:16px;background:#fff8ee;font-family:sans-serif;color:#4a3a2a}
h1{font-size:20px;margin:0 0 4px}h2{font-size:17px;margin:20px 0 8px}p{font-size:13px;color:#7a6a5a;margin:0 0 12px}
.row{display:flex;flex-wrap:wrap;gap:16px}.card{background:#fff;border-radius:16px;padding:12px;box-shadow:0 1px 4px rgba(0,0,0,.12);text-align:center}
.name{font-size:18px;font-weight:bold;margin-top:6px}.meta{font-size:12px;color:#9a8a7a}
</style></head><body>
<h1>ピタうめっち 絵の見本</h1>
<p>道具（tools/fill-pictures/fill-pictures.js）が書き出した一覧。上：完成したときの絵。下：遊ぶ前の枠（点線のマス）。1マス＝4×4ドット。</p>
<div id="out"></div>
<script>
var PICS = [
${pics.map((p) => pictureText(p, '  ')).join(',\n')}
];
(function(){
  var PX=6,D=4,out=document.getElementById('out'),NAMES={easy:'かんたん',normal:'ふつう',hard:'むずかしい'},rows={};
  ['easy','normal','hard'].forEach(function(lv){var h=document.createElement('h2');h.textContent=NAMES[lv];out.appendChild(h);
    var r=document.createElement('div');r.className='row';out.appendChild(r);rows[lv]=r;});
  PICS.forEach(function(p){
    var w=p.pixels[0].length,h=p.pixels.length;
    var card=document.createElement('div');card.className='card';
    var a=document.createElement('canvas');a.width=w*PX;a.height=h*PX;var c=a.getContext('2d');
    c.fillStyle='${BG}';c.fillRect(0,0,a.width,a.height);
    p.pixels.forEach(function(r,y){for(var x=0;x<r.length;x++){var ch=r.charAt(x);if(ch!=='.'){c.fillStyle=p.palette[ch];c.fillRect(x*PX,y*PX,PX,PX);}}});
    var b=document.createElement('canvas');b.width=w*PX;b.height=h*PX;var d=b.getContext('2d'),S=D*PX,n=0;
    d.fillStyle='#f3e9da';d.fillRect(0,0,b.width,b.height);
    for(var cy=0;cy<h/D;cy++){for(var cx=0;cx<w/D;cx++){var on=0;for(var j=0;j<D;j++)for(var i=0;i<D;i++)if(p.pixels[cy*D+j].charAt(cx*D+i)!=='.')on=1;
      if(on){n++;d.fillStyle='#fff';d.fillRect(cx*S+2,cy*S+2,S-4,S-4);d.strokeStyle='#d8c8b0';d.setLineDash([4,3]);d.strokeRect(cx*S+2.5,cy*S+2.5,S-5,S-5);}}}
    card.appendChild(a);card.appendChild(document.createElement('br'));card.appendChild(b);
    var nm=document.createElement('div');nm.className='name';nm.textContent=p.name;card.appendChild(nm);
    var mt=document.createElement('div');mt.className='meta';mt.textContent=NAMES[p.level]+'・'+(w/D)+'×'+(h/D)+'マス・枠 '+n+'マス';card.appendChild(mt);
    rows[p.level].appendChild(card);
  });
})();
</script></body></html>
`;
  fs.writeFileSync(path.join(root, '.claude', 'docs', 'specs', 'ui-drafts', 'fill-samples.html'), text, { encoding: 'utf-8' });
}

function main() {
  const show = process.argv.indexOf('show') >= 0;
  const pics = build();
  let bad = 0;
  pics.forEach((p) => {
    const lv = LEVEL[p.level], n = frameCells(p.pixels);
    const ok = n >= lv[0] && n <= lv[1] && p.pixels.length <= lv[2] && p.pixels[0].length <= lv[2] && Object.keys(p.palette).length <= 8;
    if (!ok) { bad++; }
    console.log((ok ? 'ok ' : 'NG ') + p.level + ' ' + p.id + ' ' + p.pixels[0].length + 'x' + p.pixels.length + ' frame ' + n);
    if (show) { p.pixels.forEach((r) => console.log('  ' + r)); }
  });
  writePicturesJs(pics);
  writeSamples(pics);
  console.log('wrote games/fill/js/pictures.js and .claude/docs/specs/ui-drafts/fill-samples.html' + (bad ? ' (' + bad + ' NG)' : ''));
  process.exit(bad ? 1 : 0);
}

main();
