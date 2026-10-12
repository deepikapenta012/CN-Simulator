/* Independent Physical Layer demos for attenuation, noise, and distortion. */
(function (NetSim) {
  'use strict';

  const W = 600;
  const H = 220;
  const SAMPLE_COUNT = 300;

  function mountPlot(ctx, ariaLabel) {
    ctx.canvas.classList.add('net-canvas');
    ctx.canvas.innerHTML = '<div class="wave-mount"></div>';
    return ctx.canvas.querySelector('.wave-mount');
  }

  function svgPlot(host, cleanFn, receivedFn, hint) {
    const clean = NetSim.Core.Waveform.sampleWaveform(cleanFn, W, H, SAMPLE_COUNT, 0.4);
    const received = NetSim.Core.Waveform.sampleWaveform(receivedFn, W, H, SAMPLE_COUNT, 0.4);
    host.innerHTML = `
      <svg class="net-svg wave-svg" viewBox="0 0 ${W} ${H}" role="img" aria-label="Original and received signals">
        <line class="wave-axis" x1="0" y1="${H / 2}" x2="${W}" y2="${H / 2}"></line>
        <polyline class="wave-line wave-line--ghost" points="${clean}"></polyline>
        <polyline class="wave-line wave-line--received" points="${received}"></polyline>
      </svg>
      <p class="net-hint">Dashed = original signal · solid = received signal. ${hint}</p>
    `;
  }

  function createAttenuation(ctx) {
    let distance = 0;
    let lossPerKm = 0.08;
    let timer = null;
    let host;

    function receivedAmplitude() { return Math.pow(10, -(lossPerKm * distance) / 20); }
    function draw() {
      const amplitude = receivedAmplitude();
      svgPlot(host, (t) => Math.sin(2 * Math.PI * 3 * t), (t) => amplitude * Math.sin(2 * Math.PI * 3 * t), `Distance: ${distance} km`);
      ctx.setMetrics([
        { label: 'Distance', value: distance + ' km' },
        { label: 'Loss Rate', value: lossPerKm.toFixed(2) + ' dB/km' },
        { label: 'Total Attenuation', value: (lossPerKm * distance).toFixed(2) + ' dB' },
        { label: 'Received Amplitude', value: (amplitude * 100).toFixed(1) + '%' }
      ]);
    }
    function renderParams() {
      ctx.params.hidden = false;
      ctx.params.innerHTML = `<div class="sim-param-row"><label for="attenuationRate">Attenuation rate</label><input id="attenuationRate" type="range" min="1" max="20" value="8"><span class="val" id="attenuationRateValue">0.08 dB/km</span></div>`;
      ctx.params.querySelector('#attenuationRate').addEventListener('input', (event) => {
        lossPerKm = Number(event.target.value) / 100;
        ctx.params.querySelector('#attenuationRateValue').textContent = lossPerKm.toFixed(2) + ' dB/km';
        draw();
      });
    }
    function stop() { if (timer) { NetSim.SimTiming.clearInterval(timer); timer = null; } }
    function advance() { distance = Math.min(100, distance + 5); draw(); ctx.log('Signal travelled ' + distance + ' km; received amplitude is ' + (receivedAmplitude() * 100).toFixed(1) + '%.'); if (distance >= 100) stop(); }
    function reset() { stop(); distance = 0; renderParams(); draw(); ctx.log('Attenuation model ready. Start or Step to increase link distance.'); }
    return {
      initialize() { host = mountPlot(ctx, 'Attenuation'); reset(); },
      start() { if (!timer) timer = NetSim.SimTiming.setInterval(() => { if (distance >= 100) stop(); else advance(); }, 500); },
      pause: stop,
      step() { stop(); if (distance < 100) advance(); },
      reset,
      destroy: stop
    };
  }

  function createNoise(ctx) {
    let snrDb = 20;
    let frame = 0;
    let timer = null;
    let host;
    let samples = [];

    function regenerate() { samples = Array.from({ length: SAMPLE_COUNT + 1 }, () => Math.random() * 2 - 1); }
    function draw() {
      const noiseAmplitude = Math.pow(10, -snrDb / 20);
      const clean = (t) => Math.sin(2 * Math.PI * 3 * t);
      const received = (t) => clean(t) + samples[Math.min(SAMPLE_COUNT, Math.round(t * SAMPLE_COUNT))] * noiseAmplitude;
      svgPlot(host, clean, received, `SNR: ${snrDb} dB · sample ${frame}`);
      ctx.setMetrics([
        { label: 'SNR', value: snrDb + ' dB' },
        { label: 'Relative Noise Amplitude', value: (noiseAmplitude * 100).toFixed(1) + '%' },
        { label: 'Sample Frame', value: String(frame) },
        { label: 'Signal', value: 'Sine wave + random noise' }
      ]);
    }
    function renderParams() {
      ctx.params.hidden = false;
      ctx.params.innerHTML = `<div class="sim-param-row"><label for="noiseSnr">Signal-to-noise ratio</label><input id="noiseSnr" type="range" min="0" max="40" step="1" value="${snrDb}"><span class="val" id="noiseSnrValue">${snrDb} dB</span></div>`;
      ctx.params.querySelector('#noiseSnr').addEventListener('input', (event) => {
        snrDb = Number(event.target.value);
        ctx.params.querySelector('#noiseSnrValue').textContent = snrDb + ' dB';
        draw();
      });
    }
    function stop() { if (timer) { NetSim.SimTiming.clearInterval(timer); timer = null; } }
    function advance() { frame += 1; regenerate(); draw(); ctx.log('Generated noise sample frame ' + frame + ' at ' + snrDb + ' dB SNR.'); }
    function reset() { stop(); frame = 0; regenerate(); renderParams(); draw(); ctx.log('Noise model ready. Adjust SNR, then Start or Step to generate samples.'); }
    return {
      initialize() { host = mountPlot(ctx, 'Noise'); reset(); },
      start() { if (!timer) timer = NetSim.SimTiming.setInterval(advance, 650); },
      pause: stop,
      step() { stop(); advance(); },
      reset,
      destroy: stop
    };
  }

  function createDistortion(ctx) {
    let target = 60;
    let severity = 0;
    let timer = null;
    let host;

    function distortionRatio() { return (severity / 100) * 0.45; }
    function draw() {
      const ratio = distortionRatio();
      const clean = (t) => Math.sin(2 * Math.PI * 3 * t);
      const received = (t) => (clean(t) + ratio * Math.sin(2 * Math.PI * 9 * t + 0.6)) / (1 + ratio);
      svgPlot(host, clean, received, `Distortion level: ${severity}%`);
      ctx.setMetrics([
        { label: 'Distortion Level', value: severity + '%' },
        { label: 'Target Level', value: target + '%' },
        { label: 'Model', value: 'Added third harmonic' },
        { label: 'Cause Shown', value: 'Signal components changed unequally' }
      ]);
    }
    function renderParams() {
      ctx.params.hidden = false;
      ctx.params.innerHTML = `<div class="sim-param-row"><label for="distortionTarget">Maximum distortion</label><input id="distortionTarget" type="range" min="10" max="100" step="10" value="${target}"><span class="val" id="distortionTargetValue">${target}%</span></div>`;
      ctx.params.querySelector('#distortionTarget').addEventListener('input', (event) => {
        target = Number(event.target.value);
        ctx.params.querySelector('#distortionTargetValue').textContent = target + '%';
        draw();
      });
    }
    function stop() { if (timer) { NetSim.SimTiming.clearInterval(timer); timer = null; } }
    function advance() { if (severity >= target) { stop(); return; } severity = Math.min(target, severity + 10); draw(); ctx.log('Distortion increased to ' + severity + '% as the harmonic component grows.'); if (severity >= target) stop(); }
    function reset() { stop(); severity = 0; renderParams(); draw(); ctx.log('Distortion model ready. Start or Step to increase the harmonic distortion.'); }
    return {
      initialize() { host = mountPlot(ctx, 'Distortion'); reset(); },
      start() { if (!timer) timer = NetSim.SimTiming.setInterval(advance, 500); },
      pause: stop,
      step() { stop(); advance(); },
      reset,
      destroy: stop
    };
  }

  NetSim.SimRegistry.register('attenuation', createAttenuation);
  NetSim.SimRegistry.register('noise', createNoise);
  NetSim.SimRegistry.register('distortion', createDistortion);
})(window.NetSim = window.NetSim || {});
