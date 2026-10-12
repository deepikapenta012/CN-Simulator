/* ==========================================================================
   NetSim — simulations/crc.js
   Real CRC: binary polynomial division by repeated XOR, shown one
   division step at a time, then a receiver-side check against a
   (optionally corrupted) codeword.
   ========================================================================== */

(function (NetSim) {
  'use strict';

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
    let customGenBits = '10011';
    let receiverInput = '';
    let introduceError = false;
    let phases = { sender: [], receiver: [] };
    let senderIndex = -1;
    let receiverIndex = -1;
    let senderTimer = null;
    let receiverTimer = null;
    let host = null;
    let result = null;

    function currentGenerator() {
      return { bits: customGenBits, label: 'Custom (' + customGenBits + ')' };
    }

    function buildResult() {
      const gen = currentGenerator().bits;
      const r = gen.length - 1;
      const augmented = message + '0'.repeat(r);
      const enc = divide(augmented, gen);
      const codeword = message + enc.remainder;

      let received = codeword;
      let errorPos = -1;
      if (introduceError && !receiverInput) {
        errorPos = Math.floor(Math.random() * codeword.length);
        received = flipBit(codeword, errorPos);
      }
      if (receiverInput) {
        received = receiverInput;
        errorPos = -1;
        for (let i = 0; i < Math.min(codeword.length, received.length); i++) {
          if (codeword[i] !== received[i]) { errorPos = i; break; }
        }
      }
      const check = divide(received, gen);
      const noErrorDetected = /^0+$/.test(check.remainder);

      return { gen, r, augmented, enc, codeword, received, errorPos, receiverManual: Boolean(receiverInput), check, noErrorDetected };
    }

    function buildPhases() {
      result = buildResult();
      const sender = [];
      sender.push({ text: 'Append ' + result.r + ' zero bit(s): ' + result.augmented, view: 'augmented' });
      result.enc.trace.forEach((t, i) => {
        sender.push({
          text: 'Position ' + t.pos + ': leading bit is ' + t.before[0] + (t.xored ? ' \u2192 XOR with generator' : ' \u2192 no XOR (bring down next bit)'),
          view: 'divide-encode', trace: t, step: i + 1, total: result.enc.trace.length
        });
      });
      sender.push({ text: 'Remainder (CRC) = ' + result.enc.remainder, view: 'remainder' });
      sender.push({ text: 'Transmitted codeword = ' + message + ' + ' + result.enc.remainder + ' = ' + result.codeword, view: 'codeword' });
      const receiver = [];
      if (introduceError && !result.receiverManual) {
        receiver.push({ text: 'Received bits: ' + result.received, view: 'error', level: 'warning' });
      } else {
        receiver.push({ text: 'Received bits: ' + result.received, view: 'error' });
      }
      receiver.push({ text: 'Receiver divides the received codeword by the same generator...', view: 'check-intro' });
      receiver.push({
        text: result.noErrorDetected
          ? 'Remainder = ' + result.check.remainder + ' (all zero) \u2192 No error detected \u2713'
          : 'Remainder = ' + result.check.remainder + ' (nonzero) \u2192 Error detected \u2717',
        view: 'final', level: result.noErrorDetected ? 'success' : 'error'
      });
      return { sender, receiver };
    }

    function bitGridHTML(str, highlightStart, highlightLen) {
      return str.split('').map((b, i) => {
        const hi = highlightStart != null && i >= highlightStart && i < highlightStart + highlightLen;
        return `<span class="bitbox ${hi ? 'is-active' : ''}">${b}</span>`;
      }).join('');
    }

    function ladderHTML(input, gen, trace, activePos) {
      const prefix = ' '.repeat(gen.length + 4);
      const shown = trace.slice(0, activePos + 1);
      const quotient = trace.map((step, i) => i <= activePos ? (step.xored ? '1' : '0') : '·').join('');
      const lines = [
        prefix + (quotient || '·'.repeat(trace.length)),
        gen + ' ) ' + input,
        prefix + '-'.repeat(input.length)
      ];
      shown.forEach((step) => {
        if (step.xored) {
          const offset = prefix.length + step.pos;
          lines.push(' '.repeat(offset) + gen);
          lines.push(' '.repeat(offset) + '-'.repeat(gen.length));
        }
        lines.push(prefix + step.snapshot);
      });
      return `<div class="crc-ladder-wrap"><pre class="crc-ladder" aria-label="Binary polynomial long division">${lines.join('\n')}</pre></div>`;
    }

    function draw() {
      const senderPhase = phases.sender[senderIndex];
      const receiverPhase = phases.receiver[receiverIndex];
      let senderBody = '<p class="net-hint">Enter sender data, then use the controls in this block.</p>';
      if (senderPhase && senderPhase.view === 'augmented') {
        senderBody = `<p class="net-hint">Long division setup · ${result.r} zero bits appended.</p>${ladderHTML(result.augmented, result.gen, result.enc.trace, -1)}`;
      } else if (senderPhase && senderPhase.view === 'divide-encode') {
        senderBody = `${ladderHTML(result.augmented, result.gen, result.enc.trace, senderPhase.step - 1)}<p class="net-hint">Step ${senderPhase.step} / ${senderPhase.total} · position ${senderPhase.trace.pos}: ${senderPhase.trace.xored ? 'XOR the aligned generator.' : 'Leading bit is 0; bring down the next bit.'}</p>`;
      } else if (senderPhase && ['remainder', 'codeword'].includes(senderPhase.view)) {
        senderBody = `<div class="bitgrid">${bitGridHTML(result.codeword, message.length, result.enc.remainder.length)}</div><p class="net-hint">Data bits and CRC remainder</p>`;
      }
      let receiverBody = '<p class="net-hint">Waiting for sender transmission. You may also enter a codeword to check independently.</p>';
      if (receiverPhase && receiverPhase.view === 'error') {
        receiverBody = `<div class="bitgrid">${bitGridHTML(result.received, result.errorPos >= 0 ? result.errorPos : null, 1)}</div><p class="net-hint">Received codeword</p>`;
      } else if (receiverPhase && receiverPhase.view === 'check-intro') {
        receiverBody = `<p class="net-hint">Receiver divides the entered codeword by the same generator.</p>${ladderHTML(result.received, result.gen, result.check.trace, -1)}`;
      } else if (receiverPhase && receiverPhase.view === 'final') {
        receiverBody = `${ladderHTML(result.received, result.gen, result.check.trace, result.check.trace.length - 1)}<p class="net-hint">Remainder ${result.check.remainder} · ${result.noErrorDetected ? 'no error detected' : 'error detected'}</p>`;
      }
      const senderComplete = senderIndex >= phases.sender.length - 1;
      const receiverCanRun = senderComplete || Boolean(receiverInput);
      host.innerHTML = `<div class="error-control-simulations">
        <article class="error-control-simulation"><h3>Simulation Sender Side</h3>
          <div class="error-control-inputs">
            <div class="switch-text-row"><label for="crcMsg">Message bits</label><input type="text" id="crcMsg" maxlength="14" value="${message}" inputmode="numeric" pattern="[01]+"><small>Binary bits only.</small></div>
            <div class="switch-text-row"><label for="crcCustomGen">Generator polynomial bits</label><input type="text" id="crcCustomGen" maxlength="9" value="${customGenBits}" inputmode="numeric" pattern="1[01]*1"><small>Binary coefficients, highest to lowest power; degree 1–8.</small></div>
          </div>
          ${controlButtons('sender', senderTimer, senderIndex >= phases.sender.length - 1)}
          <div class="crc-stage">${senderBody}</div><p class="error-control-result">${senderComplete ? `Codeword sent: <code>${result.codeword}</code>` : `Sender input: <code>${message}</code> · generator <code>${result.gen}</code>`}</p>
        </article>
        <article class="error-control-simulation"><h3>Simulation Receiver Side</h3>
          <div class="error-control-inputs"><div class="switch-text-row"><label for="crcReceiver">Received codeword</label><input type="text" id="crcReceiver" maxlength="32" value="${receiverInput || result.received}" inputmode="numeric" pattern="[01]*"><small>Enter bits to check; clear the field to use the sender output.</small></div>
            <label class="switch-mode-option ${introduceError ? 'is-checked' : ''}"><input type="checkbox" id="crcErr" ${introduceError ? 'checked' : ''}>Inject a channel bit error automatically</label><small>Manual received bits take precedence over automatic error injection.</small>
          </div>
          ${controlButtons('receiver', receiverTimer, !receiverCanRun || receiverIndex >= phases.receiver.length - 1)}
          <div class="crc-stage">${receiverBody}</div><p class="error-control-result">${receiverPhase && receiverPhase.view === 'final' ? `Remainder <code>${result.check.remainder}</code> · ${result.noErrorDetected ? 'no error detected' : 'error detected'}` : receiverCanRun ? 'Ready to check received bits.' : 'Run the sender to transmit a codeword, or enter receiver bits manually.'}</p>
        </article>
      </div>`;
    }

    function controlButtons(side, running, disabled) {
      return `<div class="sim-controls error-control-buttons" role="group" aria-label="${side} simulation controls">
        <button class="btn" type="button" data-side="${side}" data-side-action="start" ${running || disabled ? 'disabled' : ''}>Start</button>
        <button class="btn secondary" type="button" data-side="${side}" data-side-action="pause" ${running ? '' : 'disabled'}>Pause</button>
        <button class="btn secondary" type="button" data-side="${side}" data-side-action="step" ${disabled ? 'disabled' : ''}>Step</button>
        <button class="btn secondary" type="button" data-side="${side}" data-side-action="reset">Reset</button>
      </div>`;
    }

    function rebuild() {
      stopSender(); stopReceiver();
      senderIndex = -1; receiverIndex = -1;
      phases = buildPhases();
      draw();
    }

    function refreshReceiver() {
      stopReceiver(); receiverIndex = -1;
      phases = buildPhases();
      draw();
    }

    function stopSender() { if (senderTimer) { NetSim.SimTiming.clearInterval(senderTimer); senderTimer = null; } }
    function stopReceiver() { if (receiverTimer) { NetSim.SimTiming.clearInterval(receiverTimer); receiverTimer = null; } }
    function advanceSender() {
      if (senderIndex < phases.sender.length - 1) { senderIndex += 1; if (senderIndex >= phases.sender.length - 1) stopSender(); draw(); }
      else stopSender();
    }
    function advanceReceiver() {
      if (senderIndex < phases.sender.length - 1 && !receiverInput) return;
      if (receiverIndex < phases.receiver.length - 1) { receiverIndex += 1; if (receiverIndex >= phases.receiver.length - 1) stopReceiver(); draw(); }
      else stopReceiver();
    }
    function handleClick(event) {
      const button = event.target.closest('[data-side-action]');
      if (!button || !host.contains(button)) return;
      const side = button.dataset.side;
      const action = button.dataset.sideAction;
      const start = side === 'sender' ? startSender : startReceiver;
      const stop = side === 'sender' ? stopSender : stopReceiver;
      const advance = side === 'sender' ? advanceSender : advanceReceiver;
      if (action === 'start') start();
      if (action === 'pause') stop();
      if (action === 'step') { stop(); advance(); }
      if (action === 'reset') {
        stop();
        if (side === 'sender') { stopReceiver(); senderIndex = -1; receiverIndex = -1; }
        else receiverIndex = -1;
        draw();
      }
    }
    function handleInput(event) {
      if (event.target.id === 'crcMsg') {
        const value = event.target.value.trim();
        if (!/^[01]{1,14}$/.test(value)) { event.target.setCustomValidity('Enter 1–14 binary digits.'); event.target.reportValidity(); return; }
        message = value; receiverInput = ''; rebuild();
      } else if (event.target.id === 'crcCustomGen') {
        const value = event.target.value.trim();
        if (!/^1[01]*1$/.test(value) || value.length > 9) { event.target.setCustomValidity('Use 2–9 binary digits, with 1 at both ends.'); event.target.reportValidity(); return; }
        customGenBits = value;
        if (receiverInput && receiverInput.length < value.length) receiverInput = '';
        rebuild();
      } else if (event.target.id === 'crcReceiver') {
        const value = event.target.value.trim();
        if (value && (!/^[01]+$/.test(value) || value.length < result.gen.length || value.length > 32)) { event.target.setCustomValidity('Enter binary bits at least as long as the generator (maximum 32).'); event.target.reportValidity(); return; }
        receiverInput = value; refreshReceiver();
      } else if (event.target.id === 'crcErr') {
        introduceError = event.target.checked; refreshReceiver();
      }
    }
    function startSender() { if (!senderTimer && senderIndex < phases.sender.length - 1) senderTimer = NetSim.SimTiming.setInterval(advanceSender, 700); }
    function startReceiver() {
      if ((senderIndex >= phases.sender.length - 1 || receiverInput) && !receiverTimer && receiverIndex < phases.receiver.length - 1)
        receiverTimer = NetSim.SimTiming.setInterval(advanceReceiver, 700);
    }

    return {
      initialize() {
        ctx.canvas.classList.add('net-canvas');
        ctx.canvas.innerHTML = '<div class="crc-mount"></div>';
        host = ctx.canvas.querySelector('.crc-mount');
        host.addEventListener('click', handleClick);
        host.addEventListener('change', handleInput);
        rebuild();
      },
      start: startSender,
      pause() { stopSender(); stopReceiver(); },
      step() { stopSender(); advanceSender(); },
      reset() { rebuild(); },
      destroy() { stopSender(); stopReceiver(); }
    };
  });

})(window.NetSim = window.NetSim || {});
