/* ==========================================================================
   NetSim — simulations/udp.js
   Interactive UDP transmission simulation showing fire-and-forget
   datagram delivery:
     - Sender ↔ Receiver SVG timeline with datagrams (some lost)
     - UDP header breakdown (only 8 bytes! vs TCP's 20)
     - Delivery status strip with ✓/✕
     - Configurable datagram count and loss probability
     - Use-case toggle: DNS query, video streaming, gaming
   ========================================================================== */

(function (NetSim) {
  'use strict';

  /* ---- Use-case presets ---- */
  var SCENARIOS = {
    dns:    { label: 'DNS Query',       port: 53,    count: 4,  loss: 0.15, proto: 'DNS',   note: 'Single query + response — if lost, the resolver just retries after a timeout.' },
    stream: { label: 'Video Streaming', port: 5004,  count: 10, loss: 0.20, proto: 'RTP',   note: 'Real-time video frames — a lost frame means a brief glitch, not a stall. Re-requesting it would arrive too late.' },
    game:   { label: 'Online Gaming',   port: 27015, count: 8,  loss: 0.10, proto: 'Game',  note: 'Position updates at 60+ Hz — old positions are useless if late. Each new packet supersedes the last.' },
    custom: { label: 'Custom',          port: 9000,  count: 6,  loss: 0.25, proto: 'App',   note: 'Generic UDP datagrams with configurable parameters.' }
  };

  /* ---- Build events ---- */
  function buildEvents(scenario, count, lossProb) {
    var sc = SCENARIOS[scenario];
    var port = sc.port;
    var events = [];

    events.push({
      type: 'note',
      text: 'No handshake needed — UDP is connectionless. The application starts sending immediately.',
      label: 'No connection setup!', color: '#1565c0'
    });

    var results = []; // { id, lost }
    for (var i = 1; i <= count; i++) {
      var lost = Math.random() < lossProb;
      results.push({ id: i, lost: lost });

      events.push({
        type: 'arrow', dir: 'right',
        label: sc.proto + ' #' + i + ' (' + (40 + Math.floor(Math.random() * 960)) + 'B)',
        lost: lost,
        header: { srcPort: 51000 + i, dstPort: port, length: 8 + 40 + Math.floor(Math.random() * 960), checksum: '0x' + Math.floor(Math.random() * 65535).toString(16).toUpperCase() },
        text: lost
          ? 'Datagram #' + i + ' sent to port ' + port + ' — LOST in transit! No ACK expected, no retransmission. The sender never finds out.'
          : 'Datagram #' + i + ' sent to port ' + port + ' — delivered to the application.',
        level: lost ? 'warning' : 'success',
        datagramId: i
      });
    }

    var delivered = results.filter(function (r) { return !r.lost; }).length;
    var lost = results.filter(function (r) { return r.lost; }).length;

    events.push({
      type: 'note',
      text: 'Done! ' + delivered + '/' + count + ' datagrams delivered, ' + lost + ' lost. No connection to tear down either.',
      label: delivered + '/' + count + ' delivered — no teardown needed',
      color: '#2e7d32'
    });

    return { events: events, results: results };
  }

  /* ---- SVG Timeline ---- */
  function renderTimeline(events, currentIdx) {
    var W = 600, rowH = 48, topPad = 50;
    var visible = events.slice(0, currentIdx + 1);
    var rows = Math.max(visible.length, 1);
    var H = topPad + rows * rowH + 20;
    var sX = 100, rX = 500;

    var svg = '<svg class="udp-tl-svg" viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="UDP transmission timeline">';

    // Headers
    svg += '<text x="' + sX + '" y="22" text-anchor="middle" class="udp-tl-header" fill="#1565c0">Sender</text>';
    svg += '<text x="' + rX + '" y="22" text-anchor="middle" class="udp-tl-header" fill="#2e7d32">Receiver</text>';
    svg += '<text x="' + sX + '" y="37" text-anchor="middle" class="udp-tl-subhdr">:51000+</text>';
    svg += '<text x="' + rX + '" y="37" text-anchor="middle" class="udp-tl-subhdr">:' + (currentIdx >= 0 && events[0] ? events[currentIdx > 0 && events[currentIdx].header ? events[currentIdx].header.dstPort : 0] || '' : '') + '</text>';

    // Lifelines
    svg += '<line x1="' + sX + '" y1="42" x2="' + sX + '" y2="' + (H - 5) + '" stroke="#1565c0" stroke-width="2" stroke-dasharray="4 3"/>';
    svg += '<line x1="' + rX + '" y1="42" x2="' + rX + '" y2="' + (H - 5) + '" stroke="#2e7d32" stroke-width="2" stroke-dasharray="4 3"/>';

    // No-ACK annotation on the right
    svg += '<text x="' + (rX + 15) + '" y="' + (topPad + 10) + '" class="udp-no-ack">← No ACKs!</text>';

    visible.forEach(function (ev, i) {
      var y = topPad + i * rowH;
      var active = i === currentIdx;

      if (ev.type === 'arrow') {
        var fromX = sX, toX = rX;
        var color = ev.lost ? '#d32f2f' : '#1565c0';
        var sw = active ? '3' : '2';
        var dash = ev.lost ? ' stroke-dasharray="6 4"' : '';

        svg += '<line x1="' + fromX + '" y1="' + y + '" x2="' + toX + '" y2="' + (y + rowH * 0.5) + '" ' +
               'stroke="' + color + '" stroke-width="' + sw + '"' + dash + ' marker-end="url(#udp-arr)"/>';

        var labelX = (fromX + toX) / 2;
        svg += '<text x="' + labelX + '" y="' + (y - 3) + '" text-anchor="middle" class="udp-arrow-label" fill="' + color + '">' +
               ev.label + '</text>';

        if (ev.lost) {
          var midX = (fromX + toX) / 2;
          var midY = y + rowH * 0.25;
          svg += '<text x="' + midX + '" y="' + (midY + 5) + '" text-anchor="middle" fill="#d32f2f" font-size="20" font-weight="800">✕</text>';
          svg += '<text x="' + (midX + 18) + '" y="' + (midY + 5) + '" class="udp-lost-label" fill="#d32f2f">LOST</text>';
        }

      } else if (ev.type === 'note') {
        var noteColor = ev.color || 'var(--ink-faint)';
        svg += '<rect x="' + (sX + 10) + '" y="' + (y + 5) + '" width="' + (rX - sX - 20) + '" height="26" rx="13" ' +
               'fill="' + noteColor + '" fill-opacity="0.08" stroke="' + noteColor + '" stroke-width="1.5"/>';
        svg += '<text x="' + ((sX + rX) / 2) + '" y="' + (y + 22) + '" text-anchor="middle" ' +
               'class="udp-note-label" fill="' + noteColor + '">' + ev.label + '</text>';
      }
    });

    svg += '<defs><marker id="udp-arr" markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto">' +
           '<path d="M0,1 L0,7 L7,4 z" fill="var(--ink)"/></marker></defs>';
    svg += '</svg>';
    return svg;
  }

  /* ---- UDP Header breakdown ---- */
  function renderHeader(header) {
    if (!header) return '';
    var fields = [
      { name: 'Src Port',  val: header.srcPort,  w: '25%' },
      { name: 'Dst Port',  val: header.dstPort,  w: '25%' },
      { name: 'Length',     val: header.length + ' B', w: '25%' },
      { name: 'Checksum',  val: header.checksum,      w: '25%' }
    ];
    var html = '<div class="udp-header">';
    html += '<div class="udp-header-title">UDP Header (only 8 bytes!)</div>';
    html += '<div class="udp-header-fields">';
    fields.forEach(function (f) {
      html += '<div class="udp-hf" style="flex-basis:' + f.w + '">';
      html += '<span class="udp-hf-name">' + f.name + '</span>';
      html += '<span class="udp-hf-val">' + f.val + '</span>';
      html += '</div>';
    });
    html += '</div>';
    html += '<div class="udp-header-compare">Compare: TCP header = 20 bytes min (5× more overhead)</div>';
    html += '</div>';
    return html;
  }

  /* ---- Delivery strip ---- */
  function renderDeliveryStrip(results, currentIdx) {
    var html = '<div class="udp-delivery-strip">';
    html += '<span class="udp-strip-title">Delivery:</span>';
    results.forEach(function (r, i) {
      // only show results up to current step (offset by 1 for intro note)
      if (i + 1 > currentIdx) {
        html += '<span class="udp-dg udp-dg-pending">D' + r.id + '</span>';
      } else if (r.lost) {
        html += '<span class="udp-dg udp-dg-lost">D' + r.id + ' ✕</span>';
      } else {
        html += '<span class="udp-dg udp-dg-ok">D' + r.id + ' ✓</span>';
      }
    });
    html += '</div>';
    return html;
  }

  /* ==== Main simulation ==== */
  NetSim.SimRegistry.register('udp', function factory(ctx) {
    var scenario = 'dns';
    var count = SCENARIOS.dns.count;
    var lossProb = SCENARIOS.dns.loss;
    var sim = null;
    var index = -1;
    var timer = null;
    var host = null;

    function rebuild() {
      stop();
      index = -1;
      var sc = SCENARIOS[scenario];
      if (scenario !== 'custom') { count = sc.count; lossProb = sc.loss; }
      sim = buildEvents(scenario, count, lossProb);
      draw();
      renderParams();
      ctx.log('UDP — ' + sc.label + ': ' + sc.note);
    }

    function draw() {
      var ev = index >= 0 && sim.events[index] ? sim.events[index] : null;

      var tlHtml = renderTimeline(sim.events, index);
      var headerHtml = ev && ev.header ? renderHeader(ev.header) : '';
      var stripHtml = renderDeliveryStrip(sim.results, index);

      // Use-case info
      var sc = SCENARIOS[scenario];
      var infoHtml = '<div class="udp-info">';
      infoHtml += '<h4 class="udp-info-title">' + sc.label + ' over UDP</h4>';
      infoHtml += '<p class="udp-info-note">' + sc.note + '</p>';
      infoHtml += '<ul class="udp-info-props">';
      infoHtml += '<li><strong>No handshake</strong> — data flows immediately</li>';
      infoHtml += '<li><strong>No ACK / retransmission</strong> — lost data stays lost</li>';
      infoHtml += '<li><strong>No ordering</strong> — datagrams may arrive out of order</li>';
      infoHtml += '<li><strong>No congestion control</strong> — sender can flood the network</li>';
      infoHtml += '<li><strong>Minimal header</strong> — only 8 bytes (vs TCP\'s 20+)</li>';
      infoHtml += '</ul></div>';

      host.innerHTML = stripHtml + headerHtml + tlHtml + infoHtml;

      // Metrics
      var sent = sim.results.filter(function (r, i) { return i + 1 <= index; });
      var delivered = sent.filter(function (r) { return !r.lost; }).length;
      var lost = sent.filter(function (r) { return r.lost; }).length;

      ctx.setMetrics([
        { label: 'Scenario', value: sc.label },
        { label: 'Datagrams Sent', value: sent.length + ' / ' + count },
        { label: 'Delivered', value: String(delivered) },
        { label: 'Lost (unrecovered)', value: String(lost) },
        { label: 'Retransmissions', value: '0 (UDP never retransmits)' },
        { label: 'Header Overhead', value: '8 bytes' },
        { label: 'Connection Setup', value: 'None (connectionless)' }
      ]);
    }

    function renderParams() {
      ctx.params.hidden = false;
      var scenarioHtml =
        '<fieldset class="switch-mode-group" role="radiogroup" aria-label="Use Case">' +
        '<legend class="section-label" style="margin:0 0 0.5rem;border:none;padding:0;">Use Case</legend>' +
        Object.keys(SCENARIOS).map(function (k) {
          return '<label class="switch-mode-option ' + (k === scenario ? 'is-checked' : '') + '">' +
            '<input type="radio" name="udpScenario" value="' + k + '" ' + (k === scenario ? 'checked' : '') + '> ' +
            SCENARIOS[k].label + '</label>';
        }).join('') +
        '</fieldset>';

      var customHtml = '';
      if (scenario === 'custom') {
        customHtml =
          '<div class="sim-param-row"><label for="udpCount">Datagrams</label>' +
            '<input type="range" id="udpCount" min="3" max="12" step="1" value="' + count + '">' +
            '<span class="val" id="udpCountVal">' + count + '</span></div>' +
          '<div class="sim-param-row"><label for="udpLoss">Loss %</label>' +
            '<input type="range" id="udpLoss" min="0" max="50" step="5" value="' + Math.round(lossProb * 100) + '">' +
            '<span class="val" id="udpLossVal">' + Math.round(lossProb * 100) + '%</span></div>';
      }

      ctx.params.innerHTML = scenarioHtml + customHtml;

      ctx.params.querySelectorAll('input[name="udpScenario"]').forEach(function (r) {
        r.addEventListener('change', function () { scenario = r.value; rebuild(); });
      });
      if (scenario === 'custom') {
        var countEl = ctx.params.querySelector('#udpCount');
        var lossEl = ctx.params.querySelector('#udpLoss');
        if (countEl) {
          countEl.addEventListener('input', function (e) { ctx.params.querySelector('#udpCountVal').textContent = e.target.value; });
          countEl.addEventListener('change', function (e) { count = parseInt(e.target.value, 10); rebuild(); });
        }
        if (lossEl) {
          lossEl.addEventListener('input', function (e) { ctx.params.querySelector('#udpLossVal').textContent = e.target.value + '%'; });
          lossEl.addEventListener('change', function (e) { lossProb = parseInt(e.target.value, 10) / 100; rebuild(); });
        }
      }
    }

    function stop() { if (timer) { NetSim.SimTiming.clearInterval(timer); timer = null; } }

    function advance() {
      if (index >= sim.events.length - 1) { stop(); return; }
      index++;
      var e = sim.events[index];
      ctx.log(e.text, e.level);
      draw();
    }

    return {
      initialize: function () {
        ctx.canvas.classList.add('net-canvas');
        ctx.canvas.innerHTML = '<div class="udp-mount"></div>';
        host = ctx.canvas.querySelector('.udp-mount');
        rebuild();
      },
      start: function () {
        if (timer) return;
        timer = NetSim.SimTiming.setInterval(function () {
          if (index >= sim.events.length - 1) { stop(); return; }
          advance();
        }, 600);
      },
      pause: function () { stop(); },
      step: function () { stop(); advance(); },
      reset: function () { rebuild(); },
      destroy: function () { stop(); }
    };
  });

})(window.NetSim = window.NetSim || {});
