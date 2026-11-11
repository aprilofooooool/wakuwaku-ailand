(function (C) {
  'use strict';
  // Unified Pointer Events input: hover (mouse only), tap (any pointer type), leave (mouse only).

  var TAP_MOVE_PX = 12;
  var TAP_TIME_MS = 800;

  // down/up: { pointerId, x, y, t }.
  function classify(down, up) {
    if (!down || !up || down.pointerId !== up.pointerId) { return 'cancel'; }
    var dx = up.x - down.x, dy = up.y - down.y;
    if (dx * dx + dy * dy > TAP_MOVE_PX * TAP_MOVE_PX) { return 'cancel'; }
    if (up.t - down.t > TAP_TIME_MS) { return 'cancel'; }
    return 'tap';
  }

  function point(e) { return { pointerId: e.pointerId, x: e.clientX, y: e.clientY, t: e.timeStamp }; }

  // handlers: { onPress(x, y, type, pointerId), onHover(x, y, type), onTap(x, y, type), onLeave() }.
  // onPress fires on pointerdown (mouse: primary button only). x/y are client coordinates. Returns detach().
  function attach(el, handlers) {
    var h = handlers || {};
    var downs = {};
    var listeners = {
      pointermove: function (e) {
        if (e.pointerType === 'mouse' && h.onHover) { h.onHover(e.clientX, e.clientY, e.pointerType); }
      },
      pointerdown: function (e) {
        if (e.pointerType === 'mouse' && e.button !== 0) { return; }
        downs[e.pointerId] = point(e);
        if (h.onPress) { h.onPress(e.clientX, e.clientY, e.pointerType, e.pointerId); }
      },
      pointerup: function (e) {
        var down = downs[e.pointerId];
        delete downs[e.pointerId];
        if (classify(down, point(e)) === 'tap' && h.onTap) { h.onTap(e.clientX, e.clientY, e.pointerType); }
      },
      pointercancel: function (e) { delete downs[e.pointerId]; },
      pointerleave: function (e) {
        if (e.pointerType === 'mouse' && h.onLeave) { h.onLeave(); }
      }
    };
    Object.keys(listeners).forEach(function (n) { el.addEventListener(n, listeners[n]); });
    return function detach() {
      Object.keys(listeners).forEach(function (n) { el.removeEventListener(n, listeners[n]); });
    };
  }

  C.Pointer = { classify: classify, attach: attach, TAP_MOVE_PX: TAP_MOVE_PX, TAP_TIME_MS: TAP_TIME_MS };
})(Ailand.core);
