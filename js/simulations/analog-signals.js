/* ==========================================================================
   NetSim — simulations/analog-signals.js
   A continuous sine wave the user can shape with amplitude, frequency
   and phase — Start scrolls it (phase advancing over time), Step nudges
   the phase by a fixed increment, Reset returns to the defaults.
   ========================================================================== */

(function (NetSim) {
  'use strict';

  const W = 600, H = 220;

  NetSim.SimRegistry.register('analog-signals', function factory(ctx) {
    const params = { amplitude: 0.7, frequency: 2, phaseDeg: 0 };
    let timer = null;
    let host = null;

    function draw() {
      const phaseRad = (params.phaseDeg * Math.PI) / 180;
      const points = NetSim.Core.Waveform.sampleWaveform(
        (t) => params.amplitude * Math.sin(2 * Math.PI * params.frequency * t + phaseRad),
        W, H, 240, 0.42
      );
      host.innerHTML = `
        <svg class="net-svg wave-svg" viewBox="0 0 ${W} ${H}" role="img" aria-label="Analog sine wave">
          <line class="wave-axis" x1="0" y1="${H / 2}" x2="${W}" y2="${H / 2}"></line>
          <polyline class="wave-line wave-line--analog" points="${points}"></polyline>
        </svg>
      `;
      ctx.setMetrics([
        { label: 'Amplitude', value: params.amplitude.toFixed(2) + ' V' },
        { label: 'Frequency', value: params.frequency.toFixed(1) + ' Hz' },
        { label: 'Period', value: (1000 / params.frequency).toFixed(0) + ' ms' },
        { label: 'Phase', value: (params.phaseDeg % 360).toFixed(0) + '\u00b0' },
        { label: 'Peak-to-Peak', value: (params.amplitude * 2).toFixed(2) + ' V' }
      ]);
    }

    function renderParams() {
      ctx.params.hidden = false;
      ctx.params.innerHTML = `
        <div class="sim-param-row"><label for="ampSlider">Amplitude</label>
          <input type="range" id="ampSlider" min="0.2" max="1" step="0.05" value="${params.amplitude}">
          <span class="val" id="ampVal">${params.amplitude.toFixed(2)} V</span></div>
        <div class="sim-param-row"><label for="freqSlider">Frequency</label>
          <input type="range" id="freqSlider" min="0.5" max="6" step="0.5" value="${params.frequency}">
          <span class="val" id="freqVal">${params.frequency.toFixed(1)} Hz</span></div>
        <p style="font-size:0.78rem;color:var(--ink-faint);margin-top:0.5rem;">An analog signal is continuous — it can take
        any value at any instant, unlike the discrete levels of a digital signal.</p>
      `;
      ctx.params.querySelector('#ampSlider').addEventListener('input', (e) => {
        params.amplitude = parseFloat(e.target.value);
        ctx.params.querySelector('#ampVal').textContent = params.amplitude.toFixed(2) + ' V';
        draw();
      });
      ctx.params.querySelector('#freqSlider').addEventListener('input', (e) => {
        params.frequency = parseFloat(e.target.value);
        ctx.params.querySelector('#freqVal').textContent = params.frequency.toFixed(1) + ' Hz';
        draw();
      });
    }

    function stop() { if (timer) { NetSim.SimTiming.clearInterval(timer); timer = null; } }

    function advance(step) {
      params.phaseDeg = (params.phaseDeg + step) % 360;
      draw();
    }

    return {
      initialize() {
        ctx.canvas.classList.add('net-canvas');
        ctx.canvas.innerHTML = '<div class="wave-mount"></div>';
        host = ctx.canvas.querySelector('.wave-mount');
        renderParams();
        draw();
        ctx.log('Analog signal ready — adjust amplitude or frequency, then press Start to scroll the phase.');
      },
      start() {
        if (timer) return;
        timer = NetSim.SimTiming.setInterval(() => advance(8), 80);
        ctx.log('Scrolling the waveform (phase advancing continuously).');
      },
      pause() { stop(); },
      step() { stop(); advance(30); ctx.log('Advanced phase by 30\u00b0.'); },
      reset() {
        stop();
        params.amplitude = 0.7; params.frequency = 2; params.phaseDeg = 0;
        renderParams(); draw();
        ctx.log('Reset to default amplitude, frequency and phase.');
      },
      destroy() { stop(); }
    };
  });

})(window.NetSim = window.NetSim || {});
