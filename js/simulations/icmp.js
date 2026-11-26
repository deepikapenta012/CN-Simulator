/* ==========================================================================
   NetSim — simulations/icmp.js   (expanded rebuild)
   ICMP Ping, Traceroute & Error scenarios with:
   • Large SVG network path (A → R1 → R2 → R3 → B) with per-hop labels
   • Animated probe dot with direction indicator
   • Ping: full Echo Request → hop-by-hop TTL decrement → Echo Reply → RTT
   • Traceroute: TTL-expiry discovery with progressive hop table
   • Error mode: Destination Unreachable demonstration
   • ICMP header breakdown with all fields
   • ICMP message type reference table
   • 3 mode presets (Ping, Traceroute, Error)
   • Per-hop RTT and cumulative latency
   ========================================================================== */

(function (NetSim) {
  'use strict';

  var PATH = ['A', 'R1', 'R2', 'R3', 'B'];
  var HOP_DELAYS = [12, 15, 18, 10];
  var HOP_IPS    = ['192.168.1.1', '10.0.1.1', '10.0.2.1', '10.0.3.1', '93.184.216.34'];

  /* ── ICMP type reference ────────────────────────────────────────────── */
  var ICMP_TYPES = [
    { type: 0,  name: 'Echo Reply',            use: 'Response to ping' },
    { type: 3,  name: 'Destination Unreachable', use: 'Host/port/network unreachable' },
    { type: 5,  name: 'Redirect',               use: 'Better route exists' },
    { type: 8,  name: 'Echo Request',            use: 'Ping probe' },
    { type: 11, name: 'Time Exceeded',           use: 'TTL expired in transit' },
    { type: 13, name: 'Timestamp Request',       use: 'Time synchronisation' },
    { type: 14, name: 'Timestamp Reply',         use: 'Time sync response' }
  ];

  NetSim.SimRegistry.register('icmp', function factory(ctx) {
    var mode   = 'ping';
    var steps  = [];
    var index  = -1;
    var timer  = null;
    var mount  = null;

    /* ── build steps ──────────────────────────────────────────────────── */
    function buildPingSteps() {
      var totalRtt = 0;
      for (var i = 0; i < HOP_DELAYS.length; i++) totalRtt += HOP_DELAYS[i];
      totalRtt *= 2;
      var out = [];
      out.push({ t: 'A prepares ICMP Echo Request (Type 8, Code 0).  TTL set to 64.  Payload: 56 bytes.', probe: 0, dir: 'out', icmpType: 8, icmpCode: 0, ttl: 64 });
      /* hop-by-hop forward */
      for (var i = 0; i < PATH.length - 1; i++) {
        var newTtl = 64 - (i + 1);
        out.push({ t: PATH[i] + ' forwards to ' + PATH[i + 1] + ' (' + HOP_IPS[i + 1] + ').  TTL: ' + (64 - i) + ' → ' + newTtl + '.  Hop delay: ' + HOP_DELAYS[i] + ' ms.', probe: i + 1, dir: 'out', ttl: newTtl });
      }
      out.push({ t: 'B (' + HOP_IPS[4] + ') receives Echo Request.  Prepares Echo Reply (Type 0, Code 0).', probe: 4, dir: 'back', icmpType: 0, icmpCode: 0, lv: 'success' });
      /* hop-by-hop return */
      for (var i = PATH.length - 2; i >= 0; i--) {
        out.push({ t: 'Reply passes through ' + PATH[i] + '.  Hop delay: ' + HOP_DELAYS[i] + ' ms.', probe: i, dir: 'back' });
      }
      out.push({ t: 'A receives Echo Reply.  Round-trip time = ' + totalRtt + ' ms.  Packet intact, 0% loss.', probe: 0, dir: 'done', lv: 'success', rtt: totalRtt });
      /* statistics summary */
      out.push({ t: 'Ping statistics: 1 packet sent, 1 received.  min/avg/max = ' + totalRtt + '/' + totalRtt + '/' + totalRtt + ' ms.', probe: -1, dir: 'done', lv: 'success', rtt: totalRtt });
      return out;
    }

    function buildTracerouteSteps() {
      var out = [];
      var hops = PATH.length - 1;
      out.push({ t: 'Traceroute to B (' + HOP_IPS[4] + ').  Max hops = ' + hops + '.  Probe size: 60 bytes.', probe: 0, dir: 'out' });
      for (var ttl = 1; ttl <= hops; ttl++) {
        out.push({ t: 'Send UDP probe with TTL = ' + ttl + '.', probe: 0, dir: 'out', ttl: ttl });
        /* probe hops forward until TTL expires */
        for (var hop = 1; hop <= ttl; hop++) {
          var remaining = ttl - hop;
          out.push({ t: 'Probe reaches ' + PATH[hop] + ' (' + HOP_IPS[hop] + ').  TTL decremented: ' + (ttl - hop + 1) + ' → ' + remaining + '.', probe: hop, dir: 'out', ttl: remaining });
        }
        var cumRtt = 0;
        for (var d = 0; d < ttl; d++) cumRtt += HOP_DELAYS[d];
        cumRtt *= 2;
        if (ttl < hops) {
          out.push({ t: 'TTL expired at ' + PATH[ttl] + ' (' + HOP_IPS[ttl] + ').  ICMP Time Exceeded (Type 11) sent back.  RTT ≈ ' + cumRtt + ' ms.', probe: ttl, dir: 'back', icmpType: 11, icmpCode: 0, lv: 'warning', hopFound: { n: ttl, node: PATH[ttl], ip: HOP_IPS[ttl], rtt: cumRtt } });
        } else {
          out.push({ t: 'Probe reaches destination B (' + HOP_IPS[4] + ').  ICMP Port Unreachable (Type 3, Code 3) returned.  RTT ≈ ' + cumRtt + ' ms.', probe: hops, dir: 'back', icmpType: 3, icmpCode: 3, lv: 'success', hopFound: { n: ttl, node: 'B', ip: HOP_IPS[4], rtt: cumRtt } });
        }
      }
      out.push({ t: 'Traceroute complete.  All ' + hops + ' hops discovered.  Route: ' + PATH.join(' → ') + '.', probe: -1, dir: 'done', lv: 'success' });
      return out;
    }

    function buildErrorSteps() {
      var out = [];
      out.push({ t: 'A sends a packet to 10.99.99.99 (non-existent host).  TTL = 64.', probe: 0, dir: 'out', ttl: 64 });
      out.push({ t: 'Packet forwarded to R1.  R1 looks up 10.99.99.99 in its routing table.', probe: 1, dir: 'out', ttl: 63 });
      out.push({ t: 'R1 forwards to R2.  R2 checks next-hop…', probe: 2, dir: 'out', ttl: 62 });
      out.push({ t: 'R2 forwards to R3.  R3 is the last-hop router for the 10.99.99.0/24 subnet.', probe: 3, dir: 'out', ttl: 61 });
      out.push({ t: 'R3 sends ARP for 10.99.99.99 — no reply.  Host is unreachable.', probe: 3, dir: 'out', lv: 'warning' });
      out.push({ t: 'R3 generates ICMP Destination Unreachable (Type 3, Code 1: Host Unreachable) back to A.', probe: 3, dir: 'back', icmpType: 3, icmpCode: 1, lv: 'error' });
      out.push({ t: 'A receives the error.  Knows the destination host is unreachable at the last hop.', probe: 0, dir: 'back', lv: 'error' });
      out.push({ t: 'Common ICMP Destination Unreachable codes: 0=Net, 1=Host, 2=Protocol, 3=Port, 4=Fragmentation needed, 13=Administratively filtered.', probe: -1, dir: 'done' });
      return out;
    }

    function buildSteps() {
      if (mode === 'ping') return buildPingSteps();
      if (mode === 'traceroute') return buildTracerouteSteps();
      return buildErrorSteps();
    }

    /* ── SVG network path (large) ─────────────────────────────────────── */
    function svgDiagram() {
      var step = steps[Math.max(0, index)] || {};
      var W = 760, H = 320, nodeW = 110, nodeH = 80;
      var gap = (W - PATH.length * nodeW) / (PATH.length + 1);
      var nodeY = 40;

      var html = '<svg class="icmp-svg" viewBox="0 0 ' + W + ' ' + H + '" preserveAspectRatio="xMidYMid meet">';

      /* title bar */
      html += '<text x="' + W / 2 + '" y="22" text-anchor="middle" font-size="13" font-weight="700" fill="var(--ink-faint)">ICMP Network Path</text>';

      /* connection lines with delay labels */
      for (var i = 0; i < PATH.length - 1; i++) {
        var x1 = gap + i * (nodeW + gap) + nodeW;
        var x2 = gap + (i + 1) * (nodeW + gap);
        var midX = (x1 + x2) / 2;
        var lineY = nodeY + nodeH / 2;
        html += '<line x1="' + x1 + '" y1="' + lineY + '" x2="' + x2 + '" y2="' + lineY + '" stroke="#ccc" stroke-width="3" stroke-dasharray="8,4"/>';
        /* delay badge */
        html += '<rect x="' + (midX - 24) + '" y="' + (lineY - 28) + '" width="48" height="22" rx="11" fill="#fff" stroke="#ddd" stroke-width="1.5"/>';
        html += '<text x="' + midX + '" y="' + (lineY - 13) + '" text-anchor="middle" font-size="11" font-weight="700" fill="var(--accent,#0097a7)">' + HOP_DELAYS[i] + ' ms</text>';
      }

      /* nodes */
      for (var i = 0; i < PATH.length; i++) {
        var x = gap + i * (nodeW + gap);
        var isProbe = step.probe === i;
        var isEnd = i === 0 || i === PATH.length - 1;
        var fill = isProbe ? (step.dir === 'back' ? '#e8f5e9' : '#e3f2fd') : (isEnd ? '#f0f4ff' : '#fafafa');
        var stroke = isProbe ? (step.dir === 'back' ? '#66bb6a' : '#1976d2') : (isEnd ? '#0097a7' : '#bbb');
        var sw = isProbe ? 3.5 : 2;

        html += '<rect x="' + x + '" y="' + nodeY + '" width="' + nodeW + '" height="' + nodeH + '" rx="12" fill="' + fill + '" stroke="' + stroke + '" stroke-width="' + sw + '"/>';
        /* icon */
        var icon = isEnd ? '💻' : '🔀';
        html += '<text x="' + (x + nodeW / 2) + '" y="' + (nodeY + 24) + '" text-anchor="middle" font-size="16">' + icon + '</text>';
        html += '<text x="' + (x + nodeW / 2) + '" y="' + (nodeY + 44) + '" text-anchor="middle" font-size="15" font-weight="700" fill="var(--ink)">' + PATH[i] + '</text>';
        html += '<text x="' + (x + nodeW / 2) + '" y="' + (nodeY + 60) + '" text-anchor="middle" font-size="10" font-family="var(--f-mono)" fill="var(--ink-faint)">' + HOP_IPS[i] + '</text>';
        /* TTL indicator if probing this node */
        if (isProbe && step.ttl !== undefined) {
          html += '<rect x="' + (x + nodeW / 2 - 24) + '" y="' + (nodeY + nodeH + 4) + '" width="48" height="18" rx="9" fill="' + (step.ttl <= 1 ? '#ffebee' : '#e0f7fa') + '" stroke="' + (step.ttl <= 1 ? '#ef5350' : '#0097a7') + '" stroke-width="1"/>';
          html += '<text x="' + (x + nodeW / 2) + '" y="' + (nodeY + nodeH + 16) + '" text-anchor="middle" font-size="10" font-weight="700" fill="' + (step.ttl <= 1 ? '#ef5350' : '#0097a7') + '">TTL ' + step.ttl + '</text>';
        }
      }

      /* animated probe dot + label */
      var probeY = nodeY + nodeH + 50;
      if (step.probe >= 0 && step.probe < PATH.length && index >= 0) {
        var px = gap + step.probe * (nodeW + gap) + nodeW / 2;
        var col = step.dir === 'back' ? '#66bb6a' : (step.lv === 'error' ? '#ef5350' : '#42a5f5');
        /* trail line */
        html += '<line x1="' + px + '" y1="' + (nodeY + nodeH) + '" x2="' + px + '" y2="' + (probeY - 14) + '" stroke="' + col + '" stroke-width="1.5" stroke-dasharray="4,3"/>';
        html += '<circle cx="' + px + '" cy="' + probeY + '" r="12" fill="' + col + '" opacity="0.9"><animate attributeName="r" values="8;14;8" dur="0.8s" repeatCount="indefinite"/></circle>';
        var label = step.dir === 'back' ? '← Reply' : (step.dir === 'done' ? '✓ Done' : '→ Probe');
        if (step.lv === 'error' && step.dir === 'back') label = '← Error';
        html += '<text x="' + px + '" y="' + (probeY + 28) + '" text-anchor="middle" font-size="11" font-weight="700" fill="' + col + '">' + label + '</text>';
      }

      /* direction arrows along the path */
      var arrowY = nodeY + nodeH / 2 + 2;
      if (step.dir === 'out' && step.probe >= 1) {
        var arrowX = gap + (step.probe - 0.5) * (nodeW + gap) + nodeW / 2;
        html += '<text x="' + arrowX + '" y="' + (nodeY - 2) + '" text-anchor="middle" font-size="18" fill="#42a5f5">▶</text>';
      } else if (step.dir === 'back' && step.probe >= 0 && step.probe < PATH.length - 1) {
        var arrowX = gap + (step.probe + 0.5) * (nodeW + gap) + nodeW / 2;
        html += '<text x="' + arrowX + '" y="' + (nodeY - 2) + '" text-anchor="middle" font-size="18" fill="#66bb6a">◀</text>';
      }

      html += '</svg>';
      return html;
    }

    /* ── hop discovery table (traceroute) ──────────────────────────────── */
    function hopTable() {
      if (mode !== 'traceroute') return '';
      var hops = [];
      for (var i = 0; i <= index && i < steps.length; i++) {
        if (steps[i].hopFound) hops.push(steps[i].hopFound);
      }
      if (hops.length === 0) return '';

      var html = '<div class="icmp-panel icmp-hops">';
      html += '<div class="icmp-panel-title">Hop Discovery Table</div>';
      html += '<table class="icmp-hop-tbl">';
      html += '<thead><tr><th>#</th><th>Node</th><th>IP Address</th><th>RTT</th><th>ICMP Response</th></tr></thead><tbody>';
      for (var i = 0; i < hops.length; i++) {
        var h = hops[i];
        var last = i === hops.length - 1;
        var isDest = h.node === 'B';
        html += '<tr class="' + (last ? 'icmp-hop-latest' : '') + '">';
        html += '<td>' + h.n + '</td><td class="icmp-hop-node">' + h.node + '</td>';
        html += '<td>' + h.ip + '</td><td>' + h.rtt + ' ms</td>';
        html += '<td>' + (isDest ? '<span class="icmp-type-dest">Port Unreachable</span>' : '<span class="icmp-type-ttl">Time Exceeded</span>') + '</td></tr>';
      }
      html += '</tbody></table></div>';
      return html;
    }

    /* ── ICMP header breakdown ────────────────────────────────────────── */
    function icmpHeader() {
      var step = steps[Math.max(0, index)] || {};
      if (step.icmpType === undefined) return '';

      var typeNames = { 0: 'Echo Reply', 3: 'Destination Unreachable', 8: 'Echo Request', 11: 'Time Exceeded' };
      var codeNames = { '3-0': 'Net Unreachable', '3-1': 'Host Unreachable', '3-3': 'Port Unreachable', '11-0': 'TTL Expired' };
      var codeName = codeNames[step.icmpType + '-' + (step.icmpCode || 0)] || 'Default';
      var checksum = '0x' + (Math.floor(Math.random() * 65535)).toString(16).toUpperCase();

      var html = '<div class="icmp-panel icmp-hdr">';
      html += '<div class="icmp-panel-title">ICMP Packet Header</div>';

      /* visual header fields */
      html += '<div class="icmp-hdr-grid">';
      html += '<div class="icmp-hdr-field icmp-hdr-type"><div class="icmp-hdr-label">Type</div><div class="icmp-hdr-val">' + step.icmpType + '</div><div class="icmp-hdr-name">' + (typeNames[step.icmpType] || '?') + '</div></div>';
      html += '<div class="icmp-hdr-field icmp-hdr-code"><div class="icmp-hdr-label">Code</div><div class="icmp-hdr-val">' + (step.icmpCode || 0) + '</div><div class="icmp-hdr-name">' + codeName + '</div></div>';
      html += '<div class="icmp-hdr-field icmp-hdr-cksum"><div class="icmp-hdr-label">Checksum</div><div class="icmp-hdr-val">' + checksum + '</div></div>';
      if (step.icmpType === 8 || step.icmpType === 0) {
        html += '<div class="icmp-hdr-field"><div class="icmp-hdr-label">Identifier</div><div class="icmp-hdr-val">0x' + (Math.floor(Math.random() * 255)).toString(16).toUpperCase() + '</div></div>';
        html += '<div class="icmp-hdr-field"><div class="icmp-hdr-label">Sequence</div><div class="icmp-hdr-val">1</div></div>';
      }
      html += '</div></div>';
      return html;
    }

    /* ── ICMP type reference table ────────────────────────────────────── */
    function typeReference() {
      if (index < 2) return '';
      var step = steps[Math.max(0, index)] || {};

      var html = '<div class="icmp-panel icmp-ref">';
      html += '<div class="icmp-panel-title">ICMP Message Types Reference</div>';
      html += '<table class="icmp-ref-tbl"><thead><tr><th>Type</th><th>Name</th><th>Purpose</th></tr></thead><tbody>';
      for (var i = 0; i < ICMP_TYPES.length; i++) {
        var t = ICMP_TYPES[i];
        var active = step.icmpType === t.type;
        html += '<tr class="' + (active ? 'icmp-ref-active' : '') + '">';
        html += '<td>' + t.type + '</td><td>' + t.name + '</td><td>' + t.use + '</td></tr>';
      }
      html += '</tbody></table></div>';
      return html;
    }

    /* ── ping statistics ──────────────────────────────────────────────── */
    function pingStats() {
      if (mode !== 'ping') return '';
      var step = steps[Math.max(0, index)] || {};
      if (!step.rtt) return '';
      var html = '<div class="icmp-panel icmp-stats">';
      html += '<div class="icmp-panel-title">Ping Statistics</div>';
      html += '<div class="icmp-stats-grid">';
      html += '<div class="icmp-stat-box"><div class="icmp-stat-val">' + step.rtt + ' ms</div><div class="icmp-stat-label">Round-Trip Time</div></div>';
      html += '<div class="icmp-stat-box"><div class="icmp-stat-val">' + (PATH.length - 1) + '</div><div class="icmp-stat-label">Hops</div></div>';
      html += '<div class="icmp-stat-box"><div class="icmp-stat-val">0%</div><div class="icmp-stat-label">Packet Loss</div></div>';
      html += '<div class="icmp-stat-box"><div class="icmp-stat-val">56 B</div><div class="icmp-stat-label">Payload Size</div></div>';
      html += '</div></div>';
      return html;
    }

    /* ── draw ──────────────────────────────────────────────────────────── */
    function draw() {
      mount.innerHTML = svgDiagram() + '<div class="icmp-panels">' + hopTable() + icmpHeader() + pingStats() + typeReference() + '</div>';

      var step = steps[Math.max(0, index)] || {};
      if (mode === 'ping') {
        ctx.setMetrics([
          { label: 'Mode', value: 'Ping (Echo Request/Reply)' },
          { label: 'Path', value: PATH.join(' → ') },
          { label: 'Hops', value: String(PATH.length - 1) },
          { label: 'RTT', value: step.rtt ? step.rtt + ' ms' : '—' },
          { label: 'TTL', value: step.ttl !== undefined ? String(step.ttl) : '64 (initial)' },
          { label: 'Packet Loss', value: '0%' }
        ]);
      } else if (mode === 'traceroute') {
        var found = 0;
        for (var i = 0; i <= index; i++) { if (steps[i] && steps[i].hopFound) found++; }
        ctx.setMetrics([
          { label: 'Mode', value: 'Traceroute (TTL expiry)' },
          { label: 'Total Hops', value: String(PATH.length - 1) },
          { label: 'Discovered', value: found + ' / ' + (PATH.length - 1) },
          { label: 'Method', value: 'Increment TTL, listen for ICMP' },
          { label: 'Current TTL', value: step.ttl !== undefined ? String(step.ttl) : '—' }
        ]);
      } else {
        ctx.setMetrics([
          { label: 'Mode', value: 'Error — Destination Unreachable' },
          { label: 'Target', value: '10.99.99.99' },
          { label: 'Error Type', value: step.icmpType === 3 ? 'Type 3 (Dest Unreachable)' : '—' },
          { label: 'Error Code', value: step.icmpCode === 1 ? 'Code 1 (Host Unreachable)' : '—' },
          { label: 'Last Hop', value: step.probe >= 0 ? PATH[step.probe] : '—' }
        ]);
      }
    }

    /* ── params ────────────────────────────────────────────────────────── */
    function renderParams() {
      ctx.params.hidden = false;
      var modes = [
        { key: 'ping',       label: 'Ping',       tag: 'Echo Request / Reply, RTT measurement' },
        { key: 'traceroute', label: 'Traceroute',  tag: 'TTL expiry hop discovery' },
        { key: 'error',      label: 'Error',       tag: 'Destination Unreachable (Type 3)' }
      ];
      var html = '<div class="icmp-modes">';
      for (var i = 0; i < modes.length; i++) {
        html += '<label class="switch-mode-option' + (mode === modes[i].key ? ' is-checked' : '') + '">' +
          '<input type="radio" name="icmpmode" value="' + modes[i].key + '"' + (mode === modes[i].key ? ' checked' : '') + '> ' +
          '<strong>' + modes[i].label + '</strong><br><span style="font-size:0.72rem;color:var(--ink-faint);">' + modes[i].tag + '</span></label>';
      }
      html += '</div>';
      ctx.params.innerHTML = html;

      var radios = ctx.params.querySelectorAll('input[name="icmpmode"]');
      for (var i = 0; i < radios.length; i++) {
        radios[i].addEventListener('change', function (e) {
          mode = e.target.value;
          rebuild();
        });
      }
    }

    function rebuild() {
      stop(); index = -1;
      steps = buildSteps();
      renderParams(); draw();
      ctx.log('Ready — ' + (mode === 'ping' ? 'pinging B from A.' : mode === 'traceroute' ? 'tracing route A → B.' : 'sending to unreachable host.'));
    }

    function stop() { if (timer) { NetSim.SimTiming.clearInterval(timer); timer = null; } }

    function advance() {
      if (index >= steps.length - 1) { stop(); return; }
      index++;
      ctx.log(steps[index].t, steps[index].lv);
      draw();
    }

    return {
      initialize: function () {
        ctx.canvas.innerHTML = '<div class="icmp-mount"></div>';
        mount = ctx.canvas.querySelector('.icmp-mount');
        rebuild();
      },
      start: function () { if (timer) return; timer = NetSim.SimTiming.setInterval(function () { if (index >= steps.length - 1) { stop(); return; } advance(); }, 700); },
      pause: function () { stop(); },
      step:  function () { stop(); advance(); },
      reset: function () { rebuild(); },
      destroy: function () { stop(); }
    };
  });

})(window.NetSim = window.NetSim || {});
