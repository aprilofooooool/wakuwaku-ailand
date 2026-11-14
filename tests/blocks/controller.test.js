(function (A) {
  'use strict';
  var describe = A.Test.describe, it = A.Test.it, expect = A.Test.expect;
  var Ctl = A.games.blocks.Controller;
  var STEP = 1000 / 60;
  var SET = { char: 'mametchi', difficulty: 'easy', mode: 'collect', seenHowTo: false };
  var CH = { char: 'mametchi', difficulty: 'easy', mode: 'challenge', seenHowTo: false };

  function fakeStorage(init) {
    var m = init || {};
    return {
      m: m,
      get: function (k, fb) { return Object.prototype.hasOwnProperty.call(m, k) ? m[k] : fb; },
      set: function (k, v) { m[k] = v; },
      remove: function (k) { delete m[k]; },
      has: function (k) { return Object.prototype.hasOwnProperty.call(m, k); }
    };
  }
  var NAMES = ['count', 'go', 'spawn', 'moved', 'lock', 'clear', 'collapse', 'goal', 'over', 'danger', 'result'];
  function make(init) {
    var bus = A.core.EventBus.create(), log = [], storage = fakeStorage(init);
    NAMES.forEach(function (n) { bus.on(n, function (p) { log.push({ name: n, p: p }); }); });
    var ctl = Ctl.create({ bus: bus, storage: storage, seed: function () { return 7; } });
    return { ctl: ctl, log: log, storage: storage };
  }
  function names(log) { return log.map(function (e) { return e.name; }); }
  function count(log, n) { return names(log).filter(function (x) { return x === n; }).length; }
  function toPlaying(t) {
    t.ctl.start(SET);
    while (t.ctl.phase() === 'countdown') { t.ctl.advance(STEP); }
  }
  // Puts an O piece at x=4 (cells x+1, x+2) so hold tests are deterministic.
  function setO(t) {
    var g = t.ctl.game();
    g.piece = { shape: 'O', charId: g.piece.charId, x: 4, y: 0, rot: 0 };
  }

  describe('blocks/Controller', function () {
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
      expect(t.log[ns.indexOf('spawn')].p.shape).toBe(t.ctl.game().piece.shape);
    });
    it('holding left repeats after 170ms every 50ms', function () {
      var t = make();
      toPlaying(t);
      setO(t);
      var g = t.ctl.game();
      expect(t.ctl.press('left')).toBe(true);
      expect(g.piece.x).toBe(3);
      t.ctl.advance(169);
      expect(g.piece.x).toBe(3);
      t.ctl.advance(1);
      expect(g.piece.x).toBe(2);
      t.ctl.advance(49);
      expect(g.piece.x).toBe(2);
      t.ctl.advance(1);
      expect(g.piece.x).toBe(1);
      t.ctl.release('left');
      t.ctl.advance(500);
      expect(g.piece.x).toBe(1);
      t.ctl.release('left');
      expect(count(t.log, 'moved')).toBe(3);
    });
    it('most recently pressed horizontal wins', function () {
      var t = make();
      toPlaying(t);
      setO(t);
      var g = t.ctl.game();
      t.ctl.press('left');
      t.ctl.press('right');
      expect(g.piece.x).toBe(4);
      t.ctl.advance(170);
      expect(g.piece.x).toBe(5);
    });
    it('soft drop repeats every 50ms while held', function () {
      var t = make();
      toPlaying(t);
      var g = t.ctl.game();
      var y0 = g.piece.y;
      t.ctl.press('soft');
      expect(g.piece.y).toBe(y0 + 1);
      t.ctl.advance(49);
      expect(g.piece.y).toBe(y0 + 1);
      t.ctl.advance(1);
      expect(g.piece.y).toBe(y0 + 2);
      t.ctl.advance(50);
      expect(g.piece.y).toBe(y0 + 3);
      t.ctl.release('soft');
      t.ctl.advance(100);
      expect(g.piece.y).toBe(y0 + 3);
    });
    it('pause releases held buttons', function () {
      var t = make();
      toPlaying(t);
      setO(t);
      var g = t.ctl.game();
      t.ctl.press('left');
      t.ctl.pause('hidden');
      expect(t.ctl.isPaused()).toBe(true);
      var y = g.piece.y;
      t.ctl.advance(5000);
      expect(g.piece.y).toBe(y);
      expect(g.piece.x).toBe(3);
      expect(t.ctl.press('left')).toBe(false);
      t.ctl.resume();
      t.ctl.advance(1000);
      expect(g.piece.x).toBe(3);
    });
    it('press is refused outside playing', function () {
      var t = make();
      t.ctl.start(SET);
      expect(t.ctl.press('left')).toBe(false);
      t.ctl.release('left');
    });
    it('goal and over end with a result', function () {
      var t = make();
      toPlaying(t);
      var g = t.ctl.game();
      for (var r = 20; r < 22; r++) {
        for (var c = 0; c < 10; c++) { if (c !== 4 && c !== 5) { g.board[r][c] = { charId: 'mametchi' }; } }
      }
      g.goal = 1;
      g.piece = { shape: 'O', charId: 'mametchi', x: 3, y: 0, rot: 0 };
      t.ctl.press('hard');
      expect(t.ctl.phase()).toBe('playing');
      t.ctl.advance(300);
      expect(t.ctl.phase()).toBe('result');
      var res = t.log.filter(function (e) { return e.name === 'result'; })[0].p;
      expect(res.cleared).toBe(true);
      expect(res.goal).toBe(1);
      expect(res.char).toBe('mametchi');
      expect(count(t.log, 'goal')).toBe(1);

      var o = make();
      toPlaying(o);
      var h = o.ctl.game();
      h.board[2][4] = { charId: 'x' };
      h.board[2][5] = { charId: 'x' };
      h.piece = { shape: 'O', charId: 'mametchi', x: 3, y: 0, rot: 0 };
      o.ctl.press('hard');
      expect(o.ctl.phase()).toBe('result');
      expect(o.log[o.log.length - 1].p.cleared).toBe(false);
      expect(count(o.log, 'over')).toBe(1);
      expect(o.ctl.press('left')).toBe(false);
    });
    it('again starts fresh: held keys, danger and result are reset', function () {
      var t = make();
      toPlaying(t);
      var g = t.ctl.game();
      g.board[5][0] = { charId: 'x' };
      t.ctl.advance(STEP);
      expect(count(t.log, 'danger')).toBe(1);
      g.board[2][4] = { charId: 'x' };
      g.board[2][5] = { charId: 'x' };
      g.piece = { shape: 'O', charId: 'mametchi', x: 3, y: 0, rot: 0 };
      t.ctl.press('hard');
      expect(t.ctl.phase()).toBe('result');
      t.ctl.start(SET);
      expect(t.ctl.phase()).toBe('countdown');
      var r = t.ctl.getResult();
      expect(r.cleared).toBe(false);
      expect(r.collected).toBe(0);
      expect(r.jar).toBe(0);
      while (t.ctl.phase() === 'countdown') { t.ctl.advance(STEP); }
      setO(t);
      t.ctl.press('left');
      t.ctl.start(SET);   // a held button from the last round must not repeat in the new one
      while (t.ctl.phase() === 'countdown') { t.ctl.advance(STEP); }
      setO(t);
      var x0 = t.ctl.game().piece.x;
      t.ctl.advance(300);
      expect(t.ctl.game().piece.x).toBe(x0);
      // the new board is empty: no danger change is emitted (the old "on" state was dropped)
      expect(count(t.log, 'danger')).toBe(1);
    });
    it('danger is emitted only on change', function () {
      var t = make();
      toPlaying(t);
      var g = t.ctl.game();
      t.ctl.advance(STEP);
      expect(count(t.log, 'danger')).toBe(0);
      g.board[5][0] = { charId: 'x' };
      t.ctl.advance(STEP);
      t.ctl.advance(STEP);
      expect(count(t.log, 'danger')).toBe(1);
      expect(t.log.filter(function (e) { return e.name === 'danger'; })[0].p.on).toBe(true);
      g.board[5][0] = null;
      t.ctl.advance(STEP);
      t.ctl.advance(STEP);
      expect(count(t.log, 'danger')).toBe(2);
      expect(t.log.filter(function (e) { return e.name === 'danger'; })[1].p.on).toBe(false);
    });
    it('broken settings fall back per field', function () {
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
      var s = { char: 'flowertchi', difficulty: 'normal', mode: 'collect', seenHowTo: true };
      t.ctl.start(s);
      expect(JSON.stringify(t.storage.m['settings.v1'])).toBe(JSON.stringify(s));
      expect(t.ctl.game().selfId).toBe('flowertchi');
      expect(t.ctl.game().goal).toBe(30);
    });
    it('time does not run during the countdown or while paused, and timeup shows in the result', function () {
      var t = make();
      t.ctl.start(SET);
      t.ctl.advance(STEP);
      expect(t.ctl.game().timeMs).toBe(180000);
      while (t.ctl.phase() === 'countdown') { t.ctl.advance(STEP); }
      t.ctl.pause('menu');
      t.ctl.advance(5000);
      expect(t.ctl.game().timeMs).toBe(180000);
      t.ctl.resume();
      t.ctl.game().timeMs = 100;
      t.ctl.advance(200);
      expect(t.ctl.phase()).toBe('result');
      var res = t.ctl.getResult();
      expect(res.cleared).toBe(false);
      expect(res.timeup).toBe(true);
    });
    function challengeStart(best) {
      var init = best === undefined ? {} : { 'best.v1': best };
      var t = make(init);
      t.ctl.start(CH);
      while (t.ctl.phase() === 'countdown') { t.ctl.advance(STEP); }
      return t;
    }
    // Clears one row holding own faces with collected pre-set to 2, so collected becomes > 2.
    function collectSome(t) {
      var g = t.ctl.game();
      g.collected = 2;
      for (var c = 0; c < 10; c++) { if (c !== 4 && c !== 5) { g.board[21][c] = { charId: 'mametchi' }; } }
      g.piece = { shape: 'O', charId: 'mametchi', x: 3, y: 0, rot: 0 };
      t.ctl.press('hard');
      t.ctl.advance(300);
    }
    function blockEnd(t) {
      var g = t.ctl.game();
      g.board[2][4] = { charId: 'x' };
      g.board[2][5] = { charId: 'x' };
      g.piece = { shape: 'O', charId: 'mametchi', x: 3, y: 0, rot: 0 };
      t.ctl.press('hard');
    }
    it('mode setting loads, falls back and saves', function () {
      expect(make().ctl.loadSettings().mode).toBe('collect');
      expect(make({ 'settings.v1': { mode: 'x' } }).ctl.loadSettings().mode).toBe('collect');
      var t = make();
      t.ctl.start(CH);
      expect(t.storage.m['settings.v1'].mode).toBe('challenge');
      expect(t.ctl.game().mode).toBe('challenge');
    });
    it('bestOf reads safely', function () {
      [undefined, 'x', { easy: -3 }, { easy: '7' }].forEach(function (b) {
        expect(make(b === undefined ? {} : { 'best.v1': b }).ctl.bestOf('easy')).toBe(0);
      });
      expect(make({ 'best.v1': { easy: 7 } }).ctl.bestOf('easy')).toBe(7);
      expect(Ctl.BEST_KEY).toBe('best.v1');
    });
    it('challenge saves a new best on the fly and keeps other difficulties', function () {
      var t = challengeStart({ easy: 2, normal: 9, hard: 4 });
      collectSome(t);
      var g = t.ctl.game();
      expect(g.collected > 2).toBe(true);
      expect(t.ctl.phase()).toBe('playing');
      var b = t.storage.m['best.v1'];
      expect(b.easy).toBe(g.collected);
      expect(b.normal).toBe(9);
      expect(b.hard).toBe(4);
      t.ctl.quit();
      expect(t.storage.m['best.v1'].easy).toBe(g.collected);
    });
    it('challenge result compares with the best at round start', function () {
      var t = challengeStart({ easy: 2 });
      collectSome(t);
      var c = t.ctl.game().collected;
      blockEnd(t);
      var r = t.ctl.getResult();
      expect(r.mode).toBe('challenge');
      expect(r.newRecord).toBe(true);
      expect(r.best).toBe(c);
      expect(r.cleared).toBe(false);
      expect(r.timeup).toBe(false);
      var u = challengeStart({ easy: 99 });
      collectSome(u);
      blockEnd(u);
      var q = u.ctl.getResult();
      expect(q.newRecord).toBe(false);
      expect(q.best).toBe(99);
      expect(u.storage.m['best.v1'].easy).toBe(99);
    });
    it('challenge newRecord needs at least 1 collected', function () {
      var t = challengeStart();
      var g = t.ctl.game();
      g.collected = 1;
      blockEnd(t);
      expect(t.ctl.getResult().newRecord).toBe(true);
      var u = challengeStart();
      blockEnd(u);
      expect(u.ctl.getResult().newRecord).toBe(false);
      expect(u.ctl.getResult().best).toBe(0);
    });
    it('again in challenge passes the saved best to the engine', function () {
      var t = challengeStart({ easy: 2 });
      collectSome(t);
      var c = t.ctl.game().collected;
      blockEnd(t);
      t.ctl.start(CH);
      expect(t.ctl.game().best).toBe(c);
    });
    it('collect mode never writes best.v1; result has mode fields', function () {
      var t = make();
      toPlaying(t);
      var g = t.ctl.game();
      g.collected = 5;
      blockEnd(t);
      expect(t.storage.has('best.v1')).toBe(false);
      var r = t.ctl.getResult();
      expect(r.mode).toBe('collect');
      expect(r.best).toBe(0);
      expect(r.newRecord).toBe(false);
      var n = make();
      expect(n.ctl.getResult().mode).toBe('collect');
      expect(n.ctl.getResult().newRecord).toBe(false);
    });
  });
})(Ailand);
