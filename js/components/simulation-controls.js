/* ==========================================================================
   NetSim — components/simulation-controls.js
   The parameter panel for the switching simulation: method selector,
   sliders (only the ones relevant to the selected method, per brief
   section 5), and the collapsible "How Switching Works" explanation.
   ========================================================================== */

(function (NetSim) {
  'use strict';

  const EXPLANATIONS = {
    circuit: [
      'A dedicated end-to-end path is selected before any data moves.',
      'Connection establishment reserves that exact path in advance.',
      'Links along the path are locked — no one else can use them.',
      'The route stays fixed for the entire conversation.',
      'Connection termination releases the reserved links afterward.'
    ],
    message: [
      'The whole message travels as a single unit — it is never split.',
      'Each router fully receives and stores the message before continuing.',
      'No dedicated connection is reserved anywhere in the network.',
      'Store-and-forward at every hop adds delay but needs no setup phase.'
    ],
    packet: [
      'The message is divided into fixed-size packets.',
      'Each packet is forwarded independently — no reserved path.',
      'Network resources are shared between many senders at once.',
      'Packets may take different routes and arrive out of order.',
      'The destination uses sequence numbers to reassemble the message.'
    ]
  };

  function sliderRow(id, label, value, min, max, step, unit) {
    return `
      <div class="sim-param-row" data-row="${id}">
        <label for="${id}">${label}</label>
        <input type="range" id="${id}" min="${min}" max="${max}" step="${step}" value="${value}">
        <span class="val" id="${id}Val">${value}${unit || ''}</span>
      </div>
    `;
  }

  function render(paramsEl, params, handlers) {
    paramsEl.hidden = false;
    paramsEl.innerHTML = `
      <fieldset class="switch-mode-group" role="radiogroup" aria-label="Switching method">
        <legend class="section-label" style="margin:0 0 0.5rem;border:none;padding:0;">Switching method</legend>
        ${modeOption('circuit', 'Circuit Switching', params.mode)}
        ${modeOption('message', 'Message Switching', params.mode)}
        ${modeOption('packet', 'Packet Switching', params.mode)}
      </fieldset>

      <div class="switch-text-row">
        <label for="switchMessage">Message</label>
        <input type="text" id="switchMessage" maxlength="40" value="${escapeAttr(params.message)}">
        <span class="char-count" id="switchMessageCount">${params.message.length} chars</span>
      </div>

      <div id="switchSliders"></div>

      <details class="switch-explain">
        <summary>How ${labelFor(params.mode)} works</summary>
        <ul id="switchExplainList"></ul>
      </details>
    `;

    paintSliders(paramsEl, params);
    paintExplanation(paramsEl, params.mode);

    paramsEl.querySelectorAll('input[name="switchMode"]').forEach((r) => {
      r.addEventListener('change', () => {
        handlers.onChange({ mode: r.value });
      });
    });

    const msgInput = paramsEl.querySelector('#switchMessage');
    msgInput.addEventListener('input', () => {
      paramsEl.querySelector('#switchMessageCount').textContent = msgInput.value.length + ' chars';
    });
    msgInput.addEventListener('change', () => {
      const val = msgInput.value.trim() || 'HELLO NETWORK';
      handlers.onChange({ message: val.toUpperCase() });
    });

    wireSliders(paramsEl, handlers);
  }

  function modeOption(value, label, current) {
    const checked = value === current;
    return `
      <label class="switch-mode-option ${checked ? 'is-checked' : ''}">
        <input type="radio" name="switchMode" value="${value}" ${checked ? 'checked' : ''}>
        ${label}
      </label>
    `;
  }

  function labelFor(mode) {
    return mode === 'circuit' ? 'Circuit Switching' : mode === 'message' ? 'Message Switching' : 'Packet Switching';
  }

  function paintSliders(paramsEl, params) {
    const host = paramsEl.querySelector('#switchSliders');
    const rows = [];

    if (params.mode === 'packet') {
      rows.push(sliderRow('packetSize', 'Packet Size', params.packetSize, 1, 8, 1, ' chars'));
    }
    rows.push(sliderRow('linkDelay', 'Link Delay', params.linkDelay, 10, 300, 10, ' ms'));
    rows.push(sliderRow('transmissionSpeed', 'Transmission Speed', params.transmissionSpeed, 1, 10, 1, ' ch/ms'));
    if (params.mode === 'packet') {
      rows.push(sliderRow('packetLoss', 'Packet Loss Probability', Math.round(params.packetLoss * 100), 0, 50, 5, '%'));
    }
    if (params.mode === 'circuit') {
      rows.push(sliderRow('circuitSetupTime', 'Circuit Setup Time', params.circuitSetupTime, 50, 500, 25, ' ms'));
    }
    rows.push(sliderRow('animationSpeed', 'Animation Speed', params.animationSpeed, 0.5, 3, 0.5, '×'));

    host.innerHTML = rows.join('');
  }

  function wireSliders(paramsEl, handlers) {
    paramsEl.querySelectorAll('#switchSliders input[type="range"]').forEach((input) => {
      const valEl = paramsEl.querySelector('#' + input.id + 'Val');
      const unit = valEl.textContent.replace(/[-\d.]/g, '');
      input.addEventListener('input', () => { valEl.textContent = input.value + unit; });
      input.addEventListener('change', () => {
        const raw = parseFloat(input.value);
        const patch = {};
        if (input.id === 'packetLoss') patch.packetLoss = raw / 100;
        else patch[input.id] = raw;
        handlers.onChange(patch);
      });
    });
  }

  function paintExplanation(paramsEl, mode) {
    const list = paramsEl.querySelector('#switchExplainList');
    const summary = paramsEl.querySelector('.switch-explain summary');
    summary.textContent = 'How ' + labelFor(mode) + ' works';
    list.innerHTML = EXPLANATIONS[mode].map((line) => '<li>' + line + '</li>').join('');
  }

  function escapeAttr(str) {
    return String(str).replace(/&/g, '&amp;').replace(/"/g, '&quot;');
  }

  NetSim.Components = NetSim.Components || {};
  NetSim.Components.SwitchingControls = { render, paintSliders, paintExplanation, labelFor };

})(window.NetSim = window.NetSim || {});
