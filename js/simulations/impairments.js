/* ==========================================================================
   NetSim — simulations/impairments.js
   A clean sine wave versus a "received" version with attenuation, noise
   and/or distortion applied. Start/Step ramp a shared severity level from
   0 to 100% across whichever impairments are toggled on.
   ========================================================================== */

(function (NetSim) {
  'use strict';

  const W = 600, H = 220;
  const STEPS = 10;

  NetSim.SimRegistry.register('impairments', function factory(ctx) {
    const toggles = { attenuation: true, noise: true, distortion: false };
    const maxEffect = { attenuation: 60, noise: 18, distortion: 50 }; // % at full severity
    let severityStep = 0;
    let timer = null;
    let host = null;
    let noiseSeed = [];

    function regenerateNoise() {
      noiseSeed = [];
      for (let i = 0; i <= 300; i++) noiseSeed.push(Math.random() * 2 - 1);
    }

    function severityFrac() { return severityStep / STEPS; }

    function received(t, i) {
      const clean = Math.sin(2 * Math.PI * 3 * t);
      let v = clean;
      const s = severityFrac();

      if (toggles.distortion) {
        const distortAmt = (maxEffect.distortion / 100) * s;
        v = v * (1 - distortAmt * 0.5) + distortAmt * 0.5 * Math.sin(2 * Math.PI * 9 * t + 0.6);
      }
      if (toggles.attenuation) {
        const attenAmt = (maxEffect.attenuation / 100) * s;
        v = v * (1 - attenAmt);
      }
      if (toggles.noise) {
        const noiseAmt = (maxEffect.noise / 100) * s;
        v = v + noiseSeed[i] * noiseAmt;
      }
      return v;
    }

    function draw() {
      const cleanPoints = NetSim.Core.Waveform.sampleWaveform((t) => Math.sin(2 * Math.PI * 3 * t), W, H, 300, 0.4);
      const pts = [];
      for (let i = 0; i <= 300; i++) {
        const t = i / 300;
        const v = Math.max(-1.4, Math.min(1.4, received(t, i)));
        pts.push((t * W).toFixed(1) + ',' + (H / 2 - v * H * 0.4).toFixed(1));
      }
      host.innerHTML = `
        <svg class="net-svg wave-svg" viewBox="0 0 ${W} ${H}" role="img" aria-label="Signal with impairments">
          <line class="wave-axis" x1="0" y1="${H / 2}" x2="${W}" y2="${H / 2}"></line>
          <polyline class="wave-line wave-line--ghost" points="${cleanPoints}"></polyline>
          <polyline class="wave-line wave-line--received" points="${pts.join(' ')}"></polyline>
        </svg>
        <p class="net-hint">Dashed = original signal · solid = received signal (severity ${(severityFrac() * 100).toFixed(0)}%)</p>
      `;

      const s = severityFrac();
      const attenDb = toggles.attenuation ? (20 * Math.log10(1 - (maxEffect.attenuation / 100) * s || 0.001)) : 0;
      const noiseAmt = toggles.noise ? (maxEffect.noise / 100) * s : 0;
      const signalAmt = toggles.attenuation ? 1 - (maxEffect.attenuation / 100) * s : 1;
      const snr = noiseAmt > 0.001 ? (20 * Math.log10(signalAmt / noiseAmt)).toFixed(1) + ' dB' : '\u221e (no noise)';

      ctx.setMetrics([
        { label: 'Severity', value: (s * 100).toFixed(0) + '%' },
        { label: 'Attenuation', value: toggles.attenuation ? Math.abs(attenDb).toFixed(1) + ' dB loss' : 'Off' },
        { label: 'Noise Level', value: toggles.noise ? (noiseAmt * 100).toFixed(0) + '%' : 'Off' },
        { label: 'Distortion', value: toggles.distortion ? 'On (harmonic added)' : 'Off' },
        { label: 'Estimated SNR', value: snr }
      ]);
    }

    function renderParams() {
      ctx.params.hidden = false;
      ctx.params.innerHTML = `
        <label class="switch-mode-option ${toggles.attenuation ? 'is-checked' : ''}">
          <input type="checkbox" id="tglAtten" ${toggles.attenuation ? 'checked' : ''}> Attenuation (signal weakens)
        </label>
        <label class="switch-mode-option ${toggles.noise ? 'is-checked' : ''}" style="margin-top:0.4rem;">
          <input type="checkbox" id="tglNoise" ${toggles.noise ? 'checked' : ''}> Noise (random interference)
        </label>
        <label class="switch-mode-option ${toggles.distortion ? 'is-checked' : ''}" style="margin-top:0.4rem;">
          <input type="checkbox" id="tglDistort" ${toggles.distortion ? 'checked' : ''}> Distortion (frequencies arrive out of sync)
        </label>
      `;
      ['attenuation', 'noise', 'distortion'].forEach((key) => {
        const id = key === 'attenuation' ? 'tglAtten' : key === 'noise' ? 'tglNoise' : 'tglDistort';
        ctx.params.querySelector('#' + id).addEventListener('change', (e) => {
          toggles[key] = e.target.checked;
          ctx.log((toggles[key] ? 'Enabled ' : 'Disabled ') + key + ' for this channel.');
          draw();
        });
      });
    }

    function stop() { if (timer) { clearInterval(timer); timer = null; } }

    function advance() {
      if (severityStep >= STEPS) { stop(); return; }
      severityStep += 1;
      draw();
      ctx.log('Channel severity now at ' + (severityFrac() * 100).toFixed(0) + '%.', severityStep === STEPS ? 'warning' : undefined);
    }

    function rebuild() {
      stop();
      severityStep = 0;
      regenerateNoise();
      renderParams();
      draw();
      ctx.log('Clean signal ready. Toggle impairments, then press Start or Step to ramp up severity.');
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
        timer = setInterval(() => { if (severityStep >= STEPS) { stop(); return; } advance(); }, 500);
      },
      pause() { stop(); },
      step() { stop(); advance(); },
      reset() { rebuild(); },
      destroy() { stop(); }
    };
  });

})(window.NetSim = window.NetSim || {});
