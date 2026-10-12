/* ==========================================================================
   NetSim — simulations/qos.js
   A strict-priority scheduler serving three traffic classes sharing one
   link. Each tick it always services the highest-priority non-empty
   queue — real queueing delay accumulates for Bulk traffic while Voice
   barely waits at all, even under load.
   ========================================================================== */

(function (NetSim) {
  'use strict';

  const CLASSES = { voice: { label: 'Voice', priority: 3 }, video: { label: 'Video', priority: 2 }, bulk: { label: 'Bulk Data', priority: 1 } };
  // { tick arrived, class }
  const ARRIVALS = [
    { t: 0, cls: 'bulk' }, { t: 0, cls: 'bulk' }, { t: 0, cls: 'bulk' },
    { t: 1, cls: 'video' }, { t: 2, cls: 'voice' }, { t: 3, cls: 'bulk' },
    { t: 3, cls: 'video' }, { t: 4, cls: 'voice' }, { t: 5, cls: 'bulk' },
    { t: 6, cls: 'voice' }, { t: 7, cls: 'bulk' }, { t: 8, cls: 'video' }
  ];

  NetSim.SimRegistry.register('qos', function factory(ctx) {
    let events = [];
    let index = -1;
    let timer = null;
    let host = null;
    let finalStats = null;

    function buildEvents() {
      const packets = ARRIVALS.map((a, i) => ({ id: a.cls[0].toUpperCase() + (i + 1), cls: a.cls, arrived: a.t, served: null }));
      const out = [];
      let tick = 0;
      let remaining = packets.slice();
      while (remaining.some((p) => p.served === null) && tick < 40) {
        const available = remaining.filter((p) => p.arrived <= tick && p.served === null);
        if (!available.length) { tick++; continue; }
        available.sort((a, b) => CLASSES[b.cls].priority - CLASSES[a.cls].priority || a.arrived - b.arrived);
        const chosen = available[0];
        chosen.served = tick;
        out.push({
          text: 'Tick ' + tick + ': scheduler services ' + chosen.id + ' (' + CLASSES[chosen.cls].label + ') \u2014 waited ' + (tick - chosen.arrived) + ' tick(s) in queue.',
          packet: chosen.id, tick
        });
        tick++;
      }
      finalStats = {};
      Object.keys(CLASSES).forEach((cls) => {
        const served = packets.filter((p) => p.cls === cls);
        const waits = served.map((p) => p.served - p.arrived);
        finalStats[cls] = { count: served.length, avgWait: waits.length ? (waits.reduce((a, b) => a + b, 0) / waits.length) : 0, maxWait: waits.length ? Math.max(...waits) : 0 };
      });
      return { out, packets };
    }

    function draw() {
      const shown = Math.max(0, index + 1);
      const servedSoFar = events.packets.filter((p) => p.served !== null && p.served < shown);
      const pending = events.packets.filter((p) => !servedSoFar.includes(p));
      host.innerHTML = `
        <p class="net-hint">Serviced (priority order, highest first):</p>
        <div class="packet-status-strip">${servedSoFar.map((p) => `<span class="packet-chip delivered">${p.id}</span>`).join('') || '<span class="net-hint">none yet</span>'}</div>
        <p class="net-hint" style="margin-top:0.6rem;">Still waiting:</p>
        <div class="packet-status-strip">${pending.map((p) => `<span class="packet-chip ${p.cls === 'voice' ? 'in-flight' : 'pending'}">${p.id}</span>`).join('') || '<span class="net-hint">none</span>'}</div>
      `;
      ctx.setMetrics([
        { label: 'Voice \u2014 avg wait', value: finalStats.voice.avgWait.toFixed(1) + ' ticks' },
        { label: 'Video \u2014 avg wait', value: finalStats.video.avgWait.toFixed(1) + ' ticks' },
        { label: 'Bulk \u2014 avg wait', value: finalStats.bulk.avgWait.toFixed(1) + ' ticks' },
        { label: 'Bulk \u2014 max wait', value: finalStats.bulk.maxWait + ' ticks' },
        { label: 'Scheduling', value: 'Strict priority (Voice > Video > Bulk)' }
      ]);
    }

    function rebuild() {
      stop();
      index = -1;
      const built = buildEvents();
      events = built.out;
      events.packets = built.packets;
      ctx.params.hidden = true;
      draw();
      ctx.log('Ready \u2014 12 packets across 3 traffic classes about to contend for one link.');
    }

    function stop() { if (timer) { clearInterval(timer); timer = null; } }

    function advance() {
      if (index >= events.length - 1) { stop(); return; }
      index += 1;
      ctx.log(events[index].text);
      draw();
    }

    return {
      initialize() {
        ctx.canvas.classList.add('net-canvas');
        ctx.canvas.innerHTML = '<div class="qos-mount"></div>';
        host = ctx.canvas.querySelector('.qos-mount');
        rebuild();
      },
      start() { if (timer) return; timer = setInterval(() => { if (index >= events.length - 1) { stop(); return; } advance(); }, 400); },
      pause() { stop(); },
      step() { stop(); advance(); },
      reset() { rebuild(); },
      destroy() { stop(); }
    };
  });

})(window.NetSim = window.NetSim || {});
