(function (A) {
  'use strict';
  var describe = A.Test.describe, it = A.Test.it, expect = A.Test.expect;
  var F = A.games.fill, Ctl = F.Controller;

  function pick(id) { return F.Pictures.filter(function (p) { return p.id === id; })[0]; }
  // easy 2 (apple, strawberry), normal 1 (cat)
  var PICS = [pick('apple'), pick('strawberry'), pick('cat')];

  function fakeStorage(init) {
    var m = init || {};
    return {
      m: m,
      get: function (k, fb) { return Object.prototype.hasOwnProperty.call(m, k) ? m[k] : fb; },
      set: function (k, v) { m[k] = v; }
    };
  }
  function make(init) {
    var bus = A.core.EventBus.create(), log = [], storage = fakeStorage(init);
    ['start', 'placed', 'returned', 'turned', 'last', 'clear', 'hint', 'done'].forEach(function (n) {
      bus.on(n, function (p) { log.push({ name: n, p: p }); });
    });
    var ctl = Ctl.create({ bus: bus, storage: storage, seed: function () { return 7; }, pictures: PICS });
    return { ctl: ctl, log: log, storage: storage };
  }
  function names(log) { return log.map(function (e) { return e.name; }); }
  function key(cells) { return JSON.stringify(cells.slice().sort()); }
  // Turns a piece until its shape matches the answer shape, then drops it on the answer.
  function solveOne(ctl, id) {
    var p = ctl.puzzle().pieces.filter(function (q) { return q.id === id; })[0], e = ctl.engine(), n = 0;
    while (key(F.Piece.normalize(e.shape(id))) !== key(F.Piece.normalize(p.cells)) && n < 8) {
      ctl.turn(id, n === 3 ? 'flip' : 'rotate');
      n++;
    }
    ctl.drop(id, p.answer.x, p.answer.y);
  }
  function solveAll(ctl) {
    ctl.puzzle().pieces.forEach(function (p) { solveOne(ctl, p.id); });
  }
  function clearIt(t, id, withHint) {
    t.ctl.start(id);
    if (withHint) { t.ctl.hint(function () { return 0; }); }
    solveAll(t.ctl);
  }

  describe('fill controller', function () {
    it('clear saves done and sparkle', function () {
      var t = make();
      clearIt(t, 'apple', false);
      expect(t.ctl.phase()).toBe('done');
      expect(t.ctl.zukan().apple.done).toBe(true);
      expect(t.ctl.zukan().apple.sparkle).toBe(true);
      expect(t.ctl.result.sparkleNew).toBe(true);
      expect(names(t.log).indexOf('done') >= 0).toBe(true);
      var h = make();
      clearIt(h, 'apple', true);
      expect(h.ctl.zukan().apple.done).toBe(true);
      expect(h.ctl.zukan().apple.sparkle).toBe(false);
      expect(h.ctl.result.sparkleNew).toBe(false);
    });

    it('sparkle never goes away', function () {
      var t = make({ 'zukan.v1': { apple: { done: true, sparkle: true } } });
      clearIt(t, 'apple', true);
      expect(t.ctl.zukan().apple.sparkle).toBe(true);
      expect(t.ctl.result.sparkleNew).toBe(false);
    });

    it('broken zukan falls back', function () {
      ['oops', [1, 2], 5].forEach(function (bad) {
        var t = make({ 'zukan.v1': bad });
        expect(Object.keys(t.ctl.zukan()).length).toBe(0);
        expect(t.ctl.doneCount('easy')).toBe(0);
      });
      var t2 = make({ 'zukan.v1': { nope: { done: true }, apple: { done: 'yes' }, strawberry: { done: true, sparkle: 'x' }, cat: null } });
      var z = t2.ctl.zukan();
      expect(Object.keys(z).join(',')).toBe('strawberry');
      expect(z.strawberry.sparkle).toBe(false);
      expect(t2.ctl.listOf('easy').length).toBe(2);
    });

    it('broken settings fall back per field', function () {
      var t = make({ 'settings.v1': { char: 'zzz', tab: 'huge', seenHowTo: 'yes' } });
      var s = t.ctl.loadSettings();
      expect(s.char).toBe('mametchi');
      expect(s.tab).toBe('easy');
      expect(s.seenHowTo).toBe(false);
      var t2 = make({ 'settings.v1': { char: 'mimitchi', tab: 'normal', seenHowTo: true } });
      expect(t2.ctl.loadSettings().char).toBe('mimitchi');
      expect(t2.ctl.loadSettings().tab).toBe('normal');
      expect(t2.ctl.loadSettings().seenHowTo).toBe(true);
      expect(make({ 'settings.v1': 'x' }).ctl.loadSettings().char).toBe('mametchi');
    });

    it('how-to is shown once', function () {
      var t = make();
      expect(t.ctl.needsHowTo()).toBe(true);
      t.ctl.markHowToSeen();
      expect(t.ctl.needsHowTo()).toBe(false);
      expect(t.storage.m['settings.v1'].seenHowTo).toBe(true);
    });

    it('restart clears the hint mark', function () {
      var t = make();
      t.ctl.start('apple');
      t.ctl.hint(function () { return 0; });
      expect(t.ctl.engine().hintUsed()).toBe(true);
      t.ctl.restart();
      expect(t.ctl.engine().hintUsed()).toBe(false);
      expect(t.ctl.phase()).toBe('play');
    });

    it('quit confirm only when a piece is on the board', function () {
      var t = make();
      t.ctl.start('apple');
      expect(t.ctl.needsQuitConfirm()).toBe(false);
      solveOne(t.ctl, 'p0');
      expect(t.ctl.needsQuitConfirm()).toBe(true);
      t.ctl.toTray('p0');
      expect(t.ctl.needsQuitConfirm()).toBe(false);
      t.ctl.quit();
      expect(t.ctl.phase()).toBe('zukan');
    });

    it('hint does nothing outside play', function () {
      var t = make();
      expect(t.ctl.hint(function () { return 0; })).toBe(null);
      clearIt(t, 'apple', false);
      expect(t.ctl.hint(function () { return 0; })).toBe(null);
      expect(t.ctl.drop('p0', 0, 0).length).toBe(0);
    });

    it('next picture order', function () {
      var t = make();
      expect(t.ctl.nextPictureId('apple')).toBe('strawberry');
      expect(t.ctl.nextPictureId('strawberry')).toBe('apple');
      var u = make({ 'zukan.v1': { strawberry: { done: true, sparkle: false } } });
      expect(u.ctl.nextPictureId('apple')).toBe('strawberry');
      expect(u.ctl.nextPictureId('strawberry')).toBe('apple');
      var w = make({ 'zukan.v1': { apple: { done: true, sparkle: false }, strawberry: { done: true, sparkle: false } } });
      expect(w.ctl.nextPictureId('apple')).toBe('strawberry');
      expect(w.ctl.nextPictureId('strawberry')).toBe('apple');
    });

    it('pageDone only on the first full page', function () {
      var t = make();
      clearIt(t, 'apple', false);
      expect(t.ctl.result.pageDone).toBe(false);
      clearIt(t, 'strawberry', false);
      expect(t.ctl.result.pageDone).toBe(true);
      clearIt(t, 'strawberry', false);
      expect(t.ctl.result.pageDone).toBe(false);
    });
  });
})(Ailand);
