/* ==========================================================================
   NetSim — simulations/tcp-timers.js
   Interactive simulation of the four key TCP timers:
     1) Retransmission Timer (RTO) — RFC 6298 math with SRTT/RTTVAR
     2) Persistence Timer       — probes a zero-window receiver
     3) Keep-Alive Timer        — detects dead connections
     4) TIME_WAIT Timer         — 2×MSL wait after active close
   Each mode shows an animated Sender ↔ Receiver timeline plus live
   metrics and bar charts for the retransmission timer.
   ========================================================================== */

(function (NetSim) {
  'use strict';

  /* ==== Shared drawing helpers ==== */
  var COL = {
    sender: '#1565c0', receiver: '#2e7d32', timeout: '#d32f2f',
    ack: '#558b2f', data: '#1565c0', probe: '#e65100',
    keepalive: '#6a1b9a', timewait: '#00695c',
    bg: 'var(--paper-raised)', line: 'var(--line)', ink: 'var(--ink)',
    faint: 'var(--ink-faint)', accent: 'var(--accent)'
  };

  /* Build an SVG timeline showing Sender on left and Receiver on right,
     with arrows for packets / ACKs and annotation for timers. */
  function timelineSVG(steps, currentIdx) {
    var W = 600, rowH = 48, topPad = 55;
    var rows = Math.max(steps.length, 1);
    var H = topPad + rows * rowH + 30;
    var sX = 100, rX = 500; // sender / receiver columns

    var svg = '<svg class="tcp-tl-svg" viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="TCP timer timeline">';

    // Column headers
    svg += '<text x="' + sX + '" y="22" text-anchor="middle" class="tcp-tl-header">Sender</text>';
    svg += '<text x="' + rX + '" y="22" text-anchor="middle" class="tcp-tl-header">Receiver</text>';

    // Vertical lifelines
    svg += '<line x1="' + sX + '" y1="30" x2="' + sX + '" y2="' + (H - 10) + '" stroke="' + COL.sender + '" stroke-width="2" stroke-dasharray="4 3"/>';
    svg += '<line x1="' + rX + '" y1="30" x2="' + rX + '" y2="' + (H - 10) + '" stroke="' + COL.receiver + '" stroke-width="2" stroke-dasharray="4 3"/>';

    steps.forEach(function (step, i) {
      var y = topPad + i * rowH;
      var shown = i <= currentIdx;
      var opacity = shown ? '1' : '0.15';
      var active = i === currentIdx;

      if (step.type === 'arrow') {
        var fromX = step.dir === 'right' ? sX : rX;
        var toX = step.dir === 'right' ? rX : sX;
        var color = step.lost ? COL.timeout : (step.dir === 'right' ? COL.data : COL.ack);
        if (step.color) color = step.color;
        var sw = active ? '3' : '2';
        var dash = step.lost ? ' stroke-dasharray="6 4"' : '';

        svg += '<g opacity="' + opacity + '">';
        svg += '<line x1="' + fromX + '" y1="' + y + '" x2="' + toX + '" y2="' + (y + rowH * 0.6) + '" ' +
               'stroke="' + color + '" stroke-width="' + sw + '"' + dash + ' marker-end="url(#tcp-arr)"/>';

        // Label on arrow
        var labelX = (fromX + toX) / 2;
        var labelY = y + rowH * 0.2;
        svg += '<text x="' + labelX + '" y="' + labelY + '" text-anchor="middle" class="tcp-tl-arrow-label" fill="' + color + '">' +
               step.label + '</text>';

        // Loss X mark
        if (step.lost) {
          var midX = (fromX + toX) / 2;
          var midY = y + rowH * 0.3;
          svg += '<text x="' + midX + '" y="' + (midY + 5) + '" text-anchor="middle" fill="' + COL.timeout + '" font-size="18" font-weight="800">✕</text>';
        }
        svg += '</g>';

      } else if (step.type === 'timer') {
        // Timer bar on sender or receiver side
        var barX = step.side === 'sender' ? sX + 8 : rX - 158;
        var barW = 150, barH = 20;
        var barY = y + 8;
        var barColor = step.expired ? COL.timeout : (step.color || COL.accent);
        var fillOpacity = step.expired ? '0.2' : '0.12';

        svg += '<g opacity="' + opacity + '">';
        svg += '<rect x="' + barX + '" y="' + barY + '" width="' + barW + '" height="' + barH + '" rx="3" ' +
               'fill="' + barColor + '" fill-opacity="' + fillOpacity + '" stroke="' + barColor + '" stroke-width="' + (active ? '2' : '1') + '"/>';
        svg += '<text x="' + (barX + barW / 2) + '" y="' + (barY + 14) + '" text-anchor="middle" ' +
               'class="tcp-tl-timer-label" fill="' + barColor + '">' + step.label + '</text>';
        if (step.expired) {
          svg += '<text x="' + (barX + barW + 8) + '" y="' + (barY + 15) + '" fill="' + COL.timeout + '" font-size="11" font-weight="700">EXPIRED!</text>';
        }
        svg += '</g>';

      } else if (step.type === 'note') {
        var noteX = W / 2;
        var noteY = y + 20;
        var noteColor = step.color || COL.faint;
        svg += '<g opacity="' + opacity + '">';
        svg += '<text x="' + noteX + '" y="' + noteY + '" text-anchor="middle" class="tcp-tl-note" fill="' + noteColor + '">' +
               step.label + '</text>';
        svg += '</g>';
      }
    });

    // Arrow marker
    svg += '<defs><marker id="tcp-arr" markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto">' +
           '<path d="M0,1 L0,7 L7,4 z" fill="' + COL.ink + '"/></marker></defs>';

    svg += '</svg>';
    return svg;
  }

  /* ==== RTO bar chart ==== */
  function rtoBarChart(history, currentIdx) {
    if (!history.length) return '';
    var W = 560, H = 160;
    var barW = Math.min(50, (W - 60) / history.length - 4);
    var maxVal = Math.max.apply(null, history.map(function (h) { return h.rto; })) * 1.2;
    if (maxVal === 0) maxVal = 100;

    var svg = '<svg class="tcp-rto-chart" viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="RTO evolution chart">';

    // Y-axis
    svg += '<line x1="50" y1="10" x2="50" y2="' + (H - 25) + '" stroke="' + COL.faint + '" stroke-width="1"/>';
    svg += '<text x="25" y="' + (H / 2) + '" text-anchor="middle" transform="rotate(-90,25,' + (H / 2) + ')" class="tcp-chart-axis">ms</text>';

    // Bars
    history.forEach(function (h, i) {
      if (i > currentIdx) return;
      var x = 55 + i * (barW + 4);
      var barH_rto = (h.rto / maxVal) * (H - 45);
      var barH_srtt = (h.srtt / maxVal) * (H - 45);
      var y_rto = H - 25 - barH_rto;
      var y_srtt = H - 25 - barH_srtt;

      // RTO bar (full)
      svg += '<rect x="' + x + '" y="' + y_rto + '" width="' + barW + '" height="' + barH_rto + '" rx="2" ' +
             'fill="' + COL.accent + '" fill-opacity="0.3" stroke="' + COL.accent + '" stroke-width="1"/>';

      // SRTT bar (inner)
      svg += '<rect x="' + (x + 2) + '" y="' + y_srtt + '" width="' + (barW - 4) + '" height="' + barH_srtt + '" rx="2" ' +
             'fill="' + COL.sender + '" fill-opacity="0.5"/>';

      // Label below
      svg += '<text x="' + (x + barW / 2) + '" y="' + (H - 10) + '" text-anchor="middle" class="tcp-chart-tick">#' + (i + 1) + '</text>';

      // RTO value above
      svg += '<text x="' + (x + barW / 2) + '" y="' + (y_rto - 3) + '" text-anchor="middle" class="tcp-chart-val">' + h.rto.toFixed(0) + '</text>';
    });

    // Legend
    svg += '<rect x="' + (W - 180) + '" y="5" width="10" height="10" rx="2" fill="' + COL.accent + '" fill-opacity="0.3" stroke="' + COL.accent + '"/>';
    svg += '<text x="' + (W - 165) + '" y="14" class="tcp-chart-legend">RTO</text>';
    svg += '<rect x="' + (W - 115) + '" y="5" width="10" height="10" rx="2" fill="' + COL.sender + '" fill-opacity="0.5"/>';
    svg += '<text x="' + (W - 100) + '" y="14" class="tcp-chart-legend">SRTT</text>';

    svg += '</svg>';
    return svg;
  }

  /* ==== Timer mode definitions ==== */

  /* ---- 1. Retransmission Timer ---- */
  function buildRetransmission() {
    var ALPHA = 1 / 8, BETA = 1 / 4;
    var SAMPLES = [100, 110, 95, 105, 320, 115, 100]; // ms — one delayed-ACK spike
    var steps = [];
    var history = [];
    var srtt = null, rttvar = null, rto = null;

    SAMPLES.forEach(function (sample, i) {
      if (srtt === null) {
        srtt = sample; rttvar = sample / 2;
      } else {
        rttvar = (1 - BETA) * rttvar + BETA * Math.abs(srtt - sample);
        srtt = (1 - ALPHA) * srtt + ALPHA * sample;
      }
      rto = Math.max(srtt + 4 * rttvar, 200); // RFC 6298: min RTO = 200ms (some use 1s)

      var spike = sample > 250;
      steps.push({ type: 'arrow', dir: 'right', label: 'SEG #' + (i + 1), text: 'Sender sends segment #' + (i + 1) + '.' });
      steps.push({ type: 'arrow', dir: 'left', label: 'ACK (RTT=' + sample + 'ms)', color: spike ? COL.timeout : COL.ack,
        text: 'ACK arrives. RTT sample = ' + sample + ' ms' + (spike ? ' (delayed ACK — spike!)' : '') +
              '. SRTT=' + srtt.toFixed(1) + ', RTTVAR=' + rttvar.toFixed(1) + ', RTO=' + rto.toFixed(0) + ' ms.',
        level: spike ? 'warning' : undefined
      });
      history.push({ srtt: srtt, rttvar: rttvar, rto: rto, sample: sample });
    });

    // Timeout scenario
    steps.push({ type: 'arrow', dir: 'right', label: 'SEG #8', text: 'Sender sends segment #8 and starts RTO timer (' + rto.toFixed(0) + ' ms).' });
    steps.push({ type: 'timer', side: 'sender', label: 'RTO = ' + rto.toFixed(0) + ' ms', color: COL.timeout, expired: false,
      text: 'RTO timer is running…' });
    steps.push({ type: 'arrow', dir: 'right', label: 'SEG #8 (lost!)', lost: true,
      text: 'The segment is lost in the network — no ACK will arrive.', level: 'error' });
    steps.push({ type: 'timer', side: 'sender', label: 'RTO EXPIRED', color: COL.timeout, expired: true,
      text: 'RTO expired! No ACK received. Timeout triggered.', level: 'error' });

    var backedOff = rto * 2;
    steps.push({ type: 'arrow', dir: 'right', label: 'RETRANSMIT #8', color: COL.timeout,
      text: 'Exponential backoff: RTO doubles to ' + backedOff.toFixed(0) + ' ms. Segment #8 is retransmitted.', level: 'warning' });
    history.push({ srtt: srtt, rttvar: rttvar, rto: backedOff, sample: 0 });

    steps.push({ type: 'arrow', dir: 'left', label: 'ACK ✓', color: COL.ack,
      text: 'ACK received for retransmission. Timer resets to normal SRTT-based RTO.', level: 'success' });

    return {
      steps: steps, history: history,
      desc: 'Retransmission Timer (RTO) — RFC 6298. Tracks round-trip time via SRTT and RTTVAR. If no ACK arrives before the RTO expires, the segment is retransmitted and RTO doubles (exponential backoff).',
      formulas: [
        'SRTT  = (1 − α) × SRTT + α × RTTsample     (α = 1/8)',
        'RTTVAR = (1 − β) × RTTVAR + β × |SRTT − RTTsample|  (β = 1/4)',
        'RTO   = SRTT + 4 × RTTVAR',
        'On timeout: RTO = 2 × RTO  (exponential backoff)'
      ]
    };
  }

  /* ---- 2. Persistence Timer ---- */
  function buildPersistence() {
    var steps = [
      { type: 'arrow', dir: 'right', label: 'DATA (1000 B)', text: 'Sender transmits 1000 bytes of data to receiver.' },
      { type: 'arrow', dir: 'left', label: 'ACK, WIN=0', color: COL.probe, text: 'Receiver\'s buffer is full. It advertises Window = 0 (stop sending).', level: 'warning' },
      { type: 'note', label: '— Sender pauses, starts Persistence Timer —', color: COL.probe, text: 'Sender cannot send data. Persistence timer starts to avoid deadlock.' },
      { type: 'timer', side: 'sender', label: 'Persist Timer (5s)', color: COL.probe, expired: false, text: 'Persistence timer running (typically 5–60s).' },
      { type: 'timer', side: 'sender', label: 'Persist Timer EXPIRED', color: COL.probe, expired: true, text: 'Persistence timer expires — sender must probe the receiver.', level: 'warning' },
      { type: 'arrow', dir: 'right', label: 'PROBE (1 byte)', color: COL.probe, text: 'Sender sends a 1-byte probe segment to trigger a window update.' },
      { type: 'arrow', dir: 'left', label: 'ACK, WIN=0', color: COL.timeout, text: 'Window is still zero — receiver has not freed buffer space. Timer resets with backoff.', level: 'warning' },
      { type: 'timer', side: 'sender', label: 'Persist Timer (10s)', color: COL.probe, expired: false, text: 'Timer doubles (backoff) — waiting again.' },
      { type: 'timer', side: 'sender', label: 'Persist Timer EXPIRED', color: COL.probe, expired: true, text: 'Timer expires again — another probe.', level: 'warning' },
      { type: 'arrow', dir: 'right', label: 'PROBE (1 byte)', color: COL.probe, text: 'Second probe sent.' },
      { type: 'arrow', dir: 'left', label: 'ACK, WIN=4096', color: COL.ack, text: 'Receiver has freed buffer — advertises Window = 4096. Sender can resume!', level: 'success' },
      { type: 'note', label: '— Normal data transfer resumes —', color: COL.ack, text: 'Deadlock avoided. Sender resumes sending data with the new window.' }
    ];
    return {
      steps: steps, history: [],
      desc: 'Persistence Timer — prevents deadlock when the receiver advertises a zero window. The sender periodically sends tiny probe segments to ask "is your window still zero?" until the receiver opens its window again.',
      formulas: [
        'Triggered when: Receiver Window = 0',
        'Action: Send 1-byte probe segment on expiry',
        'Backoff: Timer period doubles each time (5s → 10s → 20s → …, max 60s)',
        'Stops when: Receiver advertises Window > 0'
      ]
    };
  }

  /* ---- 3. Keep-Alive Timer ---- */
  function buildKeepAlive() {
    var steps = [
      { type: 'arrow', dir: 'right', label: 'DATA', text: 'Normal data exchange — connection is active.' },
      { type: 'arrow', dir: 'left', label: 'ACK', color: COL.ack, text: 'Receiver acknowledges. Connection is idle now.' },
      { type: 'note', label: '— Connection goes idle —', color: COL.keepalive, text: 'No data in either direction. Keep-alive timer starts (default: 2 hours).' },
      { type: 'timer', side: 'sender', label: 'Keep-Alive (2 hrs)', color: COL.keepalive, expired: false, text: 'Keep-alive timer running. Waiting for activity…' },
      { type: 'timer', side: 'sender', label: 'Keep-Alive EXPIRED', color: COL.keepalive, expired: true, text: 'Keep-alive timer expires after 2 hours of idle.', level: 'warning' },
      { type: 'arrow', dir: 'right', label: 'KEEP-ALIVE PROBE', color: COL.keepalive, text: 'Sender sends a keep-alive probe (empty or 1-byte segment with old sequence number).' },
      { type: 'arrow', dir: 'left', label: 'ACK (alive!)', color: COL.ack, text: 'Receiver responds — connection is still alive! Timer resets.', level: 'success' },
      { type: 'note', label: '— Timer resets for another 2 hrs —', color: COL.keepalive, text: 'Connection confirmed alive. Keep-alive timer restarts.' },
      { type: 'timer', side: 'sender', label: 'Keep-Alive (2 hrs)', color: COL.keepalive, expired: false, text: 'Second keep-alive cycle begins.' },
      { type: 'timer', side: 'sender', label: 'Keep-Alive EXPIRED', color: COL.keepalive, expired: true, text: 'Timer expires again.', level: 'warning' },
      { type: 'arrow', dir: 'right', label: 'KEEP-ALIVE PROBE', color: COL.keepalive, text: 'Another probe sent — but this time the receiver is dead.' },
      { type: 'arrow', dir: 'right', label: 'PROBE (no response)', lost: true, text: 'No response after up to 10 probes (75s apart). Receiver is unreachable.', level: 'error' },
      { type: 'note', label: '— Connection RESET (RST) —', color: COL.timeout, text: 'After 10 failed probes, sender tears down the connection with RST.', level: 'error' }
    ];
    return {
      steps: steps, history: [],
      desc: 'Keep-Alive Timer — detects dead or half-open connections during long idle periods. If no data is exchanged for 2 hours, the sender sends probes. If 10 consecutive probes fail (75 seconds apart), the connection is assumed dead and reset.',
      formulas: [
        'Idle threshold: 2 hours (tcp_keepalive_time)',
        'Probe interval: 75 seconds (tcp_keepalive_intvl)',
        'Max probes: 10 (tcp_keepalive_probes)',
        'Total detection time: 2h + 10×75s ≈ 2h 12.5m',
        'Action on failure: RST — connection torn down'
      ]
    };
  }

  /* ---- 4. TIME_WAIT Timer ---- */
  function buildTimeWait() {
    var steps = [
      { type: 'arrow', dir: 'right', label: 'FIN', text: 'Sender initiates active close by sending FIN.', color: COL.timewait },
      { type: 'arrow', dir: 'left', label: 'ACK', color: COL.ack, text: 'Receiver acknowledges the FIN.' },
      { type: 'arrow', dir: 'left', label: 'FIN', color: COL.timewait, text: 'Receiver sends its own FIN (ready to close).' },
      { type: 'arrow', dir: 'right', label: 'ACK', color: COL.ack, text: 'Sender acknowledges receiver\'s FIN — enters TIME_WAIT state.' },
      { type: 'note', label: '— Sender enters TIME_WAIT —', color: COL.timewait, text: 'Connection is functionally closed, but sender waits 2×MSL before releasing the port.' },
      { type: 'timer', side: 'sender', label: 'TIME_WAIT (2×MSL = 60s)', color: COL.timewait, expired: false, text: 'TIME_WAIT timer starts. MSL = 30s, so wait = 60s.' },
      { type: 'note', label: 'Purpose 1: Ensure last ACK reaches receiver', color: COL.faint, text: 'If the final ACK was lost, the receiver will retransmit FIN, and the sender can re-ACK.' },
      { type: 'note', label: 'Purpose 2: Let old duplicate segments expire', color: COL.faint, text: 'Prevents delayed segments from a previous connection being accepted by a new connection using the same port.' },
      { type: 'timer', side: 'sender', label: '2×MSL EXPIRED', color: COL.timewait, expired: true, text: 'TIME_WAIT period (2×MSL) has elapsed. Safe to release the port.', level: 'success' },
      { type: 'note', label: '— Port released, connection CLOSED —', color: COL.ack, text: 'All resources freed. The 4-tuple (src IP:port, dst IP:port) can be reused.' }
    ];
    return {
      steps: steps, history: [],
      desc: 'TIME_WAIT Timer — after active close (sending the final ACK), the sender waits 2× Maximum Segment Lifetime before releasing the port. This ensures the final ACK can be retransmitted if lost and prevents stale segments from interfering with new connections.',
      formulas: [
        'Duration: 2 × MSL (Maximum Segment Lifetime)',
        'Typical MSL: 30 seconds → TIME_WAIT = 60 seconds',
        'Linux default: 60s (net.ipv4.tcp_fin_timeout)',
        'The port cannot be reused during TIME_WAIT',
        'State transition: FIN_WAIT_2 → TIME_WAIT → CLOSED'
      ]
    };
  }

  var MODES = {
    retransmission: { label: 'Retransmission (RTO)', build: buildRetransmission },
    persistence:    { label: 'Persistence',          build: buildPersistence },
    keepalive:      { label: 'Keep-Alive',           build: buildKeepAlive },
    timewait:       { label: 'TIME_WAIT (2×MSL)',    build: buildTimeWait }
  };
  var MODE_KEYS = ['retransmission', 'persistence', 'keepalive', 'timewait'];

  /* ==== Main simulation ==== */
  NetSim.SimRegistry.register('tcp-timers', function factory(ctx) {
    var mode = 'retransmission';
    var sim = null;
    var index = -1;
    var timer = null;
    var host = null;
    var chartHost = null;

    function rebuild() {
      stop();
      index = -1;
      sim = MODES[mode].build();
      draw();
      renderParams();
      ctx.log('TCP Timer: ' + MODES[mode].label + ' — ' + sim.steps.length + ' steps. ' + sim.desc.split('.')[0] + '.');
    }

    function draw() {
      var svgHtml = timelineSVG(sim.steps, index);

      // Info section
      var info = '<div class="tcp-timer-info">';
      info += '<h4 class="tcp-timer-info-title">' + MODES[mode].label + '</h4>';
      info += '<p class="tcp-timer-desc">' + sim.desc + '</p>';
      info += '<div class="tcp-timer-formulas"><h5>Key Parameters</h5><ul>';
      sim.formulas.forEach(function (f) { info += '<li><code>' + f + '</code></li>'; });
      info += '</ul></div></div>';

      host.innerHTML = svgHtml + info;

      // RTO chart for retransmission mode
      if (mode === 'retransmission' && sim.history.length) {
        var chartIdx = Math.min(Math.floor(index / 2), sim.history.length - 1);
        chartHost.innerHTML = '<h4 class="tcp-chart-title">RTO Evolution</h4>' + rtoBarChart(sim.history, chartIdx);
      } else {
        chartHost.innerHTML = '';
      }

      // Metrics
      var step = index >= 0 && sim.steps[index] ? sim.steps[index] : null;
      var metrics = [{ label: 'Timer Type', value: MODES[mode].label }];

      if (mode === 'retransmission' && sim.history.length) {
        var hIdx = Math.min(Math.floor(Math.max(0, index) / 2), sim.history.length - 1);
        var h = sim.history[hIdx];
        metrics.push({ label: 'SRTT', value: h.srtt.toFixed(1) + ' ms' });
        metrics.push({ label: 'RTTVAR', value: h.rttvar.toFixed(1) + ' ms' });
        metrics.push({ label: 'RTO', value: h.rto.toFixed(0) + ' ms' });
        metrics.push({ label: 'Formula', value: 'RTO = SRTT + 4×RTTVAR (RFC 6298)' });
      } else if (mode === 'persistence') {
        metrics.push({ label: 'Trigger', value: 'Receiver Window = 0' });
        metrics.push({ label: 'Probe size', value: '1 byte' });
        metrics.push({ label: 'Backoff', value: 'Doubles each time (max 60s)' });
      } else if (mode === 'keepalive') {
        metrics.push({ label: 'Idle threshold', value: '2 hours' });
        metrics.push({ label: 'Probe interval', value: '75 seconds' });
        metrics.push({ label: 'Max probes', value: '10' });
        metrics.push({ label: 'Detection time', value: '≈ 2h 12.5m' });
      } else if (mode === 'timewait') {
        metrics.push({ label: 'Duration', value: '2 × MSL = 60s' });
        metrics.push({ label: 'MSL', value: '30 seconds' });
        metrics.push({ label: 'Purpose', value: 'Ensure last ACK delivery + expire old dupes' });
      }

      metrics.push({ label: 'Step', value: (index + 1) + ' / ' + sim.steps.length });
      ctx.setMetrics(metrics);
    }

    function renderParams() {
      ctx.params.hidden = false;
      ctx.params.innerHTML =
        '<fieldset class="switch-mode-group" role="radiogroup" aria-label="TCP Timer Type">' +
        '<legend class="section-label" style="margin:0 0 0.5rem;border:none;padding:0;">Timer Type</legend>' +
        MODE_KEYS.map(function (k) {
          return '<label class="switch-mode-option ' + (k === mode ? 'is-checked' : '') + '">' +
            '<input type="radio" name="tcpTimerMode" value="' + k + '" ' + (k === mode ? 'checked' : '') + '> ' +
            MODES[k].label + '</label>';
        }).join('') +
        '</fieldset>';

      ctx.params.querySelectorAll('input[name="tcpTimerMode"]').forEach(function (r) {
        r.addEventListener('change', function () { mode = r.value; rebuild(); });
      });
    }

    function stop() { if (timer) { NetSim.SimTiming.clearInterval(timer); timer = null; } }

    function advance() {
      if (index >= sim.steps.length - 1) { stop(); return; }
      index++;
      var s = sim.steps[index];
      ctx.log(s.text, s.level);
      draw();
    }

    return {
      initialize: function () {
        ctx.canvas.classList.add('net-canvas');
        ctx.canvas.innerHTML = '<div class="tcp-timers-mount"></div><div class="tcp-chart-mount"></div>';
        host = ctx.canvas.querySelector('.tcp-timers-mount');
        chartHost = ctx.canvas.querySelector('.tcp-chart-mount');
        rebuild();
      },
      start: function () {
        if (timer) return;
        timer = NetSim.SimTiming.setInterval(function () {
          if (index >= sim.steps.length - 1) { stop(); return; }
          advance();
        }, 700);
      },
      pause: function () { stop(); },
      step: function () { stop(); advance(); },
      reset: function () { rebuild(); },
      destroy: function () { stop(); }
    };
  });

})(window.NetSim = window.NetSim || {});
