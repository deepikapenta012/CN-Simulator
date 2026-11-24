/* ==========================================================================
   NetSim — simulations/qos.js
   Interactive QoS simulation: packets from three traffic classes (Voice,
   Video, Bulk) arrive at a router and are scheduled across a single
   output link using one of three algorithms — Strict Priority, Weighted
   Fair Queuing (WFQ), or Round Robin. Visual queues, a scheduler box, and
   an output link show how each algorithm treats different classes.
   ========================================================================== */

(function (NetSim) {
  'use strict';

  /* ---- Traffic classes ---- */
  const CLASSES = [
    { id: 'voice', label: 'Voice',     dscp: 'EF (46)',   color: '#d32f2f', bg: '#ffcdd2', priority: 3, wfqWeight: 5 },
    { id: 'video', label: 'Video',     dscp: 'AF41 (34)', color: '#1565c0', bg: '#bbdefb', priority: 2, wfqWeight: 3 },
    { id: 'bulk',  label: 'Bulk Data', dscp: 'BE (0)',    color: '#558b2f', bg: '#dcedc8', priority: 1, wfqWeight: 1 }
  ];

  function cls(id) { return CLASSES.find(function (c) { return c.id === id; }); }

  /* ---- Packet arrivals (tick, class) ---- */
  function generateArrivals() {
    var arr = [];
    var id = 0;
    // Burst of bulk at start to create contention
    for (var b = 0; b < 4; b++) arr.push({ t: 0, cls: 'bulk',  id: ++id });
    arr.push({ t: 0, cls: 'video', id: ++id });
    arr.push({ t: 1, cls: 'voice', id: ++id });
    arr.push({ t: 1, cls: 'video', id: ++id });
    arr.push({ t: 2, cls: 'bulk',  id: ++id });
    arr.push({ t: 2, cls: 'voice', id: ++id });
    arr.push({ t: 3, cls: 'video', id: ++id });
    arr.push({ t: 3, cls: 'bulk',  id: ++id });
    arr.push({ t: 4, cls: 'voice', id: ++id });
    arr.push({ t: 5, cls: 'bulk',  id: ++id });
    arr.push({ t: 5, cls: 'video', id: ++id });
    arr.push({ t: 6, cls: 'bulk',  id: ++id });
    arr.push({ t: 7, cls: 'voice', id: ++id });
    arr.push({ t: 7, cls: 'bulk',  id: ++id });
    arr.push({ t: 8, cls: 'video', id: ++id });
    arr.push({ t: 9, cls: 'bulk',  id: ++id });
    return arr;
  }

  /* ---- Scheduling algorithms ---- */
  function scheduleStrictPriority(queues) {
    for (var p = 3; p >= 1; p--) {
      var c = CLASSES.find(function (cl) { return cl.priority === p; });
      if (queues[c.id].length) return queues[c.id].shift();
    }
    return null;
  }

  function scheduleWFQ(queues, wfqCounters) {
    // Serve proportional to weight: pick queue with highest remaining credit
    var best = null, bestCredit = -1;
    CLASSES.forEach(function (c) {
      if (queues[c.id].length && wfqCounters[c.id] > bestCredit) {
        best = c.id;
        bestCredit = wfqCounters[c.id];
      }
    });
    if (!best) return null;
    wfqCounters[best] -= 1;
    // Refill credits if all are zero or negative
    var allEmpty = CLASSES.every(function (c) { return wfqCounters[c.id] <= 0 || !queues[c.id].length; });
    if (allEmpty) CLASSES.forEach(function (c) { wfqCounters[c.id] += c.wfqWeight; });
    return queues[best].shift();
  }

  function scheduleRoundRobin(queues, rrIndex) {
    for (var attempt = 0; attempt < CLASSES.length; attempt++) {
      var c = CLASSES[(rrIndex.val + attempt) % CLASSES.length];
      if (queues[c.id].length) {
        rrIndex.val = (CLASSES.indexOf(c) + 1) % CLASSES.length;
        return queues[c.id].shift();
      }
    }
    return null;
  }

  /* ---- Build simulation events ---- */
  function buildEvents(algorithm) {
    var arrivals = generateArrivals();
    var queues = { voice: [], video: [], bulk: [] };
    var wfqCounters = {};
    CLASSES.forEach(function (c) { wfqCounters[c.id] = c.wfqWeight; });
    var rrIndex = { val: 0 };
    var events = [];
    var served = [];
    var tick = 0;
    var maxTick = 30;

    while (tick < maxTick) {
      // Enqueue arrivals for this tick
      var newArrivals = arrivals.filter(function (a) { return a.t === tick; });
      newArrivals.forEach(function (a) {
        queues[a.cls].push({ id: a.id, cls: a.cls, arrived: tick });
      });

      var totalQueued = queues.voice.length + queues.video.length + queues.bulk.length;
      if (totalQueued === 0 && !newArrivals.length && arrivals.every(function (a) { return a.t < tick; })) break;

      // Schedule one packet
      var pkt = null;
      if (algorithm === 'strict') pkt = scheduleStrictPriority(queues);
      else if (algorithm === 'wfq') pkt = scheduleWFQ(queues, wfqCounters);
      else pkt = scheduleRoundRobin(queues, rrIndex);

      var snapshot = {
        voice: queues.voice.slice(),
        video: queues.video.slice(),
        bulk:  queues.bulk.slice()
      };

      if (pkt) {
        pkt.servedAt = tick;
        pkt.wait = tick - pkt.arrived;
        served.push(pkt);
        events.push({
          tick: tick,
          served: pkt,
          queues: snapshot,
          arrivedThisTick: newArrivals,
          text: 'Tick ' + tick + ': ' + (newArrivals.length ? newArrivals.length + ' packet(s) arrived. ' : '') +
                'Scheduler serves ' + cls(pkt.cls).label + ' #' + pkt.id +
                ' (waited ' + pkt.wait + ' tick' + (pkt.wait !== 1 ? 's' : '') + ').'
        });
      } else if (newArrivals.length) {
        events.push({
          tick: tick,
          served: null,
          queues: snapshot,
          arrivedThisTick: newArrivals,
          text: 'Tick ' + tick + ': ' + newArrivals.length + ' packet(s) arrived, queued.'
        });
      }
      tick++;
    }

    // Compute stats
    var stats = {};
    CLASSES.forEach(function (c) {
      var pkts = served.filter(function (p) { return p.cls === c.id; });
      var waits = pkts.map(function (p) { return p.wait; });
      stats[c.id] = {
        count: pkts.length,
        avgWait: waits.length ? (waits.reduce(function (a, b) { return a + b; }, 0) / waits.length) : 0,
        maxWait: waits.length ? Math.max.apply(null, waits) : 0
      };
    });

    return { events: events, served: served, stats: stats };
  }

  /* ---- SVG queue visualization ---- */
  function renderQueuesSVG(snapshot, servedPkt, currentTick) {
    var W = 740, H = 300;
    var svg = '<svg class="qos-svg" viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="QoS queue visualization">';

    // Three queue rows
    var queueX = 30, queueW = 320, rowH = 70;
    var schedulerX = 420, schedulerW = 100, schedulerH = 180;
    var outputX = 580;

    CLASSES.forEach(function (c, i) {
      var y = 30 + i * (rowH + 15);
      var q = snapshot[c.id] || [];

      // Queue label
      svg += '<text x="' + queueX + '" y="' + (y - 5) + '" class="qos-q-label" fill="' + c.color + '">' +
             c.label + ' Queue (DSCP: ' + c.dscp + ')</text>';

      // Queue box
      svg += '<rect x="' + queueX + '" y="' + y + '" width="' + queueW + '" height="' + (rowH - 15) + '" rx="4" ' +
             'fill="none" stroke="' + c.color + '" stroke-width="1.5" stroke-dasharray="4 2"/>';

      // Packets in queue
      var pktW = 38, pktH = rowH - 25, pktGap = 4;
      q.forEach(function (pkt, j) {
        var px = queueX + 5 + j * (pktW + pktGap);
        var py = y + 5;
        if (px + pktW > queueX + queueW - 5) return; // overflow
        svg += '<rect x="' + px + '" y="' + py + '" width="' + pktW + '" height="' + pktH + '" rx="3" ' +
               'fill="' + c.bg + '" stroke="' + c.color + '" stroke-width="1.2"/>';
        svg += '<text x="' + (px + pktW / 2) + '" y="' + (py + pktH / 2 + 4) + '" text-anchor="middle" ' +
               'class="qos-pkt-id" fill="' + c.color + '">#' + pkt.id + '</text>';
      });

      // Queue count badge
      svg += '<text x="' + (queueX + queueW + 8) + '" y="' + (y + rowH / 2 - 2) + '" class="qos-q-count" fill="' + c.color + '">' +
             q.length + '</text>';

      // Arrow from queue to scheduler
      var arrowY = y + (rowH - 15) / 2;
      svg += '<line x1="' + (queueX + queueW + 25) + '" y1="' + arrowY + '" x2="' + schedulerX + '" y2="' +
             (30 + schedulerH / 2) + '" stroke="var(--ink-faint)" stroke-width="1" stroke-dasharray="3 2"/>';
    });

    // Scheduler box
    var sy = 30;
    svg += '<rect x="' + schedulerX + '" y="' + sy + '" width="' + schedulerW + '" height="' + schedulerH + '" rx="8" ' +
           'fill="var(--paper-raised)" stroke="var(--ink)" stroke-width="2"/>';
    svg += '<text x="' + (schedulerX + schedulerW / 2) + '" y="' + (sy + schedulerH / 2 - 8) + '" text-anchor="middle" ' +
           'class="qos-sched-label">Scheduler</text>';
    svg += '<text x="' + (schedulerX + schedulerW / 2) + '" y="' + (sy + schedulerH / 2 + 10) + '" text-anchor="middle" ' +
           'class="qos-sched-tick">Tick ' + currentTick + '</text>';

    // Output arrow
    var outY = sy + schedulerH / 2;
    svg += '<line x1="' + (schedulerX + schedulerW) + '" y1="' + outY + '" x2="' + (outputX - 5) + '" y2="' + outY + '" ' +
           'stroke="var(--ink)" stroke-width="2" marker-end="url(#qos-arrow)"/>';
    svg += '<text x="' + (outputX + 10) + '" y="' + (outY - 15) + '" class="qos-out-label">Output</text>';
    svg += '<text x="' + (outputX + 10) + '" y="' + (outY - 2) + '" class="qos-out-label">Link</text>';

    // Currently served packet
    if (servedPkt) {
      var sc = cls(servedPkt.cls);
      svg += '<rect x="' + outputX + '" y="' + (outY + 8) + '" width="70" height="34" rx="5" ' +
             'fill="' + sc.bg + '" stroke="' + sc.color + '" stroke-width="2"/>';
      svg += '<text x="' + (outputX + 35) + '" y="' + (outY + 30) + '" text-anchor="middle" ' +
             'class="qos-pkt-served" fill="' + sc.color + '">' + sc.label + ' #' + servedPkt.id + '</text>';
    }

    // Arrow marker
    svg += '<defs><marker id="qos-arrow" markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto">' +
           '<path d="M0,0 L0,8 L7,4 z" fill="var(--ink)"/></marker></defs>';

    svg += '</svg>';
    return svg;
  }

  /* ---- Gantt-style service timeline ---- */
  function renderTimeline(served, totalTicks) {
    if (!served.length) return '';
    var html = '<div class="qos-timeline">';
    html += '<h4 class="qos-tl-title">Service Timeline</h4>';
    html += '<div class="qos-tl-grid">';

    // Header row with tick numbers
    html += '<div class="qos-tl-row qos-tl-header"><span class="qos-tl-label">Tick</span>';
    for (var t = 0; t < totalTicks; t++) {
      html += '<span class="qos-tl-cell qos-tl-hcell">' + t + '</span>';
    }
    html += '</div>';

    // One row per class
    CLASSES.forEach(function (c) {
      html += '<div class="qos-tl-row"><span class="qos-tl-label" style="color:' + c.color + '">' + c.label + '</span>';
      for (var t = 0; t < totalTicks; t++) {
        var pkt = served.find(function (p) { return p.cls === c.id && p.servedAt === t; });
        if (pkt) {
          html += '<span class="qos-tl-cell qos-tl-active" style="background:' + c.bg + ';border-color:' + c.color + ';color:' + c.color + '">#' + pkt.id + '</span>';
        } else {
          html += '<span class="qos-tl-cell"></span>';
        }
      }
      html += '</div>';
    });

    html += '</div></div>';
    return html;
  }

  /* ---- Stats table ---- */
  function renderStats(stats) {
    var html = '<div class="qos-stats">';
    html += '<h4 class="qos-stats-title">Per-Class Statistics</h4>';
    html += '<table class="qos-stats-table"><thead><tr>';
    html += '<th>Class</th><th>DSCP</th><th>Packets</th><th>Avg Wait</th><th>Max Wait</th><th>Starvation Risk</th>';
    html += '</tr></thead><tbody>';
    CLASSES.forEach(function (c) {
      var s = stats[c.id];
      var starved = c.priority === 1 && s.maxWait > 4 ? 'Yes ⚠' : 'No';
      var starvedCls = c.priority === 1 && s.maxWait > 4 ? ' qos-starved' : '';
      html += '<tr>';
      html += '<td style="color:' + c.color + ';font-weight:600">' + c.label + '</td>';
      html += '<td>' + c.dscp + '</td>';
      html += '<td>' + s.count + '</td>';
      html += '<td>' + s.avgWait.toFixed(1) + ' ticks</td>';
      html += '<td>' + s.maxWait + ' ticks</td>';
      html += '<td class="' + starvedCls + '">' + starved + '</td>';
      html += '</tr>';
    });
    html += '</tbody></table></div>';
    return html;
  }

  /* ---- Main simulation ---- */
  NetSim.SimRegistry.register('qos', function factory(ctx) {
    var algorithm = 'strict';
    var sim = null;
    var index = -1;
    var timer = null;
    var host = null;
    var timelineHost = null;

    function rebuild() {
      stop();
      index = -1;
      sim = buildEvents(algorithm);
      draw();
      renderParams();
      ctx.log('Ready — ' + sim.events[0].arrivedThisTick.length + ' packets already waiting. Algorithm: ' + algoLabel() + '.');
    }

    function algoLabel() {
      if (algorithm === 'strict') return 'Strict Priority';
      if (algorithm === 'wfq') return 'Weighted Fair Queuing';
      return 'Round Robin';
    }

    function draw() {
      var e = index >= 0 && sim.events[index] ? sim.events[index] : null;
      var snapshot = e ? e.queues : { voice: [], video: [], bulk: [] };
      var served = e ? e.served : null;
      var tick = e ? e.tick : 0;

      // Queue SVG
      var svgHtml = renderQueuesSVG(snapshot, served, tick);

      // Output strip — served so far
      var servedSoFar = sim.served.filter(function (p) { return index >= 0 && p.servedAt <= tick; });
      var strip = '<div class="qos-output-strip"><span class="qos-strip-label">Output order:</span>';
      servedSoFar.forEach(function (p) {
        var c = cls(p.cls);
        strip += '<span class="qos-strip-pkt" style="background:' + c.bg + ';border-color:' + c.color + ';color:' + c.color + '">' +
                 c.label[0] + '#' + p.id + '</span>';
      });
      if (!servedSoFar.length) strip += '<span class="qos-strip-empty">none yet</span>';
      strip += '</div>';

      host.innerHTML = svgHtml + strip;

      // Timeline + stats (after all events)
      var maxTick = sim.events.length ? sim.events[sim.events.length - 1].tick + 1 : 0;
      var showTick = index >= 0 ? Math.min(tick + 1, maxTick) : 0;
      timelineHost.innerHTML = renderTimeline(servedSoFar, showTick) +
                               (index >= sim.events.length - 1 ? renderStats(sim.stats) : '');

      // Metrics
      var algoDesc = algorithm === 'strict'
        ? 'Voice > Video > Bulk (may starve Bulk)'
        : algorithm === 'wfq'
          ? 'Weight 5:3:1 — proportional, no starvation'
          : 'Cycles equally — ignores priority';

      ctx.setMetrics([
        { label: 'Algorithm', value: algoLabel() },
        { label: 'Behavior', value: algoDesc },
        { label: 'Voice avg wait', value: sim.stats.voice.avgWait.toFixed(1) + ' ticks' },
        { label: 'Video avg wait', value: sim.stats.video.avgWait.toFixed(1) + ' ticks' },
        { label: 'Bulk avg wait', value: sim.stats.bulk.avgWait.toFixed(1) + ' ticks' },
        { label: 'Bulk max wait', value: sim.stats.bulk.maxWait + ' ticks' }
      ]);
    }

    function renderParams() {
      ctx.params.hidden = false;
      var algos = [
        { key: 'strict', label: 'Strict Priority' },
        { key: 'wfq',    label: 'Weighted Fair (WFQ)' },
        { key: 'rr',     label: 'Round Robin' }
      ];
      ctx.params.innerHTML =
        '<fieldset class="switch-mode-group" role="radiogroup" aria-label="Scheduling Algorithm">' +
        '<legend class="section-label" style="margin:0 0 0.5rem;border:none;padding:0;">Scheduling Algorithm</legend>' +
        algos.map(function (a) {
          return '<label class="switch-mode-option ' + (a.key === algorithm ? 'is-checked' : '') + '">' +
            '<input type="radio" name="qosAlgo" value="' + a.key + '" ' + (a.key === algorithm ? 'checked' : '') + '> ' +
            a.label + '</label>';
        }).join('') +
        '</fieldset>' +
        '<div class="qos-algo-desc">' +
          '<p class="qos-algo-hint">' +
            (algorithm === 'strict' ? '<strong>Strict Priority:</strong> Always serves the highest-priority non-empty queue. Voice gets near-zero delay, but Bulk can starve under heavy load.' :
             algorithm === 'wfq' ? '<strong>Weighted Fair Queuing:</strong> Allocates bandwidth proportional to weights (Voice 5 : Video 3 : Bulk 1). No class starves, but high-priority classes still get more capacity.' :
             '<strong>Round Robin:</strong> Cycles through queues equally. Fair but ignores traffic priority — Voice gets the same treatment as Bulk.') +
          '</p>' +
        '</div>';

      ctx.params.querySelectorAll('input[name="qosAlgo"]').forEach(function (r) {
        r.addEventListener('change', function () { algorithm = r.value; rebuild(); });
      });
    }

    function stop() { if (timer) { NetSim.SimTiming.clearInterval(timer); timer = null; } }

    function advance() {
      if (index >= sim.events.length - 1) { stop(); return; }
      index++;
      var e = sim.events[index];
      ctx.log(e.text, e.served ? undefined : 'info');
      draw();
    }

    return {
      initialize: function () {
        ctx.canvas.classList.add('net-canvas');
        ctx.canvas.innerHTML = '<div class="qos-mount"></div><div class="qos-tl-mount"></div>';
        host = ctx.canvas.querySelector('.qos-mount');
        timelineHost = ctx.canvas.querySelector('.qos-tl-mount');
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
