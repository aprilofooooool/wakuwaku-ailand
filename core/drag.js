(function (C) {
  'use strict';
  // One-finger drag on an element (design 2.3). Follows only the first pointerId: other fingers are ignored
  // until it lifts. The pointer is captured so moves outside the element still arrive. DOM is not touched at load.
  //
  // handlers: { pick(e) -> piece id or null, onStart(id, e), onMove(e), onEnd(e), onCancel() }.
  // pick decides which piece (if any) a pointerdown grabs. Returns detach().
  function attach(el, handlers) {
    var h = handlers || {};
    var pid = null;

    function release(id) {
      try { if (el.hasPointerCapture && el.hasPointerCapture(id)) { el.releasePointerCapture(id); } } catch (err) { /* not captured */ }
    }
    function mine(e) { return pid !== null && e.pointerId === pid; }

    var listeners = {
      pointerdown: function (e) {
        if (pid !== null) { return; }                                   // a second finger
        if (e.pointerType === 'mouse' && e.button !== 0) { return; }
        var id = h.pick ? h.pick(e) : null;
        if (id === null || id === undefined) { return; }
        e.preventDefault();
        pid = e.pointerId;
        try { el.setPointerCapture(e.pointerId); } catch (err) { /* synthetic or already gone pointer */ }
        if (h.onStart) { h.onStart(id, e); }
      },
      pointermove: function (e) {
        if (!mine(e)) { return; }
        e.preventDefault();
        if (h.onMove) { h.onMove(e); }
      },
      pointerup: function (e) {
        if (!mine(e)) { return; }
        pid = null;
        release(e.pointerId);
        if (h.onEnd) { h.onEnd(e); }
      },
      pointercancel: function (e) {
        if (!mine(e)) { return; }
        pid = null;
        release(e.pointerId);
        if (h.onCancel) { h.onCancel(); }
      },
      // Capture lost without a pointerup (the element left the page, the browser took the gesture): cancel.
      // Only el's own capture counts: a child (e.g. the touched canvas) losing its implicit touch capture
      // when el takes it bubbles up here with the same pointerId and must not end the drag.
      lostpointercapture: function (e) {
        if (!mine(e) || e.target !== el) { return; }
        pid = null;
        if (h.onCancel) { h.onCancel(); }
      }
    };
    Object.keys(listeners).forEach(function (n) { el.addEventListener(n, listeners[n]); });

    return function detach() {
      if (pid !== null) { release(pid); pid = null; }
      Object.keys(listeners).forEach(function (n) { el.removeEventListener(n, listeners[n]); });
    };
  }

  C.Drag = { attach: attach };
})(window.Ailand.core);
