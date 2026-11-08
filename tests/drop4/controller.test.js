(function (A) {
  'use strict';
  var describe = A.Test.describe, it = A.Test.it, expect = A.Test.expect;
  var E = A.games.drop4.Engine, Ctl = A.games.drop4.Controller;

  function memBackend(failSet) {
    var m = {};
    return {
      m: m,
      getItem: function (k) { return Object.prototype.hasOwnProperty.call(m, k) ? m[k] : null; },
      setItem: function (k, v) { if (failSet) { throw new Error('quota'); } m[k] = v; },
      removeItem: function (k) { delete m[k]; }
    };
  }
  function settle() { return Promise.resolve().then(function () {}).then(function () {}).then(function () {}); }

  // opts.script: columns the fake CPU plays (falls back to the first legal move).
  function make(opts) {
    opts = opts || {};
    var clock = { t: 1000 };
    var queue = [];
    var backend = opts.backend || memBackend(opts.failSet);
    A.core.Storage._backend = backend;
    var script = (opts.script || []).slice();
    var bus = A.core.EventBus.create();
    var log = [];
    ['started', 'turn', 'thinking', 'moved', 'reaction', 'gameover', 'undo'].forEach(function (n) {
      bus.on(n, function (p) { log.push({ name: n, p: p }); });
    });
    var ai = {
      search: function (state) {
        var c = script.length ? script.shift() : null;
        var ms = E.legalMoves(state);
        var mv = ms[0];
        if (c !== null) { mv = ms.filter(function (m) { return m.type === 'drop' && m.col === c; })[0]; }
        return Promise.resolve(mv);
      }
    };
    var ctl = Ctl.create({
      bus: bus, rng: function () { return 0.5; },
      scheduler: function (fn, ms) { queue.push({ fn: fn, ms: ms }); },
      storage: A.core.Storage.create('drop4'), ai: ai,
      now: function () { return clock.t; },
      linePicker: A.core.LinePicker.create({ gameLines: A.games.drop4.Lines, commonLines: A.core.CommonLines, rng: function () { return 0; } })
    });
    return { ctl: ctl, clock: clock, queue: queue, backend: backend, log: log };
  }
  function settings(o) {
    var s = { players: 2, teams: false, popOut: false, blocks: false, firstSeat: 1, level: 'normal',
      seats: [{ seat: 1, charId: 'mametchi', human: true }, { seat: 2, charId: 'kuchipatchi', human: false }] };
    for (var k in o) { s[k] = o[k]; }
    return s;
  }
  // Waits for the CPU to finish thinking, then fires the delayed delivery.
  async function cpuMove(h, elapsed) {
    await settle();
    h.clock.t += elapsed || 0;
    h.queue.splice(0).forEach(function (e) { e.fn(); });
  }
  function names(h, n) { return h.log.filter(function (e) { return e.name === n; }); }
  function drop(col, seat) { return { type: 'drop', col: col, seat: seat || 1 }; }

  describe('drop4 controller: CPU wait and input guard', function () {
    it('constants', function () {
      expect(Ctl.CPU_MIN_WAIT_MS).toBe(600);
      expect(Ctl.UNDO_MAX).toBe(3);
      expect(Ctl.SAVE_KEY).toBe('save.v1');
    });
    it('CPU move is delivered through the scheduler after 600ms minus elapsed', async function () {
      var h = make({ script: [3] });
      h.ctl.start(settings());
      expect(h.ctl.input(drop(0))).toBe(true);
      expect(h.ctl.isBusy()).toBe(true);
      h.clock.t += 200;
      await settle();
      expect(h.queue.length).toBe(1);
      expect(h.queue[0].ms).toBe(400);
      expect(names(h, 'moved').length).toBe(1);
      h.queue.splice(0).forEach(function (e) { e.fn(); });
      expect(names(h, 'moved').length).toBe(2);
      expect(h.ctl.isBusy()).toBe(false);
    });
    it('elapsed over 600ms delivers with 0 wait', async function () {
      var h = make({ script: [3] });
      h.ctl.start(settings());
      h.ctl.input(drop(0));
      h.clock.t += 900;
      await settle();
      expect(h.queue[0].ms).toBe(0);
    });
    it('input is refused out of turn, while busy, and after game over', async function () {
      var h = make({ script: [1, 1, 1, 1] });
      h.ctl.start(settings());
      expect(h.ctl.input(drop(0, 2))).toBe(false);
      expect(h.ctl.input(drop(99))).toBe(false);
      expect(h.ctl.input(drop(0))).toBe(true);
      var snap = JSON.stringify(h.ctl.state());
      expect(h.ctl.input(drop(2))).toBe(false);
      expect(JSON.stringify(h.ctl.state())).toBe(snap);
      await cpuMove(h);
      h.ctl.input(drop(2)); await cpuMove(h);
      h.ctl.input(drop(3)); await cpuMove(h);
      h.ctl.input(drop(5)); await cpuMove(h);
      expect(h.ctl.state().result.type).toBe('win');
      var s2 = JSON.stringify(h.ctl.state());
      expect(h.ctl.input(drop(6))).toBe(false);
      expect(JSON.stringify(h.ctl.state())).toBe(s2);
    });
    it('CPU goes first when firstSeat is a CPU seat', async function () {
      var h = make({ script: [2] });
      h.ctl.start(settings({ firstSeat: 2 }));
      expect(h.ctl.isBusy()).toBe(true);
      expect(names(h, 'thinking')[0].p.on).toBe(true);
      await cpuMove(h);
      expect(h.ctl.state().moveCount).toBe(1);
      var t = names(h, 'turn');
      expect(t[t.length - 1].p.human).toBe(true);
    });
  });

  describe('drop4 controller: game over perspective', function () {
    it('human win -> win, save removed', async function () {
      var h = make({ script: [1, 1, 1] });
      h.ctl.start(settings());
      for (var i = 0; i < 3; i++) { h.ctl.input(drop(0)); await cpuMove(h); }
      h.ctl.input(drop(0));
      var g = names(h, 'gameover');
      expect(g.length).toBe(1);
      expect(g[0].p.perspective).toBe('win');
      expect(g[0].p.result.type).toBe('win');
      expect(h.backend.m['ailand:drop4:save.v1']).toBe(undefined);
    });
    it('CPU win -> lose, matches Reaction.pick', async function () {
      var h = make({ script: [1, 1, 1, 1] });
      h.ctl.start(settings());
      var cols = [0, 2, 3, 5];
      for (var i = 0; i < 4; i++) { h.ctl.input(drop(cols[i])); await cpuMove(h); }
      var g = names(h, 'gameover')[0];
      expect(g.p.perspective).toBe('lose');
      var rx = names(h, 'reaction');
      expect(rx[rx.length - 1].p.picked.perspective).toBe('lose');
    });
    it('reaction carries lines for the picked kind seats', async function () {
      var h = make({ script: [1, 1, 1] });
      h.ctl.start(settings());
      for (var i = 0; i < 3; i++) { h.ctl.input(drop(0)); await cpuMove(h); }
      h.ctl.input(drop(0));
      var rx = names(h, 'reaction');
      var last = rx[rx.length - 1].p;
      expect(typeof last.lines[1]).toBe('string');
      expect(last.lines[1].length > 0).toBeTruthy();
      expect(last.lines[2].length > 0).toBeTruthy();
    });
  });

  describe('drop4 controller: save and resume', function () {
    it('saves each move and resumes the same position', async function () {
      var h = make({ script: [3, 4] });
      h.ctl.start(settings({ blocks: true }));
      h.ctl.input(drop(0)); await cpuMove(h);
      h.ctl.input({ type: 'block', col: 6, seat: 1 }); await cpuMove(h);
      expect(h.ctl.hasSave()).toBe(true);
      var h2 = make({ backend: h.backend });
      expect(h2.ctl.hasSave()).toBe(true);
      expect(h2.ctl.resume()).toBe(true);
      expect(JSON.stringify(h2.ctl.state())).toBe(JSON.stringify(h.ctl.state()));
      expect(h2.ctl.state().blocksLeft[1]).toBe(1);
      expect(h2.ctl.undoLeft()).toBe(h.ctl.undoLeft());
      expect(names(h2, 'started').length).toBe(1);
      expect(names(h2, 'turn')[0].p.seat).toBe(1);
    });
    it('resume with a CPU turn pending restarts the CPU', async function () {
      var h = make({ script: [3] });
      h.ctl.start(settings());
      h.ctl.input(drop(0));
      var h2 = make({ backend: h.backend, script: [4] });
      expect(h2.ctl.resume()).toBe(true);
      expect(h2.ctl.isBusy()).toBe(true);
      await cpuMove(h2);
      expect(h2.ctl.state().moveCount).toBe(2);
    });
    it('bad saves: resume false, save removed, no throw', function () {
      var key = 'ailand:drop4:save.v1';
      var good = settings();
      var cases = [
        'not json{',
        JSON.stringify({ version: 2, settings: good, history: [], undoLeft: 3 }),
        JSON.stringify({ version: 1, settings: good, history: [drop(0), drop(0, 1)], undoLeft: 3 }),
        JSON.stringify({ version: 1, settings: good, history: [{ type: 'drop', col: 99, seat: 1 }], undoLeft: 3 }),
        JSON.stringify({ version: 1, history: [], undoLeft: 3 }),
        JSON.stringify({ version: 1, settings: good, history: 'x', undoLeft: 3 }),
        JSON.stringify({ version: 1, settings: good, history: [], undoLeft: 9 }),
        'null'
      ];
      cases.forEach(function (raw) {
        var b = memBackend(); b.m[key] = raw;
        var h = make({ backend: b });
        expect(h.ctl.resume()).toBe(false);
        expect(b.m[key]).toBe(undefined);
      });
    });
    it('resume with no save is false', function () {
      expect(make().ctl.resume()).toBe(false);
    });
    it('play continues when storage.set fails', async function () {
      var h = make({ failSet: true, script: [3] });
      h.ctl.start(settings());
      expect(h.ctl.input(drop(0))).toBe(true);
      await cpuMove(h);
      expect(h.ctl.state().moveCount).toBe(2);
      expect(h.ctl.hasSave()).toBe(false);
    });
  });

  describe('drop4 controller: undo', function () {
    it('rewinds to just before the last human move, 3 times max', async function () {
      var h = make({ script: [1, 1, 1, 1, 1] });
      h.ctl.start(settings());
      var empty = JSON.stringify(h.ctl.state());
      h.ctl.input(drop(0)); await cpuMove(h);
      var afterOne = JSON.stringify(h.ctl.state());
      h.ctl.input(drop(2)); await cpuMove(h);
      expect(h.ctl.undoLeft()).toBe(3);
      expect(h.ctl.undo()).toBe(true);
      expect(JSON.stringify(h.ctl.state())).toBe(afterOne);
      expect(h.ctl.undoLeft()).toBe(2);
      expect(names(h, 'undo').length).toBe(1);
      expect(h.ctl.undo()).toBe(true);
      expect(JSON.stringify(h.ctl.state())).toBe(empty);
      expect(h.ctl.undo()).toBe(false);
      h.ctl.input(drop(0)); await cpuMove(h);
      expect(h.ctl.undo()).toBe(true);
      expect(h.ctl.undoLeft()).toBe(0);
      h.ctl.input(drop(0)); await cpuMove(h);
      expect(h.ctl.undo()).toBe(false);
    });
    it('undo is refused while busy and survives resume', async function () {
      var h = make({ script: [3] });
      h.ctl.start(settings());
      h.ctl.input(drop(0));
      expect(h.ctl.undo()).toBe(false);
      await cpuMove(h);
      h.ctl.undo();
      var h2 = make({ backend: h.backend });
      h2.ctl.resume();
      expect(h2.ctl.undoLeft()).toBe(2);
      expect(h2.ctl.state().moveCount).toBe(0);
    });
    it('two or more humans: always false', function () {
      var h = make();
      h.ctl.start(settings({ seats: [{ seat: 1, charId: 'mametchi', human: true }, { seat: 2, charId: 'kuchipatchi', human: true }] }));
      h.ctl.input(drop(0));
      expect(h.ctl.undo()).toBe(false);
    });
  });

  describe('drop4 controller: settings getter (for the UI)', function () {
    it('returns null before start, the started settings, and the resumed settings', function () {
      var h = make();
      expect(h.ctl.settings()).toBe(null);
      h.ctl.start(settings({ level: 'weak' }));
      expect(h.ctl.settings().level).toBe('weak');
      h.ctl.input(drop(0));
      var h2 = make({ backend: h.backend });
      expect(h2.ctl.resume()).toBe(true);
      expect(h2.ctl.settings().seats[1].charId).toBe('kuchipatchi');
    });
  });
})(window.Ailand);
