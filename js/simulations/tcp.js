/* ==========================================================================
   NetSim — simulations/tcp.js
   Interactive TCP connection lifecycle simulation:
     - 3-way handshake (SYN → SYN-ACK → ACK) with real seq/ack numbers
     - Data transfer phase (optional segments)
     - 4-way teardown (FIN → ACK → FIN → ACK) with half-close states
   Shows: Sender ↔ Receiver SVG timeline, TCP state diagram with active
   state highlighted, segment header breakdown, and connection states.
   ========================================================================== */

(function (NetSim) {
  'use strict';

  var CLIENT_ISN = 1000;
  var SERVER_ISN = 5000;

  /* ---- State colors ---- */
  var ST = {
    closed:    { color: '#757575', bg: '#eeeeee' },
    listen:    { color: '#6a1b9a', bg: '#e1bee7' },
    syn_sent:  { color: '#1565c0', bg: '#bbdefb' },
    syn_rcvd:  { color: '#00695c', bg: '#b2dfdb' },
    estab:     { color: '#2e7d32', bg: '#c8e6c9' },
    fin_wait1: { color: '#e65100', bg: '#ffe0b2' },
    fin_wait2: { color: '#ef6c00', bg: '#fff3e0' },
    close_wait:{ color: '#ad1457', bg: '#f8bbd0' },
    last_ack:  { color: '#c62828', bg: '#ffcdd2' },
    time_wait: { color: '#4527a0', bg: '#d1c4e9' }
  };

  /* ---- Build all events ---- */
  function buildEvents(includeTeardown, includeData) {
    var events = [];
    var cSeq = CLIENT_ISN;
    var sSeq = SERVER_ISN;

    /* -- 3-way handshake -- */
    events.push({
      type: 'arrow', dir: 'right',
      label: 'SYN, Seq=' + cSeq,
      flags: { syn: true },
      header: { srcPort: 51234, dstPort: 80, seq: cSeq, ack: 0, flags: 'SYN', win: 65535 },
      clientState: 'SYN_SENT', serverState: 'LISTEN',
      text: 'Client sends SYN (seq=' + cSeq + '). "I want to connect — my sequence numbers start at ' + cSeq + '."',
      color: '#1565c0'
    });

    events.push({
      type: 'arrow', dir: 'left',
      label: 'SYN-ACK, Seq=' + sSeq + ', Ack=' + (cSeq + 1),
      flags: { syn: true, ack: true },
      header: { srcPort: 80, dstPort: 51234, seq: sSeq, ack: cSeq + 1, flags: 'SYN+ACK', win: 65535 },
      clientState: 'SYN_SENT', serverState: 'SYN_RCVD',
      text: 'Server sends SYN-ACK (seq=' + sSeq + ', ack=' + (cSeq + 1) + '). "Agreed, my numbers start at ' + sSeq + '. I expect your next byte to be ' + (cSeq + 1) + '."',
      color: '#00695c'
    });

    cSeq += 1; // SYN consumes 1 sequence number
    events.push({
      type: 'arrow', dir: 'right',
      label: 'ACK, Ack=' + (sSeq + 1),
      flags: { ack: true },
      header: { srcPort: 51234, dstPort: 80, seq: cSeq, ack: sSeq + 1, flags: 'ACK', win: 65535 },
      clientState: 'ESTABLISHED', serverState: 'ESTABLISHED',
      text: 'Client sends ACK (ack=' + (sSeq + 1) + '). Three-way handshake complete — connection ESTABLISHED!',
      level: 'success', color: '#2e7d32'
    });
    sSeq += 1;

    events.push({
      type: 'state',
      label: '— CONNECTION ESTABLISHED —',
      clientState: 'ESTABLISHED', serverState: 'ESTABLISHED',
      text: 'Both sides are ESTABLISHED. Full-duplex data transfer can begin.',
      level: 'success', color: '#2e7d32'
    });

    /* -- Optional data transfer -- */
    if (includeData) {
      var dataLen = 200;
      events.push({
        type: 'arrow', dir: 'right',
        label: 'DATA (' + dataLen + 'B), Seq=' + cSeq,
        flags: { ack: true, psh: true },
        header: { srcPort: 51234, dstPort: 80, seq: cSeq, ack: sSeq, flags: 'ACK+PSH', win: 65535 },
        clientState: 'ESTABLISHED', serverState: 'ESTABLISHED',
        text: 'Client sends ' + dataLen + ' bytes of data (seq=' + cSeq + ').',
        color: '#1565c0'
      });
      cSeq += dataLen;

      events.push({
        type: 'arrow', dir: 'left',
        label: 'ACK, Ack=' + cSeq,
        flags: { ack: true },
        header: { srcPort: 80, dstPort: 51234, seq: sSeq, ack: cSeq, flags: 'ACK', win: 65335 },
        clientState: 'ESTABLISHED', serverState: 'ESTABLISHED',
        text: 'Server ACKs the data (ack=' + cSeq + '). Window reduced by ' + dataLen + ' bytes.',
        color: '#2e7d32'
      });

      var sDataLen = 500;
      events.push({
        type: 'arrow', dir: 'left',
        label: 'DATA (' + sDataLen + 'B), Seq=' + sSeq,
        flags: { ack: true, psh: true },
        header: { srcPort: 80, dstPort: 51234, seq: sSeq, ack: cSeq, flags: 'ACK+PSH', win: 65335 },
        clientState: 'ESTABLISHED', serverState: 'ESTABLISHED',
        text: 'Server sends ' + sDataLen + ' bytes of response data (seq=' + sSeq + ').',
        color: '#00695c'
      });
      sSeq += sDataLen;

      events.push({
        type: 'arrow', dir: 'right',
        label: 'ACK, Ack=' + sSeq,
        flags: { ack: true },
        header: { srcPort: 51234, dstPort: 80, seq: cSeq, ack: sSeq, flags: 'ACK', win: 65035 },
        clientState: 'ESTABLISHED', serverState: 'ESTABLISHED',
        text: 'Client ACKs server\'s data (ack=' + sSeq + ').',
        color: '#2e7d32'
      });
    }

    /* -- 4-way teardown -- */
    if (includeTeardown) {
      events.push({
        type: 'arrow', dir: 'right',
        label: 'FIN+ACK, Seq=' + cSeq,
        flags: { fin: true, ack: true },
        header: { srcPort: 51234, dstPort: 80, seq: cSeq, ack: sSeq, flags: 'FIN+ACK', win: 65535 },
        clientState: 'FIN_WAIT_1', serverState: 'ESTABLISHED',
        text: 'Client sends FIN (seq=' + cSeq + '). "I have no more data to send."',
        color: '#e65100'
      });

      events.push({
        type: 'arrow', dir: 'left',
        label: 'ACK, Ack=' + (cSeq + 1),
        flags: { ack: true },
        header: { srcPort: 80, dstPort: 51234, seq: sSeq, ack: cSeq + 1, flags: 'ACK', win: 65535 },
        clientState: 'FIN_WAIT_2', serverState: 'CLOSE_WAIT',
        text: 'Server ACKs the FIN. Client moves to FIN_WAIT_2, server enters CLOSE_WAIT (can still send data).',
        color: '#ad1457'
      });

      events.push({
        type: 'state',
        label: '— Half-closed: Client → Server direction closed —',
        clientState: 'FIN_WAIT_2', serverState: 'CLOSE_WAIT',
        text: 'Half-close state: Client can no longer send, but server can still send data if needed.',
        level: 'warning', color: '#e65100'
      });

      events.push({
        type: 'arrow', dir: 'left',
        label: 'FIN+ACK, Seq=' + sSeq,
        flags: { fin: true, ack: true },
        header: { srcPort: 80, dstPort: 51234, seq: sSeq, ack: cSeq + 1, flags: 'FIN+ACK', win: 65535 },
        clientState: 'TIME_WAIT', serverState: 'LAST_ACK',
        text: 'Server sends its own FIN (seq=' + sSeq + '). "I\'m done too." Server enters LAST_ACK.',
        color: '#c62828'
      });

      cSeq += 1;
      events.push({
        type: 'arrow', dir: 'right',
        label: 'ACK, Ack=' + (sSeq + 1),
        flags: { ack: true },
        header: { srcPort: 51234, dstPort: 80, seq: cSeq, ack: sSeq + 1, flags: 'ACK', win: 65535 },
        clientState: 'TIME_WAIT', serverState: 'CLOSED',
        text: 'Client sends final ACK. Server closes immediately. Client enters TIME_WAIT (2×MSL).',
        color: '#4527a0'
      });

      events.push({
        type: 'state',
        label: '— TIME_WAIT (2×MSL = 60s) → CLOSED —',
        clientState: 'CLOSED', serverState: 'CLOSED',
        text: 'After 2×MSL timeout, client moves to CLOSED. Connection fully terminated on both sides.',
        level: 'success', color: '#2e7d32'
      });
    }

    return events;
  }

  /* ---- SVG Timeline ---- */
  function renderTimeline(events, currentIdx) {
    var W = 640, rowH = 46, topPad = 50;
    var visible = events.slice(0, currentIdx + 1);
    var rows = Math.max(visible.length, 1);
    var H = topPad + rows * rowH + 20;
    var cX = 110, sX = 530;

    var svg = '<svg class="tcp-hs-svg" viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="TCP handshake timeline">';

    // Headers
    svg += '<text x="' + cX + '" y="20" text-anchor="middle" class="tcp-hs-header" fill="#1565c0">Client</text>';
    svg += '<text x="' + sX + '" y="20" text-anchor="middle" class="tcp-hs-header" fill="#2e7d32">Server</text>';

    // State labels under headers
    if (currentIdx >= 0 && events[currentIdx]) {
      var cs = events[currentIdx].clientState || '';
      var ss = events[currentIdx].serverState || '';
      svg += '<text x="' + cX + '" y="35" text-anchor="middle" class="tcp-hs-state-label" fill="#1565c0">' + cs + '</text>';
      svg += '<text x="' + sX + '" y="35" text-anchor="middle" class="tcp-hs-state-label" fill="#2e7d32">' + ss + '</text>';
    }

    // Lifelines
    svg += '<line x1="' + cX + '" y1="40" x2="' + cX + '" y2="' + (H - 5) + '" stroke="#1565c0" stroke-width="2" stroke-dasharray="4 3"/>';
    svg += '<line x1="' + sX + '" y1="40" x2="' + sX + '" y2="' + (H - 5) + '" stroke="#2e7d32" stroke-width="2" stroke-dasharray="4 3"/>';

    visible.forEach(function (ev, i) {
      var y = topPad + i * rowH;
      var active = i === currentIdx;
      var sw = active ? '3' : '1.8';
      var color = ev.color || 'var(--ink)';

      if (ev.type === 'arrow') {
        var fromX = ev.dir === 'right' ? cX : sX;
        var toX = ev.dir === 'right' ? sX : cX;

        svg += '<line x1="' + fromX + '" y1="' + y + '" x2="' + toX + '" y2="' + (y + rowH * 0.55) + '" ' +
               'stroke="' + color + '" stroke-width="' + sw + '" marker-end="url(#tcp-hs-arr)"/>';

        var labelX = (fromX + toX) / 2;
        var labelY = y - 3;
        svg += '<text x="' + labelX + '" y="' + labelY + '" text-anchor="middle" class="tcp-hs-arrow-lbl" fill="' + color + '">' +
               ev.label + '</text>';

      } else if (ev.type === 'state') {
        svg += '<rect x="' + (cX + 15) + '" y="' + (y + 5) + '" width="' + (sX - cX - 30) + '" height="24" rx="12" ' +
               'fill="' + color + '" fill-opacity="0.1" stroke="' + color + '" stroke-width="1.5"/>';
        svg += '<text x="' + ((cX + sX) / 2) + '" y="' + (y + 21) + '" text-anchor="middle" ' +
               'class="tcp-hs-state-banner" fill="' + color + '">' + ev.label + '</text>';
      }
    });

    svg += '<defs><marker id="tcp-hs-arr" markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto">' +
           '<path d="M0,1 L0,7 L7,4 z" fill="var(--ink)"/></marker></defs>';
    svg += '</svg>';
    return svg;
  }

  /* ---- TCP Segment Header breakdown ---- */
  function renderHeader(header) {
    if (!header) return '';
    var fields = [
      { name: 'Src Port',  val: header.srcPort,  cls: 'tcp-hf-port' },
      { name: 'Dst Port',  val: header.dstPort,  cls: 'tcp-hf-port' },
      { name: 'Seq #',     val: header.seq,      cls: 'tcp-hf-seq' },
      { name: 'Ack #',     val: header.ack,      cls: 'tcp-hf-ack' },
      { name: 'Flags',     val: header.flags,    cls: 'tcp-hf-flags' },
      { name: 'Window',    val: header.win,      cls: 'tcp-hf-win' }
    ];
    var html = '<div class="tcp-header-strip">';
    html += '<span class="tcp-header-title">TCP Segment Header</span>';
    html += '<div class="tcp-header-fields">';
    fields.forEach(function (f) {
      html += '<div class="tcp-hf ' + f.cls + '">';
      html += '<span class="tcp-hf-name">' + f.name + '</span>';
      html += '<span class="tcp-hf-val">' + f.val + '</span>';
      html += '</div>';
    });
    html += '</div></div>';
    return html;
  }

  /* ---- Connection state boxes ---- */
  function renderStates(clientState, serverState) {
    function stateBox(label, state, side) {
      var sKey = state ? state.toLowerCase().replace(/_/g, '_') : 'closed';
      // Map to our ST keys
      var stMap = {
        'syn_sent': ST.syn_sent, 'syn_rcvd': ST.syn_rcvd, 'established': ST.estab,
        'fin_wait_1': ST.fin_wait1, 'fin_wait_2': ST.fin_wait2,
        'close_wait': ST.close_wait, 'last_ack': ST.last_ack,
        'time_wait': ST.time_wait, 'closed': ST.closed, 'listen': ST.listen
      };
      var s = stMap[sKey] || ST.closed;
      return '<div class="tcp-state-box" style="border-color:' + s.color + ';background:' + s.bg + '">' +
             '<span class="tcp-state-side" style="color:' + s.color + '">' + label + '</span>' +
             '<span class="tcp-state-name" style="color:' + s.color + '">' + (state || 'CLOSED') + '</span>' +
             '</div>';
    }
    return '<div class="tcp-states-row">' +
           stateBox('Client', clientState, 'client') +
           stateBox('Server', serverState, 'server') +
           '</div>';
  }

  /* ==== Main simulation ==== */
  NetSim.SimRegistry.register('tcp', function factory(ctx) {
    var includeTeardown = true;
    var includeData = true;
    var events = [];
    var index = -1;
    var timer = null;
    var host = null;

    function rebuild() {
      stop();
      index = -1;
      events = buildEvents(includeTeardown, includeData);
      draw();
      renderParams();
      ctx.log('Ready — Client will open a TCP connection to Server (port 80).');
    }

    function draw() {
      var ev = index >= 0 && events[index] ? events[index] : null;
      var clientState = ev ? ev.clientState : 'CLOSED';
      var serverState = ev ? ev.serverState : 'CLOSED';

      var statesHtml = renderStates(clientState, serverState);
      var tlHtml = renderTimeline(events, index);
      var headerHtml = ev && ev.header ? renderHeader(ev.header) : '';

      host.innerHTML = statesHtml + headerHtml + tlHtml;

      // Determine phase
      var phase = 'Waiting';
      if (index < 0) phase = 'Ready';
      else if (clientState === 'ESTABLISHED' && serverState === 'ESTABLISHED') phase = includeTeardown ? 'Established' : 'Complete';
      else if (clientState === 'CLOSED' && serverState === 'CLOSED' && index > 0) phase = 'Closed';
      else if (ev && ev.flags && ev.flags.fin) phase = 'Teardown';
      else if (ev && ev.flags && ev.flags.syn) phase = 'Handshake';
      else phase = clientState === 'ESTABLISHED' ? 'Data Transfer' : 'Handshake';

      ctx.setMetrics([
        { label: 'Phase', value: phase },
        { label: 'Client State', value: clientState },
        { label: 'Server State', value: serverState },
        { label: 'Client ISN', value: String(CLIENT_ISN) },
        { label: 'Server ISN', value: String(SERVER_ISN) },
        { label: 'Segments Exchanged', value: String(Math.max(0, index + 1)) + ' / ' + events.length }
      ]);
    }

    function renderParams() {
      ctx.params.hidden = false;
      ctx.params.innerHTML =
        '<div class="tcp-param-checks">' +
        '<label class="switch-mode-option ' + (includeData ? 'is-checked' : '') + '">' +
          '<input type="checkbox" id="tcpData" ' + (includeData ? 'checked' : '') + '> ' +
          'Include data transfer' +
        '</label>' +
        '<label class="switch-mode-option ' + (includeTeardown ? 'is-checked' : '') + '">' +
          '<input type="checkbox" id="tcpTeardown" ' + (includeTeardown ? 'checked' : '') + '> ' +
          'Include 4-way teardown' +
        '</label>' +
        '</div>';

      ctx.params.querySelector('#tcpData').addEventListener('change', function (e) {
        includeData = e.target.checked;
        rebuild();
      });
      ctx.params.querySelector('#tcpTeardown').addEventListener('change', function (e) {
        includeTeardown = e.target.checked;
        rebuild();
      });
    }

    function stop() { if (timer) { NetSim.SimTiming.clearInterval(timer); timer = null; } }

    function advance() {
      if (index >= events.length - 1) { stop(); return; }
      index++;
      var e = events[index];
      ctx.log(e.text, e.level);
      draw();
    }

    return {
      initialize: function () {
        ctx.canvas.classList.add('net-canvas');
        ctx.canvas.innerHTML = '<div class="tcp-hs-mount"></div>';
        host = ctx.canvas.querySelector('.tcp-hs-mount');
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
      step: function () { stop(); advance(); },
      reset: function () { rebuild(); },
      destroy: function () { stop(); }
    };
  });

})(window.NetSim = window.NetSim || {});
