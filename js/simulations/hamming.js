/* ==========================================================================
   NetSim — simulations/hamming.js
   Real Hamming(7,4): 4 data bits placed at non-power-of-2 positions,
   3 even-parity bits computed at positions 1/2/4, then a receiver-side
   syndrome calculation that locates and corrects a single-bit error.
   ========================================================================== */

(function (NetSim) {
  'use strict';

  function xor(...bits) { return bits.reduce((a, b) => a ^ b, 0); }

  function encode(d) {
    // d = [d1,d2,d3,d4] -> positions 3,5,6,7
    const pos = { 3: d[0], 5: d[1], 6: d[2], 7: d[3] };
    pos[1] = xor(pos[3], pos[5], pos[7]);
    pos[2] = xor(pos[3], pos[6], pos[7]);
    pos[4] = xor(pos[5], pos[6], pos[7]);
    const codeword = [1, 2, 3, 4, 5, 6, 7].map((i) => pos[i]);
    return { pos, codeword };
  }

  function syndrome(codeword) {
    const p = (i) => codeword[i - 1];
    const c1 = xor(p(1), p(3), p(5), p(7));
    const c2 = xor(p(2), p(3), p(6), p(7));
    const c4 = xor(p(4), p(5), p(6), p(7));
    return { c1, c2, c4, errorPos: c4 * 4 + c2 * 2 + c1 };
  }

  NetSim.SimRegistry.register('hamming', function factory(ctx) {
    let dataBits = [1, 0, 1, 1];
    let introduceError = false;
    let phases = [];
    let index = -1;
    let timer = null;
    let host = null;
    let result = null;

    function buildResult() {
      const { codeword } = encode(dataBits);
      let received = codeword.slice();
      let errorPos = -1;
      if (introduceError) {
        errorPos = 1 + Math.floor(Math.random() * 7);
        received[errorPos - 1] = received[errorPos - 1] ? 0 : 1;
      }
      const synd = syndrome(received);
      const corrected = received.slice();
      if (synd.errorPos > 0) corrected[synd.errorPos - 1] = corrected[synd.errorPos - 1] ? 0 : 1;
      return { codeword, received, errorPos, synd, corrected };
    }

    function buildPhases() {
      result = buildResult();
      const p = [];
      p.push({ text: 'Data bits d1 d2 d3 d4 = ' + dataBits.join(''), highlight: [] });
      p.push({ text: 'Data bits go into the non-power-of-2 positions: 3, 5, 6, 7.', highlight: [3, 5, 6, 7] });
      p.push({ text: 'p1 (checks positions 1,3,5,7) = d(3)\u2295d(5)\u2295d(7) = ' + result.codeword[0], highlight: [1, 3, 5, 7], stage: 'encode' });
      p.push({ text: 'p2 (checks positions 2,3,6,7) = d(3)\u2295d(6)\u2295d(7) = ' + result.codeword[1], highlight: [2, 3, 6, 7], stage: 'encode' });
      p.push({ text: 'p4 (checks positions 4,5,6,7) = d(5)\u2295d(6)\u2295d(7) = ' + result.codeword[3], highlight: [4, 5, 6, 7], stage: 'encode' });
      p.push({ text: 'Final 7-bit codeword: ' + result.codeword.join(''), highlight: [], stage: 'codeword' });
      if (introduceError) {
        p.push({ text: 'Introducing an error at position ' + result.errorPos + ': ' + result.received.join(''), highlight: [result.errorPos], level: 'warning', stage: 'error' });
      } else {
        p.push({ text: 'No error introduced \u2014 received codeword is unchanged: ' + result.received.join(''), highlight: [], stage: 'error' });
      }
      p.push({ text: 'Receiver recomputes c1 = checks 1,3,5,7 \u2192 ' + result.synd.c1, highlight: [1, 3, 5, 7], stage: 'check' });
      p.push({ text: 'Receiver recomputes c2 = checks 2,3,6,7 \u2192 ' + result.synd.c2, highlight: [2, 3, 6, 7], stage: 'check' });
      p.push({ text: 'Receiver recomputes c4 = checks 4,5,6,7 \u2192 ' + result.synd.c4, highlight: [4, 5, 6, 7], stage: 'check' });
      p.push({
        text: result.synd.errorPos === 0
          ? 'Syndrome (c4 c2 c1) = 000 \u2192 no error detected.'
          : 'Syndrome (c4 c2 c1) = ' + [result.synd.c4, result.synd.c2, result.synd.c1].join('') + ' = position ' + result.synd.errorPos + ' \u2192 flip that bit to correct it: ' + result.corrected.join(''),
        highlight: result.synd.errorPos ? [result.synd.errorPos] : [],
        level: result.synd.errorPos ? 'success' : 'success', stage: 'final'
      });
      return p;
    }

    function draw() {
      const phase = phases[Math.max(0, index)] || phases[0];
      const shown = phase.stage === 'error' || phase.stage === 'check' || phase.stage === 'final' ? result.received : result.codeword;
      const boxes = [1, 2, 3, 4, 5, 6, 7].map((i) => {
        const isParityPos = [1, 2, 4].includes(i);
        const isHi = phase.highlight.includes(i);
        const isErrorBit = phase.stage === 'error' && i === result.errorPos;
        const cls = ['bitbox'];
        if (isParityPos) cls.push('is-parity');
        if (isHi) cls.push('is-active');
        if (isErrorBit) cls.push('is-error');
        return `<div style="display:flex;flex-direction:column;align-items:center;gap:2px;">
          <span class="${cls.join(' ')}">${shown[i - 1]}</span>
          <span style="font-size:0.65rem;color:var(--ink-faint);font-family:var(--f-mono);">${i}${isParityPos ? ' (p)' : ''}</span>
        </div>`;
      }).join('');
      host.innerHTML = `<div class="crc-stage"><div class="bitgrid" style="align-items:flex-start;">${boxes}</div></div>`;

      ctx.setMetrics([
        { label: 'Data Bits', value: dataBits.join('') },
        { label: 'Codeword', value: result.codeword.join('') },
        { label: 'Error Introduced', value: introduceError ? 'Position ' + result.errorPos : 'No' },
        { label: 'Syndrome (decimal)', value: String(result.synd.errorPos) },
        { label: 'Result', value: index >= phases.length - 1 ? (result.synd.errorPos ? 'Corrected \u2192 ' + result.corrected.join('') : 'No error') : 'In progress' }
      ]);
    }

    function renderParams() {
      ctx.params.hidden = false;
      ctx.params.innerHTML = `
        <div class="switch-text-row">
          <label for="hamData">4 data bits</label>
          <input type="text" id="hamData" maxlength="4" value="${dataBits.join('')}">
        </div>
        <label class="switch-mode-option ${introduceError ? 'is-checked' : ''}">
          <input type="checkbox" id="hamErr" ${introduceError ? 'checked' : ''}>
          Introduce a single-bit error
        </label>
      `;
      ctx.params.querySelector('#hamData').addEventListener('change', (e) => {
        const clean = e.target.value.replace(/[^01]/g, '').padEnd(4, '0').slice(0, 4);
        dataBits = clean.split('').map(Number);
        rebuild();
      });
      ctx.params.querySelector('#hamErr').addEventListener('change', (e) => { introduceError = e.target.checked; rebuild(); });
    }

    function rebuild() {
      stop();
      index = -1;
      phases = buildPhases();
      renderParams();
      draw();
      ctx.log('Ready. ' + phases[0].text);
    }

    function stop() { if (timer) { clearInterval(timer); timer = null; } }

    function advance() {
      if (index >= phases.length - 1) { stop(); return; }
      index += 1;
      ctx.log(phases[index].text, phases[index].level);
      draw();
    }

    return {
      initialize() {
        ctx.canvas.classList.add('net-canvas');
        ctx.canvas.innerHTML = '<div class="hamming-mount"></div>';
        host = ctx.canvas.querySelector('.hamming-mount');
        rebuild();
      },
      start() { if (timer) return; timer = setInterval(() => { if (index >= phases.length - 1) { stop(); return; } advance(); }, 800); },
      pause() { stop(); },
      step() { stop(); advance(); },
      reset() { rebuild(); },
      destroy() { stop(); }
    };
  });

})(window.NetSim = window.NetSim || {});
