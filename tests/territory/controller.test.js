(function (A) {
  'use strict';
  var describe = A.Test.describe, it = A.Test.it, expect = A.Test.expect;
  var G = A.games.territory, E = G.Engine, Ctl = G.Controller;
  var SAVE = 'ailand:territory:save.v1', SET = 'ailand:territory:settings.v1';

  function memBackend() {
    var m = {};
    return {
      m: m,
      getItem: function (k) { return Object.prototype.hasOwnProperty.call(m, k) ? m[k] : null; },
      setItem: function (k, v) { m[k] = v; },
      removeItem: function (k) { delete m[k]; }
    };
  }

  // The fake CPU plays the first legal move.
  function firstMove(state) { return E.legalMoves(state, E.currentSeat(state))[0]; }

  function make(opts) {
    opts = opts || {};
    var clock = { t: 1000 }, queue = [];
    var backend = opts.backend || memBackend();
    A.core.Storage._backend = backend;
    var bus = A.core.EventBus.create(), log = [];
    ['started', 'turn', 'thinking', 'moved', 'reaction', 'gameover', 'undo'].forEach(function (n) {
      bus.on(n, function (p) { log.push({ name: n, p: p }); });
    });
    var ctl = Ctl.create({
      bus: bus, rng: opts.rng || function () { return 0.5; },
      setTimeout: function (fn, ms) { queue.push({ fn: fn, ms: ms }); },
      storage: A.core.Storage.create('territory'),
      ai: opts.ai || { chooseMove: firstMove },
      now: function () { return clock.t; }
    });
    return { ctl: ctl, clock: clock, queue: queue, backend: backend, log: log };
  }
  function settings(o) {
    var s = { players: 2, level: 'weak', first: 'me',
      seats: [{ seat: 1, charId: 'mametchi', human: true }, { seat: 2, charId: 'kuchipatchi', human: false }] };
    for (var k in o) { s[k] = o[k]; }
    return s;
  }
  // step = run the timers queued right now once; fire = keep going until nothing is queued (the CPU turn takes two timers).
  function step(h) { h.queue.splice(0).forEach(function (e) { e.fn(); }); }
  function fire(h) { for (var i = 0; i < 1000 && h.queue.length; i++) { step(h); } }
  function names(h, n) { return h.log.filter(function (e) { return e.name === n; }); }
  function humanMove(h) { return firstMove(h.ctl.state()); }
  // Human plays the first legal move and the CPU answers.
  function round(h) {
    expect(h.ctl.input(humanMove(h)).ok).toBe(true);
    fire(h);
  }

  describe('territory controller: settings', function () {
    it('constants', function () {
      expect(Ctl.CPU_MIN_WAIT_MS).toBe(600);
      expect(Ctl.UNDO_MAX).toBe(3);
    });
    it('settings round trip and broken values fall back', function () {
      var h = make();
      var def = h.ctl.loadSettings();
      expect(def.players).toBe(2);
      expect(def.level).toBe('weak');
      expect(def.first).toBe('random');
      expect(def.seats[0].human).toBe(true);
      expect(def.seats[1].human).toBe(false);
      var s = settings({ players: 3, level: 'strong', first: 'random', seats: [
        { seat: 1, charId: 'mimitchi', human: true }, { seat: 2, charId: 'mametchi', human: false }, { seat: 3, charId: 'flowertchi', human: false }] });
      h.ctl.saveSettings(s);
      expect(h.ctl.loadSettings()).toEqual({ players: 3, seats: s.seats, level: 'strong', first: 'random' });
      [{ players: 7 }, { level: 'god' }, { first: 'x' },
        { seats: [{ seat: 1, charId: 'nobody', human: true }, { seat: 2, charId: 'kuchipatchi', human: false }] },
        { seats: [{ seat: 1, charId: 'mametchi', human: true }, { seat: 2, charId: 'mametchi', human: false }] }
      ].forEach(function (bad) {
        h.backend.m[SET] = JSON.stringify(settings(bad));
        expect(h.ctl.loadSettings().level).toBe('weak');
        expect(h.ctl.loadSettings().players).toBe(2);
      });
      h.backend.m[SET] = 'not json{';
      expect(h.ctl.loadSettings().players).toBe(2);
    });
    it('first resolves to a seat and is saved for resume', function () {
      var h = make();
      h.ctl.start(settings({ first: 'me' }));
      expect(h.ctl.state().turn).toBe(1);
      h.ctl.start(settings({ first: 'them' }));
      expect(h.ctl.state().turn).toBe(2);
      expect(h.ctl.settings().firstSeat).toBe(2);
      expect(JSON.parse(h.backend.m[SAVE]).settings.firstSeat).toBe(2);
      var r = make({ rng: function () { return 0.9; } });
      r.ctl.start(settings({ first: 'random' }));
      expect(r.ctl.settings().firstSeat).toBe(2);
      var g = make({ rng: function () { return 0.9; } });
      g.ctl.start(settings({ players: 4, first: 'me', seats: [1, 2, 3, 4].map(function (i) {
        return { seat: i, charId: G.Constants.CHARS[i - 1], human: i === 1 };
      }) }));
      expect(g.ctl.settings().firstSeat).toBe(4);
    });
    it('how-to is seen once and does not touch the other settings', function () {
      var h = make();
      expect(h.ctl.seenHowTo()).toBe(false);
      h.ctl.saveSettings(settings({ level: 'normal' }));
      h.ctl.markHowToSeen();
      expect(h.ctl.seenHowTo()).toBe(true);
      expect(h.ctl.loadSettings().level).toBe('normal');
      h.ctl.saveSettings(settings({ level: 'strong' }));
      expect(h.ctl.seenHowTo()).toBe(true);
      h.ctl.start(settings({ level: 'weak' }));
      expect(h.ctl.seenHowTo()).toBe(true);
      expect(make({ backend: h.backend }).ctl.seenHowTo()).toBe(true);
    });
  });

  describe('territory controller: turns', function () {
    it('human move saves and cpu replies after 600ms', function () {
      var h = make();
      h.ctl.start(settings());
      expect(h.ctl.input(humanMove(h)).ok).toBe(true);
      expect(h.ctl.isBusy()).toBe(true);
      expect(typeof h.backend.m[SAVE]).toBe('string');
      expect(h.queue.length).toBe(1);
      expect(names(h, 'moved').length).toBe(1);
      step(h);
      expect(h.queue.length).toBe(1);
      expect(h.queue[0].ms).toBe(600);
      expect(names(h, 'thinking')[0].p.on).toBe(true);
      fire(h);
      expect(names(h, 'moved').length).toBe(2);
      expect(names(h, 'moved')[1].p.move.seat).toBe(2);
      expect(h.ctl.isBusy()).toBe(false);
      expect(JSON.parse(h.backend.m[SAVE]).history.length).toBe(2);
    });
    it('thinking time counts toward the 600ms wait', function () {
      var h = make({ ai: { chooseMove: function (s) { h.clock.t += 250; return firstMove(s); } } });
      h.ctl.start(settings());
      h.ctl.input(humanMove(h));
      step(h);
      expect(h.queue[0].ms).toBe(350);
    });
    it('the cpu search runs in a later timer, not inside the human move', function () {
      var calls = 0;
      var h = make({ ai: { chooseMove: function (s) { calls++; return firstMove(s); } } });
      h.ctl.start(settings());
      h.ctl.input(humanMove(h));
      expect(calls).toBe(0);
      expect(h.queue[0].ms).toBe(0);
      expect(names(h, 'thinking')[0].p.on).toBe(true);
      step(h);
      expect(calls).toBe(1);
      h.ctl.stop();
      fire(h);
      expect(h.ctl.state().moves).toBe(1);
    });
    it('stop before the search timer skips the search', function () {
      var calls = 0;
      var h = make({ ai: { chooseMove: function (s) { calls++; return firstMove(s); } } });
      h.ctl.start(settings());
      h.ctl.input(humanMove(h));
      h.ctl.stop();
      fire(h);
      expect(calls).toBe(0);
    });
    it('input refuses out-of-range rot / flip / position quickly', function () {
      var h = make();
      h.ctl.start(settings());
      var m = humanMove(h), t0 = Date.now();
      [{ rot: 1e9 }, { rot: -1 }, { rot: 1.5 }, { flip: 2 }, { x: 0.5 }, { y: 'a' }].forEach(function (d) {
        var bad = { seat: 1, pieceId: m.pieceId, rot: m.rot, flip: m.flip, x: m.x, y: m.y };
        for (var k in d) { bad[k] = d[k]; }
        var r = h.ctl.input(bad);
        expect(r.ok).toBe(false);
        expect(r.reason).toBe('bad');
      });
      expect(Date.now() - t0 < 500).toBe(true);
      expect(h.ctl.state().moves).toBe(0);
    });
    it('illegal input returns the reason and does not save', function () {
      var h = make();
      h.ctl.start(settings());
      h.backend.m[SAVE] = 'marker';
      var m = humanMove(h);
      var bad = { seat: 1, pieceId: m.pieceId, rot: m.rot, flip: m.flip, x: m.x + 5, y: m.y + 5 };
      var expected = E.check(h.ctl.state(), bad).reason;
      expect(h.ctl.input(bad)).toEqual({ ok: false, reason: expected });
      expect(h.ctl.input({ seat: 2, pieceId: m.pieceId, rot: 0, flip: 0, x: 0, y: 0 }).ok).toBe(false);
      expect(h.ctl.input({ seat: 1, pieceId: 'nope', rot: 0, flip: 0, x: 0, y: 0 }).ok).toBe(false);
      expect(h.ctl.input(null).ok).toBe(false);
      expect(h.backend.m[SAVE]).toBe('marker');
      expect(h.ctl.state().moves).toBe(0);
      h.ctl.input(m);
      expect(h.ctl.input(m).ok).toBe(false);
    });
    it('stale cpu move is dropped after stop or a new start', function () {
      var h = make();
      h.ctl.start(settings());
      h.ctl.input(humanMove(h));
      h.ctl.stop();
      expect(h.ctl.isBusy()).toBe(false);
      var th = names(h, 'thinking');
      expect(th[th.length - 1].p.on).toBe(false);
      fire(h);
      expect(h.ctl.state().moves).toBe(1);
      h.ctl.start(settings());
      h.ctl.input(humanMove(h));
      step(h);
      var old = h.queue.splice(0);
      h.ctl.start(settings());
      old.forEach(function (e) { e.fn(); });
      expect(h.ctl.state().moves).toBe(0);
      expect(h.ctl.isBusy()).toBe(false);
    });
    it('an illegal ai answer is replaced by a legal move', function () {
      var h = make({ ai: { chooseMove: function () { return { seat: 2, pieceId: 'nope', rot: 0, flip: 0, x: 0, y: 0 }; } } });
      h.ctl.start(settings());
      h.ctl.input(humanMove(h));
      fire(h);
      expect(h.ctl.state().moves).toBe(2);
    });
  });

  // Random play until seat 1 rests while the game goes on; returns the history.
  function historyWithHumanResting() {
    for (var seed = 1; seed < 200; seed++) {
      var rng = A.core.Rng.mulberry32(seed), s = E.create({ players: 2, firstSeat: 1 }), hist = [];
      while (!E.isOver(s)) {
        var ms = E.legalMoves(s, E.currentSeat(s)), m = ms[Math.floor(rng() * ms.length)];
        s = E.apply(s, m);
        hist.push(m);
        if (s.resting[1] && !E.isOver(s)) { return hist; }
      }
    }
    return null;
  }

  describe('territory controller: save and resume', function () {
    it('resume rebuilds the same board', function () {
      var h = make();
      h.ctl.start(settings({ first: 'them' }));
      fire(h);
      round(h); round(h);
      expect(h.ctl.hasSave()).toBe(true);
      var h2 = make({ backend: h.backend });
      expect(h2.ctl.hasSave()).toBe(true);
      expect(h2.ctl.resume()).toBe(true);
      expect(JSON.stringify(h2.ctl.state())).toBe(JSON.stringify(h.ctl.state()));
      expect(h2.ctl.undoLeft()).toBe(h.ctl.undoLeft());
      expect(h2.ctl.settings().firstSeat).toBe(2);
      expect(names(h2, 'started').length).toBe(1);
    });
    it('resume with a cpu turn pending restarts the cpu', function () {
      var h = make();
      h.ctl.start(settings());
      h.ctl.input(humanMove(h));
      var h2 = make({ backend: h.backend });
      expect(h2.ctl.resume()).toBe(true);
      expect(h2.ctl.isBusy()).toBe(true);
      fire(h2);
      expect(h2.ctl.state().moves).toBe(2);
    });
    it('broken save is discarded', function () {
      var good = settings({ firstSeat: 1 });
      var first = E.legalMoves(E.create({ players: 2, firstSeat: 1 }), 1)[0];
      var cases = [
        'not json{', 'null',
        JSON.stringify({ settings: good, history: 'x', undoLeft: 3 }),
        JSON.stringify({ settings: good, history: [], undoLeft: 9 }),
        JSON.stringify({ history: [], undoLeft: 3 }),
        JSON.stringify({ settings: settings({ firstSeat: 3 }), history: [], undoLeft: 3 }),
        // rules-breaking moves: wrong seat, same move twice, nonsense piece
        JSON.stringify({ settings: good, history: [{ seat: 2, pieceId: first.pieceId, rot: 0, flip: 0, x: 0, y: 0 }], undoLeft: 3 }),
        JSON.stringify({ settings: good, history: [first, first], undoLeft: 3 }),
        JSON.stringify({ settings: good, history: [{ seat: 1, pieceId: 'zzz', rot: 0, flip: 0, x: 0, y: 0 }], undoLeft: 3 }),
        // rotation / flip / position out of range (a huge rot must not hang the replay)
        JSON.stringify({ settings: good, history: [{ seat: 1, pieceId: first.pieceId, rot: 1e9, flip: 0, x: first.x, y: first.y }], undoLeft: 3 }),
        JSON.stringify({ settings: good, history: [{ seat: 1, pieceId: first.pieceId, rot: 4, flip: 0, x: first.x, y: first.y }], undoLeft: 3 }),
        JSON.stringify({ settings: good, history: [{ seat: 1, pieceId: first.pieceId, rot: 0.5, flip: 0, x: first.x, y: first.y }], undoLeft: 3 }),
        JSON.stringify({ settings: good, history: [{ seat: 1, pieceId: first.pieceId, rot: 0, flip: 2, x: first.x, y: first.y }], undoLeft: 3 }),
        JSON.stringify({ settings: good, history: [{ seat: 1, pieceId: first.pieceId, rot: 0, flip: 0, x: 0.5, y: first.y }], undoLeft: 3 }),
        // player count that does not match the seats
        JSON.stringify({ settings: settings({ firstSeat: 1, players: 3 }), history: [], undoLeft: 3 })
      ];
      cases.forEach(function (raw) {
        var b = memBackend(); b.m[SAVE] = raw;
        var h = make({ backend: b });
        expect(h.ctl.resume()).toBe(false);
        expect(b.m[SAVE]).toBe(undefined);
      });
      expect(make().ctl.resume()).toBe(false);
    });
    it('gameover clears the save', function () {
      var hist = historyWithHumanResting();
      var h = make();
      h.backend.m[SAVE] = JSON.stringify({ settings: settings({ firstSeat: 1 }), history: hist, undoLeft: 3 });
      expect(h.ctl.resume()).toBe(true);
      expect(h.ctl.hasSave()).toBe(true);
      for (var i = 0; i < 300 && h.queue.length; i++) { fire(h); }
      expect(names(h, 'gameover').length).toBe(1);
      expect(h.ctl.hasSave()).toBe(false);
    });
  });

  describe('territory controller: undo', function () {
    it('undo only with one human and a cpu, up to 3', function () {
      var h = make();
      h.ctl.start(settings());
      expect(h.ctl.canUndo()).toBe(false);
      round(h); round(h); round(h); round(h);
      expect(h.ctl.canUndo()).toBe(true);
      expect(h.ctl.undo()).toBe(true);
      expect(h.ctl.undo()).toBe(true);
      expect(h.ctl.undo()).toBe(true);
      expect(h.ctl.undoLeft()).toBe(0);
      expect(h.ctl.undo()).toBe(false);
      expect(names(h, 'undo').length).toBe(3);
      var two = make();
      two.ctl.start(settings({ seats: [{ seat: 1, charId: 'mametchi', human: true }, { seat: 2, charId: 'kuchipatchi', human: true }] }));
      two.ctl.input(humanMove(two));
      expect(two.ctl.canUndo()).toBe(false);
      expect(two.ctl.undo()).toBe(false);
    });
    it('undo is refused while the cpu thinks and survives resume', function () {
      var h = make();
      h.ctl.start(settings());
      h.ctl.input(humanMove(h));
      expect(h.ctl.undo()).toBe(false);
      fire(h);
      expect(h.ctl.undo()).toBe(true);
      var h2 = make({ backend: h.backend });
      h2.ctl.resume();
      expect(h2.ctl.undoLeft()).toBe(2);
      expect(h2.ctl.state().moves).toBe(0);
    });
    it('undo removes the cpu moves after it', function () {
      var h = make();
      h.ctl.start(settings());
      round(h);
      var afterOne = JSON.stringify(h.ctl.state());
      round(h);
      expect(h.ctl.state().moves).toBe(4);
      h.ctl.undo();
      expect(JSON.stringify(h.ctl.state())).toBe(afterOne);
      expect(JSON.parse(h.backend.m[SAVE]).history.length).toBe(2);
      h.ctl.undo();
      expect(h.ctl.state().moves).toBe(0);
    });
  });

  describe('territory controller: cpu only rest and reactions', function () {
    it('cpu-only rest plays to the end', function () {
      var h = make();
      h.backend.m[SAVE] = JSON.stringify({ settings: settings({ firstSeat: 1 }), history: historyWithHumanResting(), undoLeft: 3 });
      h.ctl.resume();
      expect(h.ctl.state().resting[1]).toBe(true);
      var humanTurns = 0;
      h.log.forEach(function (e) { if (e.name === 'turn' && e.p.human) { humanTurns++; } });
      for (var i = 0; i < 300 && h.queue.length; i++) { fire(h); }
      names(h, 'turn').forEach(function (e) { if (e.p.human) { humanTurns++; } });
      expect(humanTurns).toBe(0);
      var g = names(h, 'gameover');
      expect(g.length).toBe(1);
      expect(g[0].p.result.winners.length > 0).toBe(true);
      expect(E.isOver(h.ctl.state())).toBe(true);
    });
    it('reaction events carry faces, lines and one screen choice', function () {
      var h = make();
      h.ctl.start(settings());
      round(h);
      var rx = names(h, 'reaction');
      expect(rx.length).toBe(2);
      rx.forEach(function (e) {
        expect(Array.isArray(e.p.events)).toBe(true);
        expect(e.p.events.length > 0).toBe(true);
        expect(e.p.screen === null || typeof e.p.screen === 'string').toBe(true);
      });
    });
    it('ending screen: human win, cpu win, draw, cpu only', function () {
      function finish(humanSeats, mutate) {
        var hist = historyWithHumanResting();
        var h = make();
        var seats = [{ seat: 1, charId: 'mametchi', human: humanSeats.indexOf(1) >= 0 }, { seat: 2, charId: 'kuchipatchi', human: humanSeats.indexOf(2) >= 0 }];
        h.backend.m[SAVE] = JSON.stringify({ settings: settings({ firstSeat: 1, seats: seats }), history: hist, undoLeft: 3 });
        h.ctl.resume();
        // Seat 1 rests, so seat 2 plays alone; let the CPU pick its move first, then force the final score.
        step(h);
        mutate(h.ctl.state());
        for (var i = 0; i < 300 && h.queue.length; i++) { fire(h); }
        var rx = names(h, 'reaction');
        return rx[rx.length - 1].p;
      }
      function lead(seat) {
        return function (st) { st.placed[seat] = 1000; st.placed[3 - seat] = 0; };
      }
      expect(finish([1], lead(1)).screen).toBe('win');
      expect(finish([1], lead(2)).screen).toBe('lose');
      // Seat 2 plays alone to the end: learn how much it gains, then start it so the totals tie.
      var gain = (function () {
        var h = make();
        h.backend.m[SAVE] = JSON.stringify({ settings: settings({ firstSeat: 1 }), history: historyWithHumanResting(), undoLeft: 3 });
        h.ctl.resume();
        var before = h.ctl.state().placed[2];
        for (var i = 0; i < 300 && h.queue.length; i++) { fire(h); }
        return h.ctl.state().placed[2] - before;
      })();
      expect(finish([1], function (st) { st.placed[1] = 1000; st.placed[2] = 1000 - gain; }).screen).toBe('draw');
      expect(finish([], lead(1)).screen).toBe('win');
    });
    it('a cpu block of a human gets only the small mark; a human block gets the block effect', function () {
      var found = { mark: false, block: false };
      for (var seed = 1; seed < 200 && !(found.mark && found.block); seed++) {
        var rng = A.core.Rng.mulberry32(seed);
        var h = make({ ai: { chooseMove: function (s) {
          var ms = E.legalMoves(s, E.currentSeat(s));
          return ms[Math.floor(rng() * ms.length)];
        } } });
        h.ctl.start(settings());
        for (var i = 0; i < 200 && !E.isOver(h.ctl.state()); i++) {
          if (h.ctl.isBusy()) { fire(h); continue; }
          var ms = E.legalMoves(h.ctl.state(), 1);
          if (!ms.length) { break; }
          h.ctl.input(ms[Math.floor(rng() * ms.length)]);
        }
        names(h, 'reaction').forEach(function (e, idx) {
          var by = e.p.events[0].by, top = e.p.picked && e.p.picked.event.kind;
          if (top === 'block' && by === 2) { expect(e.p.screen).toBe('mark'); found.mark = true; }
          if (top === 'block' && by === 1) { expect(e.p.screen).toBe('block'); found.block = true; }
        });
      }
      expect(found.mark).toBe(true);
      expect(found.block).toBe(true);
    });
  });
})(window.Ailand);
