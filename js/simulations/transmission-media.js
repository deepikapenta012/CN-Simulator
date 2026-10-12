/* ==========================================================================
   NetSim — simulations/transmission-media.js
   Sends a signal across a chosen medium and steps distance forward,
   showing how differently twisted pair, coax, fiber and wireless
   attenuate — and where a repeater would become necessary.
   ========================================================================== */

(function (NetSim) {
  'use strict';

  const W = 600, H = 200;
  const MAX_DISTANCE = 100; // km
  const STEP_KM = 5;

  const MEDIA = {
    'twisted-pair': { label: 'Twisted Pair', k: 0.06, bandwidth: '1 Mbps – 1 Gbps', maxRun: '~100 m – few km', interference: 'High' },
    coax: { label: 'Coaxial Cable', k: 0.03, bandwidth: '10 Mbps – 1 Gbps', maxRun: '~500 m – few km', interference: 'Medium' },
    fiber: { label: 'Fiber Optic', k: 0.002, bandwidth: '100 Mbps – 100+ Gbps', maxRun: '~10 – 80 km', interference: 'None (immune to EMI)' },
    wireless: { label: 'Wireless / Radio', k: 0.05, bandwidth: 'Varies — Mbps to Gbps', maxRun: 'Depends on power/frequency', interference: 'High' }
  };

  function strengthAt(k, distanceKm) {
    return 100 * Math.exp(-k * distanceKm);
  }

  NetSim.SimRegistry.register('transmission-media', function factory(ctx) {
    let mediaKey = 'fiber';
    let distance = 0;
    let flaggedRepeater = false;
    let flaggedDead = false;
    let timer = null;
    let host = null;

    function draw() {
      const medium = MEDIA[mediaKey];
      const points = NetSim.Core.Waveform.sampleWaveform((t) => {
        const d = t * MAX_DISTANCE;
        const env = strengthAt(medium.k, d) / 100;
        return env * Math.sin(2 * Math.PI * 6 * t);
      }, W, H, 300, 0.42);

      const strength = strengthAt(medium.k, distance);
      const markerX = (distance / MAX_DISTANCE) * W;

      host.innerHTML = `
        <svg class="net-svg wave-svg" viewBox="0 0 ${W} ${H}" role="img" aria-label="Signal strength over distance">
          <line class="wave-axis" x1="0" y1="${H / 2}" x2="${W}" y2="${H / 2}"></line>
          <polyline class="wave-line wave-line--media" points="${points}"></polyline>
          <line class="wave-marker" x1="${markerX.toFixed(1)}" y1="0" x2="${markerX.toFixed(1)}" y2="${H}"></line>
          <text class="wave-bitlabel" x="${markerX.toFixed(1)}" y="16" text-anchor="middle">${distance} km</text>
        </svg>
      `;

      ctx.setMetrics([
        { label: 'Medium', value: medium.label },
        { label: 'Distance', value: distance + ' km' },
        { label: 'Signal Strength', value: strength.toFixed(1) + '%' },
        { label: 'Typical Bandwidth', value: medium.bandwidth },
        { label: 'Typical Repeater Spacing', value: medium.maxRun },
        { label: 'Interference Susceptibility', value: medium.interference }
      ]);
    }

    function renderParams() {
      ctx.params.hidden = false;
      const keys = Object.keys(MEDIA);
      ctx.params.innerHTML = `
        <fieldset class="switch-mode-group" role="radiogroup" aria-label="Transmission medium">
          <legend class="section-label" style="margin:0 0 0.5rem;border:none;padding:0;">Medium</legend>
          ${keys.map((k) => `
            <label class="switch-mode-option ${k === mediaKey ? 'is-checked' : ''}">
              <input type="radio" name="mediaChoice" value="${k}" ${k === mediaKey ? 'checked' : ''}>
              ${MEDIA[k].label}
            </label>
          `).join('')}
        </fieldset>
      `;
      ctx.params.querySelectorAll('input[name="mediaChoice"]').forEach((r) => {
        r.addEventListener('change', () => { mediaKey = r.value; rebuild(); });
      });
    }

    function rebuild() {
      stop();
      distance = 0;
      flaggedRepeater = false;
      flaggedDead = false;
      renderParams();
      draw();
      ctx.log('Sending a signal over ' + MEDIA[mediaKey].label + '.');
    }

    function stop() { if (timer) { clearInterval(timer); timer = null; } }

    function advance() {
      if (distance >= MAX_DISTANCE) { stop(); return; }
      distance = Math.min(MAX_DISTANCE, distance + STEP_KM);
      const strength = strengthAt(MEDIA[mediaKey].k, distance);
      draw();

      if (!flaggedRepeater && strength < 50) {
        flaggedRepeater = true;
        ctx.log('At ' + distance + ' km, signal strength has dropped below 50% — a repeater would be recommended here.', 'warning');
      } else if (!flaggedDead && strength < 10) {
        flaggedDead = true;
        ctx.log('At ' + distance + ' km, signal strength is below 10% — effectively unusable without amplification.', 'error');
      } else {
        ctx.log('At ' + distance + ' km, signal strength is ' + strength.toFixed(1) + '%.');
      }
      if (distance >= MAX_DISTANCE) stop();
    }

    return {
      initialize() {
        ctx.canvas.classList.add('net-canvas');
        ctx.canvas.innerHTML = '<div class="wave-mount"></div>';
        host = ctx.canvas.querySelector('.wave-mount');
        rebuild();
      },
      start() {
        if (timer) return;
        timer = setInterval(() => { if (distance >= MAX_DISTANCE) { stop(); return; } advance(); }, 500);
      },
      pause() { stop(); },
      step() { stop(); advance(); },
      reset() { rebuild(); },
      destroy() { stop(); }
    };
  });

})(window.NetSim = window.NetSim || {});
