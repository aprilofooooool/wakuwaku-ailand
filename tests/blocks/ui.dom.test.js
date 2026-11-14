(function (A) {
  'use strict';
  // Browser only: builds the blocks UI in a fixed box and drives the buttons with real Pointer Events.
  var describe = A.Test.describe, it = A.Test.it, expect = A.Test.expect;
  var B = A.games.blocks;
  var STEP = A.core.Loop.STEP_MS;

  // extra (optional): { mode, best, time } — the saved mode, the saved best.v2 object and the saved time.v1 object.
  function fakeStorage(seen, difficulty, extra) {
    var m = {};
    if (seen) { m[B.Controller.SETTINGS_KEY] = { char: 'mametchi', difficulty: difficulty || 'easy', seenHowTo: true }; }
    if (seen && extra && extra.mode) { m[B.Controller.SETTINGS_KEY].mode = extra.mode; }
    if (extra && extra.best) { m[B.Controller.BEST_KEY] = extra.best; }
    if (extra && extra.time) { m[B.Controller.TIME_KEY] = extra.time; }
    return {
      get: function (k, fb) { return Object.prototype.hasOwnProperty.call(m, k) ? m[k] : fb; },
      set: function (k, v) { m[k] = v; },
      remove: function (k) { delete m[k]; },
      has: function (k) { return Object.prototype.hasOwnProperty.call(m, k); }
    };
  }
  function fakeLoop() {
    var on = false;
    return { start: function () { on = true; }, stop: function () { on = false; }, isRunning: function () { return on; } };
  }

  function make(withLines, difficulty, extra) {
    var box = document.createElement('div');
    box.style.cssText = 'position:fixed;left:0;top:0;width:1024px;height:700px;z-index:9999;background:#fff';
    document.body.appendChild(box);
    var bus = A.core.EventBus.create();
    var controller = B.Controller.create({ bus: bus, storage: fakeStorage(true, difficulty, extra), seed: function () { return 7; } });
    var deps = { bus: bus, loop: fakeLoop(), rng: function () { return 0.5; } };
    if (withLines) { deps.linePicker = A.core.LinePicker.create({ gameLines: B.Lines, commonLines: A.core.CommonLines, rng: function () { return 0; } }); }
    var ui = B.UI.init(box, controller, deps);
    return {
      box: box, bus: bus, controller: controller, ui: ui,
      done: function () { ui.destroy(); box.remove(); }
    };
  }
  function buttonByText(root, text) {
    return Array.prototype.filter.call(root.querySelectorAll('button'), function (b) { return b.textContent.trim() === text; })[0];
  }
  function run(t, ms) { for (var s = 0; s < ms; s += STEP) { t.controller.advance(STEP); } }
  // Like the real loop: advance, then ui.step. The piece is held at the top so nothing locks.
  function runUi(t, ms) {
    var g = t.controller.game(), y0 = g.piece.y;
    for (var s = 0; s < ms; s += STEP) { g.piece.y = y0; t.controller.advance(STEP); t.ui.step(STEP); }
  }
  // Starts a round and runs the 3-2-1 countdown.
  function play(t) {
    buttonByText(t.box, 'はじめる').click();
    var ms = 0;
    while (ms < 5000 && t.controller.phase() !== 'playing') { t.controller.advance(STEP); ms += STEP; }
    expect(t.controller.phase()).toBe('playing');
  }
  function pad(t, action) { return t.box.querySelector('.bl-pad button[data-action="' + action + '"]'); }
  function ptr(el, type, id) {
    var r = el.getBoundingClientRect();
    el.dispatchEvent(new PointerEvent(type, {
      bubbles: type !== 'pointerleave', pointerId: id, pointerType: 'touch', isPrimary: id === 1,
      clientX: r.left + r.width / 2, clientY: r.top + r.height / 2
    }));
  }
  function x(t) { return t.controller.game().piece.x; }
  function key(type, k) { document.dispatchEvent(new KeyboardEvent(type, { key: k, bubbles: true })); }
  // One clear on the bottom row: `mine` of the 6 side cells are mametchi (the chosen character), an I piece fills the rest.
  function setupClear(t, mine) {
    var g = t.controller.game();
    g.board.forEach(function (row) { for (var c = 0; c < B.Constants.COLS; c++) { row[c] = null; } });
    [0, 1, 2, 7, 8, 9].forEach(function (c, i) { g.board[21][c] = { charId: i < mine ? 'mametchi' : 'kuchipatchi' }; });
    g.piece = { shape: 'I', charId: 'kuchipatchi', x: 3, y: 0, rot: 0 };
    return g;
  }
  // Replaces Fx.fly: records each landing callback instead of flying. Returns { lands, restore }.
  function holdFlights() {
    var fly = B.Fx.fly, lands = [];
    B.Fx.fly = function (from, to, pf, size, o) { lands.push(o.onLand); return null; };
    return { lands: lands, restore: function () { B.Fx.fly = fly; } };
  }
  function boxOf(el) { return el.getBoundingClientRect(); }
  function overlaps(a, b) { return a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom; }
  function wait(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }
  // The text of the bubble line on screen (not the one fading out).
  function bubbleText(t) {
    var lines = t.box.querySelectorAll('.bl-say .fx-bubble-line:not(.fx-out) .fx-bubble-text');
    return lines.length ? lines[lines.length - 1].textContent : '';
  }
  // Replaces Fx.showBanner: records the banner texts. Returns { texts, restore }.
  function holdBanners() {
    var show = B.Fx.showBanner, texts = [];
    B.Fx.showBanner = function (text) { texts.push(text); };
    return { texts: texts, restore: function () { B.Fx.showBanner = show; } };
  }
  function challengeResult(o) {
    var r = { cleared: false, timeup: false, collected: 0, goal: null, jar: 3, char: 'mametchi', mode: 'challenge', best: 0, newRecord: false };
    Object.keys(o).forEach(function (k) { r[k] = o[k]; });
    r.type = 'result';
    return r;
  }
  function collectResult(o) {
    var r = { cleared: true, timeup: false, collected: 15, goal: 15, jar: 3, char: 'mametchi', mode: 'collect', best: 0, newRecord: false,
      timeSec: 83, bestTime: 83, newTime: false };
    Object.keys(o).forEach(function (k) { r[k] = o[k]; });
    r.type = 'result';
    return r;
  }
  // Loads the real game page in a w x h iframe, starts a round (how-to skipped, saved settings restored after) and calls check(doc).
  function inFrame(w, h, check) {
    var frame = document.createElement('iframe');
    frame.style.cssText = 'position:fixed;left:0;top:0;width:' + w + 'px;height:' + h + 'px;border:0;z-index:9999;background:#fff';
    var saved = null, store = null;
    function cleanup() {
      if (store) { if (saved === null) { store.remove(B.Controller.SETTINGS_KEY); } else { store.set(B.Controller.SETTINGS_KEY, saved); } }
      frame.remove();
    }
    return new Promise(function (resolve, reject) {
      frame.onload = function () {
        try {
          var doc = frame.contentDocument;
          store = frame.contentWindow.Ailand.core.Storage.create('blocks');
          saved = store.get(B.Controller.SETTINGS_KEY, null);
          store.set(B.Controller.SETTINGS_KEY, { char: 'mametchi', difficulty: 'easy', seenHowTo: true });
          Array.prototype.filter.call(doc.querySelectorAll('button'), function (b) { return b.textContent.trim() === 'はじめる'; })[0].click();
          setTimeout(function () { try { check(doc); resolve(); } catch (e) { reject(e); } }, 300);
        } catch (e) { reject(e); }
      };
      frame.src = '../games/blocks/index.html';
      document.body.appendChild(frame);
    }).then(cleanup, function (e) { cleanup(); throw e; });
  }
  // No scroll, pads >= 64px and on screen, the board on screen and big enough, and the start bubble off the board.
  function checkPlayScreen(doc, minCell) {
    var de = doc.documentElement;
    expect(doc.getElementById('screen-game').hidden).toBe(false);
    expect(de.scrollHeight <= de.clientHeight).toBe(true);
    expect(de.scrollWidth <= de.clientWidth).toBe(true);
    Array.prototype.forEach.call(doc.querySelectorAll('.bl-pad button'), function (b) {
      var r = b.getBoundingClientRect();
      expect(r.width >= 64 && r.height >= 64).toBe(true);
      expect(r.bottom <= de.clientHeight && r.right <= de.clientWidth).toBe(true);
    });
    var c = boxOf(doc.querySelector('.bl-board'));
    expect(c.bottom <= de.clientHeight && c.right <= de.clientWidth).toBe(true);
    expect(c.width / B.Constants.COLS >= minCell).toBe(true);
    var bubble = doc.querySelector('.bl-say .fx-bubble');
    expect(!!bubble).toBe(true);   // the start line is showing
    expect(overlaps(boxOf(bubble), c)).toBe(false);
  }

  describe('blocks UI (browser)', function () {
    it('settings screen shows characters, difficulty and start', function () {
      var t = make();
      try {
        var s = t.box.querySelector('.bl-settings-screen');
        expect(s.querySelectorAll('.bl-charbtn').length).toBe(4);
        expect(s.querySelectorAll('.bl-level').length).toBe(3);
        ['かんたん', 'ふつう', 'むずかしい'].forEach(function (label, i) {
          expect(s.querySelectorAll('.bl-level')[i].textContent.indexOf(label)).toBe(0);
        });
        expect(!!buttonByText(s, 'はじめる')).toBe(true);
        expect(!!buttonByText(s, 'あそびかた')).toBe(true);
        Array.prototype.forEach.call(s.querySelectorAll('button'), function (b) {
          var r = b.getBoundingClientRect();
          expect(r.width >= 64 && r.height >= 64).toBe(true);
        });
      } finally { t.done(); }
    });

    it('pad buttons run ← ↓ hard ↻ → left to right', function () {
      var t = make();
      try {
        play(t);
        var acts = Array.prototype.map.call(t.box.querySelectorAll('.bl-pad button'), function (b) { return b.getAttribute('data-action'); });
        expect(acts.join(',')).toBe('left,soft,hard,rotate,right');
      } finally { t.done(); }
    });

    it('holding the left button moves the piece and release stops it', function () {
      var t = make();
      try {
        play(t);
        var left = pad(t, 'left');
        expect(getComputedStyle(left).touchAction).toBe('none');
        var x0 = x(t);
        ptr(left, 'pointerdown', 1);
        expect(x(t)).toBe(x0 - 1);
        run(t, 190);   // first repeat after 170 ms
        expect(x(t)).toBe(x0 - 2);
        ptr(left, 'pointerup', 1);
        run(t, 300);
        expect(x(t)).toBe(x0 - 2);
      } finally { t.done(); }
    });

    it('repeat stops on pointercancel and leave', function () {
      var t = make();
      try {
        play(t);
        var right = pad(t, 'right');
        var x0 = x(t);
        ptr(right, 'pointerdown', 1);
        ptr(right, 'pointercancel', 1);
        run(t, 300);
        expect(x(t)).toBe(x0 + 1);
        ptr(right, 'pointerdown', 3);
        ptr(right, 'pointerleave', 3);
        run(t, 300);
        expect(x(t)).toBe(x0 + 2);
      } finally { t.done(); }
    });

    it('two fingers: hold left and tap rotate', function () {
      var t = make();
      try {
        play(t);
        var left = pad(t, 'left'), rot = pad(t, 'rotate');
        var x0 = x(t), r0 = t.controller.game().piece.rot;
        ptr(left, 'pointerdown', 1);
        ptr(rot, 'pointerdown', 2);
        ptr(rot, 'pointerup', 2);   // the second finger lifts; the first stays down
        expect(t.controller.game().piece.rot).toBe((r0 + 1) % 4);
        var x1 = x(t);
        expect(x1 <= x0 - 1).toBe(true);
        run(t, 190);
        expect(x(t)).toBe(x1 - 1);
        ptr(left, 'pointerup', 1);
      } finally { t.done(); }
    });

    it('fits 390x844 without scrolling', function () {
      return inFrame(390, 844, function (doc) { checkPlayScreen(doc, 20); });
    });

    it('fits 844x390 without scrolling', function () {
      return inFrame(844, 390, function (doc) { checkPlayScreen(doc, 12); });
    });

    it('window blur stops a key held down', function () {
      var t = make();
      try {
        play(t);
        var x0 = x(t);
        key('keydown', 'ArrowLeft');
        expect(x(t)).toBe(x0 - 1);
        window.dispatchEvent(new Event('blur'));
        run(t, 300);
        expect(x(t)).toBe(x0 - 1);
        key('keyup', 'ArrowLeft');
      } finally { t.done(); }
    });

    it('a key up does not stop a finger holding the same button', function () {
      var t = make();
      try {
        play(t);
        var left = pad(t, 'left');
        var x0 = x(t);
        ptr(left, 'pointerdown', 1);
        key('keyup', 'ArrowLeft');   // not held by the keyboard: the finger keeps repeating
        run(t, 190);
        expect(x(t)).toBe(x0 - 2);
        ptr(left, 'pointerup', 1);
      } finally { t.done(); }
    });

    it('a face landing after the result does not change the counts', function () {
      var t = make(), fl = holdFlights();
      return Promise.resolve().then(function () {
        play(t);
        var g = setupClear(t, 1);
        g.goal = 1;
        t.controller.press('hard');
        expect(fl.lands.length).toBe(10);
        run(t, 300);
        expect(t.controller.phase()).toBe('result');
        return wait(1100);   // the result waits at most 1 s for flying faces
      }).then(function () {
        expect(!!t.box.querySelector('.bl-result')).toBe(true);
        var star = t.box.querySelector('.bl-starcount').textContent, jar = t.box.querySelector('.bl-jarcount').textContent;
        fl.lands.forEach(function (f) { f(); });
        expect(t.box.querySelector('.bl-starcount').textContent).toBe(star);
        expect(t.box.querySelector('.bl-jarcount').textContent).toBe(jar);
        expect(t.box.querySelectorAll('.bl-mini').length).toBe(0);
      }).then(function () { fl.restore(); t.done(); }, function (e) { fl.restore(); t.done(); throw e; });
    });

    it('the almost line replaces a bubble that is still showing', function () {
      var t = make(true), fl = holdFlights();
      try {
        play(t);   // the start line is still up (2 s)
        var say = t.box.querySelector('.bl-say');
        expect(!!say.querySelector('.fx-bubble-line')).toBe(true);
        var g = setupClear(t, 1);
        g.collected = 11;   // easy goal 15: this clear leaves 3
        t.controller.press('hard');
        var lines = say.querySelectorAll('.fx-bubble-line:not(.fx-out) .fx-bubble-text');
        expect(lines.length).toBe(1);
        expect(B.Lines.mametchi.almost.indexOf(lines[0].textContent) >= 0).toBe(true);
      } finally { fl.restore(); t.done(); }
    });

    it('the clock shows the time left in the info column', function () {
      var t = make(false, 'normal');
      try {
        play(t);
        var clock = t.box.querySelector('.bl-info .bl-clock');
        expect(!!clock).toBe(true);
        expect(clock.textContent).toBe('のこり 2:30');
        runUi(t, 61200);   // 61 s and a few steps: 88.8 s left, shown rounded up
        expect(clock.textContent).toBe('のこり 1:29');
      } finally { t.done(); }
    });

    it('the clock hurries under 10 seconds and calms down above', function () {
      var t = make(false, 'normal');
      try {
        play(t);
        var clock = t.box.querySelector('.bl-clock');
        expect(clock.classList.contains('is-hurry')).toBe(false);
        t.controller.game().timeMs = 9000;
        runUi(t, STEP);
        expect(clock.classList.contains('is-hurry')).toBe(true);
        t.controller.game().timeMs = 20000;
        runUi(t, STEP);
        expect(clock.classList.contains('is-hurry')).toBe(false);
      } finally { t.done(); }
    });

    it('the BGM tempo follows hurry, almost and pause', function () {
      var Bgm = A.core.Bgm, Sound = A.core.Sound, S = B.Sounds;
      var start = Bgm.start, stop = Bgm.stop, isOn = Sound.isBgmOn, starts = 0;
      // Like the real start (it resets the tempo to the score's bpm), without sound.
      Bgm.start = function (sc) { starts++; Bgm.setTempo(sc.bpm); };
      Bgm.stop = function () {};
      Sound.isBgmOn = function () { return true; };
      var t = null, fl = holdFlights();
      try {
        t = make(false, 'normal');
        play(t);
        var g = t.controller.game();
        expect(Bgm.getTempo()).toBe(S.BGM.bpm);
        g.timeMs = 9000;
        runUi(t, STEP);
        expect(Bgm.getTempo()).toBe(S.HURRY_BPM);
        g.timeMs = 20000;   // a bonus lifts the clock above 10 s
        runUi(t, STEP);
        expect(Bgm.getTempo()).toBe(S.BGM.bpm);
        // Pause and resume during hurry: the restart comes back at the hurry tempo.
        g.timeMs = 9000;
        runUi(t, STEP);
        t.controller.pause('hidden');
        t.ui.showPause('hidden');
        var n = starts;
        t.box.querySelector('.bl-resume').click();
        expect(starts).toBe(n + 1);
        expect(Bgm.getTempo()).toBe(S.HURRY_BPM);
        // The almost line during hurry keeps the hurry tempo; above 10 s it is the almost tempo.
        setupClear(t, 1);
        g.collected = g.goal - 4;   // this clear leaves 3
        t.controller.press('hard');
        expect(t.box.querySelector('.bl-star').classList.contains('is-almost')).toBe(true);
        expect(Bgm.getTempo()).toBe(S.HURRY_BPM);
        g.timeMs = 20000;
        runUi(t, STEP);
        expect(Bgm.getTempo()).toBe(S.ALMOST_BPM);
      } finally {
        fl.restore();
        if (t) { t.done(); }
        Bgm.start = start;
        Bgm.stop = stop;
        Sound.isBgmOn = isOn;
        Bgm.stop();
      }
    });

    it('the result stops the hurry blink and もういっかい starts with a calm clock', function () {
      var t = make(false, 'normal');
      try {
        play(t);
        t.controller.game().timeMs = 9000;
        runUi(t, STEP);
        expect(t.box.querySelector('.bl-clock').classList.contains('is-hurry')).toBe(true);
        t.controller.game().timeMs = 10;
        runUi(t, STEP);
        expect(t.controller.phase()).toBe('result');
        expect(!!t.box.querySelector('.bl-result')).toBe(true);
        expect(t.box.querySelector('.bl-clock').classList.contains('is-hurry')).toBe(false);
        buttonByText(t.box, 'もういっかい').click();
        var clock = t.box.querySelector('.bl-clock');
        expect(clock.classList.contains('is-hurry')).toBe(false);
        expect(clock.querySelector('.bl-clocktime').textContent).toBe('2:30');
      } finally { t.done(); }
    });

    it('star cells hide while they fly and show again after the collapse', function () {
      var t = make(), fl = holdFlights(), draw = B.Render.draw, hidden = [];
      B.Render.draw = function (ctx, g, o) { hidden.push(o.hideCells.slice()); };
      try {
        play(t);
        var faces = [{ col: 0, row: 21, charId: 'mametchi', mine: true }, { col: 8, row: 20, charId: 'mametchi', mine: true }];
        t.bus.emit('star', { type: 'star', faces: faces, collected: 2, almost: false });
        expect(hidden.length > 0).toBe(true);
        expect(hidden[hidden.length - 1]).toEqual([[0, 21], [8, 20]]);
        expect(fl.lands.length).toBe(2);
        expect(t.box.querySelector('.bl-star').classList.contains('is-almost')).toBe(false);
        t.bus.emit('collapse', { type: 'collapse', cells: [[0, 21], [8, 20]] });
        expect(hidden[hidden.length - 1]).toEqual([]);
        // A star wave that leaves ALMOST or fewer shows the almost frame, as a clear does.
        t.bus.emit('star', { type: 'star', faces: [], collected: 12, almost: true });
        expect(t.box.querySelector('.bl-star').classList.contains('is-almost')).toBe(true);
      } finally { B.Render.draw = draw; fl.restore(); t.done(); }
    });

    it('a time event shows +N next to the clock', function () {
      var t = make();
      try {
        play(t);
        t.bus.emit('time', { type: 'time', addMs: 6000 });
        var add = t.box.querySelector('.bl-timeadd');
        expect(!!add).toBe(true);
        expect(add.textContent).toBe('+6');
      } finally { t.done(); }
    });

    it('time up shows じかんぎれ and a timeup line', function () {
      var t = make(true);
      try {
        play(t);
        t.controller.game().timeMs = 10;
        runUi(t, STEP);
        expect(t.controller.phase()).toBe('result');
        var card = t.box.querySelector('.bl-result');
        expect(!!card).toBe(true);
        expect(card.querySelector('.bl-card-text').textContent).toBe('じかんぎれ');
        expect(B.Lines.mametchi.timeup.indexOf(card.querySelector('.bl-line').textContent) >= 0).toBe(true);
        expect(t.box.querySelector('.bl-clock').textContent).toBe('のこり 0:00');
      } finally { t.done(); }
    });

    it('settings show the goal and the time; the how-to tells about time and stars', function () {
      var t = make();
      try {
        var levels = t.box.querySelectorAll('.bl-level');
        expect(levels[0].textContent.indexOf('15こ あつめよう') >= 0).toBe(true);
        expect(levels[0].textContent.indexOf('3ぷん') >= 0).toBe(true);
        expect(levels[1].textContent.indexOf('2ぷん30びょう') >= 0).toBe(true);
        expect(levels[2].textContent.indexOf('50こ あつめよう') >= 0).toBe(true);
        expect(levels[2].textContent.indexOf('2ぷん') >= 0).toBe(true);
        buttonByText(t.box, 'あそびかた').click();
        var body = document.querySelector('.bl-howto-body');
        expect(!!body).toBe(true);
        expect(body.textContent.indexOf('じかんが なくなると おしまい') >= 0).toBe(true);
        expect(body.textContent.indexOf('ほしの ブロックを けすと') >= 0).toBe(true);
        buttonByText(document.getElementById('modal-root'), 'わかった').click();
      } finally { t.done(); }
    });

    // ---------- きろくチャレンジ (challenge spec 4) ----------

    it('settings: the あそびかた panel switches the level text to the best', function () {
      var t = make(false, 'easy', { best: { easy: 23 } });
      try {
        var s = t.box.querySelector('.bl-settings-screen');
        var titles = Array.prototype.map.call(s.querySelectorAll('.bl-panel h2'), function (h) { return h.textContent; });
        expect(titles.indexOf('あそびかた') >= 0).toBe(true);
        expect(titles.indexOf('あそびかた') < titles.indexOf('むずかしさ')).toBe(true);
        var collect = buttonByText(s, 'かおあつめ'), challenge = buttonByText(s, 'きろくチャレンジ');
        expect(collect.getAttribute('aria-pressed')).toBe('true');
        expect(challenge.getAttribute('aria-pressed')).toBe('false');
        challenge.click();
        s = t.box.querySelector('.bl-settings-screen');
        expect(buttonByText(s, 'きろくチャレンジ').getAttribute('aria-pressed')).toBe('true');
        expect(buttonByText(s, 'かおあつめ').getAttribute('aria-pressed')).toBe('false');
        var levels = s.querySelectorAll('.bl-level');
        expect(levels[0].textContent.indexOf('さいこう 23こ') >= 0).toBe(true);
        expect(levels[1].textContent.indexOf('きろく なし') >= 0).toBe(true);
        expect(levels[2].textContent.indexOf('きろく なし') >= 0).toBe(true);
        Array.prototype.forEach.call(levels, function (lv) { expect(lv.textContent.indexOf('3ぷん') >= 0).toBe(true); });
        expect(levels[0].textContent.indexOf('あつめよう')).toBe(-1);
        Array.prototype.forEach.call(s.querySelectorAll('button'), function (b) {
          var r = b.getBoundingClientRect();
          expect(r.width >= 64 && r.height >= 64).toBe(true);
        });
        buttonByText(s, 'かおあつめ').click();
        expect(t.box.querySelectorAll('.bl-level')[0].textContent.indexOf('15こ あつめよう') >= 0).toBe(true);
      } finally { t.done(); }
    });

    it('how-to in challenge tells about 3 minutes, no extra time and the best', function () {
      var t = make(false, 'easy', { mode: 'challenge' });
      try {
        buttonByText(t.box, 'あそびかた').click();
        var text = document.querySelector('.bl-howto-body').textContent;
        expect(text.indexOf('3ぷん') >= 0).toBe(true);
        expect(text.indexOf('のびない') >= 0).toBe(true);
        expect(text.indexOf('さいこうきろく') >= 0).toBe(true);
        expect(text.indexOf('じかんが なくなると')).toBe(-1);
        buttonByText(document.getElementById('modal-root'), 'わかった').click();
      } finally { t.done(); }
    });

    it('challenge play: the clock starts at 3:00, ★ N without a goal, the best hidden when 0', function () {
      var t = make(false, 'easy', { mode: 'challenge' });
      try {
        play(t);
        expect(t.controller.game().mode).toBe('challenge');
        var clock = t.box.querySelector('.bl-info .bl-clock');
        expect(clock.hidden).toBe(false);
        expect(getComputedStyle(clock).display === 'none').toBe(false);
        expect(clock.textContent).toBe('のこり 3:00');
        expect(t.box.querySelector('.bl-starcount').textContent).toBe('0');
        expect(t.box.querySelector('.bl-star').textContent.indexOf('／')).toBe(-1);
        expect(t.box.querySelector('.bl-best').hidden).toBe(true);
      } finally { t.done(); }
    });

    it('challenge play: the clock hurries under 10 seconds like collect', function () {
      var t = make(false, 'easy', { mode: 'challenge' });
      try {
        play(t);
        var clock = t.box.querySelector('.bl-clock');
        expect(clock.classList.contains('is-hurry')).toBe(false);
        t.controller.game().timeMs = 9000;
        runUi(t, STEP);
        expect(clock.classList.contains('is-hurry')).toBe(true);
        expect(clock.querySelector('.bl-clocktime').textContent).toBe('0:09');
      } finally { t.done(); }
    });

    it('challenge play: a clear of own faces shows no +N', function () {
      var t = make(false, 'easy', { mode: 'challenge' }), fl = holdFlights();
      try {
        play(t);
        setupClear(t, 6);
        t.controller.press('hard');
        expect(t.controller.game().collected > 0).toBe(true);
        runUi(t, STEP * 3);
        expect(t.box.querySelector('.bl-timeadd')).toBe(null);
      } finally { fl.restore(); t.done(); }
    });

    it('challenge play with a best shows さいこう M and follows the score past it', function () {
      var t = make(false, 'easy', { mode: 'challenge', best: { easy: 23 } });
      try {
        play(t);
        var best = t.box.querySelector('.bl-best');
        expect(best.hidden).toBe(false);
        expect(getComputedStyle(best).display === 'none').toBe(false);
        expect(best.textContent).toBe('さいこう 23');
        // The shown score jumps to the final count with the result: the best follows it past 23.
        t.bus.emit('result', challengeResult({ collected: 25, best: 25, newRecord: true }));
        expect(t.box.querySelector('.bl-starcount').textContent).toBe('25');
        expect(best.textContent).toBe('さいこう 25');
      } finally { t.done(); }
    });

    it('record shows the しんきろく！ banner and a record line; via a star only the line', function () {
      var t = make(true, 'easy', { mode: 'challenge', best: { easy: 10 } }), bn = holdBanners();
      var Sound = A.core.Sound, playSound = Sound.play, sounds = [];
      Sound.play = function (name) { sounds.push(name); };
      try {
        play(t);
        t.bus.emit('record', { type: 'record', collected: 11, viaStar: false });
        expect(bn.texts.indexOf('しんきろく！') >= 0).toBe(true);
        expect(sounds.indexOf('blocks-record') >= 0).toBe(true);
        expect(B.Lines.mametchi.record.indexOf(bubbleText(t)) >= 0).toBe(true);
        bn.texts.length = 0;
        sounds.length = 0;
        t.bus.emit('record', { type: 'record', collected: 12, viaStar: true });
        expect(bn.texts.length).toBe(0);
        expect(sounds.indexOf('blocks-record')).toBe(-1);
        expect(B.Lines.mametchi.record.indexOf(bubbleText(t)) >= 0).toBe(true);
      } finally { Sound.play = playSound; bn.restore(); t.done(); }
    });

    it('a 4-row clear that first passes the best leaves the flash to the record', function () {
      var t = make(false, 'easy', { mode: 'challenge', best: { easy: 10 } }), fl = holdFlights();
      var flash = B.Fx.flash, flashes = 0;
      B.Fx.flash = function () { flashes++; };
      function quad(collected) {
        t.bus.emit('clear', { type: 'clear', rows: [18, 19, 20, 21], faces: [], mine: 4, collected: collected, star: false, almost: false });
      }
      try {
        play(t);
        quad(8);    // below the best: the usual quad flash
        expect(flashes).toBe(1);
        quad(12);   // first past the best: no flash, the record event follows
        expect(flashes).toBe(1);
        t.bus.emit('record', { type: 'record', collected: 12, viaStar: false });
        quad(16);   // record already done this round: the quad flash again
        expect(flashes).toBe(2);
      } finally { B.Fx.flash = flash; fl.restore(); t.done(); }
    });

    it('almost in challenge says a nearRecord line and raises the tempo', function () {
      var Bgm = A.core.Bgm, Sound = A.core.Sound, S = B.Sounds;
      var start = Bgm.start, stop = Bgm.stop, isOn = Sound.isBgmOn;
      Bgm.start = function (sc) { Bgm.setTempo(sc.bpm); };
      Bgm.stop = function () {};
      Sound.isBgmOn = function () { return true; };
      var t = null, fl = holdFlights();
      try {
        t = make(true, 'easy', { mode: 'challenge', best: { easy: 10 } });
        play(t);
        expect(Bgm.getTempo()).toBe(S.BGM.bpm);
        var g = setupClear(t, 1);
        g.collected = 6;   // this clear makes 7: 3 left to the best
        t.controller.press('hard');
        expect(B.Lines.mametchi.nearRecord.indexOf(bubbleText(t)) >= 0).toBe(true);
        expect(t.box.querySelector('.bl-star').classList.contains('is-almost')).toBe(true);
        expect(Bgm.getTempo()).toBe(S.ALMOST_BPM);
        runUi(t, STEP * 3);   // the clock is far above 10 s: the tempo stays
        expect(Bgm.getTempo()).toBe(S.ALMOST_BPM);
      } finally {
        fl.restore();
        if (t) { t.done(); }
        Bgm.start = start;
        Bgm.stop = stop;
        Sound.isBgmOn = isOn;
        Bgm.stop();
      }
    });

    it('challenge result with a new record: しんきろく！, ★25こ, さいこう 25 and a record line', function () {
      var t = make(true, 'easy', { mode: 'challenge', best: { easy: 20 } });
      try {
        play(t);
        t.bus.emit('result', challengeResult({ collected: 25, best: 25, newRecord: true }));
        var card = t.box.querySelector('.bl-result');
        expect(!!card).toBe(true);
        expect(card.querySelector('.bl-card-text').textContent).toBe('しんきろく！');
        expect(card.querySelector('.bl-result-score').textContent.indexOf('★25こ') >= 0).toBe(true);
        expect(card.querySelector('.bl-result-best').textContent).toBe('さいこう 25');
        expect(card.querySelector('.bl-hero').classList.contains('is-win')).toBe(true);
        expect(B.Lines.mametchi.record.indexOf(card.querySelector('.bl-line').textContent) >= 0).toBe(true);
      } finally { t.done(); }
    });

    it('challenge result with no best yet shows きろく なし', function () {
      var t = make(true, 'easy', { mode: 'challenge' });
      try {
        play(t);
        t.bus.emit('result', challengeResult({ collected: 0, best: 0, newRecord: false }));
        expect(t.box.querySelector('.bl-result .bl-result-best').textContent).toBe('きろく なし');
      } finally { t.done(); }
    });

    it('the record line survives a star clear: star then record via the star', function () {
      var t = make(true, 'easy', { mode: 'challenge', best: { easy: 10 } }), bn = holdBanners(), fl = holdFlights();
      try {
        play(t);
        t.bus.emit('clear', { type: 'clear', rows: [21], faces: [], mine: 2, collected: 11, star: true, almost: false });
        t.bus.emit('star', { type: 'star', faces: [], collected: 12, almost: false });
        t.bus.emit('record', { type: 'record', collected: 12, viaStar: true });
        expect(B.Lines.mametchi.record.indexOf(bubbleText(t)) >= 0).toBe(true);
      } finally { fl.restore(); bn.restore(); t.done(); }
    });

    it('challenge result without a record: おしまい and an over line', function () {
      var t = make(true, 'easy', { mode: 'challenge', best: { easy: 30 } });
      try {
        play(t);
        t.bus.emit('result', challengeResult({ collected: 25, best: 30, newRecord: false }));
        var card = t.box.querySelector('.bl-result');
        expect(card.querySelector('.bl-card-text').textContent).toBe('おしまい');
        expect(card.querySelector('.bl-result-best').textContent).toBe('さいこう 30');
        expect(card.querySelector('.bl-hero').classList.contains('is-win')).toBe(false);
        expect(B.Lines.mametchi.over.indexOf(card.querySelector('.bl-line').textContent) >= 0).toBe(true);
      } finally { t.done(); }
    });

    it('challenge result at time up without a record: じかんです and a timeup line', function () {
      var t = make(true, 'easy', { mode: 'challenge', best: { easy: 30 } });
      try {
        play(t);
        t.bus.emit('result', challengeResult({ timeup: true, collected: 25, best: 30, newRecord: false }));
        var card = t.box.querySelector('.bl-result');
        expect(card.querySelector('.bl-card-text').textContent).toBe('じかんです');
        expect(card.querySelector('.bl-hero').classList.contains('is-win')).toBe(false);
        expect(B.Lines.mametchi.timeup.indexOf(card.querySelector('.bl-line').textContent) >= 0).toBe(true);
        expect(card.querySelector('.bl-result-time')).toBe(null);
      } finally { t.done(); }
    });

    it('challenge result at time up with a new record: しんきろく！ and a record line', function () {
      var t = make(true, 'easy', { mode: 'challenge', best: { easy: 20 } });
      try {
        play(t);
        t.bus.emit('result', challengeResult({ timeup: true, collected: 25, best: 25, newRecord: true }));
        var card = t.box.querySelector('.bl-result');
        expect(card.querySelector('.bl-card-text').textContent).toBe('しんきろく！');
        expect(B.Lines.mametchi.record.indexOf(card.querySelector('.bl-line').textContent) >= 0).toBe(true);
      } finally { t.done(); }
    });

    // ---------- かおあつめのタイム (spec 8.2) ----------

    it('settings in collect: ベスト m:ss only for a level with a saved time', function () {
      var t = make(false, 'easy', { time: { easy: 83 } });
      try {
        var levels = t.box.querySelectorAll('.bl-level');
        expect(levels[0].textContent.indexOf('ベスト 1:23') >= 0).toBe(true);
        expect(levels[0].textContent.indexOf('15こ あつめよう') >= 0).toBe(true);
        expect(levels[0].textContent.indexOf('3ぷん') >= 0).toBe(true);
        expect(levels[1].textContent.indexOf('ベスト')).toBe(-1);
        expect(levels[2].textContent.indexOf('ベスト')).toBe(-1);
      } finally { t.done(); }
    });

    it('collect clear result shows タイム m:ss and しんきろく！ only on a new time', function () {
      var t = make(true);
      try {
        play(t);
        t.bus.emit('result', collectResult({ timeSec: 83, newTime: true }));
        var card = t.box.querySelector('.bl-result');
        expect(card.querySelector('.bl-card-text').textContent).toBe('クリア！');
        expect(card.querySelector('.bl-result-time').textContent.indexOf('タイム 1:23') >= 0).toBe(true);
        expect(card.querySelector('.bl-result-newtime').textContent).toBe('しんきろく！');
      } finally { t.done(); }
      var u = make(true);
      try {
        play(u);
        u.bus.emit('result', collectResult({ timeSec: 90, bestTime: 83, newTime: false }));
        var card2 = u.box.querySelector('.bl-result');
        expect(card2.querySelector('.bl-result-time').textContent).toBe('タイム 1:30');
        expect(card2.querySelector('.bl-result-newtime')).toBe(null);
      } finally { u.done(); }
    });

    it('a collect loss shows no タイム', function () {
      var t = make(true);
      try {
        play(t);
        t.bus.emit('result', collectResult({ cleared: false, timeup: true, collected: 9, timeSec: 150, newTime: false }));
        var card = t.box.querySelector('.bl-result');
        expect(card.querySelector('.bl-card-text').textContent).toBe('じかんぎれ');
        expect(card.querySelector('.bl-result-time')).toBe(null);
        expect(card.textContent.indexOf('タイム')).toBe(-1);
      } finally { t.done(); }
    });

    it('collect result has no さいこう line', function () {
      var t = make(true);
      try {
        play(t);
        t.controller.game().timeMs = 10;
        runUi(t, STEP);
        expect(!!t.box.querySelector('.bl-result')).toBe(true);
        expect(t.box.querySelector('.bl-result-best')).toBe(null);
        expect(t.box.querySelector('.bl-best').hidden).toBe(true);
      } finally { t.done(); }
    });

    it('もういっかい keeps the challenge and the difficulty', function () {
      var t = make(false, 'normal', { mode: 'challenge' });
      try {
        play(t);
        t.bus.emit('result', challengeResult({ collected: 0 }));
        buttonByText(t.box, 'もういっかい').click();
        var g = t.controller.game();
        expect(g.mode).toBe('challenge');
        expect(g.difficulty).toBe('normal');
        expect(t.box.querySelector('.bl-clock').hidden).toBe(false);
        expect(t.box.querySelector('.bl-clocktime').textContent).toBe('3:00');
      } finally { t.done(); }
    });
  });
})(window.Ailand);
