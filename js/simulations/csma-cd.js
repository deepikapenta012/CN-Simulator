/* ==========================================================================
   NetSim — simulations/csma-cd.js
   Two stations contend for a shared bus. When they transmit at the same
   time, both detect the collision immediately, jam, and roll a real
   binary exponential backoff — replayed until the race actually resolves.
   ========================================================================== */

(function (NetSim) {
  'use strict';

  NetSim.SimRegistry.register('csma-cd', function factory(ctx) {
    let events = [];
    let index = -1;
    let timer = null;
    let host = null;
    let finalStats = {};

    function buildRun() {
      const out = [];
      let attempt = 1;
      let winner = null, loser = null, finalWindow = 0;
      while (attempt <= 6) {
        out.push({ text: 'Station A and Station B both sense the medium as idle.', phase: 'sense' });
        out.push({ text: 'Both begin transmitting at (almost) the same instant.', phase: 'transmit' });
        out.push({ text: 'Collision detected! Both stations stop and send a jam signal.', level: 'warning', phase: 'collide' });
        const windowSize = Math.pow(2, Math.min(attempt, 10));
        finalWindow = windowSize;
        let bA = Math.floor(Math.random() * windowSize);
        let bB = Math.floor(Math.random() * windowSize);
        if (attempt >= 6 && bA === bB) bB = bA === 0 ? 1 : 0;
        out.push({ text: 'Binary exponential backoff, attempt ' + attempt + ': contention window = 0\u2013' + (windowSize - 1) + ' slot times.', phase: 'backoff' });
        out.push({ text: 'Station A picks backoff = ' + bA + ' slots. Station B picks backoff = ' + bB + ' slots.', phase: 'backoff' });
        if (bA === bB) {
          out.push({ text: 'Both picked the same backoff \u2014 they will collide again.', level: 'warning', phase: 'retie' });
          attempt += 1;
          continue;
        }
        winner = bA < bB ? 'A' : 'B';
        loser = winner === 'A' ? 'B' : 'A';
        out.push({ text: 'Station ' + winner + '\u2019s backoff reaches zero first \u2014 it senses the medium idle and transmits successfully \u2713', level: 'success', phase: 'success', winner });
        out.push({ text: 'Station ' + loser + ' senses the medium busy during its countdown and waits for the next opportunity.', phase: 'defer' });
        break;
      }
      finalStats = { attempts: attempt, window: finalWindow, winner, loser };
      return out;
    }

    function draw() {
      const step = events[Math.max(0, index)] || {};
      const stateA = stationClass('A', step);
      const stateB = stationClass('B', step);
      host.innerHTML = `
        <div class="fw-diagram">
          <div class="fw-node ${stateA}">Station A</div>
          <div class="fw-packet-track"><span class="fw-arrow">${busSymbol(step)}</span></div>
          <div class="fw-node" style="border-color:var(--teal);color:var(--teal);">BUS</div>
          <div class="fw-packet-track"><span class="fw-arrow">${busSymbol(step)}</span></div>
          <div class="fw-node ${stateB}">Station B</div>
        </div>
      `;
      ctx.setMetrics([
        { label: 'Attempts', value: String(finalStats.attempts) },
        { label: 'Collisions', value: String(finalStats.attempts) },
        { label: 'Final Contention Window', value: '0\u2013' + (finalStats.window - 1) + ' slots' },
        { label: 'Winner', value: finalStats.winner ? 'Station ' + finalStats.winner : '\u2014' },
        { label: 'Outcome', value: index >= events.length - 1 ? 'Resolved' : 'In progress' }
      ]);
    }

    function stationClass(name, step) {
      if (step.phase === 'collide' || step.phase === 'transmit') return 'is-off';
      if (step.phase === 'success' && step.winner === name) return '';
      return '';
    }
    function busSymbol(step) {
      if (step.phase === 'collide') return '\u2717';
      if (step.phase === 'success') return '\u2192';
      return '\u2194';
    }

    function rebuild() {
      stop();
      index = -1;
      events = buildRun();
      ctx.params.hidden = true;
      draw();
      ctx.log('Ready \u2014 two stations about to contend for the shared bus.');
    }

    function stop() { if (timer) { NetSim.SimTiming.clearInterval(timer); timer = null; } }

    function advance() {
      if (index >= events.length - 1) { stop(); return; }
      index += 1;
      ctx.log(events[index].text, events[index].level);
      draw();
    }

    return {
      initialize() {
        ctx.canvas.classList.add('net-canvas');
        ctx.canvas.innerHTML = '<div class="cd-mount"></div>';
        host = ctx.canvas.querySelector('.cd-mount');
        rebuild();
      },
      start() { if (timer) return; timer = NetSim.SimTiming.setInterval(() => { if (index >= events.length - 1) { stop(); return; } advance(); }, 700); },
      pause() { stop(); },
      step() { stop(); advance(); },
      reset() { rebuild(); },
      destroy() { stop(); }
    };
  });

})(window.NetSim = window.NetSim || {});
