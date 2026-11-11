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

  // ---- side state ----

  function createSide(opts) {
    return { schedule: opts.schedule, selfId: opts.selfId, ngIds: opts.ngIds,
      score: 0, counts: { self: 0, rare: 0, ng: 0 }, active: {}, next: 0, ended: false };
  }

  function charIdFor(side, sp) {
    if (sp.kind === 'ng') { return side.ngIds[Math.floor(sp.ngPick * side.ngIds.length)]; }
    return side.selfId;
  }

  // Advances to nowMs. Event order: hides (hole order), shows (schedule order), then a single trailing 'end'.
  function step(side, nowMs) {
    var events = [], h, a;
    if (side.ended) { return events; }
    var over = nowMs >= K.DURATION_MS;
    for (h = 0; h < K.HOLES; h++) {
      a = side.active[h];
      if (!a) { continue; }
      if (over) {
        events.push({ type: 'hide', hole: h, missed: false });
        delete side.active[h];
      } else if (a.hitAt !== null) {
        if (nowMs >= a.hitAt + K.REACT_MS) { events.push({ type: 'hide', hole: h, missed: false }); delete side.active[h]; }
      } else if (nowMs >= a.spawn.at + a.spawn.upMs) {
        events.push({ type: 'hide', hole: h, missed: true });
        delete side.active[h];
      }
    }
    if (over) {
      side.ended = true;
      events.push({ type: 'end', score: side.score });
      return events;
    }
    while (side.next < side.schedule.length && side.schedule[side.next].at <= nowMs) {
      var sp = side.schedule[side.next++];
      var charId = charIdFor(side, sp);
      side.active[sp.hole] = { spawn: sp, charId: charId, hitAt: null };
      events.push({ type: 'show', hole: sp.hole, kind: sp.kind, charId: charId, upMs: sp.upMs });
    }
    return events;
  }

  function press(side, hole, nowMs) {
    var a = side.active[hole];
    if (side.ended || !a || a.hitAt !== null || nowMs >= a.spawn.at + a.spawn.upMs) { return null; }
    var kind = a.spawn.kind, points = K.POINTS[kind];
    a.hitAt = nowMs;
    side.score = Math.max(0, side.score + points);
    side.counts[kind]++;
    return { type: 'hit', hole: hole, kind: kind, charId: a.charId, points: points, score: side.score };
  }

  G.Engine = { buildSchedule: buildSchedule, ngIdsFor: ngIdsFor, createSide: createSide, step: step, press: press };
})(Ailand.games.whack);
