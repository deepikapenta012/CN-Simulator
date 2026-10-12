/* ==========================================================================
   NetSim — simulations/crc.js
   Real CRC: binary polynomial division by repeated XOR, shown one
   division step at a time, then a receiver-side check against a
   (optionally corrupted) codeword.
   ========================================================================== */

(function (NetSim) {
  'use strict';

  const GENERATORS = {
    g4: { bits: '10011', label: 'CRC-4 (10011, x\u2074+x+1)' },
    g3: { bits: '1101', label: 'Degree-3 (1101, x\u00b3+x\u00b2+1)' },
    g5: { bits: '110101', label: 'Degree-5 (110101)' }
  };

  /** Real XOR polynomial division. Returns { trace, remainder } where
   *  trace is one entry per position showing whether an XOR happened. */
  function divide(bitsStr, genStr) {
    const data = bitsStr.split('');
    const gen = genStr.split('').map(Number);
    const n = gen.length;
    const trace = [];
    for (let i = 0; i <= data.length - n; i++) {
      const before = data.slice(i, i + n).join('');
      if (data[i] === '1') {
        for (let j = 0; j < n; j++) data[i + j] = String(Number(data[i + j]) ^ gen[j]);
        trace.push({ pos: i, xored: true, before, after: data.slice(i, i + n).join(''), snapshot: data.join('') });
      } else {
        trace.push({ pos: i, xored: false, before, after: before, snapshot: data.join('') });
      }
    }
    return { trace, remainder: data.slice(data.length - (n - 1)).join('') };
  }

  function flipBit(str, pos) {
    const a = str.split('');
    a[pos] = a[pos] === '1' ? '0' : '1';
    return a.join('');
  }

  NetSim.SimRegistry.register('crc', function factory(ctx) {
    let message = '1101011011';
    let genKey = 'g4';
    let introduceError = false;
    let phases = [];
    let index = -1;
    let timer = null;
    let host = null;
    let result = null;

    function buildResult() {
      const gen = GENERATORS[genKey].bits;
      const r = gen.length - 1;
      const augmented = message + '0'.repeat(r);
      const enc = divide(augmented, gen);
      const codeword = message + enc.remainder;

      let received = codeword;
      let errorPos = -1;
      if (introduceError) {
        errorPos = Math.floor(Math.random() * codeword.length);
        received = flipBit(codeword, errorPos);
      }
      const check = divide(received, gen);
      const noErrorDetected = /^0+$/.test(check.remainder);

      return { gen, r, augmented, enc, codeword, received, errorPos, check, noErrorDetected };
    }

    function buildPhases() {
      result = buildResult();
      const p = [];
      p.push({ text: 'Message: ' + message + ' \u00b7 Generator: ' + GENERATORS[genKey].label, view: 'intro' });
      p.push({ text: 'Append ' + result.r + ' zero bit(s): ' + result.augmented, view: 'augmented' });
      result.enc.trace.forEach((t, i) => {
        p.push({
          text: 'Position ' + t.pos + ': leading bit is ' + t.before[0] + (t.xored ? ' \u2192 XOR with generator' : ' \u2192 no XOR (bring down next bit)'),
          view: 'divide-encode', trace: t, step: i + 1, total: result.enc.trace.length
        });
      });
      p.push({ text: 'Remainder (CRC) = ' + result.enc.remainder, view: 'remainder' });
      p.push({ text: 'Transmitted codeword = ' + message + ' + ' + result.enc.remainder + ' = ' + result.codeword, view: 'codeword' });
      if (introduceError) {
        p.push({ text: 'Introducing a transmission error: bit ' + result.errorPos + ' flipped \u2192 received: ' + result.received, view: 'error', level: 'warning' });
      } else {
        p.push({ text: 'No transmission error introduced \u2014 received codeword is identical: ' + result.received, view: 'error' });
      }
      p.push({ text: 'Receiver divides the received codeword by the same generator...', view: 'check-intro' });
      p.push({
        text: result.noErrorDetected
          ? 'Remainder = ' + result.check.remainder + ' (all zero) \u2192 No error detected \u2713'
          : 'Remainder = ' + result.check.remainder + ' (nonzero) \u2192 Error detected \u2717',
        view: 'final', level: result.noErrorDetected ? 'success' : 'error'
      });
      return p;
    }

    function bitGridHTML(str, highlightStart, highlightLen) {
      return str.split('').map((b, i) => {
        const hi = highlightStart != null && i >= highlightStart && i < highlightStart + highlightLen;
        return `<span class="bitbox ${hi ? 'is-active' : ''}">${b}</span>`;
      }).join('');
    }

    function draw() {
      const phase = phases[Math.max(0, index)];
      let body = '';
      if (!phase || phase.view === 'intro') {
        body = `<p class="net-hint">Press Start or Step to begin the division.</p>`;
      } else if (phase.view === 'augmented') {
        body = `<div class="bitgrid">${bitGridHTML(result.augmented)}</div>`;
      } else if (phase.view === 'divide-encode') {
        body = `
          <div class="bitgrid">${bitGridHTML(phase.trace.snapshot, phase.trace.pos, result.gen.length)}</div>
          <p class="net-hint">Step ${phase.step} / ${phase.total} \u2014 window at position ${phase.trace.pos}: ${phase.trace.before} ${phase.trace.xored ? '\u2295 ' + result.gen + ' = ' + phase.trace.after : '(unchanged)'}</p>
        `;
      } else if (phase.view === 'remainder' || phase.view === 'codeword') {
        body = `<div class="bitgrid">${bitGridHTML(result.codeword, message.length, result.enc.remainder.length)}</div>
          <p class="net-hint">Data bits (plain) + CRC remainder (highlighted)</p>`;
      } else if (phase.view === 'error') {
        body = `<div class="bitgrid">${bitGridHTML(result.received, result.errorPos >= 0 ? result.errorPos : null, 1)}</div>`;
      } else {
        body = `<div class="bitgrid">${bitGridHTML(result.check.remainder)}</div>
          <p class="net-hint">Final remainder after dividing the received codeword</p>`;
      }
      host.innerHTML = `<div class="crc-stage">${body}</div>`;

      ctx.setMetrics([
        { label: 'Generator', value: GENERATORS[genKey].label },
        { label: 'CRC Length', value: (result.gen.length - 1) + ' bits' },
        { label: 'Transmitted Codeword', value: result.codeword },
        { label: 'Error Introduced', value: introduceError ? 'Bit ' + result.errorPos : 'No' },
        { label: 'Result', value: index >= phases.length - 1 ? (result.noErrorDetected ? 'No error detected' : 'Error detected \u2717') : 'In progress' }
      ]);
    }

    function renderParams() {
      ctx.params.hidden = false;
      ctx.params.innerHTML = `
        <div class="switch-text-row">
          <label for="crcMsg">Message bits</label>
          <input type="text" id="crcMsg" maxlength="14" value="${message}">
        </div>
        <fieldset class="switch-mode-group" role="radiogroup" aria-label="Generator polynomial">
          <legend class="section-label" style="margin:0 0 0.5rem;border:none;padding:0;">Generator</legend>
          ${Object.keys(GENERATORS).map((k) => `
            <label class="switch-mode-option ${k === genKey ? 'is-checked' : ''}">
              <input type="radio" name="crcGen" value="${k}" ${k === genKey ? 'checked' : ''}>
              ${GENERATORS[k].label}
            </label>
          `).join('')}
        </fieldset>
        <label class="switch-mode-option ${introduceError ? 'is-checked' : ''}" style="margin-top:0.5rem;">
          <input type="checkbox" id="crcErr" ${introduceError ? 'checked' : ''}>
          Introduce a transmission error
        </label>
      `;
      ctx.params.querySelector('#crcMsg').addEventListener('change', (e) => {
        message = (e.target.value.replace(/[^01]/g, '') || '1101011011').slice(0, 14);
        rebuild();
      });
      ctx.params.querySelectorAll('input[name="crcGen"]').forEach((r) => {
        r.addEventListener('change', () => { genKey = r.value; rebuild(); });
      });
      ctx.params.querySelector('#crcErr').addEventListener('change', (e) => { introduceError = e.target.checked; rebuild(); });
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
        ctx.canvas.innerHTML = '<div class="crc-mount"></div>';
        host = ctx.canvas.querySelector('.crc-mount');
        rebuild();
      },
      start() { if (timer) return; timer = setInterval(() => { if (index >= phases.length - 1) { stop(); return; } advance(); }, 700); },
      pause() { stop(); },
      step() { stop(); advance(); },
      reset() { rebuild(); },
      destroy() { stop(); }
    };
  });

})(window.NetSim = window.NetSim || {});
