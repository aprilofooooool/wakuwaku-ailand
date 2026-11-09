(function (C) {
  'use strict';
  // Shared UI parts: header, modal, toast. Class names are styled by css/header.css and css/base.css.

  function el(tag, cls, text) {
    var e = document.createElement(tag);
    if (cls) { e.className = cls; }
    if (text !== undefined) { e.textContent = text; }
    return e;
  }

  function headerButton(cls, icon, label) {
    var b = el('button', 'hdr-btn ' + cls);
    b.type = 'button';
    b.setAttribute('aria-label', label);
    b.appendChild(el('span', 'hdr-ico', icon));
    b.appendChild(el('span', 'hdr-label', label));
    return b;
  }

  // opts: { title, onBack, onSound, onSettings, soundOn }. onSound may return the new on/off state.
  function header(opts) {
    var o = opts || {};
    var bar = el('header', 'app-header');
    var back = headerButton('hdr-back', '←', 'もどる');
    var title = el('div', 'hdr-title', o.title || '');
    var sound = headerButton('hdr-sound', '', 'おと');
    var settings = headerButton('hdr-settings', '⚙', 'せってい');
    var on = o.soundOn !== false;

    function paintSound() {
      sound.querySelector('.hdr-ico').textContent = on ? '♪' : '×';
      sound.setAttribute('aria-pressed', String(on));
      sound.setAttribute('aria-label', on ? 'おと：ON' : 'おと：OFF');
    }
    paintSound();
    // Follow sound changes made anywhere else on the page (in-game buttons etc.).
    if (C.Sound && C.Sound.onChange) { C.Sound.onChange(function (v) { on = v; paintSound(); }); }

    back.addEventListener('click', function () { if (o.onBack) { o.onBack(); } });
    sound.addEventListener('click', function () {
      var r = o.onSound ? o.onSound() : undefined;
      on = typeof r === 'boolean' ? r : !on;
      paintSound();
    });
    settings.addEventListener('click', function () { if (o.onSettings) { o.onSettings(); } });

    bar.appendChild(back);
    bar.appendChild(title);
    bar.appendChild(sound);
    bar.appendChild(settings);
    return bar;
  }

  function modalRoot() {
    var root = document.getElementById('modal-root');
    if (!root) {
      root = el('div');
      root.id = 'modal-root';
      document.body.appendChild(root);
    }
    return root;
  }

  function modal(title, nodes) {
    var root = modalRoot();
    var back = el('div', 'modal-back');
    var box = el('div', 'modal');
    box.setAttribute('role', 'dialog');
    box.setAttribute('aria-modal', 'true');
    box.setAttribute('aria-label', title);
    box.appendChild(el('h2', null, title));
    (nodes || []).forEach(function (n) { box.appendChild(n); });
    var actions = el('div', 'modal-actions');
    var closeBtn = el('button', 'btn btn-sub', 'とじる');
    closeBtn.type = 'button';
    closeBtn.setAttribute('aria-label', 'とじる');
    function close() { if (back.parentNode) { back.parentNode.removeChild(back); } }
    closeBtn.addEventListener('click', close);
    actions.appendChild(closeBtn);
    box.appendChild(actions);
    back.appendChild(box);
    root.appendChild(back);
    closeBtn.focus();
    return { close: close };
  }

  function toast(text, ms) {
    var t = el('div', 'toast', text);
    t.setAttribute('role', 'status');
    document.body.appendChild(t);
    setTimeout(function () { if (t.parentNode) { t.parentNode.removeChild(t); } }, ms || 2000);
    return t;
  }

  C.UI = { header: header, modal: modal, toast: toast };
})(Ailand.core);
