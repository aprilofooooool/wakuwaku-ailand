(function (G) {
  'use strict';
  // chain screens: settings (design 3.2), play (3.3), pause (3.4) and result (3.5). Copied from the blocks UI
  // and adapted (design 8). DOM is touched only after init(). Time runs only while deps.loop runs.
  var C = Ailand.core, K = G.Constants, L = G.Layout, R = G.Render, Fx = G.Fx, Sound = C.Sound, Bgm = C.Bgm;

  var LEVELS = [['easy', 'かんたん'], ['normal', 'ふつう'], ['hard', 'むずかしい']];
  var PADS = {
    move: [['left', '←', 'ひだり'], ['soft', '↓', 'おとす'], ['hard', '↓', 'いっきに おとす']],
    act: [['rotate', '↻', 'まわす'], ['right', '→', 'みぎ']]
  };
  // Keyboard (design 4). Repeats come from the controller, never from the OS key repeat.
  var KEYS = { ArrowLeft: 'left', ArrowRight: 'right', ArrowUp: 'rotate', ArrowDown: 'soft', ' ': 'hard', Spacebar: 'hard' };
  var MOVE_SOUND = { left: 'chain-move', right: 'chain-move', rotate: 'chain-rotate' };
  var BUBBLE_MS = 1600;
  var TIMEADD_MS = 900;        // the "+N" next to the clock after a wake
  var START_BUBBLE_MS = 2000;
  var BUBBLE_FADE_MS = 250;    // core/effects.js bubble fade-out
  var REACT_MS = 1600;         // the chosen character goes back to normal after a reaction
  var RESULT_WAIT_MS = 1000;   // longest wait for flying friends before the result card
  var ARRIVE_GAP_MS = 60;      // at most one "arrive" sound per this many ms
  var FRIENDS_SHOWN = 16;      // faces drawn in the friends panel (the count shows the rest)
  var WOBBLE_AMP = 0.06;       // pop wobble, cells
  var WIGGLE_AMP = 0.08;       // turn warning wiggle, cells
  var MAX_DPR = 3;
  var FRAME_PX = 8;            // the board frame's border on both sides (css .ch-boardframe) and a little air

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
  function key(c, r) { return c + ',' + r; }
  // 150000 -> '2ぷん30びょう', 120000 -> '2ぷん'.
  function minutesOf(ms) {
    var s = Math.round(ms / 1000);
    return Math.floor(s / 60) + 'ぷん' + (s % 60 ? (s % 60) + 'びょう' : '');
  }
  // Whole seconds: 83 -> '1:23', 0 -> '0:00'.
  function clockOf(sec) { return Math.floor(sec / 60) + ':' + (sec % 60 < 10 ? '0' : '') + (sec % 60); }

  // Loads every character's normal (balls) and sleep (sleepers) images once (design 7: before the round starts).
  function loadImages(onLoad) {
    var images = { normal: {}, sleep: {} };
    C.Characters.list().forEach(function (pf) {
      ['normal', 'sleep'].forEach(function (kind) {
        var img = new Image();
        img.onload = onLoad;
        img.src = C.CharacterView.candidates(pf, kind)[0];
        images[kind][pf.id] = img;
      });
    });
    return images;
  }

  // deps: { bus, loop, linePicker?, rng? }. Returns { step(ms), showPause(reason), destroy() }.
  function init(root, controller, deps) {
    var d = deps || {};
    var bus = d.bus, loop = d.loop;
    if (!bus || typeof bus.on !== 'function') { throw new Error('chain UI.init: deps.bus (EventBus) is required'); }
    if (!loop || typeof loop.start !== 'function') { throw new Error('chain UI.init: deps.loop (core Loop) is required'); }
    var linePicker = d.linePicker || null;
    var reactions = G.Reactions.create(d.rng || Math.random);
    var draft = controller.loadSettings();
    var game = null;          // per-round view state (see beginRound)
    var timers = [];
    var images = loadImages(function () { redraw(); drawNext(); });

    var settingsScreen = el('main', 'screen ch-settings-screen');
    settingsScreen.id = 'screen-settings';
    var gameScreen = el('main', 'screen ch-game-screen');
    gameScreen.id = 'screen-game';
    gameScreen.hidden = true;
    root.appendChild(settingsScreen);
    root.appendChild(gameScreen);

    var header = C.UI.header({
      title: 'ぷにっち',
      soundOn: Sound.isEnabled(),
      onBack: onBack,
      onSound: function () { return Sound.toggleFromTap(); },
      onSettings: openMenu
    });
    document.body.insertBefore(header, document.body.firstChild);

    function later(fn, ms) { timers.push(setTimeout(fn, ms)); }
    function clearTimers() { timers.forEach(clearTimeout); timers = []; }
    function sfx(name, opts) { if (game) { Sound.play(name, opts); } }
    function inPlay() { var p = controller.phase(); return !!game && (p === 'countdown' || p === 'playing'); }
    function reduced() { return C.Effects.isReduced(); }

    // ---------- settings screen ----------

    function panel(title) {
      var p = el('section', 'ch-panel');
      p.appendChild(el('h2', null, title));
      settingsScreen.appendChild(p);
      return p;
    }

    function renderSettings() {
      settingsScreen.innerHTML = '';
      var p1 = panel('キャラ');
      p1.appendChild(el('div', 'ch-pickname', profileOf(draft.char).name));
      var list = el('div', 'ch-charlist');
      C.Characters.list().forEach(function (pf) {
        var b = button('ch-charbtn', undefined, function () { draft.char = pf.id; renderSettings(); });
        b.setAttribute('aria-pressed', String(draft.char === pf.id));
        b.setAttribute('aria-label', pf.name);
        var face = el('span', 'ch-charface');
        faceInto(face, pf, 'normal');
        b.appendChild(face);
        list.appendChild(b);
      });
      p1.appendChild(list);

      var p2 = panel('むずかしさ');
      var levels = el('div', 'ch-levels');
      LEVELS.forEach(function (it) {
        var cfg = K.DIFFICULTY[it[0]];
        var b = button('ch-choice ch-level', undefined, function () { draft.difficulty = it[0]; renderSettings(); });
        b.appendChild(el('span', 'ch-level-name', it[1]));
        var meta = el('span', 'ch-level-meta');
        meta.appendChild(el('span', 'ch-level-goal', cfg.sleepers + 'にん おこそう'));
        meta.appendChild(el('span', 'ch-level-time', minutesOf(cfg.timeMs)));
        if (cfg.turnMs !== null) { meta.appendChild(el('span', 'ch-level-turn', 'ねがえりするよ')); }
        var best = controller.bestTimeOf(it[0]);
        if (best > 0) { meta.appendChild(el('span', 'ch-level-best', 'ベスト ' + clockOf(best))); }
        b.appendChild(meta);
        b.setAttribute('aria-pressed', String(draft.difficulty === it[0]));
        levels.appendChild(b);
      });
      p2.appendChild(levels);

      var p3 = el('section', 'ch-panel ch-startpanel');
      p3.appendChild(button('btn btn-main ch-start', 'はじめる', startGame));
      p3.appendChild(button('btn btn-sub ch-howto', 'あそびかた', function () { showHowTo(false); }));
      settingsScreen.appendChild(p3);
    }

    // The how-to card (design 3.2): before the first round, and from the あそびかた button.
    function showHowTo(beforeStart) {
      var pf = profileOf(draft.char);
      var m = null;
      var body = el('div', 'ch-howto-body');
      var face = el('div', 'ch-howto-face');
      faceInto(face, pf, 'joy');
      body.appendChild(face);
      body.appendChild(el('p', 'ch-howto-text', 'おなじ いろを 4つ つなげると きえるよ'));
      body.appendChild(el('p', 'ch-howto-text', 'ねている ともだちの となりで けすと おきるよ'));
      body.appendChild(el('p', 'ch-howto-text', 'みんな おこしたら クリア！'));
      body.appendChild(el('p', 'ch-howto-text', 'おこすと じかんが のびるよ'));
      var acts = el('div', 'ch-menu');
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
      var s = { char: draft.char, difficulty: draft.difficulty };
      controller.start(s);
      beginRound(s);
    }

    function beginRound(settings) {
      clearTimers();
      Fx.stop();
      var cg = controller.game();
      game = {
        settings: settings, profile: profileOf(settings.char),
        cell: 0, dpr: 1, clockSec: -1, hurry: false, almost: false, shownLeft: cg.sleepers, flying: 0,
        bubbleUntil: 0, reactToken: 0, lastArrive: 0, pending: null, resultShown: false,
        clockMs: 0, popping: null, falls: [], wiggle: null, settle: null
      };
      buildGame();
      settingsScreen.hidden = true;
      gameScreen.hidden = false;
      document.body.classList.add('ch-playing');
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
      var wrap = el('div', 'ch-game');

      var boardWrap = el('div', 'ch-boardwrap');
      var frame = el('div', 'ch-boardframe');
      var canvas = el('canvas', 'ch-board');
      frame.appendChild(canvas);
      boardWrap.appendChild(frame);

      var info = el('div', 'ch-info');
      var clock = el('div', 'ch-clock');
      var clockTime = el('span', 'ch-clocktime');
      clock.appendChild(el('span', 'ch-clocklabel', 'のこり '));
      clock.appendChild(clockTime);
      var next = el('div', 'ch-next');
      next.appendChild(el('span', 'ch-label', 'つぎ'));
      var nextCanvas = el('canvas', 'ch-nextcanvas');
      next.appendChild(nextCanvas);
      info.appendChild(clock);
      info.appendChild(next);

      var buddy = el('div', 'ch-buddy');
      var faceWrap = el('div', 'ch-facewrap');
      var face = el('div', 'ch-face');
      faceInto(face, game.profile, 'normal');
      var mark = el('span', 'ch-mark');
      mark.setAttribute('aria-hidden', 'true');
      var sayEl = el('div', 'ch-say');
      faceWrap.appendChild(face);
      faceWrap.appendChild(mark);
      faceWrap.appendChild(sayEl);
      var friends = el('div', 'ch-friends');
      var title = el('div', 'ch-friendtitle');
      title.appendChild(document.createTextNode('おきた'));
      title.appendChild(document.createElement('br'));
      title.appendChild(document.createTextNode('ともだち'));
      var friendBody = el('div', 'ch-friendbody');
      var left = el('div', 'ch-left');
      friends.appendChild(title);
      friends.appendChild(friendBody);
      friends.appendChild(left);
      buddy.appendChild(faceWrap);
      buddy.appendChild(friends);

      var padEl = el('div', 'ch-pad');
      game.pads = [];
      ['move', 'act'].forEach(function (group) {
        var g = el('div', 'ch-pad-' + group);
        PADS[group].forEach(function (p) { g.appendChild(padButton(p[0], p[1], p[2])); });
        padEl.appendChild(g);
      });

      var overlay = el('div', 'ch-overlay');
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
      game.face = face;
      game.mark = mark;
      game.say = sayEl;
      game.friends = friends;
      game.friendBody = friendBody;
      game.leftEl = left;
      game.overlay = overlay;
    }

    // Input (design 4): pointerdown moves once; held buttons repeat in the controller until this finger lifts,
    // is cancelled or leaves the button. Each button follows its own pointerId, so two fingers work together.
    function padButton(action, icon, label) {
      var b = el('button', 'ch-padbtn');
      b.type = 'button';
      b.appendChild(el('span', 'ch-ico', icon));   // hard drop: the same arrow onto a CSS floor bar
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
      if (e.repeat) { return; }   // a held key repeats in the controller
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
      var nc = Math.max(14, Math.min(30, Math.round(cell * 0.75)));
      game.nextCell = nc;
      game.nextCanvas.style.width = nc + 'px';
      game.nextCanvas.style.height = (nc * 2) + 'px';
      game.nextCanvas.width = Math.round(nc * dpr);
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

    // Wobble (popping balls, the warned sleeper) and fall offsets for this moment (design 5.2). None in reduced motion.
    function motion() {
      var wobble = {}, falling = {};
      if (reduced()) { return { wobble: wobble, falling: falling }; }
      var t = game.clockMs;
      if (game.popping) {
        game.popping.cells.forEach(function (p, i) { wobble[key(p.col, p.row)] = Math.sin(t / 22 + i) * WOBBLE_AMP; });
      }
      if (game.wiggle && t < game.wiggle.until) { wobble[game.wiggle.key] = Math.sin(t / 45) * WIGGLE_AMP; }
      game.falls.forEach(function (f) {
        var dur = f.dist * K.FALL_CELL_MS, e = t - f.start;
        if (e < dur) { falling[f.key] = -f.dist * (1 - e / dur); }
      });
      return { wobble: wobble, falling: falling };
    }

    function redraw() {
      var cg = controller.game();
      if (!game || !cg || !game.cell) { return; }
      var m = motion();
      R.draw(game.ctx, cg, { cell: game.cell, dpr: game.dpr, images: images, wobble: m.wobble, falling: m.falling });
    }
    function drawNext() {
      var cg = controller.game();
      if (!game || !cg || !game.nextCell) { return; }
      R.drawNext(game.nextCtx, cg.next, { cell: game.nextCell, dpr: game.dpr, images: images });
    }

    function paintCounts() { game.leftEl.textContent = 'のこり ' + Math.max(0, game.shownLeft) + 'にん'; }

    // The clock: repainted only when the whole seconds change. Under HURRY_MS it turns red, ticks once a second
    // and the BGM runs at HURRY_BPM.
    function paintClock() {
      var cg = controller.game();
      if (!game || !cg) { return; }
      var sec = Math.ceil(cg.timeMs / 1000);
      if (sec === game.clockSec) { return; }
      var first = game.clockSec < 0;
      game.clockSec = sec;
      game.clockTime.textContent = clockOf(sec);
      var hurry = inPlay() && cg.timeMs <= K.HURRY_MS;   // the clock stops blinking once the round is over
      if (hurry && sec > 0 && !first) { sfx('chain-tick'); }
      if (hurry === game.hurry) { return; }
      game.hurry = hurry;
      game.clock.classList.toggle('is-hurry', hurry);
      if (Sound.isBgmOn() && inPlay() && !controller.isPaused()) { Bgm.setTempo(bpmNow()); }
    }
    function bpmNow() { return game.hurry ? G.Sounds.HURRY_BPM : (game.almost ? G.Sounds.ALMOST_BPM : G.Sounds.BGM.bpm); }

    // The one-time "almost" (design 3.3): the friends panel glows, faster BGM and the forced line.
    function showAlmost() {
      game.almost = true;
      game.friends.classList.add('is-almost');
      if (Sound.isBgmOn()) { Bgm.setTempo(bpmNow()); }   // under 10 s the hurry tempo stays
      say('almost', BUBBLE_MS, true);
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

    // The chosen character's face, back to normal after a moment (design 5.1).
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

    function cellAt(col, row) { return L.cellCenter(game.canvas.getBoundingClientRect(), game.cell, col, row); }

    // Woken friends fly from their cells to the friends panel; のこり goes down as each one lands (design 5.2).
    function flyFaces(cells) {
      var to = centerOf(game.friendBody);
      var gap = Math.min(80, 300 / Math.max(1, cells.length));
      var size = Math.max(22, game.cell * 0.95);
      cells.forEach(function (f, i) {
        game.flying++;
        var g = game;
        Fx.fly(cellAt(f.col, f.row), to, profileOf(f.charId), size, {
          delay: Math.round(i * gap),
          deco: i,
          onLand: function () { if (game === g) { land(f); } }
        });
      });
    }

    function land(f) {
      game.flying--;
      if (game.resultShown) { return; }   // the result card already shows the final counts
      game.shownLeft--;
      var mini = el('span', 'ch-friendface');
      faceInto(mini, profileOf(f.charId), 'joy');
      game.friendBody.appendChild(mini);
      while (game.friendBody.children.length > FRIENDS_SHOWN) { game.friendBody.removeChild(game.friendBody.firstChild); }
      var now = Date.now();
      if (now - game.lastArrive >= ARRIVE_GAP_MS) { game.lastArrive = now; sfx('chain-arrive'); }
      paintCounts();
      if (game.flying <= 0 && game.pending) { showResult(); }
    }

    // The popped balls left the board (the engine removes them after WOBBLE_MS): sparkles where they were.
    function checkPopped() {
      var p = game.popping, cg = controller.game();
      if (!p || !cg) { return; }
      var first = p.cells[0];
      if (cg.board[first.row][first.col] === first.obj) { return; }
      game.popping = null;
      Fx.sparkles(p.cells.map(function (c) { return cellAt(c.col, c.row); }), game.cell);
    }

    // One screen effect per lock (design 5.3): the top one of the whole chain, then the face and one bubble.
    function finishSettle() {
      if (!game.settle) { return; }
      var events = game.settle;
      game.settle = null;
      var fx = G.Reactions.screenFx(events);
      if (fx === 'chain3') { Fx.flash(game.frame); Fx.sparkle(centerOf(game.frame)); }
      else if (fx === 'chain2') { Fx.flash(game.frame); }
      else if (fx === 'wake') { Fx.sparkle(centerOf(game.friends)); }
      // A lock that ends the game leaves face and line to the result screen (phase is not 'result' yet here).
      var last = events.length ? events[events.length - 1].type : '';
      if (last === 'over' || last === 'clear') { return; }
      var r = reactions.forSettled(fx);
      if (r.emotion) { react(r.emotion); }
      if (r.situation && controller.phase() === 'playing') { say(r.situation); }
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
      var card = el('div', 'ch-card ' + (cls || ''));
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
      showOverlay('ch-pause', [el('p', 'ch-card-text', 'ひとやすみ ちゅう'), button('btn btn-main ch-resume', 'つづける', resumeGame)]);
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

    // Result (design 3.5): waits for flying friends (at most RESULT_WAIT_MS), then shows the card once.
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
      var cg = controller.game();
      game.shownLeft = cg ? cg.sleepers : 0;
      paintCounts();
      var pf = game.profile;
      var res = reactions.forResult(r.cleared ? 'clear' : (r.reason === 'timeup' ? 'timeup' : 'over'), r.newTime);
      var nodes = [];
      nodes.push(el('p', 'ch-card-text', r.cleared ? 'みんな おきたよ！' : (r.reason === 'timeup' ? 'じかんです' : 'おしまい')));
      var hero = el('div', 'ch-hero' + (r.cleared ? ' is-win' : ''));
      var face = el('div', 'ch-heroface');
      faceInto(face, pf, res.emotion);
      hero.appendChild(face);
      hero.appendChild(el('p', 'ch-line', line(res.situation)));
      nodes.push(hero);
      nodes.push(el('p', 'ch-result-score', r.woke + 'にん おこしたよ' + (r.cleared ? '！' : '')));
      if (r.cleared) {   // the time, and しんきろく！ when it is the best (design 2.10)
        var tm = el('p', 'ch-result-time', 'タイム ' + clockOf(r.timeSec));
        if (r.newTime) { tm.appendChild(el('span', 'ch-result-newtime', 'しんきろく！')); }
        nodes.push(tm);
      }
      var acts = el('div', 'ch-result-actions');
      acts.appendChild(button('btn btn-main ch-again', 'もういっかい', again));
      acts.appendChild(button('btn btn-sub ch-tosettings', 'せっていに もどる', showSettings));
      nodes.push(acts);
      showOverlay('ch-result', nodes);
      sfx(r.cleared ? 'chain-clear' : 'chain-over');
      if (r.cleared) { Fx.confetti(); }
    }

    function again() {
      var s = { char: game.settings.char, difficulty: game.settings.difficulty };
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
      document.body.classList.remove('ch-playing');
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
      var acts = el('div', 'ch-menu');
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
        var acts = el('div', 'ch-menu');
        acts.appendChild(button('btn btn-main', 'さいしょから', function () { m.close(); showSettings(); }));
        nodes.push(acts);
      }
      var row = el('div', 'ch-rule');
      row.appendChild(el('span', 'ch-rulename', 'BGM'));
      var opts = el('div', 'ch-choices');
      [[true, 'ON'], [false, 'OFF']].forEach(function (it) {
        var b = button('ch-choice', it[1], function () {
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
    function collect(e) { if (game.settle) { game.settle.push(e); } }

    on('count', function (p) { Fx.showBanner(String(p.n), 'is-count', 800); sfx('chain-count'); });
    on('go', function () { Fx.showBanner('スタート！', 'is-go', 900); sfx('chain-go'); });
    on('spawn', function () { drawNext(); redraw(); });
    on('moved', function (p) { if (MOVE_SOUND[p.action]) { sfx(MOVE_SOUND[p.action]); } });
    on('lock', function () { game.settle = []; sfx('chain-lock'); redraw(); });
    on('fall', function (p) {
      game.falls = p.moves.map(function (m) { return { key: key(m.to[0], m.to[1]), dist: m.to[1] - m.from[1], start: game.clockMs }; });
      redraw();
    });
    // A group pops: it wobbles for WOBBLE_MS (the engine waits), then sparkles (checkPopped). Face per step (design 5.1).
    on('pop', function (p) {
      collect(p);
      checkPopped();   // the step before may already be gone in this same advance (no fall in between)
      var cg = controller.game();
      game.popping = { cells: p.cells.map(function (c) { return { col: c.col, row: c.row, obj: cg.board[c.row][c.col] }; }) };
      sfx('chain-pop', { chain: p.chain });
      react(reactions.forPop(p.chain));
      if (p.chain >= 2) {
        var sx = 0, sy = 0;
        p.cells.forEach(function (c) { var q = cellAt(c.col, c.row); sx += q.x; sy += q.y; });
        Fx.chainText({ x: sx / p.cells.length, y: sy / p.cells.length - game.cell }, p.chain);
      }
    });
    on('wake', function (p) { collect(p); sfx('chain-wake'); flyFaces(p.cells); });
    on('almost', showAlmost);
    // A wake adds time: "+N" next to the clock for a moment (the clock itself repaints on the next step).
    on('time', function (p) {
      var n = Math.round(p.addMs / 1000);
      if (n <= 0) { return; }
      sfx('chain-time');
      Array.prototype.forEach.call(game.clock.querySelectorAll('.ch-timeadd'), function (x) { x.parentNode.removeChild(x); });
      var add = el('span', 'ch-timeadd', '+' + n);
      add.setAttribute('aria-hidden', 'true');
      game.clock.appendChild(add);
      later(function () { if (add.parentNode) { add.parentNode.removeChild(add); } }, TIMEADD_MS);
    });
    // Turn (hard only, design 2.7): the warned sleeper wiggles for TURN_WARN_MS; then a ball falls asleep.
    on('turnWarn', function (p) {
      game.wiggle = { key: key(p.sleeper[0], p.sleeper[1]), until: game.clockMs + K.TURN_WARN_MS };
      sfx('chain-turnwarn');
    });
    on('turnCancel', function () { game.wiggle = null; });
    on('turn', function (p) {
      game.wiggle = null;
      game.shownLeft++;
      paintCounts();
      Fx.zzz(cellAt(p.cell[0], p.cell[1]));
      sfx('chain-turn');
      react(reactions.forTurn());
      say('turn');
      redraw();
    });
    on('settled', finishSettle);
    on('clear', function (p) { collect(p); finishSettle(); });
    on('over', function (p) { collect(p); finishSettle(); });
    on('danger', function (p) { game.frame.classList.toggle('is-danger', !!p.on); });
    on('result', onResult);

    function onResize() { applyLayout(); }
    window.addEventListener('resize', onResize);
    window.addEventListener('orientationchange', onResize);

    showSettings();

    return {
      // Moves the animation clock, repaints the clock and redraws the board; called after controller.advance.
      step: function (ms) {
        if (!game) { return; }
        game.clockMs += ms || 0;
        checkPopped();
        if (game.wiggle && game.clockMs >= game.wiggle.until) { game.wiggle = null; }
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
})(Ailand.games.chain);
