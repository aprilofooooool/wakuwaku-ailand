(function (G) {
  'use strict';
  // territory screens: settings (design 4.3), how-to (2.5) and play (3, 4.4) with drag. DOM is touched only after init().
  // Bus events are applied synchronously; the CPU flash is a timed overlay that never blocks input.
  // Full-screen effects (reaction `screen`) and the result screen come in Task 8 (fx.js); gameover shows a simple card.
  var C = Ailand.core, K = G.Constants, E = G.Engine, L = G.Layout, R = G.Render, P = C.Piece;
  var Sound = C.Sound, Bgm = C.Bgm;

  var LEVELS = [['weak', 'よわい'], ['normal', 'ふつう'], ['strong', 'つよい']];
  var FIRSTS = [['me', 'じぶん'], ['them', 'あいて'], ['random', 'ランダム']];
  // Design 2.5: why a piece went back to the tray ('out' and 'overlap' need no words).
  var TIPS = {
    edge: 'じぶんの いろと へんで くっつけちゃ だめ',
    corner: 'じぶんの いろと かどで つなげよう',
    start: 'さいしょは ひかってる すみから'
  };
  var TERMINAL = { win: 1, lose: 1, draw: 1 };
  var SOUND_OF = { big: 'territory-big', block: 'territory-block', rest: 'territory-rest' };
  var TRAY_SPAN = 4;           // a tray cell fits the longest piece (4 cells) in one slot
  var TRAY_PAD = 8;            // room (px) around a piece inside its slot
  var FRAME_PX = 6;            // board frame border, both sides (css .tr-boardframe)
  var MAX_DPR = 3;
  var FLASH_MS = 400;          // a CPU piece shines on its spot before it shows as placed (design 3)
  var GREETING_MS = 2000;
  var BUBBLE_MS = 2400;
  var TAP_PX = C.Pointer.TAP_MOVE_PX;
  var NL = '\n';

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
  function hasKey(pairs, k) { return pairs.some(function (p) { return p[0] === k; }); }
  function sizeOf(cells) {
    var w = 0, h = 0;
    cells.forEach(function (c) { w = Math.max(w, c[0] + 1); h = Math.max(h, c[1] + 1); });
    return { w: w, h: h };
  }
  function dprNow() { return Math.min(MAX_DPR, window.devicePixelRatio || 1); }
  function sizeCanvas(cv, w, h, dpr) {
    cv.style.width = w + 'px';
    cv.style.height = h + 'px';
    cv.width = Math.round(w * dpr);
    cv.height = Math.round(h * dpr);
  }
  function inRect(r, x, y) { return x >= r.left && x <= r.right && y >= r.top && y <= r.bottom; }

  // Fills gaps in saved/partial settings; characters stay unique per seat.
  function normalize(raw) {
    var r = raw && typeof raw === 'object' ? raw : {};
    var ids = K.CHARS.slice();
    C.Characters.list().forEach(function (p) { if (ids.indexOf(p.id) < 0) { ids.push(p.id); } });
    var players = [2, 3, 4].indexOf(r.players) >= 0 ? r.players : 2;
    var s = {
      players: players,
      level: hasKey(LEVELS, r.level) ? r.level : 'weak',
      first: hasKey(FIRSTS, r.first) ? r.first : 'random',
      seats: []
    };
    var old = Array.isArray(r.seats) ? r.seats : [];
    var used = {};
    for (var seat = 1; seat <= players; seat++) {
      var o = old[seat - 1];
      var id = o && ids.indexOf(o.charId) >= 0 && !used[o.charId] ? o.charId : null;
      if (!id) { id = ids.filter(function (x) { return !used[x]; })[0]; }
      used[id] = true;
      s.seats.push({ seat: seat, charId: id, human: o ? !!o.human : seat === 1 });
    }
    return s;
  }

  // deps: { bus, linePicker? }. Returns { destroy(), clearTip() }.
  function init(root, controller, deps) {
    var d = deps || {};
    var bus = d.bus;
    if (!bus || typeof bus.on !== 'function') { throw new Error('territory UI.init: deps.bus (EventBus) is required'); }
    var linePicker = d.linePicker || null;
    var draft = normalize(controller.loadSettings());
    var game = null;          // per-game view state (see buildGame)
    var timers = [];
    var detachDrag = null;
    var resumeOnShow = false; // a CPU turn was interrupted by hiding the page (design 4.6)
    var quiet = false;        // the 'started' of that silent resume: no greeting

    var settingsScreen = el('main', 'screen tr-settings-screen');
    settingsScreen.id = 'screen-settings';
    var gameScreen = el('main', 'screen tr-game-screen');
    gameScreen.id = 'screen-game';
    gameScreen.hidden = true;
    root.appendChild(settingsScreen);
    root.appendChild(gameScreen);

    var header = C.UI.header({
      title: 'ピースじんとり',
      soundOn: Sound.isEnabled(),
      onBack: function () { Bgm.stop(); location.href = C.CharacterView.basePath() + 'index.html'; },
      onSound: function () { return Sound.toggleFromTap(); },
      onSettings: openMenu
    });
    document.body.insertBefore(header, document.body.firstChild);

    function later(fn, ms) {
      var id = setTimeout(function () { timers = timers.filter(function (x) { return x !== id; }); fn(); }, ms);
      timers.push(id);
      return id;
    }
    function cancel(id) { clearTimeout(id); timers = timers.filter(function (x) { return x !== id; }); }
    function sfx(name) { if (game && !gameScreen.hidden) { Sound.play(name); } }

    // ---------- settings screen ----------

    function panel(title, cls) {
      var p = el('section', 'tr-panel' + (cls ? ' ' + cls : ''));
      if (title) { p.appendChild(el('h2', null, title)); }
      settingsScreen.appendChild(p);
      return p;
    }
    function choices(parent, items, isOn, onPick) {
      var row = el('div', 'tr-choices');
      items.forEach(function (it) {
        var b = button('tr-choice', it.label, function () { onPick(it); renderSettings(); });
        b.setAttribute('aria-pressed', String(isOn(it)));
        row.appendChild(b);
      });
      parent.appendChild(row);
    }
    function chip(color) {
      var c = el('span', 'tr-chip');
      c.style.background = color;
      c.setAttribute('aria-hidden', 'true');
      return c;
    }

    function renderSettings() {
      settingsScreen.innerHTML = '';
      var profiles = C.Characters.list().filter(function (p) { return K.CHARS.indexOf(p.id) >= 0; });

      var p1 = panel('なんにんで あそぶ？');
      choices(p1, [2, 3, 4].map(function (n) { return { n: n, label: n + 'にん' }; }),
        function (it) { return it.n === draft.players; },
        function (it) { draft = normalize({ players: it.n, level: draft.level, first: draft.first, seats: draft.seats }); });

      var p2 = panel('せきと キャラ');
      draft.seats.forEach(function (st) {
        var picked = C.Characters.get(st.charId);
        var row = el('div', 'tr-seatrow');
        var head = el('div', 'tr-seathead');
        head.appendChild(chip(picked.colors.main));
        head.appendChild(el('span', 'tr-seatlabel', st.seat + 'P ' + picked.name));
        var who = button('tr-choice tr-who', st.human ? 'ひと' : 'CPU', function () { st.human = !st.human; renderSettings(); });
        who.setAttribute('aria-pressed', String(st.human));
        who.setAttribute('aria-label', st.seat + 'P：' + (st.human ? 'ひと' : 'CPU'));
        head.appendChild(who);
        row.appendChild(head);
        var list = el('div', 'tr-charlist');
        profiles.forEach(function (pf) {
          var b = button('tr-charbtn', undefined, function () {
            // Picking a character used by another seat swaps the two (no duplicates).
            var other = draft.seats.filter(function (x) { return x.charId === pf.id; })[0];
            if (other) { other.charId = st.charId; }
            st.charId = pf.id;
            renderSettings();
          });
          b.setAttribute('aria-pressed', String(st.charId === pf.id));
          b.setAttribute('aria-label', st.seat + 'P：' + pf.name);
          var face = el('span', 'tr-charface');
          faceInto(face, pf, 'normal');
          b.appendChild(face);
          list.appendChild(b);
        });
        row.appendChild(list);
        p2.appendChild(row);
      });

      if (draft.seats.some(function (x) { return !x.human; })) {
        var p3 = panel('CPU の つよさ');
        choices(p3, LEVELS.map(function (l) { return { id: l[0], label: l[1] }; }),
          function (it) { return it.id === draft.level; }, function (it) { draft.level = it.id; });
      }
      if (draft.players === 2) {
        var p4 = panel('どっちが さき？');
        choices(p4, FIRSTS.map(function (f) { return { id: f[0], label: f[1] }; }),
          function (it) { return it.id === draft.first; }, function (it) { draft.first = it.id; });
      }

      var p5 = panel(null, 'tr-startpanel');
      p5.appendChild(button('btn btn-main tr-start', 'はじめる', function () {
        if (!controller.start(draft)) { C.UI.toast('はじめられなかったよ'); }
      }));
      if (controller.hasSave()) {
        p5.appendChild(button('btn btn-sub tr-resume', 'つづきから', function () {
          if (!controller.resume()) { C.UI.toast('つづきが よめなかったよ'); renderSettings(); }
        }));
      }
      p5.appendChild(button('btn btn-sub tr-howto', 'あそびかた', showHowTo));
    }

    // ---------- how-to (design 2.5): four pictures with one line each ----------

    var HOW_CELL = 18;
    function picture(n, cells1, cells2, dot) {
      var dpr = dprNow(), cv = el('canvas', 'tr-howto-pic');
      var c1 = C.Characters.get(K.CHARS[0]).colors.main, c2 = C.Characters.get(K.CHARS[1]).colors.main;
      sizeCanvas(cv, n * HOW_CELL, n * HOW_CELL, dpr);
      var b = [];
      for (var y = 0; y < n; y++) { b.push([]); for (var x = 0; x < n; x++) { b[y].push(0); } }
      (cells1 || []).forEach(function (c) { b[c[1]][c[0]] = 1; });
      (cells2 || []).forEach(function (c) { b[c[1]][c[0]] = 2; });
      var ctx = cv.getContext('2d');
      R.board(ctx, { size: n, cell: HOW_CELL, dpr: dpr, board: b, colors: { 1: c1, 2: c2 },
        corners: dot ? [{ x: 0, y: 0, color: c1 }] : [] });
      if (dot) { R.dots(ctx, { cell: HOW_CELL, dpr: dpr, color: c1, dots: [{ x: 0, y: 0, big: true }], keep: true }); }
      return cv;
    }
    function howRow(text, pics) {
      var row = el('div', 'tr-howto-row');
      var p = el('div', 'tr-howto-pics');
      pics.forEach(function (x) { p.appendChild(x); });
      row.appendChild(p);
      row.appendChild(el('p', 'tr-howto-text', text));
      return row;
    }
    function labelled(cv, mark) {
      var w = el('span', 'tr-howto-fig');
      w.appendChild(cv);
      w.appendChild(el('span', 'tr-howto-mark', mark));
      return w;
    }
    function showHowTo() {
      controller.markHowToSeen();
      var body = el('div', 'tr-howto-body');
      body.appendChild(howRow('さいしょは じぶんの すみから おこう', [picture(4, [], [], true)]));
      body.appendChild(howRow('じぶんの いろとは かどで つなげるよ', [
        labelled(picture(4, [[0, 0], [1, 0], [0, 1], [2, 1], [2, 2], [3, 2]]), '○'),
        labelled(picture(4, [[0, 0], [1, 0], [0, 1], [2, 0], [2, 1]]), '×')
      ]));
      body.appendChild(howRow('あいての いろとは くっついても いいよ', [
        picture(4, [[0, 0], [1, 0], [0, 1], [2, 1]], [[1, 1], [1, 2], [2, 2], [3, 2]])
      ]));
      body.appendChild(howRow('いちばん たくさん おけた ひとの かち！', []));
      var m = null;
      var acts = el('div', 'tr-menu');
      acts.appendChild(button('btn btn-main', 'わかった', function () { m.close(); }));
      body.appendChild(acts);
      m = C.UI.modal('あそびかた', [body]);
    }

    function showSettings() {
      leaveGame();
      settingsScreen.hidden = false;
      renderSettings();
      startBgm();
      window.scrollTo(0, 0);
    }

    // ---------- play screen ----------

    function colorOf(seat) { return game.seats[seat].color; }
    function humanSeats(s) { return s.seats.filter(function (x) { return x.human; }).map(function (x) { return x.seat; }); }

    function buildGame(settings) {
      if (detachDrag) { detachDrag(); detachDrag = null; }
      gameScreen.innerHTML = '';
      var wrap = el('div', 'tr-game');
      var cards = el('div', 'tr-cards');
      var seats = {};
      settings.seats.forEach(function (st) {
        var profile = C.Characters.get(st.charId);
        var card = el('div', 'tr-card');
        card.setAttribute('data-seat', String(st.seat));
        card.style.setProperty('--seat', profile.colors.main);
        var faceWrap = el('div', 'tr-facewrap');
        var face = el('div', 'tr-face');
        var mark = el('span', 'tr-mark');
        mark.setAttribute('aria-hidden', 'true');
        faceWrap.appendChild(face);
        faceWrap.appendChild(mark);
        var info = el('div', 'tr-info');
        info.appendChild(chip(profile.colors.main));
        var count = el('span', 'tr-count', '0');
        info.appendChild(count);
        var rest = el('div', 'tr-rest', 'おやすみ');
        rest.hidden = true;
        var bubble = el('div', 'tr-bubble');
        bubble.setAttribute('aria-live', 'polite');
        card.appendChild(faceWrap);
        card.appendChild(info);
        card.appendChild(rest);
        card.appendChild(bubble);
        cards.appendChild(card);
        seats[st.seat] = { card: card, face: face, mark: mark, count: count, rest: rest, bubble: bubble,
          profile: profile, color: profile.colors.main, human: st.human, emotion: null };
      });

      var boardWrap = el('div', 'tr-boardwrap');
      var frame = el('div', 'tr-boardframe');
      var canvas = el('canvas', 'tr-board');
      var dotsCv = el('canvas', 'tr-dots');
      frame.appendChild(canvas);
      frame.appendChild(dotsCv);
      boardWrap.appendChild(frame);

      var tip = el('div', 'tr-tip');
      tip.setAttribute('aria-live', 'polite');
      var tray = el('div', 'tr-tray');
      var acts = el('div', 'tr-acts');
      var rotate = button('tr-actbtn', undefined, function () { turnSelected('rotate'); });
      rotate.setAttribute('data-action', 'rotate');
      rotate.appendChild(el('span', 'tr-ico', '↻'));
      rotate.appendChild(el('span', 'tr-actlabel', 'まわす'));
      var flip = button('tr-actbtn', undefined, function () { turnSelected('flip'); });
      flip.setAttribute('data-action', 'flip');
      flip.appendChild(el('span', 'tr-ico', '⇋'));
      flip.appendChild(el('span', 'tr-actlabel', 'うらがえす'));
      var undo = button('tr-actbtn tr-undo', '', onUndo);
      undo.setAttribute('data-action', 'undo');
      acts.appendChild(rotate);
      acts.appendChild(flip);
      acts.appendChild(undo);

      wrap.appendChild(cards);
      wrap.appendChild(boardWrap);
      wrap.appendChild(tip);
      wrap.appendChild(tray);
      wrap.appendChild(acts);
      var result = el('div', 'tr-result');
      result.hidden = true;
      wrap.appendChild(result);
      gameScreen.appendChild(wrap);

      var humans = humanSeats(settings);
      game = {
        wrap: wrap, seats: seats, boardWrap: boardWrap, canvas: canvas, ctx: canvas.getContext('2d'),
        dotsCv: dotsCv, dotsCtx: dotsCv.getContext('2d'), tip: tip, tipTimer: null, tray: tray, result: result,
        rotate: rotate, flip: flip, undo: undo,
        humans: humans, cpus: settings.seats.length - humans.length,
        turnSeat: 0, humanTurn: false, over: false, fast: false,
        cell: 0, dpr: 1, selected: null, orient: {}, drag: null, flash: null, flashTimer: null,
        greetUntil: 0
      };
      detachDrag = C.Drag.attach(wrap, { pick: pick, onStart: onDragStart, onMove: onDragMove, onEnd: onDragEnd, onCancel: onDragCancel });
    }

    function showGame() {
      settingsScreen.hidden = true;
      gameScreen.hidden = false;
      document.body.classList.add('tr-playing');
      window.scrollTo(0, 0);
    }

    function leaveGame() {
      idle.stop();
      controller.stop();
      endDrag();
      timers.forEach(clearTimeout);
      timers = [];
      if (detachDrag) { detachDrag(); detachDrag = null; }
      game = null;
      resumeOnShow = false;
      gameScreen.hidden = true;
      gameScreen.innerHTML = '';
      document.body.classList.remove('tr-playing');
    }

    // Board cell size: the largest square board that fits its area (design 4.4). Canvas follows devicePixelRatio.
    function applyLayout() {
      if (!game) { return; }
      var size = controller.state().size;
      var r = game.boardWrap.getBoundingClientRect();
      game.cell = Math.max(4, Math.floor((Math.min(r.width, r.height) - FRAME_PX) / size));
      game.dpr = dprNow();
      sizeCanvas(game.canvas, game.cell * size, game.cell * size, game.dpr);
      sizeCanvas(game.dotsCv, game.cell * size, game.cell * size, game.dpr);
      refresh();
    }

    // Whose pieces the tray shows: the seat on turn; on a CPU turn with one human, that human's (locked).
    function traySeat() {
      if (game.humanTurn) { return game.turnSeat; }
      if (game.humans.length === 1) { return game.humans[0]; }
      return game.turnSeat || game.humans[0] || 1;
    }
    function locked() { return !game || !game.humanTurn || game.over || !controller.state(); }
    function orientOf(seat, id) {
      var k = seat + ':' + id;
      if (!game.orient[k]) { game.orient[k] = { rot: 0, flip: 0 }; }
      return game.orient[k];
    }
    function cellsOf(seat, id) {
      var o = orientOf(seat, id);
      return P.orient(G.Pieces.byId(id).cells, o.rot, o.flip);
    }

    function renderTray() {
      if (!game) { return; }
      var state = controller.state(), seat = traySeat(), tray = game.tray;
      tray.innerHTML = '';
      tray.classList.toggle('is-locked', locked());
      var items = state.hands[seat].map(function (id) {
        var o = orientOf(seat, id);
        var off = !E.canPlace(state, seat, id);
        var item = el('div', 'tr-tpiece' + (id === game.selected ? ' is-selected' : '') + (off ? ' is-off' : ''));
        item.setAttribute('data-piece-id', id);
        item.setAttribute('data-rot', String(o.rot));
        item.setAttribute('data-flip', String(o.flip));
        if (game.drag && game.drag.moved && game.drag.id === id) { item.style.visibility = 'hidden'; }
        tray.appendChild(item);
        return { id: id, item: item, off: off };
      });
      // All slots are the same size (css grid): one tray cell size fits the longest piece in a slot.
      var slot = items.length ? items[0].item.getBoundingClientRect() : { width: 0, height: 0 };
      var tc = Math.max(3, Math.floor((Math.min(slot.width, slot.height) - TRAY_PAD) / TRAY_SPAN));
      items.forEach(function (it) {
        var cells = cellsOf(seat, it.id), sz = sizeOf(cells);
        var cv = el('canvas');
        sizeCanvas(cv, sz.w * tc, sz.h * tc, game.dpr);
        R.piece(cv.getContext('2d'), cells, tc, game.dpr, colorOf(seat), it.off);
        it.item.appendChild(cv);
      });
      paintActs();
    }

    // まわす / うらがえす act on the selected piece (design 3); 1て もどす only with one human and a CPU.
    function paintActs() {
      var off = locked() || !game.selected;
      game.rotate.disabled = off;
      game.flip.disabled = off;
      var u = game.undo;
      u.hidden = !(game.humans.length === 1 && game.cpus > 0 && controller.undoLeft() > 0);
      u.textContent = '1て もどす' + NL + 'のこり' + controller.undoLeft();
      u.setAttribute('aria-label', '1て もどす');
      u.setAttribute('aria-disabled', String(!controller.canUndo() || game.over));
    }

    function renderCards() {
      var state = controller.state();
      Object.keys(game.seats).forEach(function (k) {
        var s = Number(k), v = game.seats[k];
        v.count.textContent = String(state.placed[s]);
        v.card.classList.toggle('is-turn', !game.over && s === game.turnSeat);
        v.card.classList.toggle('is-resting', !!state.resting[s]);
        v.rest.hidden = !state.resting[s];
      });
    }

    function startCorners(state) {
      var out = [];
      for (var s = 1; s <= state.players; s++) {
        var c = E.cornerOf(state, s);
        if (state.placed[s] === 0 && state.board[c[1]][c[0]] === 0) { out.push({ x: c[0], y: c[1], color: colorOf(s) }); }
      }
      return out;
    }

    function redraw() {
      if (!game || !game.cell) { return; }
      var state = controller.state();
      var shown = game.flash ? game.flash.before : state;
      var colors = {};
      Object.keys(game.seats).forEach(function (s) { colors[s] = game.seats[s].color; });
      R.board(game.ctx, {
        size: state.size, cell: game.cell, dpr: game.dpr, board: shown.board, colors: colors,
        corners: startCorners(shown), ghost: game.drag && game.drag.ghost, flash: game.flash
      });
      game.canvas.toggleAttribute('data-ghost', !!(game.drag && game.drag.ghost));
      // Anchor dots (design 2.5): the human on turn, in their colour; the first move's corner is a big dot.
      var dots = [];
      if (!locked()) {
        var seat = game.turnSeat, first = state.placed[seat] === 0;
        dots = E.anchors(state, seat).map(function (c) { return { x: c[0], y: c[1], big: first }; });
      }
      R.dots(game.dotsCtx, { cell: game.cell, dpr: game.dpr, color: colorOf(game.turnSeat || 1), dots: dots });
      game.dotsCv.classList.toggle('is-first', dots.length > 0 && dots[0].big);
    }

    function refresh() { if (game) { renderCards(); renderTray(); redraw(); } }

    function select(id) {
      game.selected = id;
      renderTray();
    }

    // Flip mirrors left-right as seen: (flip, rot) -> (!flip, -rot), since mirror o rotate^r = rotate^-r o mirror.
    function turnSelected(kind) {
      if (locked() || !game.selected) { return; }
      idle.poke();
      var o = orientOf(traySeat(), game.selected);
      if (kind === 'rotate') { o.rot = (o.rot + 1) % 4; sfx('territory-rotate'); }
      else { o.flip = 1 - o.flip; o.rot = (4 - o.rot) % 4; sfx('territory-flip'); }
      renderTray();
    }

    function onUndo() {
      if (!game || game.over || !controller.canUndo()) { return; }
      controller.undo();
    }

    // ---------- tip under the board (design 2.5) ----------

    function showTip(text) {
      if (game.tipTimer) { cancel(game.tipTimer); }
      game.tip.textContent = text;
      game.tipTimer = later(function () { if (game) { game.tip.textContent = ''; game.tipTimer = null; } }, K.TIP_MS);
    }
    function clearTip() {
      if (!game) { return; }
      if (game.tipTimer) { cancel(game.tipTimer); game.tipTimer = null; }
      game.tip.textContent = '';
    }

    // ---------- drag (design 3) ----------

    function pick(e) {
      if (locked()) { return null; }
      var t = e.target && e.target.closest ? e.target.closest('[data-piece-id]') : null;
      return t && game.tray.contains(t) ? t.getAttribute('data-piece-id') : null;
    }

    function onDragStart(id, e) {
      idle.poke();
      game.drag = { id: id, seat: traySeat(), x0: e.clientX, y0: e.clientY, moved: false, float: null, ghost: null };
      select(id);
    }

    // The move the dragged piece would make if let go at (clientX, clientY), or null.
    function moveAt(g, clientX, clientY) {
      var br = game.canvas.getBoundingClientRect(), o = orientOf(g.seat, g.id);
      var at = L.snap({ x: clientX - br.left, y: clientY - br.top }, cellsOf(g.seat, g.id), game.cell, L.LIFT_PX);
      return { seat: g.seat, pieceId: g.id, rot: o.rot, flip: o.flip, x: at.x, y: at.y };
    }
    function checkOf(move) {
      try { return E.check(controller.state(), move); } catch (err) { return { ok: false, reason: 'bad' }; }
    }

    function onDragMove(e) {
      var g = game && game.drag;
      if (!g) { return; }
      if (!g.moved) {
        var dx = e.clientX - g.x0, dy = e.clientY - g.y0;
        if (dx * dx + dy * dy < TAP_PX * TAP_PX) { return; }
        g.moved = true;
        g.float = makeFloat(g);
        sfx('territory-grab');
        renderTray();
      }
      var sz = sizeOf(cellsOf(g.seat, g.id));
      var left = e.clientX - sz.w * game.cell / 2, top = e.clientY - L.LIFT_PX - sz.h * game.cell / 2;
      g.float.style.transform = 'translate(' + left + 'px,' + top + 'px)';
      var move = moveAt(g, e.clientX, e.clientY), size = controller.state().size;
      var cells = E.cellsOf(move);
      var onBoard = cells.some(function (c) { return c[0] >= 0 && c[1] >= 0 && c[0] < size && c[1] < size; });
      g.ghost = onBoard ? { cells: cells, ok: checkOf(move).ok, color: colorOf(g.seat) } : null;
      redraw();
    }

    // The dragged piece at board cell size, lifted above the finger (fixed, never catches the pointer).
    function makeFloat(g) {
      var cells = cellsOf(g.seat, g.id), sz = sizeOf(cells);
      var f = el('div', 'tr-drag');
      var cv = el('canvas');
      sizeCanvas(cv, sz.w * game.cell, sz.h * game.cell, game.dpr);
      R.piece(cv.getContext('2d'), cells, game.cell, game.dpr, colorOf(g.seat), false);
      f.appendChild(cv);
      gameScreen.appendChild(f);
      return f;
    }

    function endDrag() {
      if (!game || !game.drag) { return null; }
      var g = game.drag;
      game.drag = null;
      if (g.float && g.float.parentNode) { g.float.parentNode.removeChild(g.float); }
      return g;
    }

    // Let go: a legal spot places the piece; anything else sends it back with a tip for edge / corner / start.
    function onDragEnd(e) {
      var g = endDrag();
      if (!g) { return; }
      if (!g.moved || locked()) { refresh(); return; }
      if (inRect(game.tray.getBoundingClientRect(), e.clientX, e.clientY)) { sfx('territory-back'); refresh(); return; }
      var move = moveAt(g, e.clientX, e.clientY);
      var c = checkOf(move);
      if (c.ok && controller.input(move).ok) { return; }   // 'moved' redraws
      sfx('territory-back');
      if (TIPS[c.reason]) { showTip(TIPS[c.reason]); }
      refresh();
    }

    function onDragCancel() { if (endDrag()) { refresh(); } }

    // ---------- characters ----------

    function line(seat, situation) {
      return linePicker && game.seats[seat] ? linePicker.pick(game.seats[seat].profile.id, situation) : '';
    }
    function setFace(seat, emotion) {
      var v = game.seats[seat];
      if (!v || v.emotion === emotion) { return; }
      v.emotion = emotion;
      faceInto(v.face, v.profile, emotion);
      C.Effects.mark(v.mark, C.CharacterView.markOf(emotion));
    }
    function say(seat, text, ms) {
      var v = game.seats[seat];
      if (v && text) { C.Effects.bubble(v.bubble, text, ms || BUBBLE_MS); }
    }
    function resetFaces() {
      Object.keys(game.seats).forEach(function (s) {
        setFace(Number(s), 'normal');
        C.Effects.thinking(game.seats[s].bubble, false);
      });
    }

    // B-3: on a human turn with no operation for SLEEP_AFTER_MS, the other seats fall asleep.
    var slept = [];
    var idle = C.IdleTimer.create({
      ms: K.SLEEP_AFTER_MS,
      onIdle: function () {
        if (!game) { return; }
        slept = Object.keys(game.seats).map(Number).filter(function (s) { return s !== game.turnSeat; });
        slept.forEach(function (s) { setFace(s, 'sleep'); say(s, line(s, 'sleep')); });
      },
      onWake: function () {
        slept.forEach(function (s) { if (game && game.seats[s] && game.seats[s].emotion === 'sleep') { setFace(s, 'normal'); } });
        slept = [];
      }
    });

    // ---------- BGM ----------

    // Same condition as the endgame reaction: a quarter of all pieces left, or someone resting.
    function syncTempo(state) {
      var rest = false;
      for (var s = 1; s <= state.players; s++) { if (state.resting[s]) { rest = true; } }
      game.fast = rest || E.remainingCells(state) * 4 <= G.Pieces.TOTAL_CELLS * state.players;
      Bgm.setTempo(game.fast ? G.Sounds.ENDGAME_BPM : G.Sounds.BGM.bpm);
    }
    function startBgm() {
      if (!Sound.isBgmOn()) { Bgm.stop(); return; }
      if (game && game.over) { return; }
      Bgm.start(G.Sounds.BGM);
      if (game && game.fast) { Bgm.setTempo(G.Sounds.ENDGAME_BPM); }
    }

    // ---------- header menu (design 4.6) ----------

    function openMenu() {
      var nodes = [], m = null;
      if (game) {
        var acts = el('div', 'tr-menu');
        acts.appendChild(button('btn btn-main', 'さいしょから', function () { m.close(); controller.start(controller.settings()); }));
        nodes.push(acts);
      }
      var row = el('div', 'tr-rule');
      row.appendChild(el('span', 'tr-rulename', 'BGM'));
      var opts = el('div', 'tr-choices');
      [[true, 'ON'], [false, 'OFF']].forEach(function (it) {
        var b = button('tr-choice', it[1], function () {
          Sound.setBgmOn(it[0]);
          startBgm();
          Array.prototype.forEach.call(opts.children, function (x, i) { x.setAttribute('aria-pressed', String((i === 0) === it[0])); });
        });
        b.setAttribute('aria-pressed', String(Sound.isBgmOn() === it[0]));
        opts.appendChild(b);
      });
      row.appendChild(opts);
      nodes.push(row);
      m = C.UI.modal('せってい', nodes);
    }

    // ---------- game over (placeholder card; Task 8 replaces it with the result screen) ----------

    function showResult(result) {
      var box = game.result;
      box.innerHTML = '';
      var card = el('div', 'tr-result-card');
      var names = result.winners.map(function (s) { return game.seats[s].profile.name; });
      card.appendChild(el('p', 'tr-result-text', result.draw ? 'いいしょうぶ！' : names.join('と ') + 'の かち！'));
      var list = el('ol', 'tr-result-list');
      Object.keys(result.scores).map(Number).sort(function (a, b) { return result.scores[b] - result.scores[a]; }).forEach(function (s) {
        var li = el('li');
        li.appendChild(chip(game.seats[s].color));
        li.appendChild(el('span', null, game.seats[s].profile.name + ' ' + result.scores[s] + 'マス'));
        list.appendChild(li);
      });
      card.appendChild(list);
      var row = el('div', 'tr-result-actions');
      row.appendChild(button('btn btn-main tr-again', 'もういちど', function () { controller.start(controller.settings()); }));
      row.appendChild(button('btn btn-sub tr-tosettings', 'せっていに もどる', showSettings));
      card.appendChild(row);
      box.appendChild(card);
      box.hidden = false;
    }

    // ---------- controller events ----------

    var offs = [];
    function on(name, fn) { offs.push(bus.on(name, fn)); }

    on('started', function () {
      var settings = controller.settings();
      draft = normalize(settings);
      idle.stop();
      var greet = !quiet;
      buildGame(settings);
      showGame();
      syncTempo(controller.state());
      applyLayout();
      resetFaces();
      if (greet) {
        game.greetUntil = Date.now() + GREETING_MS;
        Object.keys(game.seats).forEach(function (s) { say(Number(s), line(Number(s), 'start'), GREETING_MS); });
      }
      startBgm();
    });
    on('turn', function (p) {
      if (!game) { return; }
      if (p.seat !== game.turnSeat && game.humans.length > 1) { game.selected = null; }
      game.turnSeat = p.seat;
      game.humanTurn = p.human;
      if (p.human) { idle.arm(); } else { idle.stop(); }
      refresh();
    });
    on('thinking', function (p) {
      if (!game || !game.seats[p.seat]) { return; }
      var v = game.seats[p.seat];
      v.card.classList.toggle('is-thinking', p.on);
      setFace(p.seat, p.on ? 'thinking' : 'normal');
      C.Effects.thinking(v.bubble, p.on);
      // While the greeting is up, thinking shows the dots only.
      if (p.on && p.line && Date.now() >= game.greetUntil) { say(p.seat, p.line); }
    });
    on('moved', function (p) {
      if (!game) { return; }
      idle.stop();
      game.humanTurn = false;
      endDrag();
      if (game.selected === p.move.pieceId) { game.selected = null; }
      clearTip();
      if (game.flashTimer) { cancel(game.flashTimer); game.flashTimer = null; }
      game.flash = null;
      // A CPU piece shines on its spot first (design 3); not with reduced motion.
      if (!game.seats[p.move.seat].human && !C.Effects.isReduced()) {
        game.flash = { cells: E.cellsOf(p.move), color: colorOf(p.move.seat), before: p.before };
        game.flashTimer = later(function () {
          if (!game) { return; }
          game.flash = null;
          game.flashTimer = null;
          sfx('territory-place');
          redraw();
        }, FLASH_MS);
      } else {
        sfx('territory-place');
      }
      refresh();
    });
    on('reaction', function (p) {
      if (!game) { return; }
      // Lower-priority events first so the higher-priority emotion wins for a seat.
      var pri = G.Reactions.PRIORITY;
      var events = p.events.slice().sort(function (a, b) { return pri.indexOf(b.kind) - pri.indexOf(a.kind); });
      Object.keys(game.seats).forEach(function (s) { if (game.seats[s].emotion !== 'thinking') { setFace(Number(s), 'normal'); } });
      events.forEach(function (e) { if (e.emotion) { setFace(e.seat, e.emotion); } });
      Object.keys(p.lines || {}).forEach(function (s) { say(Number(s), p.lines[s]); });
      if (p.events.some(function (e) { return e.kind === 'endgame'; })) { game.fast = true; Bgm.setTempo(G.Sounds.ENDGAME_BPM); }
      var kind = p.picked && p.picked.event.kind;
      if (kind && TERMINAL[kind]) {
        Bgm.stop();
        sfx('territory-' + (p.picked.perspective || 'draw'));
      } else if (SOUND_OF[kind]) {
        sfx(SOUND_OF[kind]);
      }
      // p.screen: the one full-screen effect for this move — drawn by fx.js (Task 8).
    });
    on('gameover', function (p) {
      if (!game) { return; }
      idle.stop();
      game.over = true;
      game.humanTurn = false;
      endDrag();
      Bgm.stop();
      refresh();
      showResult(p.result);
    });
    on('undo', function () {
      if (!game) { return; }
      idle.stop();
      endDrag();
      if (game.flashTimer) { cancel(game.flashTimer); game.flashTimer = null; }
      game.flash = null;
      game.selected = null;
      game.over = false;
      game.result.hidden = true;
      clearTip();
      resetFaces();
      syncTempo(controller.state());
      refresh();
    });

    // Design 4.6: a hidden page does not play on. A CPU turn is dropped and thought again on return.
    function onVisibility() {
      if (document.hidden) {
        idle.pause();
        if (game && !game.over && controller.isBusy()) { controller.stop(); resumeOnShow = true; }
        return;
      }
      idle.resume();
      if (resumeOnShow) {
        resumeOnShow = false;
        quiet = true;
        try { if (!controller.resume()) { showSettings(); } } finally { quiet = false; }
      }
    }
    function onPoke() { idle.poke(); }
    document.addEventListener('visibilitychange', onVisibility);
    gameScreen.addEventListener('pointerdown', onPoke);
    window.addEventListener('resize', applyLayout);
    window.addEventListener('orientationchange', applyLayout);

    showSettings();
    if (!controller.seenHowTo()) { showHowTo(); }

    return {
      clearTip: clearTip,
      // Tests: removes the UI, its header and listeners.
      destroy: function () {
        leaveGame();
        Bgm.stop();
        offs.forEach(function (off) { if (typeof off === 'function') { off(); } });
        document.removeEventListener('visibilitychange', onVisibility);
        window.removeEventListener('resize', applyLayout);
        window.removeEventListener('orientationchange', applyLayout);
        if (header.parentNode) { header.parentNode.removeChild(header); }
        root.removeChild(settingsScreen);
        root.removeChild(gameScreen);
      }
    };
  }

  G.UI = { init: init, normalize: normalize, TIPS: TIPS };
})(Ailand.games.territory);
