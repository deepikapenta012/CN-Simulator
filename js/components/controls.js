/* ==========================================================================
   NetSim — components/controls.js
   Reusable Start / Pause / Step / Reset control bar used by every
   simulation page.
   ========================================================================== */

(function (NetSim) {
  'use strict';

  function controlsHTML() {
    const speedPercent = Math.round(((NetSim.SimTiming && NetSim.SimTiming.getSpeed()) || 1) * 100);
    return `
      <div class="sim-controls" role="group" aria-label="Simulation controls">
        <button class="btn" type="button" data-action="start">Start</button>
        <button class="btn secondary" type="button" data-action="pause">Pause</button>
        <button class="btn secondary" type="button" data-action="step">Step</button>
        <button class="btn secondary" type="button" data-action="reset">Reset</button>
      </div>
      <div class="sim-playback-speed">
        <label for="simSpeed">Playback speed</label>
        <input type="range" id="simSpeed" min="50" max="250" step="25" value="${speedPercent}">
        <output id="simSpeedValue" for="simSpeed">${(speedPercent / 100).toFixed(2).replace(/\.?0+$/, '')}×</output>
      </div>
    `;
  }

  /**
   * Wires the four buttons inside `scopeEl` to a lifecycle-shaped object
   * (anything with start/pause/step/reset methods).
   */
  function wireControls(scopeEl, lifecycle) {
    const speedInput = scopeEl.querySelector('#simSpeed');
    const speedOutput = scopeEl.querySelector('#simSpeedValue');
    if (speedInput && NetSim.SimTiming) {
      speedInput.addEventListener('input', () => {
        const speed = Number(speedInput.value) / 100;
        NetSim.SimTiming.setSpeed(speed);
        speedOutput.textContent = speed.toFixed(2).replace(/\.?0+$/, '') + '×';
      });
    }

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
