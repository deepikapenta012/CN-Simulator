/* ==========================================================================
   NetSim — simulations/digital-signals.js
   Renders a user-entered bit string as an NRZ-L digital signal (two
   discrete voltage levels) and scans across it bit by bit, tying bit
   rate to bit duration and total transmission time.
   ========================================================================== */

(function (NetSim) {
  'use strict';

  const W = 600, H = 220;

  NetSim.SimRegistry.register('digital-signals', function factory(ctx) {
    let bits = NetSim.Core.Waveform.parseBits('10110100');
    let bitRate = 4; // bits per second, illustrative
    let index = -1;
    let timer = null;
    let host = null;

    function draw() {
      const revealedCount = Math.max(0, index + 1);
      const visibleBits = bits.slice(0, revealedCount);
      const visibleWidth = (revealedCount / bits.length) * W;
      const points = revealedCount
        ? NetSim.Core.Waveform.stepWaveform(revealedCount, visibleWidth, H, 0.38, (i) => (
          [{ frac: 0, value: visibleBits[i] === '1' ? 1 : -1 }]
        ))
        : '';
      host.innerHTML = `
        <svg class="net-svg wave-svg" viewBox="0 0 ${W} ${H}" role="img" aria-label="Digital NRZ-L signal">
          <line class="wave-axis" x1="0" y1="${H / 2}" x2="${W}" y2="${H / 2}"></line>
          ${bits.map((b, i) => `<text class="wave-bitlabel" x="${((i + 0.5) / bits.length) * W}" y="${H - 8}" text-anchor="middle">${b}</text>`).join('')}
          <polyline class="wave-line wave-line--digital" points="${points}"></polyline>
          ${index >= 0 ? `<rect class="wave-scan" x="${(index / bits.length) * W}" y="0" width="${W / bits.length}" height="${H}"></rect>` : ''}
        </svg>
      `;

      const bitDuration = 1000 / bitRate;
      ctx.setMetrics([
        { label: 'Bit Rate', value: bitRate + ' bps' },
        { label: 'Bit Duration', value: bitDuration.toFixed(0) + ' ms' },
        { label: 'Bits Drawn', value: revealedCount + ' / ' + bits.length },
        { label: 'Transmission Time', value: (bitDuration * bits.length).toFixed(0) + ' ms' },
        { label: 'Baud Rate', value: bitRate + ' baud (1 signal element / bit for NRZ)' }
      ]);
    }

    function renderParams() {
      ctx.params.hidden = false;
      ctx.params.innerHTML = `
        <div class="switch-text-row">
          <label for="bitsInput">Bit string</label>
          <input type="text" id="bitsInput" maxlength="16" value="${bits.join('')}">
        </div>
        <div class="sim-param-row"><label for="rateSlider">Bit Rate</label>
          <input type="range" id="rateSlider" min="1" max="10" step="1" value="${bitRate}">
          <span class="val" id="rateVal">${bitRate} bps</span></div>
      `;
      ctx.params.querySelector('#bitsInput').addEventListener('change', (e) => {
        bits = NetSim.Core.Waveform.parseBits(e.target.value, '10110100');
        index = -1;
        stop();
        draw();
        ctx.log('New bit string: ' + bits.join('') + '.');
      });
      ctx.params.querySelector('#rateSlider').addEventListener('input', (e) => {
        bitRate = parseInt(e.target.value, 10);
        ctx.params.querySelector('#rateVal').textContent = bitRate + ' bps';
        draw();
      });
    }

    function stop() { if (timer) { NetSim.SimTiming.clearInterval(timer); timer = null; } }

    function advance() {
      if (index >= bits.length - 1) { stop(); return; }
      index += 1;
      ctx.log('Bit ' + (index + 1) + ' = \u2018' + bits[index] + '\u2019 \u2014 signal held ' + (bits[index] === '1' ? 'HIGH' : 'LOW') + ' for this bit period.');
      draw();
    }

    return {
      initialize() {
        ctx.canvas.classList.add('net-canvas');
        ctx.canvas.innerHTML = '<div class="wave-mount"></div>';
        host = ctx.canvas.querySelector('.wave-mount');
        renderParams();
        draw();
        ctx.log('Digital signal ready (NRZ-L: 1 = high, 0 = low). Press Start or Step to scan bit by bit.');
      },
      start() {
        if (timer) return;
        timer = NetSim.SimTiming.setInterval(() => { if (index >= bits.length - 1) { stop(); return; } advance(); }, Math.max(150, 1000 / bitRate));
      },
      pause() { stop(); },
      step() { stop(); advance(); },
      reset() { stop(); index = -1; draw(); ctx.log('Reset — scan position cleared.'); },
      destroy() { stop(); }
    };
  });

})(window.NetSim = window.NetSim || {});
