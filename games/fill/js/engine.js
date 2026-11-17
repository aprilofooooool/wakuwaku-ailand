(function (G) {
  'use strict';

  var P = G.Piece;

  function create(puzzle) {
    var frame = puzzle.frame;
    var st = {};          // id -> { rot, flip, at }
    var lastFired = false, hinted = false;
    var total = puzzle.pieces.length;
    var byId = {};          // ids may be strings like "p0", so not an array index
    puzzle.pieces.forEach(function (p) { byId[p.id] = p; });

    puzzle.pieces.forEach(function (p) {
      st[p.id] = { rot: p.start.rot, flip: p.start.flip, at: null };
    });

    function cellsOf(id) { return byId[id].cells; }

    function shape(id) { return P.orient(cellsOf(id), st[id].rot, st[id].flip === 1); }

    // Occupied cells of every placed piece except `skipId`.
    function occupiedExcept(skipId) {
      var occ = {};
      puzzle.pieces.forEach(function (p) {
        var s = st[p.id];
        if (p.id === skipId || !s.at) { return; }
        P.place(shape(p.id), s.at.x, s.at.y).forEach(function (c) { occ[c[0] + ',' + c[1]] = p.id; });
      });
      return occ;
    }

    function inTray() {
      return puzzle.tray.filter(function (id) { return !st[id].at; });
    }

    function placedCount() { return total - inTray().length; }

    function isClear() { return placedCount() === total; }

    function drop(id, x, y) {
      if (!P.fits(frame, occupiedExcept(id), shape(id), x, y)) {
        st[id].at = null;
        return [{ type: 'returned', id: id }];
      }
      st[id].at = { x: x, y: y };
      var ev = [{ type: 'placed', id: id }];
      if (isClear()) {
        ev.push({ type: 'clear' });
      } else if (!lastFired && inTray().length === 1) {
        lastFired = true;
        ev.push({ type: 'last' });
      }
      return ev;
    }

    function toTray(id) {
      st[id].at = null;
      return [{ type: 'returned', id: id }];
    }

    // rotate: +1 clockwise. flip: mirror the current shape left-right.
    // Shape = rotate^rot(flip^f(c)); mirroring it equals toggling f and negating rot.
    function turn(id, kind) {
      var s = st[id];
      if (kind === 'flip') {
        s.flip = 1 - s.flip;
        s.rot = (4 - s.rot) % 4;
      } else {
        s.rot = (s.rot + 1) % 4;
      }
      var ev = [{ type: 'turned', id: id }];
      if (s.at && !P.fits(frame, occupiedExcept(id), shape(id), s.at.x, s.at.y)) {
        s.at = null;
        ev.push({ type: 'returned', id: id });
      }
      return ev;
    }

    function sameAbsolute(a, b) {
      if (a.length !== b.length) { return false; }
      var set = {};
      b.forEach(function (c) { set[c[0] + ',' + c[1]] = true; });
      return a.every(function (c) { return set[c[0] + ',' + c[1]]; });
    }

    function hint(rand) {
      var wrong = puzzle.pieces.filter(function (p) { return !isCorrectCells(p.id); })
        .map(function (p) { return p.id; });
      var tray = wrong.filter(function (id) { return !st[id].at; });
      var pool = tray.length ? tray : wrong;
      var id = pool[Math.floor(rand() * pool.length)];
      var p = byId[id];
      hinted = true;
      return { id: id, x: p.answer.x, y: p.answer.y, cells: P.place(p.cells, p.answer.x, p.answer.y) };
    }

    function isCorrectCells(id) {
      var s = st[id], p = byId[id];
      return !!s.at && sameAbsolute(P.place(shape(id), s.at.x, s.at.y), P.place(p.cells, p.answer.x, p.answer.y));
    }

    return {
      shape: shape,
      state: function (id) {
        var s = st[id];
        return { rot: s.rot, flip: s.flip, at: s.at ? { x: s.at.x, y: s.at.y } : null };
      },
      occupied: function () { return occupiedExcept(-1); },
      inTray: inTray,
      drop: drop,
      toTray: toTray,
      turn: turn,
      isClear: isClear,
      placedCount: placedCount,
      hint: hint,
      hintUsed: function () { return hinted; }
    };
  }

  G.Engine = { create: create };
})(Ailand.games.fill);
