(function (G) {
  'use strict';
  // drop4 screens: settings (requirements 3.7) and game (3.8, design 6.6). DOM is touched only after init().
  var C = Ailand.core, E = G.Engine, L = G.Layout;

  var SYMBOLS = { 1: '♥', 2: '★', 3: '●', 4: '◆' };
  var MARKS = { sweat: '💦', bang: '❗', sparkle: '✨', zzz: '💤', steam: '💢' };
  var PLAYER_MODES = [
    { players: 2, teams: false, label: '2にん' },
    { players: 3, teams: false, label: '3にん' },
    { players: 4, teams: false, label: '4にん' },
    { players: 4, teams: true, label: '4にん チームせん' }
  ];
  var LEVELS = [['weak', 'よわい'], ['normal', 'ふつう'], ['strong', 'つよい']];
  var FIRSTS = [['me', 'じぶん'], ['them', 'あいて'], ['random', 'ランダム']];
  var THINKING_TEXT = 'うーん…';
  var NL = '\n';  // tool labels use white-space: pre-line

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
  function hasKey(pairs, k) { return pairs.some(function (p) { return p[0] === k; }); }

  function seatLabel(seat, teams) { return teams ? ['A1', 'B1', 'A2', 'B2'][seat - 1] : seat + 'P'; }

  // Fills gaps and fixes duplicates in saved/partial settings. Characters stay unique per seat.
  function normalize(raw) {
    var r = raw && typeof raw === 'object' ? raw : {};
    var ids = C.Characters.list().map(function (p) { return p.id; });
    var players = [2, 3, 4].indexOf(r.players) >= 0 ? r.players : 2;
    var s = {
      players: players, teams: !!r.teams && players === 4, popOut: !!r.popOut, blocks: !!r.blocks,
      level: hasKey(LEVELS, r.level) ? r.level : 'weak',
      firstChoice: hasKey(FIRSTS, r.firstChoice) ? r.firstChoice : 'me',
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

  // Settings for Controller.start: resolves "どっちが さき？" (2 players) or a random first seat (3+).
  function withFirstSeat(s) {
    var out = JSON.parse(JSON.stringify(s));
    if (s.players === 2 && s.firstChoice === 'me') { out.firstSeat = 1; }
    else if (s.players === 2 && s.firstChoice === 'them') { out.firstSeat = 2; }
    else { out.firstSeat = 1 + Math.floor(Math.random() * s.players); }
    return out;
  }

  function init(root, controller, opts) {
    var o = opts || {};
    var bus = o.bus;
    var draft = normalize(controller.loadSettings());
    var soundOn = true;

    var settingsScreen = el('main', 'screen d4-settings-screen');
    settingsScreen.id = 'screen-settings';
    var gameScreen = el('main', 'screen d4-game-screen');
    gameScreen.id = 'screen-game';
    gameScreen.hidden = true;
    root.appendChild(settingsScreen);
    root.appendChild(gameScreen);

    document.body.insertBefore(C.UI.header({
      title: 'ぽとん4',
      soundOn: soundOn,
      onBack: function () { location.href = C.CharacterView.basePath() + 'index.html'; },
      // Sound arrives in Task 17; the button only remembers the choice for now.
      onSound: function () { soundOn = !soundOn; return soundOn; },
      onSettings: showSettings
    }), document.body.firstChild);

    // ---------- settings screen ----------

    function panel(title) {
      var p = el('section', 'd4-panel');
      p.appendChild(el('h2', null, title));
      settingsScreen.appendChild(p);
      return p;
    }
    function choices(parent, items, isOn, onPick) {
      var row = el('div', 'd4-choices');
      items.forEach(function (it) {
        var b = button('d4-choice', it.label, function () { onPick(it); renderSettings(); });
        b.setAttribute('aria-pressed', String(isOn(it)));
        row.appendChild(b);
      });
      parent.appendChild(row);
    }
    // Seat color + symbol. Team colors come from an `.is-teams` ancestor.
    function chip(seat) {
      var c = el('span', 'd4-chip d4-piece s' + seat, SYMBOLS[seat]);
      c.setAttribute('aria-hidden', 'true');
      return c;
    }
    function faceInto(wrap, profile, emotion) {
      wrap.innerHTML = '';
      var img = el('img', 'char-img');
      img.draggable = false;
      wrap.appendChild(img);
      C.CharacterView.apply(img, profile, emotion);
    }

    function renderSettings() {
      settingsScreen.innerHTML = '';
      var profiles = C.Characters.list();

      var p1 = panel('なんにんで あそぶ？');
      choices(p1, PLAYER_MODES, function (m) { return m.players === draft.players && m.teams === draft.teams; }, function (m) {
        draft = normalize({ players: m.players, teams: m.teams, popOut: draft.popOut, blocks: draft.blocks,
          level: draft.level, firstChoice: draft.firstChoice, seats: draft.seats });
      });

      var p2 = panel('せきと キャラ');
      p2.classList.add(draft.teams ? 'is-teams' : 'no-teams');
      draft.seats.forEach(function (st) {
        var row = el('div', 'd4-seatrow');
        var head = el('div', 'd4-seathead');
        head.appendChild(chip(st.seat));
        var picked = profiles.filter(function (pf) { return pf.id === st.charId; })[0];
        head.appendChild(el('span', 'd4-seatlabel', seatLabel(st.seat, draft.teams) + ' ' + picked.name));
        var who = button('d4-choice d4-who', st.human ? 'ひと' : 'CPU', function () { st.human = !st.human; renderSettings(); });
        who.setAttribute('aria-pressed', String(st.human));
        who.setAttribute('aria-label', seatLabel(st.seat, draft.teams) + '：' + (st.human ? 'ひと' : 'CPU'));
        head.appendChild(who);
        row.appendChild(head);
        var list = el('div', 'd4-charlist');
        profiles.forEach(function (pf) {
          var b = button('d4-charbtn', undefined, function () {
            // Picking a character used by another seat swaps the two (no duplicates).
            var other = draft.seats.filter(function (x) { return x.charId === pf.id; })[0];
            if (other) { other.charId = st.charId; }
            st.charId = pf.id;
            renderSettings();
          });
          b.setAttribute('aria-pressed', String(st.charId === pf.id));
          b.setAttribute('aria-label', seatLabel(st.seat, draft.teams) + '：' + pf.name);
          var face = el('span', 'd4-charface');
          faceInto(face, pf, 'normal');
          b.appendChild(face);
          list.appendChild(b);
        });
        row.appendChild(list);
        p2.appendChild(row);
      });

      var p3 = panel('CPU の つよさ');
      choices(p3, LEVELS.map(function (l) { return { id: l[0], label: l[1] }; }),
        function (it) { return it.id === draft.level; }, function (it) { draft.level = it.id; });

      var p4 = panel('ルール');
      [['popOut', 'ぬきとり'], ['blocks', 'おじゃまブロック']].forEach(function (rule) {
        var line = el('div', 'd4-rule');
        line.appendChild(el('span', 'd4-rulename', rule[1]));
        choices(line, [{ v: true, label: 'ON' }, { v: false, label: 'OFF' }],
          function (it) { return draft[rule[0]] === it.v; }, function (it) { draft[rule[0]] = it.v; });
        p4.appendChild(line);
      });

      if (draft.players === 2) {
        var p5 = panel('どっちが さき？');
        choices(p5, FIRSTS.map(function (f) { return { id: f[0], label: f[1] }; }),
          function (it) { return it.id === draft.firstChoice; }, function (it) { draft.firstChoice = it.id; });
      }

      var p6 = el('section', 'd4-panel d4-startpanel');
      p6.appendChild(button('btn btn-main d4-start', 'はじめる', function () { controller.start(withFirstSeat(draft)); }));
      if (controller.hasSave()) {
        p6.appendChild(button('btn btn-sub d4-resume', 'つづきから', function () {
          if (!controller.resume()) { C.UI.toast('つづきが よめなかったよ'); renderSettings(); }
        }));
      }
      settingsScreen.appendChild(p6);
    }

    function showSettings() {
      gameScreen.hidden = true;
      settingsScreen.hidden = false;
      document.body.classList.remove('d4-playing');
      renderSettings();
      window.scrollTo(0, 0);
    }

    // ---------- game screen ----------

    var g = null;            // DOM refs and per-game data, rebuilt on every 'started'
    var view = { state: null, turnSeat: 0, humanTurn: false, over: false };
    var mode = 'drop';       // 'drop' | 'pop' | 'block'
    var sel = null;          // { type, col }: ghost (drop/block) or picked piece (pop)
    var layout = null;
    var chain = Promise.resolve();
    var pending = 0;

    // Review Focus 3: input is ignored while the CPU thinks or any queued animation/render is pending.
    function inputLocked() {
      return controller.isBusy() || pending > 0 || !view.state || !view.humanTurn || view.over;
    }

    // Task 15 replaces this body with the drop/pop animation. It runs before the board shows `after`.
    function animateMove(move) {
      return Promise.resolve(move);
    }

    // Every bus event is applied in order, after the previous one's animation finished.
    function queue(fn) {
      pending++;
      chain = chain.then(fn).catch(function (e) {
        if (window.console) { window.console.error(e); }
      }).then(function () {
        pending--;
        renderTools();
      });
    }

    function buildGame(settings, state) {
      gameScreen.innerHTML = '';
      var wrap = el('div', 'd4-game' + (state.teams ? ' is-teams' : ''));
      wrap.id = 'd4-game';
      var left = el('div', 'd4-side d4-side-left');
      var right = el('div', 'd4-side d4-side-right');
      var center = el('div', 'd4-center');
      var seats = {};
      var half = Math.ceil(settings.seats.length / 2);
      settings.seats.forEach(function (st, i) {
        var profile = C.Characters.get(st.charId);
        var box = el('div', 'd4-seat');
        box.id = 'd4-seat-' + st.seat;
        var face = el('div', 'd4-face');
        var mark = el('span', 'd4-mark');
        mark.setAttribute('aria-hidden', 'true');
        var name = el('div', 'd4-name');
        name.appendChild(chip(st.seat));
        name.appendChild(el('span', 'd4-name-text', profile.name));
        var bubble = el('div', 'd4-bubble');
        bubble.id = 'd4-bubble-' + st.seat;
        bubble.setAttribute('aria-live', 'polite');
        box.appendChild(face);
        box.appendChild(mark);
        box.appendChild(name);
        box.appendChild(bubble);
        (i < half ? left : right).appendChild(box);
        seats[st.seat] = { box: box, face: face, mark: mark, bubble: bubble, profile: profile, emotion: null };
      });

      var boardwrap = el('div', 'd4-boardwrap');
      boardwrap.id = 'd4-boardwrap';
      boardwrap.setAttribute('aria-label', 'ばん');
      var ghostrow = el('div', 'd4-ghostrow');
      ghostrow.id = 'd4-ghostrow';
      var board = el('div', 'd4-board');
      board.id = 'd4-board';
      var slots = [], cells = [];
      for (var c = 0; c < state.cols; c++) { slots.push(ghostrow.appendChild(el('div', 'd4-slot'))); cells.push([]); }
      // Top row first so the grid reads top to bottom; cells[c][r] has r = 0 at the bottom.
      for (var r = state.rows - 1; r >= 0; r--) {
        for (var c2 = 0; c2 < state.cols; c2++) {
          var cell = el('div', 'd4-cell');
          cell.dataset.col = String(c2);
          cell.dataset.row = String(r);
          cells[c2][r] = board.appendChild(cell);
        }
      }
      boardwrap.appendChild(ghostrow);
      boardwrap.appendChild(board);
      var tools = el('div', 'd4-tools');
      tools.id = 'd4-tools';
      center.appendChild(boardwrap);
      center.appendChild(tools);

      var result = el('div', 'd4-result');
      result.id = 'd4-result';
      result.hidden = true;

      wrap.appendChild(left);
      wrap.appendChild(center);
      wrap.appendChild(right);
      wrap.appendChild(result);
      gameScreen.appendChild(wrap);

      if (g && g.detach) { g.detach(); }
      g = {
        wrap: wrap, seats: seats, boardwrap: boardwrap, slots: slots, cells: cells, tools: tools, result: result,
        cols: state.cols, rows: state.rows, players: state.players,
        humans: settings.seats.filter(function (x) { return x.human; }).map(function (x) { return x.seat; }),
        detach: C.Pointer.attach(boardwrap, { onHover: onHover, onTap: onTap, onLeave: onLeave })
      };
    }

    function applyLayout() {
      if (!g) { return; }
      var hdr = document.querySelector('.app-header');
      var top = hdr ? hdr.getBoundingClientRect().height : 0;
      layout = L.compute({
        width: document.documentElement.clientWidth, height: window.innerHeight - top,
        cols: g.cols, rows: g.rows, players: g.players
      });
      var st = g.wrap.style;
      g.wrap.classList.toggle('is-landscape', layout.orientation === 'landscape');
      g.wrap.classList.toggle('is-portrait', layout.orientation === 'portrait');
      st.setProperty('--cell', layout.cell + 'px');
      st.setProperty('--gap', L.GAP + 'px');
      st.setProperty('--pad', L.PAD + 'px');
      st.setProperty('--cols', String(g.cols));
      st.setProperty('--board-w', layout.boardW + 'px');
      st.setProperty('--side', L.SIDE + 'px');
      st.setProperty('--vpad', L.VPAD + 'px');
      st.setProperty('--tools-h', L.TOOLS_H + 'px');
      st.setProperty('--chars-h', L.CHARS_H + 'px');
      st.setProperty('--side-w', L.SIDE_W + 'px');
      // Review Focus 4: a resize drops the ghost / picked piece.
      sel = null;
      renderMarks();
    }

    function setFace(seat, emotion) {
      var v = g.seats[seat];
      if (!v || v.emotion === emotion) { return; }
      v.emotion = emotion;
      faceInto(v.face, v.profile, emotion);
      v.mark.textContent = MARKS[C.CharacterView.markOf(emotion)] || '';
    }
    function setBubble(seat, text) {
      var v = g.seats[seat];
      if (!v) { return; }
      v.bubble.textContent = text || '';
      v.bubble.hidden = !text;
    }
    function resetFaces() {
      Object.keys(g.seats).forEach(function (s) {
        setFace(Number(s), 'normal');
        setBubble(Number(s), '');
        g.seats[s].box.classList.remove('is-thinking');
      });
    }

    function renderBoard() {
      var state = view.state;
      for (var c = 0; c < state.cols; c++) {
        for (var r = 0; r < state.rows; r++) {
          var v = E.at(state, c, r), cell = g.cells[c][r];
          var key = String(v);
          if (cell.dataset.v === key) { continue; }
          cell.dataset.v = key;
          cell.innerHTML = '';
          if (v === E.BLOCK) {
            cell.appendChild(el('div', 'd4-piece is-block'));
          } else if (v !== E.EMPTY) {
            cell.appendChild(el('div', 'd4-piece s' + v, SYMBOLS[v]));
          }
        }
      }
    }

    function seat() { return E.currentSeat(view.state); }
    function legal(move) {
      return E.legalMoves(view.state).some(function (m) { return m.type === move.type && m.col === move.col && m.seat === move.seat; });
    }
    function popCols() {
      if (!view.state || !view.humanTurn || view.over) { return []; }
      return E.legalMoves(view.state).filter(function (m) { return m.type === 'pop'; }).map(function (m) { return m.col; });
    }

    // Ghost row, pop highlights and the picked piece.
    function renderMarks() {
      if (!g) { return; }
      g.slots.forEach(function (slot, c) {
        slot.innerHTML = '';
        if (sel && sel.type !== 'pop' && sel.col === c) {
          slot.appendChild(el('div', 'd4-ghost d4-piece ' + (sel.type === 'block' ? 'is-block' : 's' + seat()),
            sel.type === 'block' ? '' : SYMBOLS[seat()]));
        }
      });
      var pops = mode === 'pop' ? popCols() : [];
      for (var c = 0; c < g.cols; c++) {
        var bottom = g.cells[c][0];
        bottom.classList.toggle('can-pop', pops.indexOf(c) >= 0);
        bottom.classList.toggle('is-picked', !!sel && sel.type === 'pop' && sel.col === c);
      }
    }

    function toolSeat() {
      if (view.humanTurn) { return view.turnSeat; }
      return g.humans.length === 1 ? g.humans[0] : view.turnSeat;
    }

    function renderTools() {
      if (!g || !view.state) { return; }
      var t = g.tools, state = view.state;
      t.innerHTML = '';
      if (view.over) { return; }
      var off = !view.humanTurn;
      function modeBtn(id, label) {
        var b = button('d4-tool d4-tool-' + id, label, function () {
          if (inputLocked()) { return; }
          mode = id;
          sel = null;
          renderMarks();
          renderTools();
        });
        b.setAttribute('aria-pressed', String(mode === id));
        b.disabled = off;
        t.appendChild(b);
        return b;
      }
      modeBtn('drop', 'おとす');
      if (state.popOut) { modeBtn('pop', 'ぬく').disabled = off || popCols().length === 0; }
      if (state.blocks) {
        var left = state.blocksLeft[toolSeat()] || 0;
        modeBtn('block', 'ブロック' + NL + 'のこり' + left).disabled = off || left <= 0;
      }
      if (g.humans.length === 1 && controller.undoLeft() > 0) {
        var u = button('d4-tool d4-undo', '1て もどす' + NL + 'のこり' + controller.undoLeft(), function () {
          if (controller.isBusy() || pending > 0) { return; }
          controller.undo();
        });
        u.id = 'd4-undo';
        t.appendChild(u);
      }
    }

    function colFrom(x) {
      if (!layout) { return -1; }
      return L.colAt(x - g.boardwrap.getBoundingClientRect().left, layout, g.cols);
    }

    function onHover(x) {
      if (inputLocked() || mode === 'pop') { return; }
      var col = colFrom(x);
      var next = col >= 0 && legal({ type: mode, col: col, seat: seat() }) ? { type: mode, col: col } : null;
      if (JSON.stringify(next) === JSON.stringify(sel)) { return; }
      sel = next;
      renderMarks();
    }
    function onLeave() {
      if (sel && sel.type !== 'pop') { sel = null; renderMarks(); }
    }
    // Mouse: one click drops. Touch/pen: first tap shows the ghost, a second tap on the same column drops.
    // Pop always takes two taps (pick, then confirm).
    function onTap(x, y, type) {
      if (inputLocked()) { return; }
      var col = colFrom(x);
      if (col < 0) { return; }
      var move = { type: mode, col: col, seat: seat() };
      if (!legal(move)) {
        C.UI.toast(mode === 'pop' ? 'ひかっている コマを えらんでね' : 'そこは いっぱい！');
        sel = null;
        renderMarks();
        return;
      }
      var confirmed = (type === 'mouse' && mode !== 'pop') || (sel && sel.type === mode && sel.col === col);
      if (!confirmed) {
        sel = { type: mode, col: col };
        renderMarks();
        return;
      }
      sel = null;
      renderMarks();
      if (controller.input(move) && move.type !== 'drop') { mode = 'drop'; }
    }

    function showResult(result) {
      var box = g.result;
      box.innerHTML = '';
      var text;
      if (result.type === 'draw') {
        text = 'ひきわけ！';
      } else if (view.state.teams) {
        text = (result.team === 0 ? 'A' : 'B') + 'チームの かち！';
      } else {
        text = result.seats.map(function (s) { return g.seats[s].profile.name; }).join('と ') + 'の かち！';
      }
      var card = el('div', 'd4-result-card');
      card.appendChild(el('p', 'd4-result-text', text));
      var row = el('div', 'd4-result-actions');
      row.appendChild(button('btn btn-main', 'もういちど', function () {
        controller.start(withFirstSeat(normalize(controller.settings())));
      }));
      row.appendChild(button('btn btn-sub', 'せってい', showSettings));
      card.appendChild(row);
      box.appendChild(card);
      box.hidden = false;
    }

    function showGame() {
      settingsScreen.hidden = true;
      gameScreen.hidden = false;
      document.body.classList.add('d4-playing');
      window.scrollTo(0, 0);
    }

    // ---------- controller events ----------

    bus.on('started', function (p) {
      queue(function () {
        var settings = controller.settings();
        draft = normalize(settings);
        view = { state: p.state, turnSeat: 0, humanTurn: false, over: false };
        mode = 'drop';
        sel = null;
        buildGame(settings, p.state);
        showGame();
        applyLayout();
        resetFaces();   // also clears any thinking indicator left by a game restarted mid-think (R4)
        renderBoard();
        renderMarks();
      });
    });
    bus.on('turn', function (p) {
      queue(function () {
        if (p.seat !== view.turnSeat) { mode = 'drop'; sel = null; }
        view.turnSeat = p.seat;
        view.humanTurn = p.human;
        Object.keys(g.seats).forEach(function (s) { g.seats[s].box.classList.toggle('is-turn', Number(s) === p.seat); });
        renderMarks();
      });
    });
    bus.on('thinking', function (p) {
      queue(function () {
        g.seats[p.seat].box.classList.toggle('is-thinking', p.on);
        setFace(p.seat, p.on ? 'thinking' : 'normal');
        setBubble(p.seat, p.on ? THINKING_TEXT : '');
      });
    });
    bus.on('moved', function (p) {
      queue(function () {
        sel = null;
        view.humanTurn = false;
        renderMarks();
        return animateMove(p.move).then(function () {
          view.state = p.after;
          renderBoard();
        });
      });
    });
    bus.on('reaction', function (p) {
      queue(function () {
        // Lower-priority events first so the higher-priority emotion wins for a seat.
        var pri = G.Reactions.PRIORITY;
        var events = p.events.slice().sort(function (a, b) { return pri.indexOf(b.kind) - pri.indexOf(a.kind); });
        Object.keys(g.seats).forEach(function (s) { setFace(Number(s), 'normal'); setBubble(Number(s), ''); });
        events.forEach(function (e) { setFace(e.seat, e.emotion); });
        Object.keys(p.lines || {}).forEach(function (s) { setBubble(Number(s), p.lines[s]); });
      });
    });
    bus.on('gameover', function (p) {
      queue(function () {
        view.over = true;
        view.humanTurn = false;
        Object.keys(g.seats).forEach(function (s) { g.seats[s].box.classList.remove('is-turn'); });
        renderMarks();
        showResult(p.result);
      });
    });
    bus.on('undo', function (p) {
      queue(function () {
        view.state = p.state;
        view.over = false;
        mode = 'drop';
        sel = null;
        resetFaces();
        renderBoard();
        renderMarks();
      });
    });

    window.addEventListener('resize', applyLayout);
    window.addEventListener('orientationchange', applyLayout);

    showSettings();
  }

  G.UI = { init: init };
})(Ailand.games.drop4);
