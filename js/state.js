/* ==========================================================================
   NetSim — state.js
   Minimal pub/sub store. No framework, no persistence beyond memory
   (kept intentionally simple — this is a teaching tool, not a database).
   ========================================================================== */

(function (NetSim) {
  'use strict';

  const listeners = new Set();

  const data = {
    route: { name: 'osi', params: {} },
    hoveredLayerId: null,
    selectedLayerId: null,
    settings: {
      reduceMotion: false,
      compactCards: false
    }
  };

  function notify() {
    listeners.forEach((fn) => fn(data));
  }

  function subscribe(fn) {
    listeners.add(fn);
    return () => listeners.delete(fn);
  }

  function setRoute(name, params) {
    data.route = { name, params: params || {} };
    notify();
  }

  function setHoveredLayer(layerId) {
    data.hoveredLayerId = layerId;
    notify();
  }

  function setSelectedLayer(layerId) {
    data.selectedLayerId = layerId;
    notify();
  }

  function updateSetting(key, value) {
    data.settings[key] = value;
    document.body.classList.toggle('reduce-motion', !!data.settings.reduceMotion);
    document.body.classList.toggle('compact-cards', !!data.settings.compactCards);
    notify();
  }

  function getState() {
    return data;
  }

  NetSim.State = {
    subscribe,
    setRoute,
    setHoveredLayer,
    setSelectedLayer,
    updateSetting,
    getState
  };

})(window.NetSim = window.NetSim || {});
