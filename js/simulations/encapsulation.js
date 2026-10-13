/* Layer-by-layer OSI encapsulation at the sender and decapsulation at the receiver. */
(function (NetSim) {
  'use strict';

  const LAYERS = [
    { name: 'Application', unit: 'Data', action: 'creates application data' },
    { name: 'Presentation', unit: 'Data', action: 'formats or encrypts the data' },
    { name: 'Session', unit: 'Data', action: 'manages the communication session' },
    { name: 'Transport', unit: 'Segment', action: 'adds a TCP/UDP header' },
    { name: 'Network', unit: 'Packet', action: 'adds an IP header' },
    { name: 'Data Link', unit: 'Frame', action: 'adds a link header and trailer' },
    { name: 'Physical', unit: 'Bits', action: 'encodes the frame as signals / bits' }
  ];

  NetSim.SimRegistry.register('encapsulation-concept', function (ctx) {
    let stepIndex = 0;
    let timer = null;
    let host;
    const total = LAYERS.length * 2;

    function current() {
      const direction = stepIndex < LAYERS.length ? 'encapsulate' : 'decapsulate';
      const layerIndex = direction === 'encapsulate' ? stepIndex : total - 1 - stepIndex;
      return { direction, layerIndex, layer: LAYERS[layerIndex] };
    }

    function draw() {
      const state = current();
      host.innerHTML = `
        <div class="encap-walk">
          <div class="encap-walk-head"><strong>${state.direction === 'encapsulate' ? 'Sender · encapsulation' : 'Receiver · decapsulation'}</strong><span>Step ${stepIndex + 1} of ${total}</span></div>
          <div class="encap-walk-flow">
            <section><h3>Sender</h3><div class="encap-stack">${LAYERS.map((l, i) => `<div class="encap-row ${i === state.layerIndex && state.direction === 'encapsulate' ? 'active' : i < stepIndex ? 'done' : ''}"><b>${l.name}</b><span>${i <= stepIndex ? l.unit + (i > 2 ? ' · ' + l.action : '') : 'Waiting'}</span></div>`).join('')}</div></section>
            <div class="encap-medium"><span>Network</span><b>${stepIndex < LAYERS.length ? '→' : '←'}</b><small>${stepIndex >= LAYERS.length - 1 ? 'Bits / signals' : 'Moving data'}</small></div>
            <section><h3>Receiver</h3><div class="encap-stack">${LAYERS.slice().reverse().map((l, i) => { const li = LAYERS.indexOf(l); return `<div class="encap-row ${li === state.layerIndex && state.direction === 'decapsulate' ? 'active' : li > state.layerIndex && state.direction === 'decapsulate' ? 'done' : ''}"><b>${l.name}</b><span>${state.direction === 'decapsulate' && li >= state.layerIndex ? (li === 0 && li === state.layerIndex ? 'Original message' : li > state.layerIndex ? l.header + ' removed' : l.unit) : 'Waiting'}</span></div>`; }).join('')}</div></section>
          </div>
          <p class="encap-walk-note"><strong>${state.layer.name}:</strong> ${state.direction === 'encapsulate' ? state.layer.action + ' as data moves down the stack.' : state.layerIndex > 2 ? `processes and removes its ${state.layer.name === 'Data Link' ? 'header and trailer' : 'header'} before passing data up.` : `processes the data and passes it up to the ${state.layerIndex === 0 ? 'receiving application' : LAYERS[state.layerIndex - 1].name} layer.`}</p>
        </div>`;
      ctx.setMetrics([
        { label: 'Direction', value: state.direction === 'encapsulate' ? 'Sender → medium' : 'Receiver → application' },
        { label: 'Current layer', value: state.layer.name },
        { label: 'Data unit', value: state.layer.unit },
        { label: 'Progress', value: `${stepIndex + 1} / ${total}` }
      ]);
    }
    function stop() { if (timer) { NetSim.SimTiming.clearInterval(timer); timer = null; } }
    function advance() {
      if (stepIndex >= total - 1) { stop(); return; }
      stepIndex += 1;
      const s = current();
      ctx.log(`${s.direction === 'encapsulate' ? 'Encapsulating at' : 'Decapsulating at'} the ${s.layer.name} layer.`);
      draw();
    }
    return {
      initialize() { ctx.canvas.classList.add('net-canvas'); ctx.canvas.innerHTML = '<div class="encap-walk-mount"></div>'; host = ctx.canvas.querySelector('.encap-walk-mount'); ctx.params.hidden = true; stepIndex = 0; draw(); ctx.log('Application data is ready at the sender. Step through encapsulation and decapsulation.'); },
      start() { if (!timer) timer = NetSim.SimTiming.setInterval(advance, 1300); },
      pause() { stop(); },
      step() { stop(); advance(); },
      reset() { stop(); stepIndex = 0; draw(); ctx.log('Reset to application data at the sender.'); },
      destroy() { stop(); }
    };
  });
})(window.NetSim = window.NetSim || {});
