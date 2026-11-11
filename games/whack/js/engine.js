(function (G) {
  'use strict';
  var K = G.Constants;

  function lerp(a, b, p) { return a + (b - a) * p; }

  // ---- schedule ----

  // Builds the deterministic spawn table for one round. Rng call order is fixed: hole, kind, ngPick.
  function buildSchedule(difficulty, seed) {
    var cfg = K.DIFFICULTY[difficulty];
    var rng = Ailand.core.Rng.mulberry32(seed);
    var out = [];
    var freeAt = [], h;
    for (h = 0; h < K.HOLES; h++) { freeAt.push(-Infinity); } // hole usable when busyUntil + COOLDOWN_MS <= t
    var t = K.FIRST_SPAWN_MS;
    while (t < K.DURATION_MS) {
      var p = t / K.DURATION_MS;
      var final = t >= K.DURATION_MS - K.FINAL_MS;
      var interval = lerp(cfg.intervalStart, cfg.intervalEnd, p) * (final ? cfg.finalFactor : 1);
      var upMs = Math.round(lerp(cfg.upStart, cfg.upEnd, p));
      var max = final ? cfg.maxFinal : cfg.maxStart;
      var busy = out.filter(function (s) { return s.busyUntil > t; });
      var free = [];
      for (h = 0; h < K.HOLES; h++) { if (freeAt[h] <= t) { free.push(h); } }
      if (busy.length < max && free.length > 0) {
        var hole = free[Math.floor(rng() * free.length)];
        var r = rng();
        var rareOk = !busy.some(function (s) { return s.kind === 'rare'; }) &&
          !out.some(function (s) { return s.kind === 'rare' && t - s.at < K.RARE_GAP_MS; });
        var kind = 'self';
        if (r < cfg.rareRate && rareOk) { kind = 'rare'; }
        else if (r >= cfg.rareRate && r < cfg.rareRate + cfg.ngRate) { kind = 'ng'; }
        var ngPick = rng();
        var busyUntil = t + upMs + K.REACT_MS;
        out.push({ at: t, hole: hole, kind: kind, ngPick: ngPick, upMs: upMs, busyUntil: busyUntil });
        freeAt[hole] = busyUntil + K.COOLDOWN_MS;
      }
      t += Math.round(interval);
    }
    return out;
  }

  // Character ids other than selfId, in Characters.list() order.
  function ngIdsFor(selfId) {
    return Ailand.core.Characters.list().map(function (c) { return c.id; }).filter(function (id) { return id !== selfId; });
  }

  G.Engine = { buildSchedule: buildSchedule, ngIdsFor: ngIdsFor };
})(Ailand.games.whack);
