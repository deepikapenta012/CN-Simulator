/* ==========================================================================
   NetSim — simulations/nat.js   (rebuilt)
   Port Address Translation (PAT / NAT overload) with:
   • SVG network diagram: Internal hosts ↔ NAT Router ↔ Internet
   • Animated packet arrows (outbound green, inbound blue, dropped red)
   • Live NAT translation table with row highlighting
   • 3 scenario presets: Basic PAT, Inbound Reply, Unsolicited Drop
   • Packet header comparison (before/after NAT)
   ========================================================================== */

(function (NetSim) {
  'use strict';

  var PUBLIC_IP = '203.0.113.5';

  var PRESETS = [
    { label: 'Basic Outbound PAT', tag: '3 flows mapped', key: 'basic' },
    { label: 'Inbound Reply',      tag: 'Table lookup hit',  key: 'reply' },
    { label: 'Unsolicited Inbound', tag: 'Dropped — no match', key: 'drop' }
  ];

  var FLOWS = [
    { internal: '10.0.0.2:5001', dest: '93.184.216.34:443',  port: 40001, host: 'Host A' },
    { internal: '10.0.0.3:5002', dest: '142.250.72.78:443',  port: 40002, host: 'Host B' },
    { internal: '10.0.0.4:5003', dest: '93.184.216.34:80',   port: 40003, host: 'Host C' }
  ];

  NetSim.SimRegistry.register('nat', function factory(ctx) {
    var preIdx  = 0;
    var table   = [];
    var events  = [];
    var index   = -1;
    var timer   = null;
    var mount   = null;

    /* ── build events ─────────────────────────────────────────────────── */
    function buildEvents() {
      table = [];
      var out = [];
      var mode = PRESETS[preIdx].key;

      /* outbound flows */
      for (var i = 0; i < FLOWS.length; i++) {
        var f = FLOWS[i];
        out.push({ t: f.host + ' (' + f.internal + ') sends a packet to ' + f.dest + '.  NAT maps to ' + PUBLIC_IP + ':' + f.port + '.', dir: 'out', flow: i, addEntry: f });
      }
      out.push({ t: 'All three outbound flows mapped.  External servers only see ' + PUBLIC_IP + '.', dir: 'none', lv: 'success' });

      if (mode === 'reply' || mode === 'drop') {
        /* inbound reply */
        out.push({ t: 'A reply arrives for ' + PUBLIC_IP + ':40002.  NAT looks up port 40002…', dir: 'in', flow: 1 });
        out.push({ t: 'Match found → translated back to 10.0.0.3:5002 and delivered to Host B.', dir: 'in-ok', flow: 1, lv: 'success' });
      }

      if (mode === 'drop') {
        /* unsolicited */
        out.push({ t: 'An unsolicited packet arrives for ' + PUBLIC_IP + ':50000.  No table entry for port 50000.', dir: 'in-bad', lv: 'warning' });
        out.push({ t: 'Packet DROPPED — no matching entry.  NAT incidentally blocks unsolicited inbound connections.', dir: 'dropped', lv: 'error' });
      }

      return out;
    }

    /* ── SVG network diagram ──────────────────────────────────────────── */
    function svgDiagram() {
      var step = events[Math.max(0, index)] || {};
      var W = 680, H = 160;
      var html = '<svg class="nat-svg" viewBox="0 0 ' + W + ' ' + H + '" preserveAspectRatio="xMidYMid meet">';

      /* hosts column */
      var hosts = ['Host A\n10.0.0.2', 'Host B\n10.0.0.3', 'Host C\n10.0.0.4'];
      for (var i = 0; i < 3; i++) {
        var hy = 20 + i * 48;
        var active = step.flow === i;
        html += '<rect x="10" y="' + hy + '" width="100" height="36" rx="6" fill="' + (active ? '#e0f7fa' : '#fafafa') + '" stroke="' + (active ? '#0097a7' : '#bbb') + '" stroke-width="' + (active ? 2 : 1) + '"/>';
        var lines = hosts[i].split('\n');
        html += '<text x="60" y="' + (hy + 15) + '" text-anchor="middle" font-size="10" font-weight="600" fill="var(--ink)">' + lines[0] + '</text>';
        html += '<text x="60" y="' + (hy + 27) + '" text-anchor="middle" font-size="8" font-family="var(--f-mono)" fill="var(--ink-faint)">' + lines[1] + '</text>';
      }

      /* NAT router */
      html += '<rect x="260" y="50" width="130" height="60" rx="8" fill="#e0f7fa" stroke="#0097a7" stroke-width="2"/>';
      html += '<text x="325" y="72" text-anchor="middle" font-size="12" font-weight="700" fill="#00695c">NAT Router</text>';
      html += '<text x="325" y="88" text-anchor="middle" font-size="9" font-family="var(--f-mono)" fill="#0097a7">' + PUBLIC_IP + '</text>';

      /* Internet cloud */
      html += '<ellipse cx="560" cy="80" rx="80" ry="40" fill="#fff3e0" stroke="#f9a825" stroke-width="1.5"/>';
      html += '<text x="560" y="84" text-anchor="middle" font-size="12" font-weight="600" fill="#e65100">Internet</text>';

      /* arrows */
      var arrowCol = '#66bb6a';
      var arrowDir = 'out';
      if (step.dir === 'in' || step.dir === 'in-ok') { arrowCol = '#42a5f5'; arrowDir = 'in'; }
      if (step.dir === 'in-bad') { arrowCol = '#ffa726'; arrowDir = 'in'; }
      if (step.dir === 'dropped') { arrowCol = '#ef5350'; arrowDir = 'in'; }

      if (step.dir && step.dir !== 'none') {
        /* left arrow (hosts ↔ router) */
        var ay = step.flow !== undefined ? 38 + step.flow * 48 : 80;
        if (arrowDir === 'out') {
          html += '<line x1="110" y1="' + ay + '" x2="258" y2="80" stroke="' + arrowCol + '" stroke-width="2" marker-end="url(#natArrow)"/>';
        } else {
          html += '<line x1="258" y1="80" x2="112" y2="' + ay + '" stroke="' + arrowCol + '" stroke-width="2" marker-end="url(#natArrow)"/>';
        }
        /* right arrow (router ↔ internet) */
        if (arrowDir === 'out') {
          html += '<line x1="392" y1="80" x2="478" y2="80" stroke="' + arrowCol + '" stroke-width="2" marker-end="url(#natArrow)"/>';
        } else {
          html += '<line x1="478" y1="80" x2="394" y2="80" stroke="' + arrowCol + '" stroke-width="2" marker-end="url(#natArrow)"/>';
        }
        /* X for dropped */
        if (step.dir === 'dropped') {
          html += '<text x="325" y="130" text-anchor="middle" font-size="22" fill="#ef5350" font-weight="700">✗ DROPPED</text>';
        }
      }

      /* marker def */
      html += '<defs><marker id="natArrow" markerWidth="8" markerHeight="6" refX="8" refY="3" orient="auto"><path d="M0,0 L8,3 L0,6 Z" fill="' + arrowCol + '"/></marker></defs>';

      html += '</svg>';
      return html;
    }

    /* ── NAT table ────────────────────────────────────────────────────── */
    function natTable() {
      var step = events[Math.max(0, index)] || {};
      /* accumulate entries */
      var liveTable = [];
      for (var i = 0; i <= Math.max(0, index) && i < events.length; i++) {
        if (events[i].addEntry) liveTable.push(events[i].addEntry);
      }

      if (liveTable.length === 0) return '<div class="nat-table-empty">NAT table is empty — no flows yet.</div>';

      var html = '<div class="nat-tbl-wrap"><table class="nat-tbl">';
      html += '<thead><tr><th>Internal</th><th>→</th><th>Public (NAT\'d)</th><th>Destination</th></tr></thead><tbody>';
      for (var i = 0; i < liveTable.length; i++) {
        var f = liveTable[i];
        var hl = step.flow === i ? ' class="nat-tbl-hl"' : '';
        html += '<tr' + hl + '><td>' + f.internal + '</td><td>→</td><td>' + PUBLIC_IP + ':' + f.port + '</td><td>' + f.dest + '</td></tr>';
      }
      html += '</tbody></table></div>';
      return html;
    }

    /* ── header comparison ────────────────────────────────────────────── */
    function headerCompare() {
      if (index < 0) return '';
      var step = events[Math.max(0, index)];
      if (step.flow === undefined || !step.addEntry && step.dir !== 'out') return '';
      var f = FLOWS[step.flow] || FLOWS[0];
      var html = '<div class="nat-hdr-cmp">';
      html += '<div class="nat-hdr-box"><div class="nat-hdr-title">Before NAT</div>';
      html += '<div class="nat-hdr-field">Src: <strong>' + f.internal + '</strong></div>';
      html += '<div class="nat-hdr-field">Dst: ' + f.dest + '</div></div>';
      html += '<div class="nat-hdr-arrow">→</div>';
      html += '<div class="nat-hdr-box nat-hdr-after"><div class="nat-hdr-title">After NAT</div>';
      html += '<div class="nat-hdr-field">Src: <strong>' + PUBLIC_IP + ':' + f.port + '</strong></div>';
      html += '<div class="nat-hdr-field">Dst: ' + f.dest + '</div></div>';
      html += '</div>';
      return html;
    }

    /* ── draw ──────────────────────────────────────────────────────────── */
    function draw() {
      mount.innerHTML = svgDiagram() + natTable() + headerCompare();

      var liveCount = 0;
      for (var i = 0; i <= Math.max(0, index) && i < events.length; i++) {
        if (events[i].addEntry) liveCount++;
      }
      var step = events[Math.max(0, index)] || {};
      ctx.setMetrics([
        { label: 'Public IP', value: PUBLIC_IP },
        { label: 'NAT Table Entries', value: String(liveCount) },
        { label: 'Scenario', value: PRESETS[preIdx].label },
        { label: 'Last Action', value: step.dir === 'dropped' ? 'Dropped' : step.dir === 'in-ok' ? 'Delivered' : step.dir === 'out' ? 'Mapped outbound' : '—' }
      ]);
    }

    /* ── params ────────────────────────────────────────────────────────── */
    function renderParams() {
      ctx.params.hidden = false;
      var html = '<div class="nat-presets">';
      for (var i = 0; i < PRESETS.length; i++) {
        html += '<label class="switch-mode-option' + (i === preIdx ? ' is-checked' : '') + '">' +
          '<input type="radio" name="natpre" value="' + i + '"' + (i === preIdx ? ' checked' : '') + '> ' +
          '<strong>' + PRESETS[i].label + '</strong><br><span style="font-size:0.72rem;color:var(--ink-faint);">' + PRESETS[i].tag + '</span></label>';
      }
      html += '</div>';
      ctx.params.innerHTML = html;

      var radios = ctx.params.querySelectorAll('input[name="natpre"]');
      for (var i = 0; i < radios.length; i++) {
        radios[i].addEventListener('change', function (e) {
          preIdx = parseInt(e.target.value, 10);
          rebuild();
        });
      }
    }

    /* ── lifecycle ─────────────────────────────────────────────────────── */
    function rebuild() {
      stop(); index = -1;
      events = buildEvents();
      renderParams(); draw();
      ctx.log('Ready — ' + PRESETS[preIdx].label + ': three internal hosts sharing ' + PUBLIC_IP + '.');
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
        ctx.canvas.innerHTML = '<div class="nat-mount"></div>';
        mount = ctx.canvas.querySelector('.nat-mount');
        rebuild();
      },
      start: function () {
        if (timer) return;
        timer = NetSim.SimTiming.setInterval(function () {
          if (index >= events.length - 1) { stop(); return; }
          advance();
        }, 800);
      },
      pause: function () { stop(); },
      step:  function () { stop(); advance(); },
      reset: function () { rebuild(); },
      destroy: function () { stop(); }
    };
  });

})(window.NetSim = window.NetSim || {});
