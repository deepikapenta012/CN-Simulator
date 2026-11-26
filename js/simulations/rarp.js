/* ==========================================================================
   NetSim — simulations/rarp.js   (rebuilt)
   Reverse ARP with:
   • SVG diagram: Diskless host ↔ LAN ↔ RARP Server
   • MAC→IP lookup table visualisation
   • Step comparison with DHCP (why RARP was replaced)
   • Animated broadcast/reply arrows
   ========================================================================== */

(function (NetSim) {
  'use strict';

  var CLIENT_MAC = '08:00:20:1A:5B:3C';
  var TABLE = {
    '08:00:20:1A:5B:3C': '192.168.1.50',
    '08:00:20:1A:5B:3D': '192.168.1.51',
    '08:00:20:2F:A0:11': '192.168.1.52'
  };

  NetSim.SimRegistry.register('rarp', function factory(ctx) {
    var events = [];
    var index  = -1;
    var timer  = null;
    var mount  = null;

    function buildEvents() {
      return [
        { t: 'A diskless workstation boots.  It knows its MAC (' + CLIENT_MAC + ') but has no IP.', phase: 'boot', arrow: 'none' },
        { t: 'Workstation broadcasts RARP Request: "My MAC is ' + CLIENT_MAC + ' — what is my IP?"', phase: 'bcast', arrow: 'right' },
        { t: 'RARP Server receives the broadcast and looks up ' + CLIENT_MAC + ' in its static table.', phase: 'lookup', arrow: 'none' },
        { t: 'Match found: ' + CLIENT_MAC + ' → ' + TABLE[CLIENT_MAC] + '.', phase: 'match', arrow: 'none', lv: 'success' },
        { t: 'RARP Server sends unicast reply: "Your IP is ' + TABLE[CLIENT_MAC] + '."', phase: 'reply', arrow: 'left', lv: 'success' },
        { t: 'Workstation configures itself with ' + TABLE[CLIENT_MAC] + '.  It can now communicate.', phase: 'done', arrow: 'none', lv: 'success' },
        { t: 'Limitation: RARP only provides an IP — no subnet mask, gateway, or DNS.  DHCP replaced it.', phase: 'note', arrow: 'none' }
      ];
    }

    /* ── SVG diagram ──────────────────────────────────────────────────── */
    function svgDiagram() {
      var step = events[Math.max(0, index)] || {};
      var W = 680, H = 120;
      var html = '<svg class="rarp-svg" viewBox="0 0 ' + W + ' ' + H + '" preserveAspectRatio="xMidYMid meet">';

      /* diskless host */
      html += '<rect x="30" y="25" width="130" height="50" rx="8" fill="#e3f2fd" stroke="#42a5f5" stroke-width="2"/>';
      html += '<text x="95" y="47" text-anchor="middle" font-size="11" font-weight="700" fill="#1565c0">Diskless Host</text>';
      html += '<text x="95" y="62" text-anchor="middle" font-size="8" font-family="var(--f-mono)" fill="var(--ink-faint)">' + CLIENT_MAC + '</text>';

      /* RARP server */
      html += '<rect x="480" y="25" width="130" height="50" rx="8" fill="#e8f5e9" stroke="#66bb6a" stroke-width="2"/>';
      html += '<text x="545" y="47" text-anchor="middle" font-size="11" font-weight="700" fill="#2e7d32">RARP Server</text>';
      html += '<text x="545" y="62" text-anchor="middle" font-size="8" fill="#2e7d32">MAC→IP Table</text>';

      /* connection line */
      html += '<line x1="160" y1="50" x2="480" y2="50" stroke="#ccc" stroke-width="1"/>';

      /* arrows */
      if (step.arrow === 'right') {
        html += '<line x1="162" y1="45" x2="478" y2="45" stroke="#f9a825" stroke-width="2.5" stroke-dasharray="6,3" marker-end="url(#rarpArr)"/>';
        html += '<text x="320" y="38" text-anchor="middle" font-size="9" fill="#f9a825" font-weight="600">RARP REQUEST (broadcast)</text>';
      } else if (step.arrow === 'left') {
        html += '<line x1="478" y1="55" x2="162" y2="55" stroke="#66bb6a" stroke-width="2.5" marker-end="url(#rarpArr)"/>';
        html += '<text x="320" y="72" text-anchor="middle" font-size="9" fill="#66bb6a" font-weight="600">RARP REPLY (unicast)</text>';
      }

      /* assigned IP label */
      if (step.phase === 'done' || step.phase === 'note') {
        html += '<text x="95" y="90" text-anchor="middle" font-size="10" font-weight="700" fill="#0097a7">IP: ' + TABLE[CLIENT_MAC] + '</text>';
      }

      html += '<defs><marker id="rarpArr" markerWidth="8" markerHeight="6" refX="8" refY="3" orient="auto"><path d="M0,0 L8,3 L0,6 Z" fill="#888"/></marker></defs>';
      html += '</svg>';
      return html;
    }

    /* ── lookup table ─────────────────────────────────────────────────── */
    function lookupTable() {
      var step = events[Math.max(0, index)] || {};
      if (step.phase !== 'lookup' && step.phase !== 'match' && step.phase !== 'reply' && step.phase !== 'done' && step.phase !== 'note') return '';
      var html = '<div class="rarp-tbl-wrap"><div class="rarp-tbl-title">RARP Server\'s Static Table</div>';
      html += '<table class="rarp-tbl"><thead><tr><th>MAC Address</th><th>→</th><th>IP Address</th></tr></thead><tbody>';
      var keys = Object.keys(TABLE);
      for (var i = 0; i < keys.length; i++) {
        var hl = keys[i] === CLIENT_MAC && (step.phase === 'match' || step.phase === 'reply' || step.phase === 'done');
        html += '<tr' + (hl ? ' class="rarp-tbl-hl"' : '') + '><td>' + keys[i] + '</td><td>→</td><td>' + TABLE[keys[i]] + '</td></tr>';
      }
      html += '</tbody></table></div>';
      return html;
    }

    /* ── comparison box ───────────────────────────────────────────────── */
    function comparisonBox() {
      var step = events[Math.max(0, index)] || {};
      if (step.phase !== 'note') return '';
      var html = '<div class="rarp-compare">';
      html += '<div class="rarp-cmp-title">RARP vs DHCP</div>';
      var rows = [
        ['Provides IP', '✓', '✓'],
        ['Subnet Mask', '✗', '✓'],
        ['Default Gateway', '✗', '✓'],
        ['DNS Servers', '✗', '✓'],
        ['Lease Time', '✗', '✓'],
        ['Server per Segment', 'Required', 'Optional (relay)']
      ];
      html += '<table class="rarp-cmp-tbl"><thead><tr><th></th><th>RARP</th><th>DHCP</th></tr></thead><tbody>';
      for (var i = 0; i < rows.length; i++) {
        html += '<tr><td>' + rows[i][0] + '</td><td>' + rows[i][1] + '</td><td class="rarp-cmp-better">' + rows[i][2] + '</td></tr>';
      }
      html += '</tbody></table></div>';
      return html;
    }

    function draw() {
      mount.innerHTML = svgDiagram() + lookupTable() + comparisonBox();

      var step = events[Math.max(0, index)] || {};
      ctx.setMetrics([
        { label: 'Client MAC', value: CLIENT_MAC },
        { label: 'Assigned IP', value: step.phase === 'done' || step.phase === 'note' || step.phase === 'match' || step.phase === 'reply' ? TABLE[CLIENT_MAC] : '—' },
        { label: 'Lookup', value: 'Static MAC→IP table' },
        { label: 'Status', value: step.phase === 'done' || step.phase === 'note' ? 'Configured' : 'Booting…' }
      ]);
    }

    function rebuild() {
      stop(); index = -1;
      events = buildEvents();
      ctx.params.hidden = true;
      draw();
      ctx.log('Ready — a diskless workstation is about to boot and request its IP via RARP.');
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
        ctx.canvas.innerHTML = '<div class="rarp-mount"></div>';
        mount = ctx.canvas.querySelector('.rarp-mount');
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
