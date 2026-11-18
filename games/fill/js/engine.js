(function (G) {
  'use strict';

  var P = G.Piece;

  function create(puzzle) {
    var st = {};          // id -> { rot, at }; a placed piece sits at its answer and never moves
    var lastFired = false, hinted = false;
    var total = puzzle.pieces.length;
    var byId = {};          // ids may be strings like "p0", so not an array index
    puzzle.pieces.forEach(function (p) { byId[p.id] = p; });

    puzzle.pieces.forEach(function (p) {
      st[p.id] = { rot: p.start.rot, at: null };
    });

    function shape(id) { return P.orient(byId[id].cells, st[id].rot); }

    // Occupied cells of every placed piece.
    function occupied() {
      var occ = {};
      puzzle.pieces.forEach(function (p) {
        var s = st[p.id];
        if (!s.at) { return; }
        P.place(shape(p.id), s.at.x, s.at.y).forEach(function (c) { occ[c[0] + ',' + c[1]] = p.id; });
      });
      return occ;
    }

    function inTray() {
      return puzzle.tray.filter(function (id) { return !st[id].at; });
    }

    function placedCount() { return total - inTray().length; }

    function isClear() { return placedCount() === total; }

    // The answer position when a drop at (x, y) would snap, otherwise null.
    function snapTarget(id, x, y) {
      var s = st[id], a = byId[id].answer;
      if (s.at || s.rot !== 0) { return null; }
      if (Math.abs(x - a.x) > 1 || Math.abs(y - a.y) > 1) { return null; }
      return { x: a.x, y: a.y };
    }

    function drop(id, x, y) {
      if (st[id].at) { return []; }
      var t = snapTarget(id, x, y);
      if (!t) { return [{ type: 'returned', id: id }]; }
      st[id].at = t;
      var ev = [{ type: 'placed', id: id }];
      if (isClear()) {
        ev.push({ type: 'clear' });
      } else if (!lastFired && inTray().length === 1) {
        lastFired = true;
        ev.push({ type: 'last' });
      }
      return ev;
    }

    // Rotate a tray piece one step clockwise. Placed pieces do not move.
    function turn(id) {
      var s = st[id];
      if (s.at) { return []; }
      s.rot = (s.rot + 1) % 4;
      return [{ type: 'turned', id: id }];
    }

    function hint(rand, preferId) {
      var tray = inTray();
      if (!tray.length) { return null; }
      var id = tray.indexOf(preferId) >= 0 ? preferId : tray[Math.floor(rand() * tray.length)];
      var p = byId[id];
      hinted = true;
      return { id: id, x: p.answer.x, y: p.answer.y, cells: P.place(p.cells, p.answer.x, p.answer.y) };
    }

    return {
      shape: shape,
      state: function (id) {
        var s = st[id];
        return { rot: s.rot, at: s.at ? { x: s.at.x, y: s.at.y } : null };
      },
      occupied: occupied,
      inTray: inTray,
      drop: drop,
      turn: turn,
      isClear: isClear,
      placedCount: placedCount,
      hint: hint,
      hintUsed: function () { return hinted; },
      snapTarget: snapTarget
    };
  }

  G.Engine = { create: create };
})(Ailand.games.fill);
