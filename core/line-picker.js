(function (C) {
  'use strict';

  // Picks a line for (character, situation): game lines, then common lines, then ''.
  // Avoids repeating the previous line for the same character and situation.
  function create(opts) {
    var gameLines = opts.gameLines || {};
    var commonLines = opts.commonLines || {};
    var random = opts.rng || Math.random;
    var lastIndex = {};

    function pick(charId, situation) {
      var own = gameLines[charId] && gameLines[charId][situation];
      var list = own && own.length > 0 ? own : commonLines[situation];
      if (!list || list.length === 0) { return ''; }
      var key = charId + '|' + situation;
      var prev = lastIndex[key];
      var idx;
      if (list.length === 1 || prev === undefined || prev >= list.length) {
        idx = Math.min(Math.floor(random() * list.length), list.length - 1);
      } else {
        // Choose among the other list.length - 1 lines, skipping prev.
        idx = Math.min(Math.floor(random() * (list.length - 1)), list.length - 2);
        if (idx >= prev) { idx += 1; }
      }
      lastIndex[key] = idx;
      return list[idx];
    }

    return { pick: pick };
  }

  C.LinePicker = { create: create };
})(Ailand.core);
