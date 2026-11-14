(function (G) {
  'use strict';
  // blocks screens: settings (design 3.2), play (3.3), pause (3.4) and result (3.5).
  // DOM is touched only after init(). Time runs only while deps.loop runs (countdown and play).
  var C = Ailand.core, K = G.Constants, L = G.Layout, R = G.Render, Fx = G.Fx, Sound = C.Sound, Bgm = C.Bgm;

  var LEVELS = [['easy', 'かんたん'], ['normal', 'ふつう'], ['hard', 'むずかしい']];
  var MODES = [['collect', 'かおあつめ'], ['challenge', 'きろくチャレンジ']];
  var PADS = {
    move: [['left', '←', 'ひだり'], ['soft', '↓', 'おとす'], ['hard', '↓', 'いっきに おとす']],
    act: [['rotate', '↻', 'まわす'], ['right', '→', 'みぎ']]
  };
  // Keyboard (design 4). Repeats come from the controller, never from the OS key repeat.
  var KEYS = { ArrowLeft: 'left', ArrowRight: 'right', ArrowUp: 'rotate', ArrowDown: 'soft', ' ': 'hard', Spacebar: 'hard' };
  var MOVE_SOUND = { left: 'blocks-move', right: 'blocks-move', rotate: 'blocks-rotate' };
  var BUBBLE_MS = 1600;
  var TIMEADD_MS = 900;        // the "+N" next to the clock after a time bonus
  var START_BUBBLE_MS = 2000;
  var BUBBLE_FADE_MS = 250;    // core/effects.js bubble fade-out
  var REACT_MS = 1600;         // the chosen character goes back to normal after a reaction
  var RESULT_WAIT_MS = 1000;   // longest wait for flying faces before the result card
  var COLLECT_GAP_MS = 60;     // at most one "collect" sound per this many ms
  var JAR_SHOWN = 24;          // faces drawn inside the jar (the number shows the total)
  var MAX_DPR = 3;
  var FRAME_PX = 8;            // the board frame's border on both sides (css .bl-boardframe) and a little air

  function el(tag, cls, text) {
    var e = document.createElement(tag);
    if (cls) { e.className = cls; }
    if (text !== undefined) { e.textContent = text; }
    return e;
  }
  function button(cls, text, onClick) {
    var b = el('button', cls, text);
    b.type = 'button';
    b.addEventListener('click', onClick);
    return b;
  }
  function faceInto(wrap, profile, emotion) {
    wrap.innerHTML = '';
    var img = el('img', 'char-img');
    img.draggable = false;
    wrap.appendChild(img);
    C.CharacterView.apply(img, profile, emotion);
  }
  function profileOf(id) { return C.Characters.get(id); }
  function centerOf(node) {
    var r = node.getBoundingClientRect();
    return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
  }
  function goalOf(difficulty) { return K.DIFFICULTY[difficulty].goal; }
  // 180000 -> '3ぷん', 150000 -> '2ぷん30びょう'.
  function timeOf(difficulty) {
    var s = Math.round(K.DIFFICULTY[difficulty].timeMs / 1000);
    return Math.floor(s / 60) + 'ぷん' + (s % 60 ? (s % 60) + 'びょう' : '');
  }
  // Whole seconds (rounded up by the caller): 89 -> '1:29', 0 -> '0:00'.
  function clockOf(sec) { return Math.floor(sec / 60) + ':' + (sec % 60 < 10 ? '0' : '') + (sec % 60); }
  // A long how-to line: a br after each part; css keeps the words whole.
  function textLines(parts) {
    var p = el('p', 'bl-howto-text');
    parts.forEach(function (t, i) {
      if (i > 0) { p.appendChild(document.createElement('br')); }
      p.appendChild(document.createTextNode(t));
    });
    return p;
  }

  // Loads every character's normal image once for the board (design 7: before the round starts).
  function loadImages(onLoad) {
    var images = {};
    C.Characters.list().forEach(function (pf) {
      var img = new Image();
      img.onload = onLoad;
      img.src = C.CharacterView.candidates(pf, 'normal')[0];
      images[pf.id] = img;
    });
    return images;
  }

  // deps: { bus, loop, linePicker?, rng? }. Returns { step(ms), showPause(reason), destroy() }.
  function init(root, controller, deps) {
    var d = deps || {};
    var bus = d.bus, loop = d.loop;
    if (!bus || typeof bus.on !== 'function') { throw new Error('blocks UI.init: deps.bus (EventBus) is required'); }
    if (!loop || typeof loop.start !== 'function') { throw new Error('blocks UI.init: deps.loop (core Loop) is required'); }
    var linePicker = d.linePicker || null;
    var reactions = G.Reactions.create(d.rng || Math.random);
    var draft = controller.loadSettings();
    var game = null;          // per-round view state (see beginRound)
    var timers = [];
    var images = loadImages(function () { redraw(); drawNext(); });

    var settingsScreen = el('main', 'screen bl-settings-screen');
    settingsScreen.id = 'screen-settings';
    var gameScreen = el('main', 'screen bl-game-screen');
    gameScreen.id = 'screen-game';
    gameScreen.hidden = true;
    root.appendChild(settingsScreen);
    root.appendChild(gameScreen);

    var header = C.UI.header({
      title: 'おちブロック',
      soundOn: Sound.isEnabled(),
      onBack: onBack,
      onSound: function () { return Sound.toggleFromTap(); },
      onSettings: openMenu
    });
    document.body.insertBefore(header, document.body.firstChild);

    function later(fn, ms) { timers.push(setTimeout(fn, ms)); }
    function clearTimers() { timers.forEach(clearTimeout); timers = []; }
    function sfx(name) { if (game) { Sound.play(name); } }
    function inPlay() { var p = controller.phase(); return !!game && (p === 'countdown' || p === 'playing'); }

    // ---------- settings screen ----------

    function panel(title) {
      var p = el('section', 'bl-panel');
      p.appendChild(el('h2', null, title));
      settingsScreen.appendChild(p);
      return p;
    }

    function renderSettings() {
      settingsScreen.innerHTML = '';
      var p1 = panel('キャラ');
      p1.appendChild(el('div', 'bl-pickname', profileOf(draft.char).name));
      var list = el('div', 'bl-charlist');
      C.Characters.list().forEach(function (pf) {
        var b = button('bl-charbtn', undefined, function () { draft.char = pf.id; renderSettings(); });
        b.setAttribute('aria-pressed', String(draft.char === pf.id));
        b.setAttribute('aria-label', pf.name);
        var face = el('span', 'bl-charface');
        faceInto(face, pf, 'normal');
        b.appendChild(face);
        list.appendChild(b);
      });
      p1.appendChild(list);

      var pm = panel('あそびかた');
      var modes = el('div', 'bl-choices bl-modes');
      MODES.forEach(function (it) {
        var b = button('bl-choice bl-mode', it[1], function () { draft.mode = it[0]; renderSettings(); });
        b.setAttribute('aria-pressed', String(draft.mode === it[0]));
        modes.appendChild(b);
      });
      pm.appendChild(modes);

      var challenge = draft.mode === 'challenge';
      var p2 = panel('むずかしさ');
      var levels = el('div', 'bl-levels');
      LEVELS.forEach(function (it) {
        var b = button('bl-choice bl-level', undefined, function () { draft.difficulty = it[0]; renderSettings(); });
        b.appendChild(el('span', 'bl-level-name', it[1]));
        var meta = el('span', 'bl-level-meta');
        if (challenge) {
          var best = controller.bestOf(it[0]);
          meta.appendChild(el('span', 'bl-level-best', best > 0 ? 'さいこう ' + best + 'こ' : 'きろく なし'));
        } else {
          meta.appendChild(el('span', 'bl-level-goal', goalOf(it[0]) + 'こ あつめよう'));
          meta.appendChild(el('span', 'bl-level-time', timeOf(it[0])));
        }
        b.appendChild(meta);
        b.setAttribute('aria-pressed', String(draft.difficulty === it[0]));
        levels.appendChild(b);
      });
      p2.appendChild(levels);

      var p3 = el('section', 'bl-panel bl-startpanel');
      p3.appendChild(button('btn btn-main bl-start', 'はじめる', startGame));
      p3.appendChild(button('btn btn-sub bl-howto', 'あそびかた', function () { showHowTo(false); }));
      settingsScreen.appendChild(p3);
    }

    // The how-to card (design 3.2): before the first round, and from the あそびかた button.
    function showHowTo(beforeStart) {
      var pf = profileOf(draft.char);
      var m = null;
      var body = el('div', 'bl-howto-body');
      var face = el('div', 'bl-howto-face');
      faceInto(face, pf, 'joy');
      body.appendChild(face);
      body.appendChild(el('p', 'bl-howto-text', 'そろえて けすと かおが とんでいくよ'));
      if (draft.mode === 'challenge') {
        body.appendChild(textLines([pf.name + 'の かおを たくさん あつめて、', 'さいこうきろくを こえよう！']));
        body.appendChild(textLines(['じかんは ないよ。', 'うえまで つまったら おしまい']));
      } else {
        body.appendChild(el('p', 'bl-howto-text', pf.name + 'の かおを ' + goalOf(draft.difficulty) + 'こ あつめたら クリア'));
        body.appendChild(textLines(['じかんが なくなると おしまい。', 'じぶんの かおを けすと のびるよ']));
      }
      body.appendChild(textLines(['ほしの ブロックを けすと、', 'ばんの じぶんの かおが ぜんぶ とんでくる！']));
      var acts = el('div', 'bl-menu');
      acts.appendChild(button('btn btn-main', beforeStart ? 'はじめる' : 'わかった', function () {
        m.close();
        controller.markHowToSeen();
        if (beforeStart) { startGame(); }
      }));
      m = C.UI.modal('あそびかた', [body, acts]);
    }

    function showSettings() {
      leaveGame();
      settingsScreen.hidden = false;
      draft = controller.loadSettings();
      renderSettings();
      startBgm();
      window.scrollTo(0, 0);
    }

    // ---------- game screen ----------

    function startGame() {
      if (controller.needsHowTo()) { showHowTo(true); return; }
      var s = { char: draft.char, difficulty: draft.difficulty, mode: draft.mode };
      controller.start(s);
      beginRound(s);
    }

    function beginRound(settings) {
      clearTimers();
      Fx.stop();
      var cg = controller.game();
      game = {
        settings: settings, profile: profileOf(settings.char), goal: cg.goal, challenge: cg.mode === 'challenge', best: cg.best,
        cell: 0, dpr: 1, hideRows: [], hideCells: [], clockSec: -1, hurry: false, shown: { star: 0, jar: 0 }, flying: 0, almost: false,
        bubbleUntil: 0, reactToken: 0, lastCollect: 0, pending: null, resultShown: false
      };
      buildGame();
      settingsScreen.hidden = true;
      gameScreen.hidden = false;
      document.body.classList.add('bl-playing');
      window.scrollTo(0, 0);
      applyLayout();
      paintCounts();
      paintClock();
      reactions.reset();
      say('start', START_BUBBLE_MS);
      startBgm();
      loop.start();
    }

    function buildGame() {
      gameScreen.innerHTML = '';
      var wrap = el('div', 'bl-game');

      var boardWrap = el('div', 'bl-boardwrap');
      var frame = el('div', 'bl-boardframe');
      var canvas = el('canvas', 'bl-board');
      frame.appendChild(canvas);
      boardWrap.appendChild(frame);

      var info = el('div', 'bl-info');
      var clock = el('div', 'bl-clock');
      var clockTime = el('span', 'bl-clocktime');
      clock.appendChild(el('span', 'bl-clocklabel', 'のこり '));
      clock.appendChild(clockTime);
      var next = el('div', 'bl-next');
      next.appendChild(el('span', 'bl-label', 'つぎ'));
      var nextCanvas = el('canvas', 'bl-nextcanvas');
      next.appendChild(nextCanvas);
      var star = el('div', 'bl-star');
      var starFace = el('div', 'bl-starface');
      faceInto(starFace, game.profile, 'normal');
      var starCount = el('div', 'bl-starcount');
      var best = el('div', 'bl-best');
      best.hidden = !game.challenge || game.best <= 0;   // no best yet: hidden for the whole round (spec 4.3)
      clock.hidden = game.challenge;                     // the challenge has no time
      star.appendChild(el('span', 'bl-starmark', '★'));
      star.appendChild(starFace);
      star.appendChild(starCount);
      star.appendChild(best);
      info.appendChild(clock);
      info.appendChild(next);
      info.appendChild(star);

      var buddy = el('div', 'bl-buddy');
      var faceWrap = el('div', 'bl-facewrap');
      var face = el('div', 'bl-face');
      faceInto(face, game.profile, 'normal');
      var mark = el('span', 'bl-mark');
      mark.setAttribute('aria-hidden', 'true');
      var sayEl = el('div', 'bl-say');
      faceWrap.appendChild(face);
      faceWrap.appendChild(mark);
      faceWrap.appendChild(sayEl);
      var jar = el('div', 'bl-jar');
      var jarBody = el('div', 'bl-jarbody');
      var jarCount = el('div', 'bl-jarcount');
      jar.appendChild(el('div', 'bl-jarlid'));
      jar.appendChild(jarBody);
      jar.appendChild(jarCount);
      buddy.appendChild(faceWrap);
      buddy.appendChild(jar);

      var padEl = el('div', 'bl-pad');
      game.pads = [];
      ['move', 'act'].forEach(function (group) {
        var g = el('div', 'bl-pad-' + group);
        PADS[group].forEach(function (p) { g.appendChild(padButton(p[0], p[1], p[2])); });
        padEl.appendChild(g);
      });

      var overlay = el('div', 'bl-overlay');
      overlay.hidden = true;

      wrap.appendChild(boardWrap);
      wrap.appendChild(info);
      wrap.appendChild(buddy);
      wrap.appendChild(padEl);
      gameScreen.appendChild(wrap);
      gameScreen.appendChild(overlay);

      game.wrap = wrap;
      game.boardWrap = boardWrap;
      game.frame = frame;
      game.canvas = canvas;
      game.ctx = canvas.getContext('2d');
      game.nextCanvas = nextCanvas;
      game.nextCtx = nextCanvas.getContext('2d');
      game.clock = clock;
      game.clockTime = clockTime;
      game.star = star;
      game.starFace = starFace;
      game.starCount = starCount;
      game.bestEl = best;
      game.face = face;
      game.mark = mark;
      game.say = sayEl;
      game.jarBody = jarBody;
      game.jarCount = jarCount;
      game.overlay = overlay;
    }

    // Input (design 4): pointerdown moves once; held buttons repeat in the controller until this finger lifts,
    // is cancelled or leaves the button. Each button follows its own pointerId, so two fingers work together.
    function padButton(action, icon, label) {
      var b = el('button', 'bl-padbtn');
      b.type = 'button';
      b.appendChild(el('span', 'bl-ico', icon));   // hard drop: the same arrow onto a CSS floor bar (any font renders it)
      b.dataset.action = action;
      b.setAttribute('aria-label', label);
      var pad = { pid: null };
      b.addEventListener('pointerdown', function (e) {
        e.preventDefault();
        // Touch captures the pointer implicitly; release it so pointerleave fires when the finger slides off.
        try { if (b.hasPointerCapture && b.hasPointerCapture(e.pointerId)) { b.releasePointerCapture(e.pointerId); } } catch (err) { /* ignore */ }
        if (!game || controller.phase() !== 'playing' || controller.isPaused()) { return; }
        pad.pid = e.pointerId;
        controller.press(action);
        redraw();
      });
      function up(e) {
        if (pad.pid === null || e.pointerId !== pad.pid) { return; }
        pad.pid = null;
        controller.release(action);
      }
      b.addEventListener('pointerup', up);
      b.addEventListener('pointercancel', up);
      b.addEventListener('pointerleave', up);
      b.addEventListener('contextmenu', function (e) { e.preventDefault(); });
      game.pads.push(pad);
      return b;
    }
    function forgetPointers() { if (game) { game.pads.forEach(function (p) { p.pid = null; }); } }

    var keysHeld = {};   // actions held by keys (released on keyup or when the window loses focus)
    function onKeyDown(e) {
      var action = KEYS[e.key];
      if (!action || !game || controller.phase() !== 'playing' || controller.isPaused()) { return; }
      e.preventDefault();
      if (e.repeat) { return; }   // a held key repeats in the controller (press again would move again)
      keysHeld[action] = true;
      controller.press(action);
      redraw();
    }
    function onKeyUp(e) {
      var action = KEYS[e.key];
      // Only a hold that the keyboard started: a finger on the same pad button keeps repeating.
      if (action && keysHeld[action]) { delete keysHeld[action]; controller.release(action); }
    }
    // A keyup never arrives when focus leaves the window mid-press: stop those repeats here.
    function onBlur() {
      Object.keys(keysHeld).forEach(function (a) { controller.release(a); });
      keysHeld = {};
    }
    document.addEventListener('keydown', onKeyDown);
    document.addEventListener('keyup', onKeyUp);
    window.addEventListener('blur', onBlur);

    // Cell size: the largest board that fits the board area (design 3.3). Canvas size follows devicePixelRatio (design 7).
    function applyLayout() {
      if (!game) { return; }
      var r = game.boardWrap.getBoundingClientRect();
      var cell = L.cellSize(r.width - FRAME_PX, r.height - FRAME_PX);
      var dpr = Math.min(MAX_DPR, window.devicePixelRatio || 1);
      game.cell = cell;
      game.dpr = dpr;
      game.canvas.style.width = (cell * K.COLS) + 'px';
      game.canvas.style.height = (cell * K.ROWS) + 'px';
      game.canvas.width = Math.round(cell * K.COLS * dpr);
      game.canvas.height = Math.round(cell * K.ROWS * dpr);
      var nc = Math.max(12, Math.min(22, cell));
      game.nextCell = nc;
      game.nextCanvas.style.width = (nc * 4) + 'px';
      game.nextCanvas.style.height = (nc * 2) + 'px';
      game.nextCanvas.width = Math.round(nc * 4 * dpr);
      game.nextCanvas.height = Math.round(nc * 2 * dpr);
      redraw();
      drawNext();
    }

    // Loop steps come up to 5 per frame: draw the board at most once per animation frame.
    var drawFrame = 0;
    function requestDraw() {
      if (drawFrame) { return; }
      drawFrame = window.requestAnimationFrame(function () { drawFrame = 0; redraw(); });
    }
    function cancelDraw() { if (drawFrame) { window.cancelAnimationFrame(drawFrame); drawFrame = 0; } }

    function redraw() {
      var cg = controller.game();
      if (!game || !cg || !game.cell) { return; }
      R.draw(game.ctx, cg, { cell: game.cell, dpr: game.dpr, images: images, hideRows: game.hideRows, hideCells: game.hideCells, selfId: game.settings.char });
    }
    function drawNext() {
      var cg = controller.game();
      if (!game || !cg || !game.nextCell) { return; }
      R.drawNext(game.nextCtx, cg.next, { cell: game.nextCell, dpr: game.dpr, images: images, selfId: game.settings.char });
    }

    function paintCounts() {
      game.starCount.textContent = game.challenge ? String(game.shown.star) : game.shown.star + '／' + game.goal;
      // After a new record the best follows the score (spec 4.3).
      if (game.challenge) { game.bestEl.textContent = 'さいこう ' + Math.max(game.best, game.shown.star); }
      game.jarCount.textContent = 'みんな ' + game.shown.jar;
    }

    // The clock (thrill design): repainted only when the whole seconds change. Under HURRY_MS it turns red,
    // ticks once a second and the BGM runs at HURRY_BPM.
    function paintClock() {
      var cg = controller.game();
      if (!game || !cg || game.challenge) { return; }   // the challenge has no clock (timeMs is null)
      var sec = Math.ceil(cg.timeMs / 1000);
      if (sec === game.clockSec) { return; }
      var first = game.clockSec < 0;
      game.clockSec = sec;
      game.clockTime.textContent = clockOf(sec);
      var hurry = inPlay() && cg.timeMs <= K.HURRY_MS;   // the clock stops blinking once the round is over
      if (hurry && sec > 0 && !first) { sfx('blocks-tick'); }
      if (hurry === game.hurry) { return; }
      game.hurry = hurry;
      game.clock.classList.toggle('is-hurry', hurry);
      if (Sound.isBgmOn() && inPlay() && !controller.isPaused()) { Bgm.setTempo(bpmNow()); }
    }
    function bpmNow() { return game.hurry ? G.Sounds.HURRY_BPM : (game.almost ? G.Sounds.ALMOST_BPM : G.Sounds.BGM.bpm); }

    // The one-time "almost" (from a clear or a star wave): star frame, faster BGM and the forced line.
    function showAlmost() {
      game.almost = true;
      game.star.classList.add('is-almost');
      if (Sound.isBgmOn()) { Bgm.setTempo(bpmNow()); }   // under 10 s the hurry tempo stays
      say(game.challenge ? 'nearRecord' : 'almost', BUBBLE_MS, true);
    }

    // One bubble at a time (design 5.1): a new line waits until the previous one is gone.
    // force (the one-time almost line): replaces the bubble on screen instead of being dropped.
    function say(situation, ms, force) {
      if (!linePicker || !game) { return; }
      var now = Date.now();
      if (!force && game.bubbleUntil > now) { return; }
      var text = linePicker.pick(game.profile.id, situation);
      if (!text) { return; }
      var life = ms || BUBBLE_MS;
      C.Effects.bubble(game.say, text, life);
      game.bubbleUntil = now + life + BUBBLE_FADE_MS;
    }

    // The chosen character's face for a clear, back to normal after a moment (design 5.1).
    function react(emotion) {
      var token = ++game.reactToken;
      faceInto(game.face, game.profile, emotion);
      C.Effects.mark(game.mark, C.CharacterView.markOf(emotion));
      later(function () {
        if (!game || game.reactToken !== token) { return; }
        faceInto(game.face, game.profile, 'normal');
        C.Effects.mark(game.mark, null);
      }, REACT_MS);
    }

    // Faces fly from their cells to the special frame (mine) or the jar (others); counts go up as they land.
    function flyFaces(faces) {
      var rect = game.canvas.getBoundingClientRect();
      var starAt = centerOf(game.starFace), jarAt = centerOf(game.jarBody);
      var gap = Math.min(30, 300 / Math.max(1, faces.length));
      var size = Math.max(18, game.cell * 0.9);
      faces.forEach(function (f, i) {
        game.flying++;
        var g = game;
        Fx.fly(L.cellCenter(rect, game.cell, f.col, f.row), f.mine ? starAt : jarAt, profileOf(f.charId), size, {
          delay: Math.round(i * gap),
          deco: i,
          onLand: function () { if (game === g) { land(f); } }
        });
      });
    }

    function land(f) {
      game.flying--;
      if (game.resultShown) { return; }   // the result card already shows the final counts
      if (f.mine) {
        game.shown.star++;
        var now = Date.now();
        if (now - game.lastCollect >= COLLECT_GAP_MS) { game.lastCollect = now; sfx('blocks-collect'); }
      } else {
        game.shown.jar++;
        var mini = el('span', 'bl-mini');
        faceInto(mini, profileOf(f.charId), 'joy');
        game.jarBody.appendChild(mini);
        while (game.jarBody.children.length > JAR_SHOWN) { game.jarBody.removeChild(game.jarBody.firstChild); }
      }
      paintCounts();
      if (game.flying <= 0 && game.pending) { showResult(); }
    }

    // Settings screen: the BGM at normal tempo. Game: only while playing.
    function startBgm() {
      if (!Sound.isBgmOn()) { Bgm.stop(); return; }
      if (!game) { Bgm.start(G.Sounds.BGM); return; }
      if (!inPlay() || controller.isPaused()) { return; }
      Bgm.start(G.Sounds.BGM);
      if (game.hurry || game.almost) { Bgm.setTempo(bpmNow()); }
    }

    // ---------- overlay: pause and result ----------

    function showOverlay(cls, nodes) {
      var o = game.overlay;
      o.innerHTML = '';
      var card = el('div', 'bl-card ' + (cls || ''));
      nodes.forEach(function (n) { card.appendChild(n); });
      o.appendChild(card);
      o.hidden = false;
      return card;
    }
    function hideOverlay() { if (game) { game.overlay.hidden = true; game.overlay.innerHTML = ''; } }

    function pauseGame(reason) {
      if (!inPlay() || controller.isPaused()) { return false; }
      controller.pause(reason);
      loop.stop();
      showPause(reason);
      return true;
    }

    // Also called by main.js after Loop's onPause (tab hidden), when the controller is already paused.
    // The board is hidden while paused (design 3.4).
    function showPause() {
      if (!inPlay()) { return; }
      Bgm.stop();
      forgetPointers();
      game.wrap.classList.add('is-paused');
      showOverlay('bl-pause', [el('p', 'bl-card-text', 'ひとやすみ ちゅう'), button('btn btn-main bl-resume', 'つづける', resumeGame)]);
    }

    function resumeGame() {
      if (!inPlay()) { return; }
      hideOverlay();
      game.wrap.classList.remove('is-paused');
      controller.resume();
      startBgm();
      loop.start();
    }

    function line(situation) { return linePicker ? linePicker.pick(game.profile.id, situation) : ''; }

    // Result (design 3.5): waits for flying faces (at most RESULT_WAIT_MS), then shows the card once.
    function onResult(r) {
      loop.stop();
      Bgm.stop();
      forgetPointers();
      game.pending = r;
      if (game.flying <= 0) { showResult(); return; }
      later(showResult, RESULT_WAIT_MS);
    }

    function showResult() {
      if (!game || !game.pending || game.resultShown) { return; }
      var r = game.pending;
      game.resultShown = true;
      game.hurry = false;
      game.clock.classList.remove('is-hurry');
      game.shown.star = r.collected;
      game.shown.jar = r.jar;
      paintCounts();
      var pf = game.profile;
      // Challenge (spec 4.4): a new record is shown like a clear; otherwise the usual おしまい.
      var record = game.challenge && !!r.newRecord;
      var win = r.cleared || record;
      var nodes = [];
      nodes.push(el('p', 'bl-card-text', r.cleared ? 'クリア！' : (record ? 'しんきろく！' : (r.timeup ? 'じかんぎれ' : 'おしまい'))));
      var hero = el('div', 'bl-hero' + (win ? ' is-win' : ''));
      var face = el('div', 'bl-heroface');
      faceInto(face, pf, reactions.forResult(win ? 'goal' : 'over'));
      hero.appendChild(face);
      hero.appendChild(el('p', 'bl-line', line(r.cleared ? 'clear' : (record ? 'record' : (r.timeup ? 'timeup' : 'over')))));
      nodes.push(hero);
      nodes.push(el('p', 'bl-result-score', pf.name + 'の かお ★' + r.collected + 'こ あつめたよ' + (win ? '！' : '')));
      if (game.challenge) { nodes.push(el('p', 'bl-result-best', 'さいこう ' + r.best)); }
      nodes.push(el('p', 'bl-result-jar', 'みんなの かお ' + r.jar + 'こ'));
      var acts = el('div', 'bl-result-actions');
      acts.appendChild(button('btn btn-main bl-again', 'もういっかい', again));
      acts.appendChild(button('btn btn-sub bl-tosettings', 'せっていに もどる', showSettings));
      nodes.push(acts);
      showOverlay('bl-result', nodes);
      sfx(win ? 'blocks-goal' : 'blocks-over');
      if (win) { Fx.confetti(); }
    }

    function again() {
      var s = { char: game.settings.char, difficulty: game.settings.difficulty, mode: game.settings.mode };
      controller.start(s);
      beginRound(s);
    }

    function leaveGame() {
      cancelDraw();
      loop.stop();
      Bgm.stop();
      clearTimers();
      Fx.stop();
      if (controller.phase() !== 'idle') { controller.quit(); }
      game = null;
      gameScreen.hidden = true;
      gameScreen.innerHTML = '';
      document.body.classList.remove('bl-playing');
    }

    // ---------- header ----------

    function goEntry() {
      leaveGame();
      location.href = C.CharacterView.basePath() + 'index.html';
    }

    // During play, もどる pauses and asks first (design 3.4).
    function onBack() {
      if (!inPlay()) { goEntry(); return; }
      pauseGame('back');
      var m = null;
      var acts = el('div', 'bl-menu');
      acts.appendChild(button('btn btn-main', 'やめる', function () { m.close(); goEntry(); }));
      acts.appendChild(button('btn btn-sub', 'つづける', function () { m.close(); resumeGame(); }));
      m = C.UI.modal('やめる？', [acts]);
    }

    // せってい: さいしょから (back to the settings screen) and BGM ON/OFF. Time stops while it is open.
    function openMenu() {
      pauseGame('menu');
      var nodes = [];
      var m = null;
      if (!gameScreen.hidden) {
        var acts = el('div', 'bl-menu');
        acts.appendChild(button('btn btn-main', 'さいしょから', function () { m.close(); showSettings(); }));
        nodes.push(acts);
      }
      var row = el('div', 'bl-rule');
      row.appendChild(el('span', 'bl-rulename', 'BGM'));
      var opts = el('div', 'bl-choices');
      [[true, 'ON'], [false, 'OFF']].forEach(function (it) {
        var b = button('bl-choice', it[1], function () {
          Sound.setBgmOn(it[0]);
          if (it[0]) { startBgm(); } else { Bgm.stop(); }
          Array.prototype.forEach.call(opts.children, function (x, i) { x.setAttribute('aria-pressed', String((i === 0) === it[0])); });
        });
        b.setAttribute('aria-pressed', String(Sound.isBgmOn() === it[0]));
        opts.appendChild(b);
      });
      row.appendChild(opts);
      nodes.push(row);
      m = C.UI.modal('せってい', nodes);
    }

    // ---------- controller events ----------

    var offs = [];
    function on(name, fn) { offs.push(bus.on(name, function (p) { if (game) { fn(p); } })); }

    on('count', function (p) { Fx.showBanner(String(p.n), 'is-count', 800); sfx('blocks-count'); });
    on('go', function () { Fx.showBanner('スタート！', 'is-go', 900); sfx('blocks-go'); });
    on('spawn', function () { drawNext(); redraw(); });
    on('moved', function (p) { if (MOVE_SOUND[p.action]) { sfx(MOVE_SOUND[p.action]); } });
    on('lock', function () { sfx('blocks-lock'); redraw(); });
    on('clear', function (p) {
      game.hideRows = p.rows.slice();
      redraw();
      sfx(p.rows.length >= 4 ? 'blocks-quad' : (p.rows.length >= 2 ? 'blocks-multi' : 'blocks-line'));
      flyFaces(p.faces);
      // One screen effect per lock (design 5.3): a clear that reaches the goal leaves the stage to the result,
      // and a star clear leaves it to the star event that follows.
      var events = [p];
      if (!game.challenge && p.collected >= game.goal) { events.push({ type: 'goal' }); }
      if (!p.star && G.Reactions.screenFx(events) === 'quad') { Fx.flash(game.frame); }
      var r = reactions.forClear(p);
      react(r.emotion);
      if (p.almost) {
        showAlmost();
      } else if (r.situation) {
        say(r.situation);
      }
    });
    // The star: every own face on the board flies to the frame in one wave; their cells hide until the collapse.
    on('star', function (p) {
      Fx.showBanner('ほし！', 'is-go', 900);
      Fx.flash(game.frame);
      sfx('blocks-star');
      game.hideCells = p.faces.map(function (f) { return [f.col, f.row]; });
      redraw();
      flyFaces(p.faces);
      react(reactions.forStar().emotion);
      if (p.almost) { showAlmost(); } else { say('star', BUBBLE_MS, true); }
    });
    // A time bonus: "+N" next to the clock for a moment (the clock itself repaints on the next step).
    on('time', function (p) {
      var n = Math.round(p.addMs / 1000);
      if (n <= 0) { return; }
      Array.prototype.forEach.call(game.clock.querySelectorAll('.bl-timeadd'), function (x) { x.parentNode.removeChild(x); });
      var add = el('span', 'bl-timeadd', '+' + n);
      add.setAttribute('aria-hidden', 'true');
      game.clock.appendChild(add);
      later(function () { if (add.parentNode) { add.parentNode.removeChild(add); } }, TIMEADD_MS);
    });
    // A new record (spec 3.3), once per round. With a star wave the banner and sound stay the star's.
    on('record', function (p) {
      if (!p.viaStar) { Fx.showBanner('しんきろく！', 'is-go', 900); sfx('blocks-record'); }
      react(reactions.forRecord().emotion);
      say('record', BUBBLE_MS, true);
    });
    on('collapse', function () { game.hideRows = []; game.hideCells = []; redraw(); });
    on('danger', function (p) { game.frame.classList.toggle('is-danger', !!p.on); });
    on('result', onResult);

    function onResize() { applyLayout(); }
    window.addEventListener('resize', onResize);
    window.addEventListener('orientationchange', onResize);

    showSettings();

    return {
      // Repaints the clock and redraws the board; called after controller.advance on every loop step.
      step: function () {
        if (!game) { return; }
        paintClock();
        if (inPlay()) { requestDraw(); }
      },
      showPause: showPause,
      // Tests: removes the UI, its header and listeners.
      destroy: function () {
        leaveGame();
        offs.forEach(function (off) { if (typeof off === 'function') { off(); } });
        document.removeEventListener('keydown', onKeyDown);
        document.removeEventListener('keyup', onKeyUp);
        window.removeEventListener('blur', onBlur);
        window.removeEventListener('resize', onResize);
        window.removeEventListener('orientationchange', onResize);
        if (header.parentNode) { header.parentNode.removeChild(header); }
        root.removeChild(settingsScreen);
        root.removeChild(gameScreen);
      }
    };
  }

  G.UI = { init: init };
})(Ailand.games.blocks);
