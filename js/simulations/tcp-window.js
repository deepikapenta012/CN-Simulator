/* ==========================================================================
   NetSim — simulations/tcp-window.js
   Interactive TCP window management simulation showing:
     - Sender ↔ Receiver timeline with data/ACK arrows
     - Receiver buffer visualization (filling / draining)
     - Sender window (usable window = min(cwnd, rwnd))
     - rwnd evolution bar chart
     - Zero-window → probe → window reopen flow
   ========================================================================== */

(function (NetSim) {
  'use strict';

  var BUFFER_CAP = 10; // receiver buffer in segments
  var TOTAL_SEGS = 16; // total segments to transfer

  /* ---- Build the step-by-step simulation ---- */
  function buildSteps() {
    // App read schedule: segments the application reads from receiver buffer each round
    // Deliberately slow early, then stall (0), then catch up
    var appReads = [1, 1, 2, 0, 0, 0, 1, 3, 2, 3, 2, 2];
    var steps = [];
    var bufUsed = 0;    // segments in receiver buffer (unread)
    var totalSent = 0;  // total segments sent so far
    var rwndHistory = [];
    var round = 0;

    for (var r = 0; r < appReads.length && totalSent < TOTAL_SEGS; r++) {
      round = r + 1;
      var rwnd = BUFFER_CAP - bufUsed;

      if (rwnd === 0) {
        // Zero window
        steps.push({
          type: 'state', round: round,
          text: 'Round ' + round + ': Receiver advertises rwnd = 0 — buffer full! Sender MUST stop.',
          level: 'warning', bufUsed: bufUsed, rwnd: 0, sent: totalSent, zeroWin: true
        });
        rwndHistory.push({ round: round, rwnd: 0, event: 'zero' });

        // Probe
        steps.push({
          type: 'arrow', dir: 'right', label: 'PROBE (1 byte)',
          text: 'Sender sends a 1-byte window probe to check if receiver has freed space.',
          level: 'info', bufUsed: bufUsed, rwnd: 0, sent: totalSent, probe: true
        });

        // App reads to free space
        var readNow = Math.min(appReads[r], bufUsed);
        if (readNow > 0) {
          bufUsed -= readNow;
          rwnd = BUFFER_CAP - bufUsed;
          steps.push({
            type: 'app-read', round: round,
            text: 'Application reads ' + readNow + ' segment(s). Buffer: ' + bufUsed + '/' + BUFFER_CAP + '. Window reopens to ' + rwnd + '.',
            level: 'success', bufUsed: bufUsed, rwnd: rwnd, sent: totalSent, readAmt: readNow
          });
          rwndHistory.push({ round: round, rwnd: rwnd, event: 'reopen' });
        } else {
          steps.push({
            type: 'arrow', dir: 'left', label: 'ACK, WIN=0',
            text: 'Receiver responds: window still 0 — application hasn\'t read any data yet.',
            level: 'warning', bufUsed: bufUsed, rwnd: 0, sent: totalSent
          });
        }
        continue;
      }

      // Normal send
      var toSend = Math.min(rwnd, TOTAL_SEGS - totalSent, 3); // sender sends up to 3 per round
      if (toSend <= 0) continue;

      var seqStart = totalSent + 1;
      var seqEnd = totalSent + toSend;
      totalSent += toSend;
      bufUsed += toSend;
      var newRwnd = BUFFER_CAP - bufUsed;

      steps.push({
        type: 'arrow', dir: 'right',
        label: 'SEG ' + seqStart + (toSend > 1 ? '–' + seqEnd : ''),
        text: 'Round ' + round + ': Sender transmits ' + toSend + ' segment(s) [' + seqStart + '–' + seqEnd + ']. ' +
              'Receiver buffer: ' + bufUsed + '/' + BUFFER_CAP + '.',
        level: 'normal', bufUsed: bufUsed, rwnd: newRwnd, sent: totalSent
      });

      steps.push({
        type: 'arrow', dir: 'left',
        label: 'ACK ' + seqEnd + ', WIN=' + newRwnd,
        text: 'Receiver ACKs through segment ' + seqEnd + '. Advertised window = ' + newRwnd + '.',
        level: newRwnd <= 2 ? 'warning' : undefined,
        bufUsed: bufUsed, rwnd: newRwnd, sent: totalSent
      });
      rwndHistory.push({ round: round, rwnd: newRwnd, event: newRwnd === 0 ? 'zero' : newRwnd <= 2 ? 'low' : 'ok' });

      // App reads
      var readAmt = Math.min(appReads[r], bufUsed);
      if (readAmt > 0) {
        bufUsed -= readAmt;
        var rwndAfter = BUFFER_CAP - bufUsed;
        steps.push({
          type: 'app-read', round: round,
          text: 'Application reads ' + readAmt + ' segment(s). Buffer: ' + bufUsed + '/' + BUFFER_CAP + '. rwnd → ' + rwndAfter + '.',
          level: 'success', bufUsed: bufUsed, rwnd: rwndAfter, sent: totalSent, readAmt: readAmt
        });
        if (rwndAfter !== newRwnd) {
          rwndHistory.push({ round: round, rwnd: rwndAfter, event: 'read' });
        }
      }
    }

    // Drain remaining
    while (bufUsed > 0) {
      round++;
      var drain = Math.min(3, bufUsed);
      bufUsed -= drain;
      steps.push({
        type: 'app-read', round: round,
        text: 'Round ' + round + ': Application reads ' + drain + ' final segment(s). Buffer: ' + bufUsed + '/' + BUFFER_CAP + '.',
        level: 'success', bufUsed: bufUsed, rwnd: BUFFER_CAP - bufUsed, sent: totalSent, readAmt: drain
      });
    }

    steps.push({
      type: 'state', round: round,
      text: 'All ' + TOTAL_SEGS + ' segments delivered and read by the application. Transfer complete!',
      level: 'success', bufUsed: 0, rwnd: BUFFER_CAP, sent: totalSent, done: true
    });

    return { steps: steps, rwndHistory: rwndHistory };
  }

  /* ---- SVG: Sender ↔ Receiver timeline ---- */
  function renderTimeline(steps, currentIdx) {
    var W = 600, rowH = 44, topPad = 55;
    var visibleSteps = steps.slice(0, currentIdx + 1);
    var rows = Math.max(visibleSteps.length, 1);
    var H = topPad + rows * rowH + 20;
    var sX = 100, rX = 500;

    var svg = '<svg class="tcpw-tl-svg" viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="TCP window timeline">';

    // Headers
    svg += '<text x="' + sX + '" y="22" text-anchor="middle" class="tcpw-tl-header">Sender</text>';
    svg += '<text x="' + rX + '" y="22" text-anchor="middle" class="tcpw-tl-header">Receiver</text>';

    // Lifelines
    svg += '<line x1="' + sX + '" y1="30" x2="' + sX + '" y2="' + (H - 5) + '" stroke="#1565c0" stroke-width="2" stroke-dasharray="4 3"/>';
    svg += '<line x1="' + rX + '" y1="30" x2="' + rX + '" y2="' + (H - 5) + '" stroke="#2e7d32" stroke-width="2" stroke-dasharray="4 3"/>';

    visibleSteps.forEach(function (step, i) {
      var y = topPad + i * rowH;
      var active = i === currentIdx;
      var sw = active ? '2.5' : '1.5';

      if (step.type === 'arrow') {
        var fromX = step.dir === 'right' ? sX : rX;
        var toX = step.dir === 'right' ? rX : sX;
        var color = step.dir === 'right' ? '#1565c0' : '#2e7d32';
        if (step.probe) color = '#e65100';
        if (step.rwnd === 0 && step.dir === 'left') color = '#d32f2f';

        svg += '<line x1="' + fromX + '" y1="' + y + '" x2="' + toX + '" y2="' + (y + rowH * 0.55) + '" ' +
               'stroke="' + color + '" stroke-width="' + sw + '" marker-end="url(#tcpw-arr)"/>';
        var labelX = (fromX + toX) / 2;
        svg += '<text x="' + labelX + '" y="' + (y - 2) + '" text-anchor="middle" class="tcpw-arrow-label" fill="' + color + '">' +
               step.label + '</text>';

      } else if (step.type === 'state') {
        var noteColor = step.zeroWin ? '#d32f2f' : step.done ? '#2e7d32' : 'var(--ink-faint)';
        svg += '<rect x="' + (sX + 20) + '" y="' + (y + 2) + '" width="' + (rX - sX - 40) + '" height="24" rx="4" ' +
               'fill="' + noteColor + '" fill-opacity="0.08" stroke="' + noteColor + '" stroke-width="1"/>';
        // Truncate label to fit
        var stateLabel = step.zeroWin ? 'rwnd = 0 — SENDER BLOCKED' : step.done ? '✓ TRANSFER COMPLETE' : 'State';
        svg += '<text x="' + ((sX + rX) / 2) + '" y="' + (y + 18) + '" text-anchor="middle" ' +
               'class="tcpw-state-label" fill="' + noteColor + '">' + stateLabel + '</text>';

      } else if (step.type === 'app-read') {
        svg += '<text x="' + (rX + 15) + '" y="' + (y + 15) + '" class="tcpw-read-label">App reads ' + step.readAmt + '</text>';
      }
    });

    svg += '<defs><marker id="tcpw-arr" markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto">' +
           '<path d="M0,1 L0,7 L7,4 z" fill="var(--ink)"/></marker></defs>';
    svg += '</svg>';
    return svg;
  }

  /* ---- SVG: Receiver buffer visualization ---- */
  function renderBuffer(bufUsed) {
    var W = 500, H = 70;
    var slotW = (W - 40) / BUFFER_CAP;
    var svg = '<svg class="tcpw-buf-svg" viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="Receiver buffer">';

    svg += '<text x="' + (W / 2) + '" y="14" text-anchor="middle" class="tcpw-buf-title">' +
           'Receiver Buffer (' + bufUsed + '/' + BUFFER_CAP + ' used)</text>';

    for (var i = 0; i < BUFFER_CAP; i++) {
      var x = 20 + i * slotW;
      var filled = i < bufUsed;
      var fillColor = filled ? (bufUsed >= BUFFER_CAP ? '#d32f2f' : bufUsed >= BUFFER_CAP - 2 ? '#e65100' : '#1565c0') : 'var(--paper-raised)';
      var fillOp = filled ? '0.65' : '1';
      svg += '<rect x="' + x + '" y="22" width="' + (slotW - 2) + '" height="30" rx="3" ' +
             'fill="' + fillColor + '" fill-opacity="' + fillOp + '" stroke="var(--line-strong)" stroke-width="1"/>';
      if (filled) {
        svg += '<text x="' + (x + slotW / 2 - 1) + '" y="42" text-anchor="middle" fill="#fff" font-size="10" font-weight="700">▮</text>';
      }
    }

    // rwnd indicator
    var rwnd = BUFFER_CAP - bufUsed;
    var rwndStart = 20 + bufUsed * slotW;
    var rwndW = rwnd * slotW;
    if (rwnd > 0) {
      svg += '<line x1="' + rwndStart + '" y1="58" x2="' + (rwndStart + rwndW - 2) + '" y2="58" ' +
             'stroke="#2e7d32" stroke-width="2"/>';
      svg += '<text x="' + (rwndStart + rwndW / 2) + '" y="68" text-anchor="middle" fill="#2e7d32" font-size="10" font-weight="600">' +
             'rwnd = ' + rwnd + '</text>';
    } else {
      svg += '<text x="' + (W / 2) + '" y="66" text-anchor="middle" fill="#d32f2f" font-size="11" font-weight="700">rwnd = 0 (FULL)</text>';
    }

    svg += '</svg>';
    return svg;
  }

  /* ---- SVG: rwnd evolution chart ---- */
  function renderRwndChart(history, maxRound) {
    if (!history.length) return '';
    var W = 520, H = 130;
    var padL = 40, padR = 20, padT = 20, padB = 25;
    var plotW = W - padL - padR;
    var plotH = H - padT - padB;
    var maxR = Math.max.apply(null, history.map(function (h) { return h.round; }));
    var xScale = plotW / Math.max(maxR, 1);

    var svg = '<svg class="tcpw-rwnd-chart" viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="rwnd evolution">';

    // Axes
    svg += '<line x1="' + padL + '" y1="' + padT + '" x2="' + padL + '" y2="' + (H - padB) + '" stroke="var(--ink-faint)" stroke-width="1"/>';
    svg += '<line x1="' + padL + '" y1="' + (H - padB) + '" x2="' + (W - padR) + '" y2="' + (H - padB) + '" stroke="var(--ink-faint)" stroke-width="1"/>';
    svg += '<text x="10" y="' + (H / 2) + '" transform="rotate(-90,10,' + (H / 2) + ')" text-anchor="middle" class="tcpw-chart-axis">rwnd</text>';
    svg += '<text x="' + (W / 2) + '" y="' + (H - 3) + '" text-anchor="middle" class="tcpw-chart-axis">Round</text>';

    // Zero-window danger line
    svg += '<line x1="' + padL + '" y1="' + (H - padB) + '" x2="' + (W - padR) + '" y2="' + (H - padB) + '" ' +
           'stroke="#d32f2f" stroke-width="1" stroke-dasharray="4 3" opacity="0.4"/>';
    svg += '<text x="' + (W - padR - 2) + '" y="' + (H - padB - 3) + '" text-anchor="end" fill="#d32f2f" font-size="8" opacity="0.6">zero</text>';

    // Plot points + line
    var points = [];
    history.forEach(function (h) {
      if (h.round > maxRound) return;
      var x = padL + h.round * xScale;
      var y = (H - padB) - (h.rwnd / BUFFER_CAP) * plotH;
      points.push({ x: x, y: y, rwnd: h.rwnd, event: h.event });
    });

    if (points.length > 1) {
      var pathD = 'M' + points.map(function (p) { return p.x + ',' + p.y; }).join(' L');
      svg += '<path d="' + pathD + '" fill="none" stroke="var(--accent)" stroke-width="2"/>';
    }
    points.forEach(function (p) {
      var color = p.event === 'zero' ? '#d32f2f' : p.event === 'low' ? '#e65100' : 'var(--accent)';
      svg += '<circle cx="' + p.x + '" cy="' + p.y + '" r="4" fill="' + color + '" stroke="#fff" stroke-width="1.5"/>';
      svg += '<text x="' + p.x + '" y="' + (p.y - 7) + '" text-anchor="middle" fill="' + color + '" font-size="9" font-weight="600">' + p.rwnd + '</text>';
    });

    svg += '</svg>';
    return svg;
  }

  /* ---- Sender window strip ---- */
  function renderSenderWindow(sent, rwnd) {
    var effective = Math.min(rwnd, 3); // sender also limited by own pace
    var nextSeq = sent + 1;
    var html = '<div class="tcpw-sender-win">';
    html += '<span class="tcpw-sw-label">Sender window:</span>';

    // Already sent (gray)
    for (var s = Math.max(1, sent - 4); s <= sent; s++) {
      html += '<span class="tcpw-sw-seg tcpw-sw-sent">' + s + '</span>';
    }
    // Usable window (green)
    for (var u = 0; u < effective && nextSeq + u <= TOTAL_SEGS; u++) {
      html += '<span class="tcpw-sw-seg tcpw-sw-usable">' + (nextSeq + u) + '</span>';
    }
    // Not yet usable (faint)
    for (var n = effective; n < effective + 3 && nextSeq + n <= TOTAL_SEGS; n++) {
      html += '<span class="tcpw-sw-seg tcpw-sw-blocked">' + (nextSeq + n) + '</span>';
    }

    if (rwnd === 0) {
      html += '<span class="tcpw-sw-zero">← blocked (rwnd = 0)</span>';
    }
    html += '</div>';
    return html;
  }

  /* ==== Main simulation ==== */
  NetSim.SimRegistry.register('tcp-window', function factory(ctx) {
    var sim = null;
    var index = -1;
    var timer = null;
    var host = null;
    var chartHost = null;

    function rebuild() {
      stop();
      index = -1;
      sim = buildSteps();
      draw();
      ctx.params.hidden = true;
      ctx.log('Ready — sender will transmit ' + TOTAL_SEGS + ' segments. Watch the receiver buffer fill and the window shrink.');
    }

    function draw() {
      var step = index >= 0 && sim.steps[index] ? sim.steps[index] : null;
      var bufUsed = step ? step.bufUsed : 0;
      var rwnd = step ? step.rwnd : BUFFER_CAP;
      var sent = step ? step.sent : 0;

      var tlHtml = renderTimeline(sim.steps, index);
      var bufHtml = renderBuffer(bufUsed);
      var swHtml = renderSenderWindow(sent, rwnd);

      host.innerHTML = bufHtml + swHtml + tlHtml;

      // rwnd chart
      var maxRound = step ? step.round || 0 : 0;
      chartHost.innerHTML = sim.rwndHistory.length
        ? '<h4 class="tcpw-chart-title">Advertised Window (rwnd) Over Time</h4>' + renderRwndChart(sim.rwndHistory, maxRound)
        : '';

      // Metrics
      var zeroEvents = sim.steps.slice(0, index + 1).filter(function (s) { return s.zeroWin; }).length;
      ctx.setMetrics([
        { label: 'Buffer Capacity', value: BUFFER_CAP + ' segments' },
        { label: 'Buffer Used', value: bufUsed + ' / ' + BUFFER_CAP },
        { label: 'Advertised rwnd', value: String(rwnd) + (rwnd === 0 ? ' ⚠ ZERO' : '') },
        { label: 'Segments Sent', value: sent + ' / ' + TOTAL_SEGS },
        { label: 'Zero-Window Events', value: String(zeroEvents) },
        { label: 'Effective Window', value: 'min(cwnd, rwnd) — sender can send ' + Math.min(rwnd, 3) }
      ]);
    }

    function stop() { if (timer) { NetSim.SimTiming.clearInterval(timer); timer = null; } }

    function advance() {
      if (index >= sim.steps.length - 1) { stop(); return; }
      index++;
      var s = sim.steps[index];
      ctx.log(s.text, s.level === 'normal' ? undefined : s.level);
      draw();
    }

    return {
      initialize: function () {
        ctx.canvas.classList.add('net-canvas');
        ctx.canvas.innerHTML = '<div class="tcpw-mount"></div><div class="tcpw-chart-mount"></div>';
        host = ctx.canvas.querySelector('.tcpw-mount');
        chartHost = ctx.canvas.querySelector('.tcpw-chart-mount');
        rebuild();
      },
      start: function () {
        if (timer) return;
        timer = NetSim.SimTiming.setInterval(function () {
          if (index >= sim.steps.length - 1) { stop(); return; }
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
