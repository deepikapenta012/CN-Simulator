/* ==========================================================================
   NetSim — simulations/multiplexing.js
   Three application streams share one NIC and one destination IP:port —
   the transport layer tells them apart purely by source port, and
   demultiplexes each arriving segment to the correct socket using the
   full (srcIP, srcPort, dstIP, dstPort) tuple.
   ========================================================================== */

(function (NetSim) {
  'use strict';

  const SERVER = '93.184.216.34:443';
  const STREAMS = [
    { name: 'Tab 1 (news site)', port: 51000 },
    { name: 'Tab 2 (video call)', port: 51001 },
    { name: 'Tab 3 (email)', port: 51002 }
  ];
  // interleaved arrival order at the server
  const ARRIVAL_ORDER = [0, 1, 0, 2, 1, 1, 0, 2, 1, 0];

  NetSim.SimRegistry.register('multiplexing', function factory(ctx) {
    let events = [];
    let index = -1;
    let timer = null;
    let host = null;

    function buildEvents() {
      const out = [{ text: 'All three tabs share the same network interface and the same destination ' + SERVER + '.', phase: 'intro' }];
      STREAMS.forEach((s) => out.push({ text: s.name + ' opens a connection using source port ' + s.port + '.', phase: 'open', stream: s }));
      ARRIVAL_ORDER.forEach((streamIdx, i) => {
        const s = STREAMS[streamIdx];
        out.push({ text: 'Segment ' + (i + 1) + ' arrives at the server from port ' + s.port + ' \u2014 demultiplexed to ' + s.name + '\u2019s socket.', phase: 'deliver', stream: s, level: 'success' });
      });
      out.push({ text: 'All three streams were carried over the same physical link and IP address \u2014 only the source port told them apart.', phase: 'done', level: 'success' });
      return out;
    }

    function draw() {
      const step = events[Math.max(0, index)] || {};
      const delivered = {};
      STREAMS.forEach((s) => { delivered[s.port] = 0; });
      events.slice(0, index + 1).forEach((e) => { if (e.phase === 'deliver') delivered[e.stream.port] += 1; });

      host.innerHTML = `
        <div style="display:flex;flex-direction:column;gap:0.4rem;">
          ${STREAMS.map((s) => `
            <div style="display:flex;align-items:center;gap:0.6rem;padding:0.4rem 0.6rem;border:1px solid ${step.stream === s ? 'var(--accent)' : 'var(--line)'};${step.stream === s ? 'background:var(--accent-soft);' : ''}">
              <span style="font-family:var(--f-mono);font-size:0.75rem;width:7rem;flex:none;">:${s.port}</span>
              <span style="flex:1;font-size:0.85rem;">${s.name}</span>
              <span class="packet-chip delivered">${delivered[s.port]} segments</span>
            </div>
          `).join('')}
        </div>
        <p class="net-hint" style="text-align:center;margin-top:0.75rem;">All destined for ${SERVER} \u2014 demultiplexed by source port alone.</p>
      `;
      ctx.setMetrics([
        { label: 'Shared Destination', value: SERVER },
        { label: 'Concurrent Streams', value: String(STREAMS.length) },
        { label: 'Segments Delivered', value: String(Object.values(delivered).reduce((a, b) => a + b, 0)) + ' / ' + ARRIVAL_ORDER.length },
        { label: 'Demux Key', value: 'Source port (since dest IP:port is identical for all)' }
      ]);
    }

    function rebuild() {
      stop();
      index = -1;
      events = buildEvents();
      ctx.params.hidden = true;
      draw();
      ctx.log('Ready \u2014 three tabs about to share one network connection.');
    }

    function stop() { if (timer) { NetSim.SimTiming.clearInterval(timer); timer = null; } }

    function advance() {
      if (index >= events.length - 1) { stop(); return; }
      index += 1;
      ctx.log(events[index].text, events[index].level);
      draw();
    }

    return {
      initialize() {
        ctx.canvas.classList.add('net-canvas');
        ctx.canvas.innerHTML = '<div class="mux-mount"></div>';
        host = ctx.canvas.querySelector('.mux-mount');
        rebuild();
      },
      start() { if (timer) return; timer = NetSim.SimTiming.setInterval(() => { if (index >= events.length - 1) { stop(); return; } advance(); }, 500); },
      pause() { stop(); },
      step() { stop(); advance(); },
      reset() { rebuild(); },
      destroy() { stop(); }
    };
  });

})(window.NetSim = window.NetSim || {});
