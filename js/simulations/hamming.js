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
    let receiverInput = '';
    let introduceError = false;
    let phases = { sender: [], receiver: [] };
    let senderIndex = -1;
    let receiverIndex = -1;
    let senderTimer = null;
    let receiverTimer = null;
    let host = null;
    let result = null;

    function buildResult() {
      const { codeword } = encode(dataBits);
      let received = codeword.slice();
      let errorPos = -1;
      if (receiverInput) {
        received = receiverInput.split('').map(Number);
        for (let i = 0; i < codeword.length; i++) {
          if (codeword[i] !== received[i]) { errorPos = i + 1; break; }
        }
      } else if (introduceError) {
        errorPos = 1 + Math.floor(Math.random() * 7);
        received[errorPos - 1] = received[errorPos - 1] ? 0 : 1;
      }
      const synd = syndrome(received);
      const corrected = received.slice();
      if (synd.errorPos > 0) corrected[synd.errorPos - 1] = corrected[synd.errorPos - 1] ? 0 : 1;
      return { codeword, received, errorPos, receiverManual: Boolean(receiverInput), synd, corrected };
    }

    function buildPhases() {
      result = buildResult();
      const sender = [];
      sender.push({ text: 'Data bits d1 d2 d3 d4 = ' + dataBits.join(''), highlight: [] });
      sender.push({ text: 'Place data at positions 3, 5, 6, and 7.', highlight: [3, 5, 6, 7] });
      sender.push({ text: 'Calculate p1 over positions 1, 3, 5, 7 = ' + result.codeword[0], highlight: [1, 3, 5, 7], stage: 'encode' });
      sender.push({ text: 'Calculate p2 over positions 2, 3, 6, 7 = ' + result.codeword[1], highlight: [2, 3, 6, 7], stage: 'encode' });
      sender.push({ text: 'Calculate p4 over positions 4, 5, 6, 7 = ' + result.codeword[3], highlight: [4, 5, 6, 7], stage: 'encode' });
      sender.push({ text: 'Transmit 7-bit codeword: ' + result.codeword.join(''), highlight: [], stage: 'codeword' });
      const receiver = [];
      if (introduceError && !receiverInput) {
        receiver.push({ text: 'Received with an error at position ' + result.errorPos + ': ' + result.received.join(''), highlight: [result.errorPos], level: 'warning', stage: 'error' });
      } else {
        receiver.push({ text: 'Received codeword: ' + result.received.join(''), highlight: [], stage: 'error' });
      }
      receiver.push({ text: 'Recalculate c1 over positions 1, 3, 5, 7 = ' + result.synd.c1, highlight: [1, 3, 5, 7], stage: 'check' });
      receiver.push({ text: 'Recalculate c2 over positions 2, 3, 6, 7 = ' + result.synd.c2, highlight: [2, 3, 6, 7], stage: 'check' });
      receiver.push({ text: 'Recalculate c4 over positions 4, 5, 6, 7 = ' + result.synd.c4, highlight: [4, 5, 6, 7], stage: 'check' });
      receiver.push({
        text: result.synd.errorPos === 0
          ? 'Syndrome (c4 c2 c1) = 000 \u2192 no error detected.'
          : 'Syndrome (c4 c2 c1) = ' + [result.synd.c4, result.synd.c2, result.synd.c1].join('') + ' = position ' + result.synd.errorPos + ' \u2192 flip that bit to correct it: ' + result.corrected.join(''),
        highlight: result.synd.errorPos ? [result.synd.errorPos] : [],
        level: result.synd.errorPos ? 'success' : 'success', stage: 'final'
      });
      return { sender, receiver };
    }

    // Each endpoint has its own input, playback controls, and phase index.
    function draw() {
      const senderPhase = phases.sender[senderIndex];
      const receiverPhase = phases.receiver[receiverIndex];
      function renderWord(word, highlight, markError) {
        return [1, 2, 3, 4, 5, 6, 7].map((i) => {
          const parity = [1, 2, 4].includes(i);
          const cls = ['bitbox'];
          if (parity) cls.push('is-parity');
          if (highlight.includes(i)) cls.push('is-active');
          if (markError && i === result.errorPos) cls.push('is-error');
          return `<div style="display:flex;flex-direction:column;align-items:center;gap:2px;"><span class="${cls.join(' ')}">${word[i - 1]}</span><span style="font-size:0.65rem;color:var(--ink-faint);font-family:var(--f-mono);">${i}${parity ? ' (p)' : ''}</span></div>`;
        }).join('');
      }
      const senderDone = senderIndex >= phases.sender.length - 1;
      const receiverCanRun = senderDone || Boolean(receiverInput);
      const senderHighlight = senderPhase && senderPhase.stage === 'encode' ? senderPhase.highlight : [];
      const receiverHighlight = receiverPhase && receiverPhase.stage === 'check' ? receiverPhase.highlight : receiverPhase && receiverPhase.stage === 'final' && result.synd.errorPos ? [result.synd.errorPos] : [];
      const receiverWord = receiverPhase && receiverPhase.stage === 'final' ? result.corrected : result.received;
      const senderStatus = senderDone ? `Codeword sent: <code>${result.codeword.join('')}</code>` : senderPhase ? senderPhase.text : 'Enter data bits, then start or step the sender.';
      const receiverStatus = receiverPhase && receiverPhase.stage === 'final'
        ? `Syndrome ${[result.synd.c4, result.synd.c2, result.synd.c1].join('')} · ${result.synd.errorPos ? `corrected to ${result.corrected.join('')}` : 'no error detected'}.`
        : receiverPhase ? receiverPhase.text : receiverCanRun ? 'Ready to receive and decode.' : 'Run the sender or enter receiver data manually.';
      host.innerHTML = `<div class="error-control-simulations">
        <article class="error-control-simulation"><h3>Simulation Sender Side</h3>
          <div class="error-control-inputs"><div class="switch-text-row"><label for="hamData">Data bits (4)</label><input type="text" id="hamData" maxlength="4" value="${dataBits.join('')}" inputmode="numeric" pattern="[01]{4}"><small>Enter four binary digits.</small></div></div>
          ${controlButtons('sender', senderTimer, senderIndex >= phases.sender.length - 1)}
          <div class="crc-stage">${senderPhase ? `<div class="bitgrid" style="align-items:flex-start;">${renderWord(result.codeword, senderHighlight, false)}</div>` : '<p class="net-hint">Sender is ready to calculate the parity bits.</p>'}</div>
          <p class="error-control-result">${senderStatus}</p>
        </article>
        <article class="error-control-simulation"><h3>Simulation Receiver Side</h3>
          <div class="error-control-inputs"><div class="switch-text-row"><label for="hamReceiver">Received codeword (7 bits)</label><input type="text" id="hamReceiver" maxlength="7" value="${receiverInput || result.received.join('')}" inputmode="numeric" pattern="[01]{7}"><small>Enter received bits; clear the field to use sender output.</small></div>
            <label class="switch-mode-option ${introduceError ? 'is-checked' : ''}"><input type="checkbox" id="hamErr" ${introduceError ? 'checked' : ''}>Inject a channel bit error automatically</label><small>Manual received bits take precedence over automatic error injection.</small></div>
          ${controlButtons('receiver', receiverTimer, !receiverCanRun || receiverIndex >= phases.receiver.length - 1)}
          <div class="crc-stage">${receiverPhase ? `<div class="bitgrid" style="align-items:flex-start;">${renderWord(receiverWord, receiverHighlight, receiverPhase.stage === 'error')}</div>` : '<p class="net-hint">Receiver is waiting for transmission.</p>'}</div>
          <p class="error-control-result">${receiverStatus}</p>
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
      stopSender(); stopReceiver(); senderIndex = -1; receiverIndex = -1;
      phases = buildPhases(); draw();
    }
    function refreshReceiver() { stopReceiver(); receiverIndex = -1; phases = buildPhases(); draw(); }
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
    function startSender() { if (!senderTimer && senderIndex < phases.sender.length - 1) senderTimer = NetSim.SimTiming.setInterval(advanceSender, 800); }
    function startReceiver() {
      if ((senderIndex >= phases.sender.length - 1 || receiverInput) && !receiverTimer && receiverIndex < phases.receiver.length - 1)
        receiverTimer = NetSim.SimTiming.setInterval(advanceReceiver, 800);
    }
    function handleClick(event) {
      const button = event.target.closest('[data-side-action]');
      if (!button || !host.contains(button)) return;
      const side = button.dataset.side;
      const action = button.dataset.sideAction;
      const start = side === 'sender' ? startSender : startReceiver;
      const stop = side === 'sender' ? stopSender : stopReceiver;
      const advanceSide = side === 'sender' ? advanceSender : advanceReceiver;
      if (action === 'start') start();
      if (action === 'pause') stop();
      if (action === 'step') { stop(); advanceSide(); }
      if (action === 'reset') {
        stop();
        if (side === 'sender') { stopReceiver(); senderIndex = -1; receiverIndex = -1; }
        else receiverIndex = -1;
        draw();
      }
    }
    function handleInput(event) {
      if (event.target.id === 'hamData') {
        const value = event.target.value.trim();
        if (!/^[01]{4}$/.test(value)) { event.target.setCustomValidity('Enter exactly four binary digits.'); event.target.reportValidity(); return; }
        dataBits = value.split('').map(Number); receiverInput = ''; rebuild();
      } else if (event.target.id === 'hamReceiver') {
        const value = event.target.value.trim();
        if (value && !/^[01]{7}$/.test(value)) { event.target.setCustomValidity('Enter exactly seven binary digits.'); event.target.reportValidity(); return; }
        receiverInput = value; refreshReceiver();
      } else if (event.target.id === 'hamErr') {
        introduceError = event.target.checked; refreshReceiver();
      }
    }

    return {
      initialize() {
        ctx.canvas.classList.add('net-canvas');
        ctx.canvas.innerHTML = '<div class="hamming-mount"></div>';
        host = ctx.canvas.querySelector('.hamming-mount');
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
