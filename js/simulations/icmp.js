/* ==========================================================================
   NetSim — simulations/icmp.js   (rebuilt)
   ICMP Ping & Traceroute with:
   • SVG network path diagram (A → R1 → R2 → R3 → B) with animated probe
   • Ping mode: Echo Request/Reply with RTT calculation
   • Traceroute mode: TTL-expiry hop discovery, hop table built step-by-step
   • ICMP packet type/code breakdown panel
   • Mode toggle (Ping vs Traceroute)
   ========================================================================== */

(function (NetSim) {
  'use strict';

  var PATH_NODES = ['A', 'R1', 'R2', 'R3', 'B'];
  var HOP_DELAYS = [12, 15, 18, 10];   /* per-hop RTT contribution */

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
      return [
        { t: 'A sends ICMP Echo Request (Type 8, Code 0) toward B.', probe: 0, dir: 'out', type: '8', code: '0' },
        { t: 'Request traverses R1 → R2 → R3 (each router decrements TTL and forwards).', probe: 3, dir: 'out' },
        { t: 'B receives the Echo Request and replies with ICMP Echo Reply (Type 0, Code 0).', probe: 4, dir: 'back', type: '0', code: '0', lv: 'success' },
        { t: 'Reply travels B → R3 → R2 → R1 → A.  Round-trip time ≈ ' + totalRtt + ' ms.', probe: 0, dir: 'back', lv: 'success', rtt: totalRtt }
      ];
    }

    function buildTracerouteSteps() {
      var out = [];
      var hops = PATH_NODES.length - 1;
      for (var ttl = 1; ttl <= hops; ttl++) {
        out.push({ t: 'Send probe with TTL=' + ttl + '.', probe: 0, dir: 'out', ttl: ttl });
        /* probe reaches node at index ttl */
        if (ttl < hops) {
          out.push({ t: 'TTL expires at ' + PATH_NODES[ttl] + '.  It sends ICMP Time Exceeded (Type 11, Code 0) back to A.', probe: ttl, dir: 'back', type: '11', code: '0', lv: 'warning', hopFound: { n: ttl, node: PATH_NODES[ttl], delay: HOP_DELAYS[ttl - 1] } });
        } else {
          out.push({ t: 'TTL is enough to reach B.  B replies with Echo Reply.  Traceroute complete.', probe: hops, dir: 'back', type: '0', code: '0', lv: 'success', hopFound: { n: ttl, node: 'B', delay: HOP_DELAYS[ttl - 1] } });
        }
      }
      return out;
    }

    function buildSteps() {
      return mode === 'ping' ? buildPingSteps() : buildTracerouteSteps();
    }

    /* ── SVG path diagram ─────────────────────────────────────────────── */
    function svgDiagram() {
      var step = steps[Math.max(0, index)] || {};
      var W = 680, H = 90, nodeW = 56, nodeH = 32;
      var gap = (W - PATH_NODES.length * nodeW) / (PATH_NODES.length + 1);

      var html = '<svg class="icmp-svg" viewBox="0 0 ' + W + ' ' + H + '" preserveAspectRatio="xMidYMid meet">';

      /* connection lines */
      for (var i = 0; i < PATH_NODES.length - 1; i++) {
        var x1 = gap + i * (nodeW + gap) + nodeW;
        var x2 = gap + (i + 1) * (nodeW + gap);
        html += '<line x1="' + x1 + '" y1="30" x2="' + x2 + '" y2="30" stroke="#ccc" stroke-width="1.5"/>';
        html += '<text x="' + ((x1 + x2) / 2) + '" y="22" text-anchor="middle" font-size="8" fill="var(--ink-faint)">' + HOP_DELAYS[i] + 'ms</text>';
      }

      /* nodes */
      for (var i = 0; i < PATH_NODES.length; i++) {
        var x = gap + i * (nodeW + gap);
        var isProbe = step.probe === i;
        var isEnd = i === 0 || i === PATH_NODES.length - 1;
        var fill = isProbe ? '#e3f2fd' : (isEnd ? '#e8f5e9' : '#fafafa');
        var stroke = isProbe ? '#1976d2' : (isEnd ? '#66bb6a' : '#bbb');
        html += '<rect x="' + x + '" y="14" width="' + nodeW + '" height="' + nodeH + '" rx="6" fill="' + fill + '" stroke="' + stroke + '" stroke-width="' + (isProbe ? 2.5 : 1) + '"/>';
        html += '<text x="' + (x + nodeW / 2) + '" y="35" text-anchor="middle" font-size="11" font-weight="' + (isEnd ? '700' : '400') + '" fill="var(--ink)">' + PATH_NODES[i] + '</text>';
      }

      /* animated probe indicator */
      if (step.probe !== undefined && index >= 0) {
        var px = gap + step.probe * (nodeW + gap) + nodeW / 2;
        var col = step.dir === 'back' ? '#66bb6a' : '#42a5f5';
        html += '<circle cx="' + px + '" cy="55" r="6" fill="' + col + '"><animate attributeName="r" values="4;8;4" dur="0.8s" repeatCount="indefinite"/></circle>';
        html += '<text x="' + px + '" y="72" text-anchor="middle" font-size="8" fill="' + col + '">' + (step.dir === 'back' ? '← reply' : '→ probe') + '</text>';
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
      var html = '<div class="icmp-hops"><table class="icmp-hop-tbl">';
      html += '<thead><tr><th>Hop</th><th>Node</th><th>RTT</th><th>ICMP Type</th></tr></thead><tbody>';
      var cumRtt = 0;
      for (var i = 0; i < hops.length; i++) {
        cumRtt += hops[i].delay * 2;
        var last = i === hops.length - 1;
        html += '<tr' + (last ? ' class="icmp-hop-latest"' : '') + '><td>' + hops[i].n + '</td><td>' + hops[i].node + '</td><td>' + cumRtt + ' ms</td><td>' + (hops[i].node === 'B' ? 'Echo Reply' : 'Time Exceeded') + '</td></tr>';
      }
      html += '</tbody></table></div>';
      return html;
    }

    /* ── ICMP packet breakdown ────────────────────────────────────────── */
    function icmpPacket() {
      var step = steps[Math.max(0, index)] || {};
      if (!step.type) return '';
      var typeNames = { '0': 'Echo Reply', '8': 'Echo Request', '11': 'Time Exceeded' };
      var html = '<div class="icmp-pkt">';
      html += '<div class="icmp-pkt-title">ICMP Header</div>';
      html += '<div class="icmp-pkt-row"><span>Type</span><strong>' + step.type + ' (' + (typeNames[step.type] || '?') + ')</strong></div>';
      html += '<div class="icmp-pkt-row"><span>Code</span><strong>' + step.code + '</strong></div>';
      html += '<div class="icmp-pkt-row"><span>Checksum</span><strong>0x' + (Math.floor(Math.random() * 65535)).toString(16).toUpperCase() + '</strong></div>';
      html += '</div>';
      return html;
    }

    /* ── draw ──────────────────────────────────────────────────────────── */
    function draw() {
      mount.innerHTML = svgDiagram() + '<div class="icmp-bottom">' + hopTable() + icmpPacket() + '</div>';

      var step = steps[Math.max(0, index)] || {};
      if (mode === 'ping') {
        ctx.setMetrics([
          { label: 'Mode', value: 'Ping (Echo Request/Reply)' },
          { label: 'Hops', value: String(PATH_NODES.length - 1) },
          { label: 'Path', value: PATH_NODES.join(' → ') },
          { label: 'RTT', value: step.rtt ? step.rtt + ' ms' : '—' }
        ]);
      } else {
        var found = 0;
        for (var i = 0; i <= index; i++) { if (steps[i].hopFound) found++; }
        ctx.setMetrics([
          { label: 'Mode', value: 'Traceroute (TTL expiry)' },
          { label: 'Total Hops', value: String(PATH_NODES.length - 1) },
          { label: 'Discovered', value: found + ' / ' + (PATH_NODES.length - 1) },
          { label: 'Method', value: 'Increment TTL, listen for Time Exceeded' }
        ]);
      }
    }

    /* ── params ────────────────────────────────────────────────────────── */
    function renderParams() {
      ctx.params.hidden = false;
      var html = '<div class="icmp-modes">';
      html += '<label class="switch-mode-option' + (mode === 'ping' ? ' is-checked' : '') + '"><input type="radio" name="icmpmode" value="ping"' + (mode === 'ping' ? ' checked' : '') + '> <strong>Ping</strong><br><span style="font-size:0.72rem;color:var(--ink-faint);">Echo Request / Reply</span></label>';
      html += '<label class="switch-mode-option' + (mode === 'traceroute' ? ' is-checked' : '') + '"><input type="radio" name="icmpmode" value="traceroute"' + (mode === 'traceroute' ? ' checked' : '') + '> <strong>Traceroute</strong><br><span style="font-size:0.72rem;color:var(--ink-faint);">TTL expiry hop discovery</span></label>';
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
      ctx.log('Ready — ' + (mode === 'ping' ? 'pinging B from A.' : 'tracing the route from A to B.'));
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
      start: function () { if (timer) return; timer = NetSim.SimTiming.setInterval(function () { if (index >= steps.length - 1) { stop(); return; } advance(); }, 800); },
      pause: function () { stop(); },
      step:  function () { stop(); advance(); },
      reset: function () { rebuild(); },
      destroy: function () { stop(); }
    };
  });

})(window.NetSim = window.NetSim || {});
