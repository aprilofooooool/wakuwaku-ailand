(function (A) {
  'use strict';
  var describe = A.Test.describe, it = A.Test.it, expect = A.Test.expect;
  var Ctl = A.games.chain.Controller;
  var STEP = 1000 / 60;
  var SET = { char: 'mametchi', difficulty: 'easy', seenHowTo: false };

  function fakeStorage(init) {
    var m = init || {};
    return {
      m: m,
      sets: [],
      get: function (k, fb) { return Object.prototype.hasOwnProperty.call(m, k) ? m[k] : fb; },
      set: function (k, v) { this.sets.push(k); m[k] = v; },
      remove: function (k) { delete m[k]; },
      has: function (k) { return Object.prototype.hasOwnProperty.call(m, k); }
    };
  }
  var NAMES = ['count', 'go', 'spawn', 'moved', 'lock', 'fall', 'pop', 'wake', 'settled', 'clear', 'over', 'danger', 'result'];
  function make(init) {
    var bus = A.core.EventBus.create(), log = [], storage = fakeStorage(init);
    NAMES.forEach(function (n) { bus.on(n, function (p) { log.push({ name: n, p: p }); }); });
    var ctl = Ctl.create({ bus: bus, storage: storage, seed: function () { return 7; } });
    return { ctl: ctl, log: log, storage: storage };
  }
  function names(log) { return log.map(function (e) { return e.name; }); }
  function count(log, n) { return names(log).filter(function (x) { return x === n; }).length; }
  function toPlaying(t, s) {
    t.ctl.start(s || SET);
    while (t.ctl.phase() === 'countdown') { t.ctl.advance(STEP); }
  }
  // Puts a pair at x=3 (rot 0) so hold tests are deterministic.
  function setPair(t) {
    var g = t.ctl.game();
    g.pair = { x: 3, y: 1, rot: 0, axis: g.pair.axis, child: g.pair.child };
  }
  function settle(t) {
    var n = 0;
    while (t.ctl.phase() === 'playing' && n < 1000) { t.ctl.advance(STEP); n++; }
  }
  // Drops a pair with no sleepers left so the round clears once the settle finishes.
  function clearRound(init, elapsed) {
    var t = make(init);
    toPlaying(t);
    var g = t.ctl.game();
    g.sleepers = 0;
    g.elapsedMs = elapsed;
    t.ctl.press('hard');
    settle(t);
    return t;
  }
  // Drops a pair onto a blocked column so the next spawn is blocked.
  function blockEnd(t) {
    var g = t.ctl.game();
    g.board[2][2] = { kind: 'ball', charId: 'x' };
    g.board[3][2] = { kind: 'ball', charId: 'x' };
    g.pair = { x: 2, y: 1, rot: 0, axis: 'mametchi', child: 'mimitchi' };
    t.ctl.press('hard');
    settle(t);
  }

  describe('chain/Controller', function () {
    it('countdown then play', function () {
      var t = make();
      t.ctl.start(SET);
      expect(t.ctl.phase()).toBe('countdown');
      var n = 0;
      while (t.ctl.phase() === 'countdown' && n < 1000) { t.ctl.advance(STEP); n++; }
      var counts = t.log.filter(function (e) { return e.name === 'count'; }).map(function (e) { return e.p.n; });
      expect(counts.join(',')).toBe('3,2,1');
      var ns = names(t.log);
      expect(ns.indexOf('go') > ns.lastIndexOf('count')).toBe(true);
      expect(ns.indexOf('spawn') > ns.indexOf('go')).toBe(true);
      expect(t.ctl.phase()).toBe('playing');
      expect(t.log[ns.indexOf('spawn')].p.pair).toBe(t.ctl.game().pair);
    });
    it('holding left repeats after 170ms every 50ms', function () {
      var t = make();
      toPlaying(t);
      setPair(t);
      var g = t.ctl.game();
      expect(t.ctl.press('left')).toBe(true);
      expect(g.pair.x).toBe(2);
      t.ctl.advance(169);
      expect(g.pair.x).toBe(2);
      t.ctl.advance(1);
      expect(g.pair.x).toBe(1);
      t.ctl.advance(49);
      expect(g.pair.x).toBe(1);
      t.ctl.advance(1);
      expect(g.pair.x).toBe(0);
      t.ctl.release('left');
      t.ctl.advance(500);
      expect(g.pair.x).toBe(0);
      expect(count(t.log, 'moved')).toBe(3);
    });
    it('most recently pressed horizontal wins', function () {
      var t = make();
      toPlaying(t);
      setPair(t);
      var g = t.ctl.game();
      t.ctl.press('left');
      t.ctl.press('right');
      expect(g.pair.x).toBe(3);
      t.ctl.advance(170);
      expect(g.pair.x).toBe(4);
    });
    it('soft drop repeats every 50ms while held', function () {
      var t = make();
      toPlaying(t);
      var g = t.ctl.game();
      var y0 = g.pair.y;
      t.ctl.press('soft');
      expect(g.pair.y).toBe(y0 + 1);
      t.ctl.advance(49);
      expect(g.pair.y).toBe(y0 + 1);
      t.ctl.advance(1);
      expect(g.pair.y).toBe(y0 + 2);
      t.ctl.advance(50);
      expect(g.pair.y).toBe(y0 + 3);
      t.ctl.release('soft');
      t.ctl.advance(100);
      expect(g.pair.y).toBe(y0 + 3);
    });
    it('pause releases held buttons', function () {
      var t = make();
      toPlaying(t);
      setPair(t);
      var g = t.ctl.game();
      t.ctl.press('left');
      t.ctl.pause('hidden');
      expect(t.ctl.isPaused()).toBe(true);
      var y = g.pair.y, el = g.elapsedMs;
      t.ctl.advance(5000);
      expect(g.pair.y).toBe(y);
      expect(g.elapsedMs).toBe(el);
      expect(g.pair.x).toBe(2);
      expect(t.ctl.press('left')).toBe(false);
      t.ctl.resume();
      t.ctl.advance(1000);
      expect(g.pair.x).toBe(2);
    });
    it('press is refused outside playing', function () {
      var t = make();
      t.ctl.start(SET);
      expect(t.ctl.press('left')).toBe(false);
      t.ctl.release('left');
    });
    it('clear ends with a result', function () {
      var t = clearRound({}, 0);
      expect(t.ctl.phase()).toBe('result');
      var res = t.log.filter(function (e) { return e.name === 'result'; })[0].p;
      expect(res.cleared).toBe(true);
      expect(res.reason).toBe(null);
      expect(res.char).toBe('mametchi');
      expect(res.difficulty).toBe('easy');
      expect(count(t.log, 'clear')).toBe(1);
      expect(t.ctl.press('left')).toBe(false);
    });
    it('over (blocked) ends with a result and a reason', function () {
      var t = make();
      toPlaying(t);
      blockEnd(t);
      expect(t.ctl.phase()).toBe('result');
      var r = t.ctl.getResult();
      expect(r.cleared).toBe(false);
      expect(r.reason).toBe('blocked');
      expect(count(t.log, 'over')).toBe(1);
      expect(count(t.log, 'result')).toBe(1);
    });
    it('timeup ends with a result and a reason', function () {
      var t = make();
      toPlaying(t);
      t.ctl.game().timeMs = 100;
      t.ctl.advance(200);
      expect(t.ctl.phase()).toBe('result');
      expect(t.ctl.getResult().reason).toBe('timeup');
    });
    it('time does not run during the countdown or while paused', function () {
      var t = make();
      t.ctl.start(SET);
      t.ctl.advance(STEP);
      expect(t.ctl.game().timeMs).toBe(150000);
      while (t.ctl.phase() === 'countdown') { t.ctl.advance(STEP); }
      t.ctl.pause('menu');
      t.ctl.advance(5000);
      expect(t.ctl.game().timeMs).toBe(150000);
      expect(t.ctl.game().elapsedMs).toBe(0);
    });
    it('clear saves a faster time only', function () {
      var a = clearRound({ 'time.v1': { easy: 90, normal: 50 } }, 79500);
      var r = a.ctl.getResult();
      expect(r.timeSec).toBe(80);
      expect(r.newTime).toBe(true);
      expect(r.bestTime).toBe(80);
      expect(a.storage.m['time.v1'].easy).toBe(80);
      expect(a.storage.m['time.v1'].normal).toBe(50);

      var b = clearRound({ 'time.v1': { easy: 90 } }, 98500);
      var q = b.ctl.getResult();
      expect(q.timeSec).toBe(99);
      expect(q.newTime).toBe(false);
      expect(q.bestTime).toBe(90);
      expect(b.storage.sets.indexOf('time.v1')).toBe(-1);

      var c = clearRound({}, 80200);   // 80.2 s rounds up to 81; no record yet
      expect(c.ctl.getResult().timeSec).toBe(81);
      expect(c.ctl.getResult().newTime).toBe(true);
      expect(c.storage.m['time.v1'].easy).toBe(81);

      var d = clearRound({ 'time.v1': { easy: 81 } }, 80200);   // equal is not new
      expect(d.ctl.getResult().newTime).toBe(false);
      expect(d.storage.sets.indexOf('time.v1')).toBe(-1);
    });
    it('a loss never saves a time and reports newTime false', function () {
      var t = make();
      toPlaying(t);
      t.ctl.game().elapsedMs = 5000;
      blockEnd(t);
      var r = t.ctl.getResult();
      expect(r.cleared).toBe(false);
      expect(r.newTime).toBe(false);
      expect(r.bestTime).toBe(0);
      expect(t.storage.has('time.v1')).toBe(false);
      var u = make({ 'time.v1': { easy: 60 } });
      toPlaying(u);
      blockEnd(u);
      expect(u.ctl.getResult().bestTime).toBe(60);
      expect(u.ctl.getResult().newTime).toBe(false);
    });
    it('result has the exact shape', function () {
      var t = clearRound({}, 0);
      expect(Object.keys(t.ctl.getResult()).join(',')).toBe('cleared,reason,woke,char,difficulty,timeSec,bestTime,newTime');
    });
    it('broken settings and times fall back', function () {
      var def = JSON.stringify(SET);
      [null, 'x', 5, [1]].forEach(function (bad) {
        expect(JSON.stringify(make({ 'settings.v1': bad }).ctl.loadSettings())).toBe(def);
      });
      var a = make({ 'settings.v1': { char: 'nobody', difficulty: 'hard', seenHowTo: true } }).ctl.loadSettings();
      expect(a.char).toBe('mametchi');
      expect(a.difficulty).toBe('hard');
      expect(a.seenHowTo).toBe(true);
      var b = make({ 'settings.v1': { char: 'mimitchi', difficulty: 'insane', seenHowTo: 'yes' } }).ctl.loadSettings();
      expect(b.char).toBe('mimitchi');
      expect(b.difficulty).toBe('easy');
      expect(b.seenHowTo).toBe(false);
      [undefined, 'x', { easy: -1 }, { easy: '7' }, [5], { easy: 0 }, { easy: Infinity }, { easy: NaN }].forEach(function (bad) {
        expect(make(bad === undefined ? {} : { 'time.v1': bad }).ctl.bestTimeOf('easy')).toBe(0);
      });
      expect(make({ 'time.v1': { easy: 83 } }).ctl.bestTimeOf('easy')).toBe(83);
      expect(Ctl.TIME_KEY).toBe('time.v1');
    });
    it('how-to is shown once', function () {
      var t = make();
      expect(t.ctl.needsHowTo()).toBe(true);
      t.ctl.markHowToSeen();
      expect(t.ctl.needsHowTo()).toBe(false);
      expect(t.storage.m['settings.v1'].seenHowTo).toBe(true);
    });
    it('start saves the settings', function () {
      var t = make();
      var s = { char: 'flowertchi', difficulty: 'normal', seenHowTo: true };
      t.ctl.start(s);
      expect(JSON.stringify(t.storage.m['settings.v1'])).toBe(JSON.stringify(s));
      expect(t.ctl.game().difficulty).toBe('normal');
      expect(t.ctl.game().sleepers).toBe(6);
    });
    it('danger is emitted only on change', function () {
      var t = make();
      toPlaying(t);
      var g = t.ctl.game();
      t.ctl.advance(STEP);
      var base = count(t.log, 'danger');
      g.board[2][2] = { kind: 'ball', charId: 'x' };
      t.ctl.advance(STEP);
      t.ctl.advance(STEP);
      expect(count(t.log, 'danger')).toBe(base + 1);
      var ds = t.log.filter(function (e) { return e.name === 'danger'; });
      expect(ds[ds.length - 1].p.on).toBe(true);
      g.board[2][2] = null;
      t.ctl.advance(STEP);
      t.ctl.advance(STEP);
      expect(count(t.log, 'danger')).toBe(base + 2);
      ds = t.log.filter(function (e) { return e.name === 'danger'; });
      expect(ds[ds.length - 1].p.on).toBe(false);
    });
  });
})(Ailand);
