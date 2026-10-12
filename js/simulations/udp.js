/* ==========================================================================
   NetSim — simulations/udp.js
   Fire-and-forget: datagrams go out with no handshake, no ACK, and no
   retransmission. A configurable loss probability shows exactly what
   "no delivery guarantee" means in practice.
   ========================================================================== */

(function (NetSim) {
  'use strict';

  NetSim.SimRegistry.register('udp', function factory(ctx) {
    let count = 6;
    let lossProb = 0.25;
    let events = [];
    let index = -1;
    let timer = null;
    let host = null;

    function buildEvents() {
      const out = [{ text: 'No handshake \u2014 the application just starts sending UDP datagrams immediately.', level: 'normal' }];
      for (let i = 1; i <= count; i++) {
        const lost = Math.random() < lossProb;
        out.push({
          text: lost
            ? 'Datagram ' + i + ' sent \u2014 lost in transit. No one retransmits it; the application never even finds out.'
            : 'Datagram ' + i + ' sent \u2014 delivered.',
          level: lost ? 'warning' : 'success',
          lost
        });
      }
      out.push({ text: 'No connection to close, either \u2014 the "session" is just whichever datagrams happened to arrive.', level: 'normal' });
      return out;
    }

    function draw() {
      const step = events[Math.max(0, index)] || {};
      const chips = events.slice(1, index + 1).filter((e) => 'lost' in e).map((e, i) => `<span class="packet-chip ${e.lost ? 'lost' : 'delivered'}">D${i + 1} ${e.lost ? '\u2717' : '\u2713'}</span>`).join('');
      host.innerHTML = `
        <div class="fw-diagram">
          <div class="fw-node">Sender</div>
          <div class="fw-packet-track"><span class="fw-arrow" style="font-size:1.3rem;">\u2192</span></div>
          <div class="fw-node" style="border-color:var(--teal);color:var(--teal);">Receiver</div>
        </div>
        <div class="packet-status-strip" style="margin-top:0.75rem;">${chips || '<span class="net-hint">No datagrams sent yet.</span>'}</div>
      `;
      const sent = events.slice(1, index + 1).filter((e) => 'lost' in e);
      const lost = sent.filter((e) => e.lost).length;
      ctx.setMetrics([
        { label: 'Datagrams Sent', value: sent.length + ' / ' + count },
        { label: 'Delivered', value: String(sent.length - lost) },
        { label: 'Lost (never recovered)', value: String(lost) },
        { label: 'Retransmissions', value: '0 (UDP never retransmits)' },
        { label: 'Header Overhead', value: '8 bytes (src port, dst port, length, checksum)' }
      ]);
    }

    function renderParams() {
      ctx.params.hidden = false;
      ctx.params.innerHTML = `
        <div class="sim-param-row"><label for="udpCount">Datagrams to Send</label>
          <input type="range" id="udpCount" min="3" max="12" step="1" value="${count}">
          <span class="val" id="udpCountVal">${count}</span></div>
        <div class="sim-param-row"><label for="udpLoss">Loss Probability</label>
          <input type="range" id="udpLoss" min="0" max="50" step="5" value="${Math.round(lossProb * 100)}">
          <span class="val" id="udpLossVal">${Math.round(lossProb * 100)}%</span></div>
      `;
      ctx.params.querySelector('#udpCount').addEventListener('change', (e) => { count = parseInt(e.target.value, 10); rebuild(); });
      ctx.params.querySelector('#udpCount').addEventListener('input', (e) => { ctx.params.querySelector('#udpCountVal').textContent = e.target.value; });
      ctx.params.querySelector('#udpLoss').addEventListener('change', (e) => { lossProb = parseInt(e.target.value, 10) / 100; rebuild(); });
      ctx.params.querySelector('#udpLoss').addEventListener('input', (e) => { ctx.params.querySelector('#udpLossVal').textContent = e.target.value + '%'; });
    }

    function rebuild() {
      stop();
      index = -1;
      events = buildEvents();
      renderParams();
      draw();
      ctx.log('Ready \u2014 about to send ' + count + ' UDP datagrams with no connection setup.');
    }

    function stop() { if (timer) { clearInterval(timer); timer = null; } }

    function advance() {
      if (index >= events.length - 1) { stop(); return; }
      index += 1;
      ctx.log(events[index].text, events[index].level === 'normal' ? undefined : events[index].level);
      draw();
    }

    return {
      initialize() {
        ctx.canvas.classList.add('net-canvas');
        ctx.canvas.innerHTML = '<div class="udp-mount"></div>';
        host = ctx.canvas.querySelector('.udp-mount');
        rebuild();
      },
      start() { if (timer) return; timer = setInterval(() => { if (index >= events.length - 1) { stop(); return; } advance(); }, 500); },
      pause() { stop(); },
      step() { stop(); advance(); },
      reset() { rebuild(); },
      destroy() { stop(); }
    };
  });

})(window.NetSim = window.NetSim || {});
