/* ==========================================================================
   NetSim — simulations/arp.js
   Address Resolution Protocol: broadcast "who has this IP", unicast
   reply, and a cache that makes the second lookup free.
   ========================================================================== */

(function (NetSim) {
  'use strict';

  function randomMac(seed) {
    const parts = ['02'];
    for (let i = 0; i < 5; i++) parts.push(((seed * 37 + i * 91) % 256).toString(16).padStart(2, '0').toUpperCase());
    return parts.join(':');
  }

  NetSim.SimRegistry.register('arp', function factory(ctx) {
    const hosts = {
      '192.168.1.10': { name: 'Host A', mac: randomMac(1) },
      '192.168.1.20': { name: 'Host B', mac: randomMac(2) },
      '192.168.1.30': { name: 'Host C', mac: randomMac(3) }
    };
    let cache = {};
    let events = [];
    let index = -1;
    let timer = null;
    let host = null;

    function buildEvents() {
      const out = [];
      cache = {};
      out.push({ text: 'Host A wants to reach 192.168.1.20 but only knows the IP, not the MAC address.', phase: 'start' });
      out.push({ text: 'Host A checks its ARP cache — no entry for 192.168.1.20.', phase: 'check' });
      out.push({ text: 'Host A broadcasts: "Who has 192.168.1.20? Tell 192.168.1.10" (to FF:FF:FF:FF:FF:FF).', phase: 'broadcast' });
      out.push({ text: 'Every host on the LAN receives the broadcast. Host C checks: not me. Host B checks: that\u2019s me!', phase: 'receive' });
      out.push({ text: 'Host B replies directly (unicast) with its MAC address: ' + hosts['192.168.1.20'].mac, phase: 'reply', level: 'success' });
      out.push({ text: 'Host A caches the mapping 192.168.1.20 \u2192 ' + hosts['192.168.1.20'].mac + '.', phase: 'cache', cacheAdd: '192.168.1.20' });
      out.push({ text: 'Host A now sends its original packet, addressed directly to that MAC.', phase: 'deliver', level: 'success' });
      out.push({ text: 'A moment later, Host A needs 192.168.1.20 again \u2014 this time it\u2019s already in the cache.', phase: 'start2' });
      out.push({ text: 'Cache hit \u2014 no broadcast needed. Host A uses ' + hosts['192.168.1.20'].mac + ' immediately.', phase: 'cachehit', level: 'success' });
      return out;
    }

    function draw() {
      const step = events[Math.max(0, index)] || {};
      const liveCache = {};
      events.slice(0, index + 1).forEach((e) => { if (e.cacheAdd) liveCache[e.cacheAdd] = hosts[e.cacheAdd].mac; });

      const symbol = step.phase === 'broadcast' ? '\u2192 (broadcast)' : step.phase === 'reply' || step.phase === 'deliver' || step.phase === 'cachehit' ? '\u2190' : '\u2194';
      host.innerHTML = `
        <div class="fw-diagram">
          <div class="fw-node">Host A<br><span style="font-size:0.65rem;color:var(--ink-faint);">192.168.1.10</span></div>
          <div class="fw-packet-track"><span class="fw-arrow" style="font-size:1.3rem;">${symbol}</span></div>
          <div class="fw-node" style="border-color:var(--teal);color:var(--teal);">LAN</div>
          <div class="fw-packet-track"><span class="fw-arrow" style="font-size:1.3rem;">${symbol}</span></div>
          <div class="fw-node">Host B<br><span style="font-size:0.65rem;color:var(--ink-faint);">192.168.1.20</span></div>
        </div>
        <div class="packet-status-strip" style="margin-top:0.75rem;">
          ${Object.keys(liveCache).length
            ? Object.keys(liveCache).map((ip) => `<span class="packet-chip delivered">${ip} \u2192 ${liveCache[ip]}</span>`).join('')
            : '<span class="net-hint">ARP cache is empty.</span>'}
        </div>
      `;

      ctx.setMetrics([
        { label: 'Requester', value: 'Host A (192.168.1.10)' },
        { label: 'Target', value: '192.168.1.20' },
        { label: 'Broadcasts Sent', value: String(events.slice(0, index + 1).filter((e) => e.phase === 'broadcast').length) },
        { label: 'Cache Entries', value: String(Object.keys(liveCache).length) },
        { label: 'Second Lookup', value: index >= 7 ? 'Served from cache \u2014 no broadcast' : 'Not yet reached' }
      ]);
    }

    function rebuild() {
      stop();
      index = -1;
      events = buildEvents();
      ctx.params.hidden = true;
      draw();
      ctx.log('Ready \u2014 Host A is about to resolve 192.168.1.20\u2019s MAC address.');
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
        ctx.canvas.innerHTML = '<div class="arp-mount"></div>';
        host = ctx.canvas.querySelector('.arp-mount');
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
