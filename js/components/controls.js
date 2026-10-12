/* ==========================================================================
   NetSim — components/controls.js
   Reusable Start / Pause / Step / Reset control bar used by every
   simulation page.
   ========================================================================== */

(function (NetSim) {
  'use strict';

  function controlsHTML() {
    return `
      <div class="sim-controls" role="group" aria-label="Simulation controls">
        <button class="btn" type="button" data-action="start">Start</button>
        <button class="btn secondary" type="button" data-action="pause">Pause</button>
        <button class="btn secondary" type="button" data-action="step">Step</button>
        <button class="btn secondary" type="button" data-action="reset">Reset</button>
      </div>
    `;
  }

  /**
   * Wires the four buttons inside `scopeEl` to a lifecycle-shaped object
   * (anything with start/pause/step/reset methods).
   */
  function wireControls(scopeEl, lifecycle) {
    scopeEl.querySelectorAll('[data-action]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const action = btn.dataset.action;
        if (typeof lifecycle[action] === 'function') lifecycle[action]();
      });
    });
  }

  NetSim.Components = NetSim.Components || {};
  NetSim.Components.controlsHTML = controlsHTML;
  NetSim.Components.wireControls = wireControls;

})(window.NetSim = window.NetSim || {});
