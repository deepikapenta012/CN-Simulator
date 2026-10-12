/* ==========================================================================
   NetSim — simulations/tcp-timers.js
   Real RFC 6298 retransmission-timer math: SRTT and RTTVAR updated from
   each new RTT sample (including a deliberately delayed ACK that spikes
   the estimate), RTO derived from them, then a genuine timeout that
   doubles RTO via exponential backoff on the retransmit.
   ========================================================================== */

(function (NetSim) {
  'use strict';

  const ALPHA = 1 / 8, BETA = 1 / 4;
  const SAMPLES = [100, 110, 95, 105, 320, 115, 100]; // ms — one delayed-ACK spike included

  NetSim.SimRegistry.register('tcp-timers', function factory(ctx) {
    let phases = [];
    let index = -1;
    let timer = null;
    let host = null;

    function buildPhases() {
      const p = [];
      let srtt = null, rttvar = null, rto = null;
      SAMPLES.forEach((sample, i) => {
        if (srtt === null) {
          srtt = sample;
          rttvar = sample / 2;
        } else {
          rttvar = (1 - BETA) * rttvar + BETA * Math.abs(srtt - sample);
          srtt = (1 - ALPHA) * srtt + ALPHA * sample;
        }
        rto = srtt + 4 * rttvar;
        const spike = sample > 250;
        p.push({
          text: 'RTT sample #' + (i + 1) + ' = ' + sample + ' ms' + (spike ? ' (delayed ACK \u2014 unusually slow)' : '') + '. SRTT = ' + srtt.toFixed(1) + ' ms, RTTVAR = ' + rttvar.toFixed(1) + ' ms, RTO = ' + rto.toFixed(0) + ' ms.',
          level: spike ? 'warning' : undefined, srtt, rttvar, rto
        });
      });
      p.push({ text: 'A new segment is sent. RTO is currently ' + rto.toFixed(0) + ' ms.', srtt, rttvar, rto });
      p.push({ text: 'No ACK arrives before the RTO expires \u2014 timeout! The segment is retransmitted.', level: 'error', srtt, rttvar, rto });
      const backedOffRto = rto * 2;
      p.push({ text: 'Exponential backoff: RTO doubles to ' + backedOffRto.toFixed(0) + ' ms for the retransmission, in case the network is congested rather than the packet just being unlucky.', level: 'warning', srtt, rttvar, rto: backedOffRto });
      p.push({ text: 'The retransmission is ACKed. RTO returns to being driven by fresh RTT samples again.', level: 'success', srtt, rttvar, rto });
      return p;
    }

    function draw() {
      const phase = phases[Math.max(0, index)] || { srtt: 0, rttvar: 0, rto: 0 };
      host.innerHTML = `
        <div style="display:flex;justify-content:center;gap:1.5rem;flex-wrap:wrap;text-align:center;">
          <div><div style="font-family:var(--f-mono);font-size:1.4rem;font-weight:700;color:var(--ink);">${phase.srtt.toFixed(0)} ms</div><div class="net-hint">SRTT</div></div>
          <div><div style="font-family:var(--f-mono);font-size:1.4rem;font-weight:700;color:var(--ink);">${phase.rttvar.toFixed(0)} ms</div><div class="net-hint">RTTVAR</div></div>
          <div><div style="font-family:var(--f-mono);font-size:1.4rem;font-weight:700;color:var(--accent);">${phase.rto.toFixed(0)} ms</div><div class="net-hint">RTO</div></div>
        </div>
      `;
      ctx.setMetrics([
        { label: 'SRTT', value: phase.srtt.toFixed(1) + ' ms' },
        { label: 'RTTVAR', value: phase.rttvar.toFixed(1) + ' ms' },
        { label: 'RTO (= SRTT + 4\u00d7RTTVAR)', value: phase.rto.toFixed(0) + ' ms' },
        { label: 'Formula', value: '\u03b1=1/8, \u03b2=1/4 (RFC 6298)' }
      ]);
    }

    function rebuild() {
      stop();
      index = -1;
      phases = buildPhases();
      ctx.params.hidden = true;
      draw();
      ctx.log('Ready \u2014 about to observe RTT samples and compute the retransmission timeout.');
    }

    function stop() { if (timer) { NetSim.SimTiming.clearInterval(timer); timer = null; } }

    function advance() {
      if (index >= phases.length - 1) { stop(); return; }
      index += 1;
      ctx.log(phases[index].text, phases[index].level);
      draw();
    }

    return {
      initialize() {
        ctx.canvas.classList.add('net-canvas');
        ctx.canvas.innerHTML = '<div class="timers-mount"></div>';
        host = ctx.canvas.querySelector('.timers-mount');
        rebuild();
      },
      start() { if (timer) return; timer = NetSim.SimTiming.setInterval(() => { if (index >= phases.length - 1) { stop(); return; } advance(); }, 700); },
      pause() { stop(); },
      step() { stop(); advance(); },
      reset() { rebuild(); },
      destroy() { stop(); }
    };
  });

})(window.NetSim = window.NetSim || {});
