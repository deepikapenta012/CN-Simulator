/* ==========================================================================
   NetSim — simulations/rarp.js
   Reverse ARP: a host that only knows its own MAC address (e.g. a
   diskless workstation at boot) broadcasts for its IP, and a RARP
   server replies by looking up a static MAC-to-IP table.
   ========================================================================== */

(function (NetSim) {
  'use strict';

  NetSim.SimRegistry.register('rarp', function factory(ctx) {
    const clientMac = '08:00:20:1A:5B:3C';
    const table = { '08:00:20:1A:5B:3C': '192.168.1.50', '08:00:20:1A:5B:3D': '192.168.1.51' };
    let events = [];
    let index = -1;
    let timer = null;
    let host = null;

    function buildEvents() {
      return [
        { text: 'A diskless workstation boots up. It knows its own MAC address (' + clientMac + ') but has no IP address yet.', phase: 'start' },
        { text: 'The workstation broadcasts a RARP request: "My MAC is ' + clientMac + ' \u2014 what is my IP?"', phase: 'broadcast' },
        { text: 'The RARP server receives the broadcast and looks up ' + clientMac + ' in its static MAC\u2192IP table.', phase: 'lookup' },
        { text: 'Match found: ' + clientMac + ' \u2192 ' + table[clientMac], phase: 'match', level: 'success' },
        { text: 'The RARP server replies directly with the assigned IP address: ' + table[clientMac], phase: 'reply', level: 'success' },
        { text: 'The workstation configures itself with ' + table[clientMac] + ' and can now communicate on the network.', phase: 'done', level: 'success' },
        { text: 'Note: RARP needed a server per physical segment and only supplied an IP \u2014 DHCP later replaced it by also handing out the subnet mask, gateway, DNS servers and a lease time.', phase: 'note' }
      ];
    }

    function draw() {
      const step = events[Math.max(0, index)] || {};
      const symbol = step.phase === 'broadcast' ? '\u2192 (broadcast)' : (step.phase === 'reply' || step.phase === 'done') ? '\u2190' : '\u2194';
      host.innerHTML = `
        <div class="fw-diagram">
          <div class="fw-node">Diskless Host<br><span style="font-size:0.65rem;color:var(--ink-faint);">${clientMac}</span></div>
          <div class="fw-packet-track"><span class="fw-arrow" style="font-size:1.3rem;">${symbol}</span></div>
          <div class="fw-node" style="border-color:var(--teal);color:var(--teal);">RARP Server</div>
        </div>
        <p class="net-hint" style="margin-top:0.75rem;">${index >= 3 ? 'Assigned IP: <strong>' + table[clientMac] + '</strong>' : 'IP not yet known.'}</p>
      `;
      ctx.setMetrics([
        { label: 'Client MAC', value: clientMac },
        { label: 'Assigned IP', value: index >= 3 ? table[clientMac] : '\u2014' },
        { label: 'Lookup Method', value: 'Static MAC\u2192IP table on RARP server' },
        { label: 'Status', value: index >= events.length - 1 ? 'Configured' : 'Booting...' }
      ]);
    }

    function rebuild() {
      stop();
      index = -1;
      events = buildEvents();
      ctx.params.hidden = true;
      draw();
      ctx.log('Ready \u2014 a diskless workstation is about to boot.');
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
        ctx.canvas.innerHTML = '<div class="rarp-mount"></div>';
        host = ctx.canvas.querySelector('.rarp-mount');
        rebuild();
      },
      start() { if (timer) return; timer = NetSim.SimTiming.setInterval(() => { if (index >= events.length - 1) { stop(); return; } advance(); }, 700); },
      pause() { stop(); },
      step() { stop(); advance(); },
      reset() { rebuild(); },
      destroy() { stop(); }
    };
  });

})(window.NetSim = window.NetSim || {});
