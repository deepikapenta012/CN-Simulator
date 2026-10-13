/* Shows each PDU as headers and trailers are added, then removed. */
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
  const PAYLOAD = 'Hello, NetSim!';
  const TOTAL = LAYERS.length * 2;

  function pduHTML(level) {
    if (level >= 6) {
      return `<div class="pdu-bits"><b>Bits / signals</b><code>10101010 00000001 01001000 ...</code><small>Illustrative signal encoding of the Ethernet frame</small></div>`;
    }
    const fields = [];
    if (level >= 5) fields.push(['trailer', 'FCS trailer', 'Frame check sequence']);
    fields.push(['payload', level >= 5 ? 'Frame payload' : level >= 4 ? 'Packet payload' : level >= 3 ? 'Segment payload' : 'Application data', PAYLOAD]);
    if (level >= 3) fields.push(['header', 'TCP header', 'Src port 51514 · Dst port 443']);
    if (level >= 4) fields.push(['header', 'IP header', 'Src 192.0.2.10 · Dst 198.51.100.20']);
    if (level >= 5) fields.push(['header', 'Ethernet header', 'Src MAC · Dst MAC']);
    const names = level >= 5 ? ['Ethernet frame', 'Frame'] : level === 4 ? ['IP packet', 'Packet'] : level === 3 ? ['TCP segment', 'Segment'] : ['Application data', 'Data'];
    return `<div class="pdu-box"><div class="pdu-title"><b>${names[0]}</b><span>${names[1]}</span></div><div class="pdu-fields">${fields.reverse().map(([type, title, value]) => `<div class="pdu-field ${type}"><b>${title}</b><span>${value}</span></div>`).join('')}</div></div>`;
  }

  NetSim.SimRegistry.register('encapsulation-concept', function (ctx) {
    let stepIndex = 0;
    let timer = null;
    let host;

    function current() {
      const direction = stepIndex < LAYERS.length ? 'encapsulate' : 'decapsulate';
      const layerIndex = direction === 'encapsulate' ? stepIndex : TOTAL - 1 - stepIndex;
      const pduLevel = direction === 'encapsulate' ? Math.min(layerIndex, 6) : Math.max(0, layerIndex - 1);
      return { direction, layerIndex, layer: LAYERS[layerIndex], pduLevel };
    }

    function draw() {
      const state = current();
      const inputLevel = state.direction === 'decapsulate' ? state.layerIndex : Math.max(0, state.layerIndex - 1);
      const incoming = state.direction === 'encapsulate'
        ? (state.layerIndex === 0 ? 'Application creates the message' : `Incoming ${LAYERS[state.layerIndex - 1].unit.toLowerCase()}`)
        : (state.layerIndex === 6 ? 'Signal arrives from the medium' : `Incoming ${state.layer.unit.toLowerCase()}`);
      const after = state.direction === 'encapsulate'
        ? `${state.layer.unit} leaves this layer`
        : `${state.pduLevel > 2 ? LAYERS[state.pduLevel].unit : 'Data'} passed upward`;
      host.innerHTML = `
        <div class="encap-walk">
          <div class="encap-walk-head"><strong>${state.direction === 'encapsulate' ? 'Sender · encapsulation' : 'Receiver · decapsulation'}</strong><span>Step ${stepIndex + 1} of ${TOTAL}</span></div>
          <div class="pdu-transform">
            <div class="pdu-stage"><span class="pdu-stage-label">${incoming}</span>${pduHTML(inputLevel)}</div>
            <div class="pdu-transform-arrow">${state.direction === 'encapsulate' ? '↓' : '↑'}<span>${state.direction === 'encapsulate' ? 'Add information' : 'Read and remove'}</span></div>
            <div class="pdu-stage"><span class="pdu-stage-label">${after}</span>${pduHTML(state.pduLevel)}</div>
          </div>
          <div class="encap-layer-track">${LAYERS.map((layer, i) => `<div class="encap-layer-step ${i === state.layerIndex ? 'active' : state.direction === 'encapsulate' ? i < state.layerIndex ? 'done' : '' : i > state.layerIndex ? 'done' : ''}"><b>${layer.name}</b><span>${layer.unit}</span></div>`).join('')}</div>
          <p class="encap-walk-note"><strong>${state.layer.name}:</strong> ${state.direction === 'encapsulate' ? state.layer.action + '.' : state.layerIndex > 2 ? `reads and removes the ${state.layer.name === 'Data Link' ? 'frame header and FCS trailer' : state.layer.name === 'Network' ? 'IP header' : 'transport header'}; it passes the payload upward.` : `processes the data and passes it to the ${state.layerIndex === 0 ? 'receiving application' : LAYERS[state.layerIndex - 1].name} layer.`}</p>
        </div>`;
      ctx.setMetrics([
        { label: 'Direction', value: state.direction === 'encapsulate' ? 'Sender → medium' : 'Receiver → application' },
        { label: 'Current layer', value: state.layer.name },
        { label: 'Data unit', value: state.direction === 'decapsulate' && state.layerIndex <= 3 ? 'Data' : state.layer.unit },
        { label: 'Progress', value: `${stepIndex + 1} / ${TOTAL}` }
      ]);
    }

    function stop() { if (timer) { NetSim.SimTiming.clearInterval(timer); timer = null; } }
    function advance() {
      if (stepIndex >= TOTAL - 1) { stop(); return; }
      stepIndex += 1;
      const state = current();
      ctx.log(`${state.direction === 'encapsulate' ? 'Encapsulating at' : 'Decapsulating at'} the ${state.layer.name} layer.`);
      draw();
    }

    return {
      initialize() { ctx.canvas.classList.add('net-canvas'); ctx.canvas.innerHTML = '<div class="encap-walk-mount"></div>'; host = ctx.canvas.querySelector('.encap-walk-mount'); ctx.params.hidden = true; stepIndex = 0; draw(); ctx.log('Application data is ready at the sender. Step through encapsulation and decapsulation.'); },
      start() { if (!timer) timer = NetSim.SimTiming.setInterval(advance, 1500); },
      pause() { stop(); },
      step() { stop(); advance(); },
      reset() { stop(); stepIndex = 0; draw(); ctx.log('Reset to application data at the sender.'); },
      destroy() { stop(); }
    };
  });
})(window.NetSim = window.NetSim || {});
