/* ==========================================================================
   NetSim — core/event-queue.js
   A plain FIFO queue of simulation events. Kept mutable (rather than a
   fixed array) because a mid-run link failure needs to splice in a
   re-route or truncate what was already planned for a packet/message.
   ========================================================================== */

(function (NetSim) {
  'use strict';

  function createEventQueue() {
    let items = [];

    return {
      push(event) { items.push(event); },
      pushAll(events) { items = items.concat(events); },
      shift() { return items.shift() || null; },
      peek() { return items[0] || null; },
      isEmpty() { return items.length === 0; },
      clear() { items = []; },
      size() { return items.length; },
      toArray() { return items.slice(); },
      /** Remove every queued event belonging to `predicate`, e.g. a lost packet. */
      removeWhere(predicate) { items = items.filter((e) => !predicate(e)); },
      /** Replace the whole remaining queue, e.g. after a mid-run re-route. */
      replace(events) { items = events; }
    };
  }

  NetSim.Core = NetSim.Core || {};
  NetSim.Core.EventQueue = { createEventQueue };

})(window.NetSim = window.NetSim || {});
