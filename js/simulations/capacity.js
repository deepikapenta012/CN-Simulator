/* Independent Nyquist and Shannon channel-capacity calculators. */
(function (NetSim) {
  'use strict';

  function format(value) {
    return value >= 1000 ? value.toFixed(0) : value >= 10 ? value.toFixed(2) : value.toFixed(3);
  }

  function createCalculator(ctx, kind) {
    const isNyquist = kind === 'nyquist';
    const defaults = isNyquist ? { bandwidth: 1, levels: 16 } : { bandwidth: 1, snrDb: 20 };
    let values = { ...defaults };

    function calculate(logResult) {
      const bandwidthHz = values.bandwidth * 1e6;
      let capacityMbps;
      let formula;
      let substitution;
      let metrics;

      if (isNyquist) {
        const logLevels = Math.log(values.levels) / Math.log(2);
        capacityMbps = (2 * bandwidthHz * logLevels) / 1e6;
        formula = 'C = 2B log₂(M)';
        substitution = `2 × ${values.bandwidth} MHz × log₂(${values.levels})`;
        metrics = [
          { label: 'Bandwidth', value: values.bandwidth + ' MHz' },
          { label: 'Signal Levels (M)', value: String(values.levels) },
          { label: 'Bits per Symbol', value: String(logLevels) },
          { label: 'Nyquist Bit Rate', value: format(capacityMbps) + ' Mbps' }
        ];
      } else {
        const snrLinear = Math.pow(10, values.snrDb / 10);
        capacityMbps = (bandwidthHz * (Math.log(1 + snrLinear) / Math.log(2))) / 1e6;
        formula = 'C = B log₂(1 + SNR)';
        substitution = `${values.bandwidth} MHz × log₂(1 + ${snrLinear.toFixed(2)})`;
        metrics = [
          { label: 'Bandwidth', value: values.bandwidth + ' MHz' },
          { label: 'SNR', value: values.snrDb + ' dB' },
          { label: 'Linear SNR', value: snrLinear.toFixed(2) },
          { label: 'Shannon Capacity', value: format(capacityMbps) + ' Mbps' }
        ];
      }

      ctx.canvas.innerHTML = `
        <div class="capacity-single-result">
          <div class="capacity-result-label">${isNyquist ? 'Nyquist maximum bit rate' : 'Shannon maximum channel capacity'}</div>
          <strong>${format(capacityMbps)} Mbps</strong>
          <div class="capacity-formula"><span>${formula}</span><span>${substitution}</span></div>
          <p class="capacity-caveat">The result is a theoretical limit. Practical throughput is lower because of coding, framing, guard bands, and implementation limits.</p>
        </div>
      `;
      ctx.setMetrics(metrics);
      if (logResult) ctx.log('Calculated ' + (isNyquist ? 'Nyquist bit-rate limit' : 'Shannon channel capacity') + ': ' + format(capacityMbps) + ' Mbps.');
    }

    function renderParams() {
      ctx.params.hidden = false;
      const bandwidthInput = `<div class="switch-text-row"><label for="capacityBandwidth">Bandwidth (MHz)</label><input id="capacityBandwidth" type="number" min="0.1" max="1000" step="0.1" value="${values.bandwidth}"></div>`;
      const specificInputs = isNyquist
        ? `<div class="switch-text-row"><label for="capacityLevels">Signal levels (M)</label><select id="capacityLevels">${[2, 4, 8, 16, 32, 64, 128, 256].map((level) => `<option value="${level}" ${values.levels === level ? 'selected' : ''}>${level}</option>`).join('')}</select></div><p class="capacity-help">Nyquist assumes a noiseless channel and M distinct signal levels.</p>`
        : `<div class="sim-param-row"><label for="capacitySnr">Signal-to-noise ratio</label><input id="capacitySnr" type="range" min="0" max="60" step="1" value="${values.snrDb}"><span class="val" id="capacitySnrValue">${values.snrDb} dB</span></div><p class="capacity-help">The calculator converts SNR from dB to a linear ratio before applying Shannon’s formula.</p>`;
      ctx.params.innerHTML = bandwidthInput + specificInputs;

      ctx.params.querySelector('#capacityBandwidth').addEventListener('input', (event) => {
        const value = Number(event.target.value);
        if (Number.isFinite(value) && value >= 0.1 && value <= 1000) {
          values.bandwidth = value;
          calculate(false);
        }
      });
      if (isNyquist) {
        ctx.params.querySelector('#capacityLevels').addEventListener('change', (event) => {
          values.levels = Number(event.target.value);
          calculate(false);
        });
      } else {
        ctx.params.querySelector('#capacitySnr').addEventListener('input', (event) => {
          values.snrDb = Number(event.target.value);
          ctx.params.querySelector('#capacitySnrValue').textContent = values.snrDb + ' dB';
          calculate(false);
        });
      }
    }

    function reset() {
      values = { ...defaults };
      renderParams();
      calculate(false);
      ctx.log((isNyquist ? 'Nyquist' : 'Shannon') + ' calculator ready. Change the inputs or press Start to calculate.');
    }

    return {
      initialize() { ctx.canvas.classList.add('capacity-canvas'); reset(); },
      start() { calculate(true); },
      pause() {},
      step() { calculate(true); },
      reset,
      destroy() {}
    };
  }

  NetSim.SimRegistry.register('nyquist-capacity', (ctx) => createCalculator(ctx, 'nyquist'));
  NetSim.SimRegistry.register('shannon-capacity', (ctx) => createCalculator(ctx, 'shannon'));
})(window.NetSim = window.NetSim || {});
