(function (C) {
  'use strict';

  function create() {
    var handlers = {};
    return {
      on: function (name, fn) {
        (handlers[name] = handlers[name] || []).push(fn);
        return function off() {
          var list = handlers[name];
          if (!list) { return; }
          var i = list.indexOf(fn);
          if (i !== -1) { list.splice(i, 1); }
        };
      },
      emit: function (name, payload) {
        var list = handlers[name];
        if (!list) { return; }
        list.slice().forEach(function (fn) { fn(payload); });
      }
    };
  }

  C.EventBus = { create: create };
})(Ailand.core);
