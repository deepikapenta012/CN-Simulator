/* ==========================================================================
   NetSim — simulations/arp.js   (rebuilt)
   Address Resolution Protocol with:
   • SVG LAN diagram: 3 hosts + switch, broadcast/unicast arrows
   • ARP cache table with live entries
   • Packet header breakdown (ARP request vs reply)
   • Cache-hit second-lookup fast path
   • 2 presets: first lookup (miss+broadcast) and second lookup (cache hit)
   ========================================================================== */

(function (NetSim) {
  'use strict';

  function randomMac(seed) {
    var parts = ['02'];
    for (var i = 0; i < 5; i++) {
      var v = ((seed * 37 + i * 91) % 256);
      var h = v.toString(16).toUpperCase();
      parts.push(h.length < 2 ? '0' + h : h);
    }
    return parts.join(':');
  }

  var HOSTS = [
    { name: 'Host A', ip: '192.168.1.10', mac: randomMac(1), x: 80,  y: 30 },
    { name: 'Host B', ip: '192.168.1.20', mac: randomMac(2), x: 380, y: 30 },
    { name: 'Host C', ip: '192.168.1.30', mac: randomMac(3), x: 560, y: 30 }
  ];

  NetSim.SimRegistry.register('arp', function factory(ctx) {
    var cache  = {};
    var events = [];
    var index  = -1;
    var timer  = null;
    var mount  = null;

    function buildEvents() {
      cache = {};
      return [
        { t: 'Host A wants to send a packet to ' + HOSTS[1].ip + ' but only knows the IP — not the MAC.', phase: 'start', active: [0] },
        { t: 'Host A checks its ARP cache — no entry for ' + HOSTS[1].ip + '.', phase: 'miss', active: [0] },
        { t: 'Host A broadcasts ARP Request: "Who has ' + HOSTS[1].ip + '? Tell ' + HOSTS[0].ip + '" (to FF:FF:FF:FF:FF:FF).', phase: 'bcast', active: [0, 1, 2], arrow: 'bcast' },
        { t: 'All hosts receive the broadcast.  Host C: "Not me."  Host B: "That\'s my IP!"', phase: 'check', active: [1, 2] },
        { t: 'Host B sends a unicast ARP Reply back to Host A: "' + HOSTS[1].ip + ' is at ' + HOSTS[1].mac + '."', phase: 'reply', active: [0, 1], arrow: 'reply', lv: 'success' },
        { t: 'Host A caches: ' + HOSTS[1].ip + ' → ' + HOSTS[1].mac + '.', phase: 'cache', active: [0], cacheAdd: HOSTS[1].ip },
        { t: 'Host A sends the original data packet directly to ' + HOSTS[1].mac + '.', phase: 'send', active: [0, 1], arrow: 'data', lv: 'success' },
        { t: 'Later, Host A needs ' + HOSTS[1].ip + ' again — it\'s already in the cache.', phase: 'hit-start', active: [0] },
        { t: 'Cache HIT — no broadcast needed.  Packet sent immediately using cached MAC.', phase: 'hit', active: [0, 1], arrow: 'data', lv: 'success' }
      ];
    }

    /* ── SVG LAN diagram ──────────────────────────────────────────────── */
    function svgDiagram() {
      var step = events[Math.max(0, index)] || {};
      var activeSet = step.active || [];
      var W = 680, H = 140;
      var html = '<svg class="arp-svg" viewBox="0 0 ' + W + ' ' + H + '" preserveAspectRatio="xMidYMid meet">';

      /* switch in the middle */
      html += '<rect x="280" y="90" width="80" height="30" rx="5" fill="#e8f5e9" stroke="#66bb6a" stroke-width="1.5"/>';
      html += '<text x="320" y="110" text-anchor="middle" font-size="10" font-weight="600" fill="#2e7d32">Switch</text>';

      /* hosts */
      for (var i = 0; i < HOSTS.length; i++) {
        var h = HOSTS[i];
        var active = activeSet.indexOf(i) >= 0;
        html += '<rect x="' + (h.x - 45) + '" y="' + h.y + '" width="90" height="44" rx="6" fill="' + (active ? '#e3f2fd' : '#fafafa') + '" stroke="' + (active ? '#1976d2' : '#bbb') + '" stroke-width="' + (active ? 2 : 1) + '"/>';
        html += '<text x="' + h.x + '" y="' + (h.y + 16) + '" text-anchor="middle" font-size="10" font-weight="600" fill="var(--ink)">' + h.name + '</text>';
        html += '<text x="' + h.x + '" y="' + (h.y + 28) + '" text-anchor="middle" font-size="8" font-family="var(--f-mono)" fill="var(--ink-faint)">' + h.ip + '</text>';
        html += '<text x="' + h.x + '" y="' + (h.y + 38) + '" text-anchor="middle" font-size="7" font-family="var(--f-mono)" fill="var(--accent)">' + h.mac + '</text>';

        /* connection line to switch */
        html += '<line x1="' + h.x + '" y1="' + (h.y + 44) + '" x2="320" y2="90" stroke="#ccc" stroke-width="1"/>';
      }

      /* arrows */
      if (step.arrow === 'bcast') {
        for (var i = 1; i < HOSTS.length; i++) {
          html += '<line x1="' + HOSTS[0].x + '" y1="74" x2="' + HOSTS[i].x + '" y2="74" stroke="#f9a825" stroke-width="2" stroke-dasharray="6,3" marker-end="url(#arpArr)"/>';
        }
        html += '<text x="320" y="86" text-anchor="middle" font-size="9" fill="#f9a825" font-weight="600">BROADCAST</text>';
      } else if (step.arrow === 'reply') {
        html += '<line x1="' + HOSTS[1].x + '" y1="74" x2="' + HOSTS[0].x + '" y2="74" stroke="#66bb6a" stroke-width="2" marker-end="url(#arpArr)"/>';
        html += '<text x="' + ((HOSTS[0].x + HOSTS[1].x) / 2) + '" y="86" text-anchor="middle" font-size="9" fill="#66bb6a" font-weight="600">UNICAST REPLY</text>';
      } else if (step.arrow === 'data') {
        html += '<line x1="' + HOSTS[0].x + '" y1="74" x2="' + HOSTS[1].x + '" y2="74" stroke="#42a5f5" stroke-width="2" marker-end="url(#arpArr)"/>';
        html += '<text x="' + ((HOSTS[0].x + HOSTS[1].x) / 2) + '" y="86" text-anchor="middle" font-size="9" fill="#42a5f5" font-weight="600">DATA</text>';
      }

      html += '<defs><marker id="arpArr" markerWidth="8" markerHeight="6" refX="8" refY="3" orient="auto"><path d="M0,0 L8,3 L0,6 Z" fill="#888"/></marker></defs>';
      html += '</svg>';
      return html;
    }

    /* ── ARP cache display ────────────────────────────────────────────── */
    function cacheDisplay() {
      var liveCache = {};
      for (var i = 0; i <= Math.max(0, index) && i < events.length; i++) {
        if (events[i].cacheAdd) liveCache[events[i].cacheAdd] = HOSTS[1].mac;
      }
      var keys = Object.keys(liveCache);
      var html = '<div class="arp-cache"><div class="arp-cache-title">ARP Cache (Host A)</div>';
      if (keys.length === 0) {
        html += '<div class="arp-cache-empty">Empty — no entries yet.</div>';
      } else {
        html += '<table class="arp-cache-tbl"><thead><tr><th>IP Address</th><th>MAC Address</th><th>Status</th></tr></thead><tbody>';
        for (var i = 0; i < keys.length; i++) {
          html += '<tr><td>' + keys[i] + '</td><td>' + liveCache[keys[i]] + '</td><td class="arp-cache-ok">✓ Resolved</td></tr>';
        }
        html += '</tbody></table>';
      }
      html += '</div>';
      return html;
    }

    /* ── ARP packet breakdown ─────────────────────────────────────────── */
    function packetBreakdown() {
      var step = events[Math.max(0, index)] || {};
      if (step.phase !== 'bcast' && step.phase !== 'reply') return '';
      var isReq = step.phase === 'bcast';
      var fields = [
        ['Operation', isReq ? '1 (Request)' : '2 (Reply)'],
        ['Sender MAC', isReq ? HOSTS[0].mac : HOSTS[1].mac],
        ['Sender IP', isReq ? HOSTS[0].ip : HOSTS[1].ip],
        ['Target MAC', isReq ? 'FF:FF:FF:FF:FF:FF' : HOSTS[0].mac],
        ['Target IP', HOSTS[1].ip]
      ];
      var html = '<div class="arp-pkt"><div class="arp-pkt-title">ARP ' + (isReq ? 'Request' : 'Reply') + ' Packet</div>';
      for (var i = 0; i < fields.length; i++) {
        html += '<div class="arp-pkt-row"><span>' + fields[i][0] + '</span><strong>' + fields[i][1] + '</strong></div>';
      }
      html += '</div>';
      return html;
    }

    /* ── draw ──────────────────────────────────────────────────────────── */
    function draw() {
      mount.innerHTML = svgDiagram() + '<div class="arp-bottom">' + cacheDisplay() + packetBreakdown() + '</div>';

      var step = events[Math.max(0, index)] || {};
      var bcastCount = 0, hitCount = 0;
      for (var i = 0; i <= index; i++) {
        if (events[i].phase === 'bcast') bcastCount++;
        if (events[i].phase === 'hit') hitCount++;
      }
      ctx.setMetrics([
        { label: 'Requester', value: 'Host A (' + HOSTS[0].ip + ')' },
        { label: 'Target', value: HOSTS[1].ip },
        { label: 'Broadcasts', value: String(bcastCount) },
        { label: 'Cache Hits', value: String(hitCount) },
        { label: 'Cache Entries', value: String(Object.keys(cache).length + (index >= 5 ? 1 : 0)) }
      ]);
    }

    function renderParams() { ctx.params.hidden = true; }

    function rebuild() {
      stop(); index = -1;
      events = buildEvents();
      renderParams(); draw();
      ctx.log('Ready — Host A resolving ' + HOSTS[1].ip + '\'s MAC address.');
    }

    function stop() { if (timer) { NetSim.SimTiming.clearInterval(timer); timer = null; } }

    function advance() {
      if (index >= events.length - 1) { stop(); return; }
      index++;
      ctx.log(events[index].t, events[index].lv);
      draw();
    }

    return {
      initialize: function () {
        ctx.canvas.innerHTML = '<div class="arp-mount"></div>';
        mount = ctx.canvas.querySelector('.arp-mount');
        rebuild();
      },
      start: function () { if (timer) return; timer = NetSim.SimTiming.setInterval(function () { if (index >= events.length - 1) { stop(); return; } advance(); }, 800); },
      pause: function () { stop(); },
      step:  function () { stop(); advance(); },
      reset: function () { rebuild(); },
      destroy: function () { stop(); }
    };
  });

})(window.NetSim = window.NetSim || {});
