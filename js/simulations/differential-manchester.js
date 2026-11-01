/* ==========================================================================
   NetSim — simulations/differential-manchester.js
   Encodes a user bit string as Differential Manchester.

   Rule:  A transition ALWAYS occurs at the mid-point of every bit (clock).
          • Bit 0 → transition at the START of the bit period as well.
          • Bit 1 → NO transition at the start of the bit period.
   The starting level before the first bit is assumed to be LOW (-1).
   ========================================================================== */

(function (NetSim) {
  'use strict';

  const W = 600, H = 240;

  NetSim.SimRegistry.register('differential-manchester', function factory(ctx) {
    let bits = NetSim.Core.Waveform.parseBits('1011001');
    let bitRate = 4;
    let index = -1;
    let timer = null;
    let host = null;

    /**
     * Pre-compute the full differential-Manchester level sequence for all bits.
     * Returns an array of objects: { startLevel, endLevel } per bit.
     * startLevel = level at the beginning of the bit period.
     * endLevel   = level after the mid-bit transition (always the inverse of startLevel).
     */
    function computeLevels() {
      const levels = [];
      let lastLevel = -1;   // level at the end of the previous bit period (initial = LOW)
      for (let i = 0; i < bits.length; i++) {
        let startLevel;
        if (bits[i] === '0') {
          // Bit 0: transition at the bit boundary → invert lastLevel
          startLevel = -lastLevel;
        } else {
          // Bit 1: NO transition at the bit boundary → keep lastLevel
          startLevel = lastLevel;
        }
        // Mid-bit transition always happens → endLevel is the inverse
        const endLevel = -startLevel;
        levels.push({ startLevel, endLevel });
        lastLevel = endLevel;
      }
      return levels;
    }

    /**
     * Build waveform segments for the i-th bit using precomputed levels.
     */
    function diffManchesterSegments(levels) {
      return function (i) {
        return [
          { frac: 0, value: levels[i].startLevel },
          { frac: 0.5, value: levels[i].endLevel }
        ];
      };
    }

    function draw() {
      const revealedCount = index >= 0 ? index + 1 : 0;
      const revealedWidth = (revealedCount / bits.length) * W;
      const levels = computeLevels();
      const points = revealedCount
        ? NetSim.Core.Waveform.stepWaveform(revealedCount, revealedWidth, H - 60, 0.35, diffManchesterSegments(levels))
        : '';

      host.innerHTML = `
        <svg class="net-svg wave-svg" viewBox="0 0 ${W} ${H}" role="img" aria-label="Differential Manchester encoding">
          <text class="wave-tracklabel" x="4" y="16">Differential Manchester</text>
          <g transform="translate(0,30)">
            <line class="wave-axis" x1="0" y1="${(H - 60) / 2}" x2="${W}" y2="${(H - 60) / 2}"></line>
            <polyline class="wave-line wave-line--digital" points="${points}"></polyline>
          </g>
          ${bits.map((b, i) => {
            const x = ((i + 0.5) / bits.length) * W;
            return `<text class="wave-bitlabel" x="${x}" y="${H - 4}" text-anchor="middle">${b}</text>`;
          }).join('')}
        </svg>
      `;

      const baudRate = bitRate * 2;
      ctx.setMetrics([
        { label: 'Bit Rate', value: bitRate + ' bps' },
        { label: 'Baud Rate', value: baudRate + ' baud (2\u00d7 bit rate)' },
        { label: 'Bits Encoded', value: revealedCount + ' / ' + bits.length },
        { label: 'Self-Clocking', value: 'Yes \u2014 mid-bit transition in every bit' },
        { label: 'Differential', value: 'Yes \u2014 polarity-inversion tolerant' },
        { label: 'Bandwidth Needed', value: 'Higher than NRZ (doubled)' }
      ]);
    }

    function renderParams() {
      ctx.params.hidden = false;
      ctx.params.innerHTML = `
        <div class="switch-text-row">
          <label for="dmBitsInput">Bit string</label>
          <input type="text" id="dmBitsInput" maxlength="12" value="${bits.join('')}">
        </div>
        <div class="sim-param-row"><label for="dmRateSlider">Bit Rate</label>
          <input type="range" id="dmRateSlider" min="1" max="10" step="1" value="${bitRate}">
          <span class="val" id="dmRateVal">${bitRate} bps</span></div>
        <p style="font-size:0.78rem;color:var(--ink-faint);margin-top:0.5rem;">
          A mid-bit transition always occurs (for clocking).
          Bit 0 also has a transition at the bit <strong>boundary</strong>;
          Bit 1 has <strong>no</strong> boundary transition.
          Because meaning depends on transitions rather than absolute polarity,
          the encoding is immune to polarity inversion.</p>
      `;
      ctx.params.querySelector('#dmBitsInput').addEventListener('change', (e) => {
        bits = NetSim.Core.Waveform.parseBits(e.target.value, '1011001');
        index = -1;
        stop();
        draw();
        ctx.log('New bit string: ' + bits.join('') + '.');
      });
      ctx.params.querySelector('#dmRateSlider').addEventListener('input', (e) => {
        bitRate = parseInt(e.target.value, 10);
        ctx.params.querySelector('#dmRateVal').textContent = bitRate + ' bps';
        draw();
      });
    }

    function stop() { if (timer) { NetSim.SimTiming.clearInterval(timer); timer = null; } }

    function advance() {
      if (index >= bits.length - 1) { stop(); return; }
      index += 1;
      const levels = computeLevels();
      const lvl = levels[index];
      const hasBoundaryTransition = bits[index] === '0';
      const boundary = hasBoundaryTransition ? 'transition at boundary' : 'no boundary transition';
      const dir = lvl.startLevel < lvl.endLevel ? 'low \u2192 high' : 'high \u2192 low';
      ctx.log('Bit ' + (index + 1) + ' = \u2018' + bits[index] + '\u2019 \u2014 ' + boundary + '; mid-bit ' + dir + '.');
      draw();
    }

    function rebuild() {
      stop();
      index = -1;
      renderParams();
      draw();
      ctx.log('Ready to encode ' + bits.length + ' bits as Differential Manchester. Press Start or Step.');
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
