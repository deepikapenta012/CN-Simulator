/* ==========================================================================
   NetSim — simulations/manchester.js
   Encodes a user bit string as Manchester (mid-bit transition) and draws
   it above a faint NRZ reference so the difference — and the doubled
   baud rate it costs — is visible directly.

   Convention used here (G.E. Thomas): bit 1 = LOW-to-HIGH transition at
   mid-bit; bit 0 = HIGH-to-LOW transition at mid-bit. (IEEE 802.3 uses
   the opposite polarity — the self-clocking principle is identical.)
   ========================================================================== */

(function (NetSim) {
  'use strict';

  const W = 600, H = 240;

  NetSim.SimRegistry.register('manchester', function factory(ctx) {
    let bits = NetSim.Core.Waveform.parseBits('1011001');
    let bitRate = 4;
    let index = -1;
    let timer = null;
    let host = null;

    function manchesterSegments(i) {
      return bits[i] === '1'
        ? [{ frac: 0, value: -1 }, { frac: 0.5, value: 1 }]
        : [{ frac: 0, value: 1 }, { frac: 0.5, value: -1 }];
    }

    function draw() {
      const revealedCount = index >= 0 ? index + 1 : 0;
      const revealedWidth = (revealedCount / bits.length) * W;
      const nrzBits = bits.slice(0, revealedCount);
      const nrzPoints = revealedCount
        ? NetSim.Core.Waveform.stepWaveform(revealedCount, revealedWidth, H / 2 - 10, 0.35, (i) => (
          [{ frac: 0, value: nrzBits[i] === '1' ? 1 : -1 }]
        ))
        : '';
      const manchesterBits = bits.slice(0, revealedCount);
      const manchesterPoints = manchesterBits.length
        ? NetSim.Core.Waveform.stepWaveform(manchesterBits.length, revealedWidth, H / 2 - 10, 0.35, manchesterSegments)
        : '';

      host.innerHTML = `
        <svg class="net-svg wave-svg" viewBox="0 0 ${W} ${H}" role="img" aria-label="Manchester encoding">
          <text class="wave-tracklabel" x="4" y="14">NRZ (reference)</text>
          <g transform="translate(0,20)">
            <line class="wave-axis" x1="0" y1="${(H / 2 - 10) / 2}" x2="${W}" y2="${(H / 2 - 10) / 2}"></line>
            <polyline class="wave-line wave-line--ghost" points="${nrzPoints}"></polyline>
          </g>
          <text class="wave-tracklabel" x="4" y="${H / 2 + 24}">Manchester</text>
          <g transform="translate(0,${H / 2 + 30})">
            <line class="wave-axis" x1="0" y1="${(H / 2 - 10) / 2}" x2="${W}" y2="${(H / 2 - 10) / 2}"></line>
            <polyline class="wave-line wave-line--digital" points="${manchesterPoints}"></polyline>
          </g>
          ${bits.map((b, i) => `<text class="wave-bitlabel" x="${((i + 0.5) / bits.length) * W}" y="${H - 4}" text-anchor="middle">${b}</text>`).join('')}
        </svg>
      `;

      const baudRate = bitRate * 2;
      ctx.setMetrics([
        { label: 'Bit Rate', value: bitRate + ' bps' },
        { label: 'Baud Rate', value: baudRate + ' baud (2\u00d7 bit rate)' },
        { label: 'Bits Encoded', value: revealedCount + ' / ' + bits.length },
        { label: 'Self-Clocking', value: 'Yes — a transition every bit period' },
        { label: 'Bandwidth Needed', value: 'Higher than NRZ (doubled)' }
      ]);
    }

    function renderParams() {
      ctx.params.hidden = false;
      ctx.params.innerHTML = `
        <div class="switch-text-row">
          <label for="mBitsInput">Bit string</label>
          <input type="text" id="mBitsInput" maxlength="12" value="${bits.join('')}">
        </div>
        <div class="sim-param-row"><label for="mRateSlider">Bit Rate</label>
          <input type="range" id="mRateSlider" min="1" max="10" step="1" value="${bitRate}">
          <span class="val" id="mRateVal">${bitRate} bps</span></div>
        <p style="font-size:0.78rem;color:var(--ink-faint);margin-top:0.5rem;">Convention used: 1 = low\u2192high transition
        at mid-bit, 0 = high\u2192low. (IEEE 802.3 uses the reverse polarity — the self-clocking idea is the same.)</p>
      `;
      ctx.params.querySelector('#mBitsInput').addEventListener('change', (e) => {
        bits = NetSim.Core.Waveform.parseBits(e.target.value, '1011001');
        index = -1;
        stop();
        draw();
        ctx.log('New bit string: ' + bits.join('') + '.');
      });
      ctx.params.querySelector('#mRateSlider').addEventListener('input', (e) => {
        bitRate = parseInt(e.target.value, 10);
        ctx.params.querySelector('#mRateVal').textContent = bitRate + ' bps';
        draw();
      });
    }

    function stop() { if (timer) { NetSim.SimTiming.clearInterval(timer); timer = null; } }

    function advance() {
      if (index >= bits.length - 1) { stop(); return; }
      index += 1;
      const dir = bits[index] === '1' ? 'low \u2192 high' : 'high \u2192 low';
      ctx.log('Bit ' + (index + 1) + ' = \u2018' + bits[index] + '\u2019 \u2014 transition ' + dir + ' at mid-bit.');
      draw();
    }

    function rebuild() {
      stop();
      index = -1;
      renderParams();
      draw();
      ctx.log('Ready to encode ' + bits.length + ' bits as Manchester. Press Start or Step.');
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
        timer = NetSim.SimTiming.setInterval(() => { if (index >= bits.length - 1) { stop(); return; } advance(); }, Math.max(200, 1000 / bitRate));
      },
      pause() { stop(); },
      step() { stop(); advance(); },
      reset() { rebuild(); },
      destroy() { stop(); }
    };
  });

})(window.NetSim = window.NetSim || {});
