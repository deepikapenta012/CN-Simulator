/* Physical layer line-coding demos: Unipolar NRZ and Polar NRZ-L. */
(function (NetSim) {
  'use strict';

  const W = 600;
  const H = 220;

  function createLineCode(ctx, type) {
    const unipolar = type === 'unipolar';
    const nrzi = type === 'polar-nrzi';
    const rz = type === 'polar-rz';
    const title = unipolar ? 'Unipolar NRZ' : nrzi ? 'Polar NRZ-I' : rz ? 'Polar RZ' : 'Polar NRZ-L';
    let bits = NetSim.Core.Waveform.parseBits('10110010');
    let bitRate = 4;
    let index = -1;
    let timer = null;
    let host;

    function segmentsForBits() {
      let previousLevel = -1;
      return bits.map((bit) => {
        if (nrzi) {
          if (bit === '1') previousLevel *= -1;
          return [{ frac: 0, value: previousLevel }];
        }
        if (rz) return [{ frac: 0, value: bit === '1' ? 1 : -1 }, { frac: 0.5, value: 0 }];
        if (unipolar) return [{ frac: 0, value: bit === '1' ? 1 : 0 }];
        return [{ frac: 0, value: bit === '1' ? 1 : -1 }];
      });
    }

    function draw() {
      const encodedSegments = segmentsForBits();
      const points = NetSim.Core.Waveform.stepWaveform(bits.length, W, H, 0.38,
        (i) => encodedSegments[i]);
      host.innerHTML = `
        <svg class="net-svg wave-svg" viewBox="0 0 ${W} ${H}" role="img" aria-label="${title} waveform">
          <line class="wave-axis" x1="0" y1="${H / 2}" x2="${W}" y2="${H / 2}"></line>
          ${bits.map((bit, i) => `<text class="wave-bitlabel" x="${((i + 0.5) / bits.length) * W}" y="${H - 8}" text-anchor="middle">${bit}</text>`).join('')}
          <polyline class="wave-line wave-line--digital" points="${points}"></polyline>
          ${index >= 0 ? `<rect class="wave-scan" x="${(index / bits.length) * W}" y="0" width="${W / bits.length}" height="${H}"></rect>` : ''}
        </svg>
      `;
      ctx.setMetrics([
        { label: 'Encoding', value: title },
        { label: 'Bit Rate', value: bitRate + ' bps' },
        { label: 'Baud Rate', value: rz ? (bitRate * 2) + ' baud (up to 2 elements/bit)' : bitRate + ' baud' },
        { label: 'Signal Levels', value: unipolar ? '+V and 0 V' : rz ? '+V, 0 V, -V' : '+V and -V' },
        { label: 'Bits Scanned', value: Math.max(index + 1, 0) + ' / ' + bits.length }
      ]);
    }

    function stop() {
      if (timer) { clearInterval(timer); timer = null; }
    }

    function advance() {
      if (index >= bits.length - 1) { stop(); return; }
      index += 1;
      const level = segmentsForBits()[index][0].value;
      const detail = nrzi
        ? (bits[index] === '1' ? 'transition at bit start' : 'no transition')
        : rz ? (bits[index] === '1' ? '+V pulse, then return to zero' : '-V pulse, then return to zero')
          : 'signal level ' + (level > 0 ? '+V' : level < 0 ? '-V' : '0 V');
      ctx.log('Bit ' + (index + 1) + ' = ' + bits[index] + ': ' + detail + '.');
      draw();
    }

    function renderParams() {
      ctx.params.hidden = false;
      ctx.params.innerHTML = `
        <div class="switch-text-row">
          <label for="lineCodeBits">Bit string</label>
          <input type="text" id="lineCodeBits" maxlength="16" value="${bits.join('')}">
        </div>
        <div class="sim-param-row"><label for="lineCodeRate">Bit Rate</label>
          <input type="range" id="lineCodeRate" min="1" max="10" step="1" value="${bitRate}">
          <span class="val" id="lineCodeRateValue">${bitRate} bps</span></div>
        <p class="line-code-note">${unipolar
          ? 'Unipolar NRZ: 1 = +V, 0 = 0 V. Long runs of zeros have no transitions, and the signal can have a DC component.'
          : nrzi ? 'Polar NRZ-I: 1 causes a transition at the start of the bit; 0 leaves the level unchanged. The starting level is -V.'
            : rz ? 'Polar RZ: 1 = +V pulse, 0 = -V pulse; each pulse returns to zero halfway through the bit.'
              : 'Polar NRZ-L: 1 = +V, 0 = -V. Two voltage polarities represent the two bit values.'}</p>
      `;
      ctx.params.querySelector('#lineCodeBits').addEventListener('change', (event) => {
        bits = NetSim.Core.Waveform.parseBits(event.target.value, '10110010');
        index = -1;
        stop();
        draw();
        ctx.log('Updated bit string to ' + bits.join('') + '.');
      });
      ctx.params.querySelector('#lineCodeRate').addEventListener('input', (event) => {
        bitRate = Number(event.target.value);
        ctx.params.querySelector('#lineCodeRateValue').textContent = bitRate + ' bps';
      });
    }

    function rebuild() {
      stop();
      index = -1;
      renderParams();
      draw();
      ctx.log(title + ' ready. Press Start or Step to encode the bit string.');
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
        timer = setInterval(() => {
          if (index >= bits.length - 1) { stop(); return; }
          advance();
        }, Math.max(150, 1000 / bitRate));
      },
      pause() { stop(); },
      step() { stop(); advance(); },
      reset() { rebuild(); },
      destroy() { stop(); }
    };
  }

  NetSim.SimRegistry.register('unipolar', (ctx) => createLineCode(ctx, 'unipolar'));
  NetSim.SimRegistry.register('polar', (ctx) => createLineCode(ctx, 'polar'));
  NetSim.SimRegistry.register('polar-nrzi', (ctx) => createLineCode(ctx, 'polar-nrzi'));
  NetSim.SimRegistry.register('polar-rz', (ctx) => createLineCode(ctx, 'polar-rz'));
})(window.NetSim = window.NetSim || {});
