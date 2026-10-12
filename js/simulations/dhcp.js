/* ==========================================================================
   NetSim — simulations/dhcp.js
   The real DORA sequence — Discover, Offer, Request, Acknowledge —
   including the detail most diagrams skip: the DHCPREQUEST is itself
   broadcast, so any other server that made an offer learns it lost and
   withdraws it.
   ========================================================================== */

(function (NetSim) {
  'use strict';

  NetSim.SimRegistry.register('dhcp', function factory(ctx) {
    let events = [];
    let index = -1;
    let timer = null;
    let host = null;
    const offerA = '192.168.1.105', offerB = '192.168.1.210', leaseTime = '24 hours';

    function buildEvents() {
      return [
        { text: 'A new client boots up with no IP address and broadcasts DHCPDISCOVER to the LAN.', phase: 'discover' },
        { text: 'Server A and Server B both receive the broadcast.', phase: 'receive' },
        { text: 'Server A replies with DHCPOFFER: ' + offerA + ', lease ' + leaseTime + '.', phase: 'offerA' },
        { text: 'Server B also replies with DHCPOFFER: ' + offerB + ', lease ' + leaseTime + '.', phase: 'offerB' },
        { text: 'The client accepts Server A\u2019s offer and broadcasts DHCPREQUEST for ' + offerA + ' (broadcast, so every server sees the choice).', phase: 'request' },
        { text: 'Server B sees the DHCPREQUEST naming Server A\u2019s address \u2014 it was not chosen, so it withdraws its offer and returns ' + offerB + ' to its pool.', phase: 'withdraw', level: 'warning' },
        { text: 'Server A sends DHCPACK, confirming the lease of ' + offerA + ' for ' + leaseTime + '.', phase: 'ack', level: 'success' },
        { text: 'The client configures its network interface with ' + offerA + ' and can now communicate.', phase: 'done', level: 'success' },
        { text: 'At 50% of the lease time, the client will send a unicast DHCPREQUEST directly to Server A to renew before the lease expires.', phase: 'renew' }
      ];
    }

    function draw() {
      const step = events[Math.max(0, index)] || {};
      const dir = step.phase === 'discover' || step.phase === 'request' ? '\u2192 (broadcast)'
        : step.phase === 'offerA' || step.phase === 'ack' ? '\u2190 A'
        : step.phase === 'offerB' ? '\u2190 B'
        : '\u2194';
      host.innerHTML = `
        <div class="fw-diagram">
          <div class="fw-node">Client</div>
          <div class="fw-packet-track"><span class="fw-arrow" style="font-size:1.2rem;">${dir}</span></div>
          <div class="fw-node" style="border-color:var(--teal);color:var(--teal);">LAN</div>
          <div class="fw-packet-track"></div>
          <div style="display:flex;flex-direction:column;gap:0.4rem;">
            <div class="fw-node" style="${step.phase === 'withdraw' ? 'opacity:0.4;' : ''}font-size:0.72rem;">Server A</div>
            <div class="fw-node" style="${step.phase === 'withdraw' ? 'border-color:var(--err);color:var(--err);border-style:dashed;' : ''}font-size:0.72rem;">Server B</div>
          </div>
        </div>
        <p class="net-hint" style="margin-top:0.75rem;">${index >= 7 ? 'Leased address: <strong>' + offerA + '</strong> (' + leaseTime + ')' : 'No lease yet.'}</p>
      `;
      ctx.setMetrics([
        { label: 'Offers Received', value: String(events.slice(0, index + 1).filter((e) => e.phase === 'offerA' || e.phase === 'offerB').length) },
        { label: 'Chosen Server', value: index >= 4 ? 'Server A' : '\u2014' },
        { label: 'Leased IP', value: index >= 7 ? offerA : '\u2014' },
        { label: 'Lease Time', value: leaseTime },
        { label: 'Status', value: index >= 7 ? 'Bound' : 'Negotiating' }
      ]);
    }

    function rebuild() {
      stop();
      index = -1;
      events = buildEvents();
      ctx.params.hidden = true;
      draw();
      ctx.log('Ready \u2014 a new client is about to request an address from two DHCP servers.');
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
        ctx.canvas.innerHTML = '<div class="dhcp-mount"></div>';
        host = ctx.canvas.querySelector('.dhcp-mount');
        rebuild();
      },
      start() { if (timer) return; timer = setInterval(() => { if (index >= events.length - 1) { stop(); return; } advance(); }, 750); },
      pause() { stop(); },
      step() { stop(); advance(); },
      reset() { rebuild(); },
      destroy() { stop(); }
    };
  });

})(window.NetSim = window.NetSim || {});
