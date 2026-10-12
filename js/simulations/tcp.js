/* ==========================================================================
   NetSim — simulations/tcp.js
   The real three-way handshake with actual sequence/ack numbers, then
   (optionally) the four-way teardown — both ends send their own FIN,
   not a single shared one.
   ========================================================================== */

(function (NetSim) {
  'use strict';

  NetSim.SimRegistry.register('tcp', function factory(ctx) {
    let includeTeardown = true;
    let events = [];
    let index = -1;
    let timer = null;
    let host = null;

    function buildEvents() {
      const clientIsn = 1000, serverIsn = 5000;
      const out = [
        { text: 'Client sends SYN, seq=' + clientIsn + ' \u2014 "I\u2019d like to open a connection, my sequence numbers start here."', dir: 'c2s', phase: 'SYN' },
        { text: 'Server sends SYN-ACK, seq=' + serverIsn + ', ack=' + (clientIsn + 1) + ' \u2014 "Agreed, and here is where mine start."', dir: 's2c', phase: 'SYN-ACK' },
        { text: 'Client sends ACK, ack=' + (serverIsn + 1) + ' \u2014 connection established.', dir: 'c2s', phase: 'ACK', level: 'success' },
        { text: 'Connection is now ESTABLISHED \u2014 both sides can send data.', phase: 'established', level: 'success' }
      ];
      if (includeTeardown) {
        const dataBytes = 200;
        out.push({ text: 'Client sends FIN, seq=' + (clientIsn + 1 + dataBytes) + ' \u2014 "I have no more data to send."', dir: 'c2s', phase: 'FIN1' });
        out.push({ text: 'Server sends ACK for the client\u2019s FIN \u2014 client\u2019s side is now half-closed.', dir: 's2c', phase: 'ACK-FIN1' });
        out.push({ text: 'Server finishes sending its own data, then sends its own FIN, seq=' + (serverIsn + 1) + '.', dir: 's2c', phase: 'FIN2' });
        out.push({ text: 'Client sends the final ACK \u2014 connection fully closed on both sides.', dir: 'c2s', phase: 'ACK-FIN2', level: 'success' });
      }
      return out;
    }

    function draw() {
      const step = events[Math.max(0, index)] || {};
      const arrow = step.dir === 'c2s' ? '\u2192' : step.dir === 's2c' ? '\u2190' : '\u2194';
      host.innerHTML = `
        <div class="fw-diagram">
          <div class="fw-node">Client</div>
          <div class="fw-packet-track"><span class="fw-packet" style="font-size:0.72rem;">${step.phase || ''} ${arrow}</span></div>
          <div class="fw-node" style="border-color:var(--teal);color:var(--teal);">Server</div>
        </div>
      `;
      const established = index >= 3;
      const closed = includeTeardown && index >= events.length - 1;
      ctx.setMetrics([
        { label: 'State', value: closed ? 'CLOSED' : established ? 'ESTABLISHED' : 'Handshaking...' },
        { label: 'Segments Exchanged', value: String(index + 1) },
        { label: 'Client ISN', value: '1000' },
        { label: 'Server ISN', value: '5000' },
        { label: 'Teardown Included', value: includeTeardown ? 'Yes (4-way)' : 'No' }
      ]);
    }

    function renderParams() {
      ctx.params.hidden = false;
      ctx.params.innerHTML = `
        <label class="switch-mode-option ${includeTeardown ? 'is-checked' : ''}">
          <input type="checkbox" id="tcpTeardown" ${includeTeardown ? 'checked' : ''}>
          Include connection teardown (4-way)
        </label>
      `;
      ctx.params.querySelector('#tcpTeardown').addEventListener('change', (e) => { includeTeardown = e.target.checked; rebuild(); });
    }

    function rebuild() {
      stop();
      index = -1;
      events = buildEvents();
      renderParams();
      draw();
      ctx.log('Ready \u2014 client about to open a TCP connection to the server.');
    }

    function stop() { if (timer) { clearInterval(timer); timer = null; } }

    function advance() {
      if (index >= events.length - 1) { stop(); return; }
      index += 1;
      ctx.log(events[index].text, events[index].level);
      draw();
    }

    return {
      initialize() {
        ctx.canvas.classList.add('net-canvas');
        ctx.canvas.innerHTML = '<div class="tcp-mount"></div>';
        host = ctx.canvas.querySelector('.tcp-mount');
        rebuild();
      },
      start() { if (timer) return; timer = setInterval(() => { if (index >= events.length - 1) { stop(); return; } advance(); }, 700); },
      pause() { stop(); },
      step() { stop(); advance(); },
      reset() { rebuild(); },
      destroy() { stop(); }
    };
  });

})(window.NetSim = window.NetSim || {});
