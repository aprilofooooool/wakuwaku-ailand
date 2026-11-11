(function (G) {
  'use strict';
  // Pure layout math for the whack game screen (no DOM).

  var GAP = 12;       // gap between holes
  var HIT_PAD = 8;    // extra hit area around each hole (px)
  var MIN_HOLE = 64;  // minimum hole size (px), also the minimum tap target

  // Which play mode to use for the given player count and device.
  function decideMode(players, env) {
    if (players === 1) { return 'solo'; }
    if (players === 2 && env.maxTouchPoints > 0 && env.width > env.height && Math.min(env.width, env.height) >= 600) {
      return 'together';
    }
    return 'turns';
  }

  // Hole size (px) that fits a 3x3 grid in the play area.
  function holeSize(areaW, areaH) {
    return Math.max(MIN_HOLE, Math.floor((Math.min(areaW, areaH) - 4 * GAP) / 3));
  }

  // Index of the hole under pointer (x, y), or -1. rects[i] is null when hole i has no character.
  function hitHole(x, y, rects) {
    var best = -1, bestDist = Infinity;
    for (var i = 0; i < rects.length; i++) {
      var r = rects[i];
      if (!r) { continue; }
      var left = r.left - HIT_PAD, top = r.top - HIT_PAD;
      var right = r.left + r.width + HIT_PAD, bottom = r.top + r.height + HIT_PAD;
      if (x < left || x > right || y < top || y > bottom) { continue; }
      var cx = r.left + r.width / 2, cy = r.top + r.height / 2;
      var d = (x - cx) * (x - cx) + (y - cy) * (y - cy);
      if (d < bestDist) { bestDist = d; best = i; }
    }
    return best;
  }

  G.Layout = {
    GAP: GAP,
    HIT_PAD: HIT_PAD,
    decideMode: decideMode,
    holeSize: holeSize,
    hitHole: hitHole
  };
})(Ailand.games.whack);
