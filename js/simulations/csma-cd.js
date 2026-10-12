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
        out.push({ text: 'Both stations listen to the shared Ethernet bus and sense it idle.', phase: 'sense', channel: 'idle' });
        out.push({ text: 'Both stations start transmitting at nearly the same time.', phase: 'transmit', channel: 'busy' });
        out.push({ text: 'Both detect the collision, stop transmitting, and send a jam signal.', level: 'warning', phase: 'collide', channel: 'collision' });
        const windowSize = Math.pow(2, Math.min(attempt, 10));
        finalWindow = windowSize;
        let bA = Math.floor(Math.random() * windowSize);
        let bB = Math.floor(Math.random() * windowSize);
        if (attempt >= 6 && bA === bB) bB = bA === 0 ? 1 : 0;
        out.push({ text: 'Binary exponential backoff, attempt ' + attempt + ': contention window = 0\u2013' + (windowSize - 1) + ' slot times.', phase: 'backoff' });
        out.push({ text: 'Station A picks backoff = ' + bA + ' slots. Station B picks backoff = ' + bB + ' slots.', phase: 'backoff', channel: 'idle', bA, bB, windowSize, attempt });
        if (bA === bB) {
          out.push({ text: 'Both picked the same backoff \u2014 they will collide again.', level: 'warning', phase: 'retie', channel: 'idle', bA, bB });
          attempt += 1;
          continue;
        }
        winner = bA < bB ? 'A' : 'B';
        loser = winner === 'A' ? 'B' : 'A';
        out.push({ text: 'Station ' + winner + '\u2019s backoff reaches zero first \u2014 it senses the medium idle and transmits successfully \u2713', level: 'success', phase: 'success', channel: 'busy', winner, loser, bA, bB });
        out.push({ text: 'Station ' + loser + ' senses the medium busy during its countdown and waits for the next opportunity.', phase: 'defer', channel: 'busy', winner, loser, bA, bB });
        break;
      }
      finalStats = { attempts: attempt, window: finalWindow, winner, loser };
      return out;
    }

    function draw() {
      const step = events[Math.max(0, index)] || {};
      const stateA = stationClass('A', step);
      const stateB = stationClass('B', step);
      const channel = step.channel === 'busy' ? 'BUSY' : step.channel === 'collision' ? 'COLLISION' : 'IDLE';
      const statusFor = (name) => step.phase === 'sense' ? 'SENSING' : step.phase === 'backoff' ? 'BACKOFF' : step.phase === 'collide' || step.phase === 'retie' ? 'COLLISION' : step.winner === name ? 'TRANSMITTING' : step.loser === name ? 'WAITING' : 'READY';
      const node = (name, x, status, klass) => '<g class="mac-topo-station ' + klass + '"><circle cx="' + x + '" cy="90" r="43"/><text class="mac-topo-name" x="' + x + '" y="86">Station ' + name + '</text><text class="mac-topo-state" x="' + x + '" y="104">' + status + '</text></g>';
      const linkA = step.phase === 'transmit' || step.phase === 'collide' ? 'is-active is-collision' : step.phase === 'success' && step.winner === 'A' ? 'is-active' : '';
      const linkB = step.phase === 'transmit' || step.phase === 'collide' ? 'is-active is-collision' : step.phase === 'success' && step.winner === 'B' ? 'is-active' : '';
      host.innerHTML = '<svg class="mac-topology-svg" viewBox="0 0 600 240" role="img" aria-label="Star network with Ethernet stations connected to a shared bus">' +
        '<line class="mac-topo-link ' + linkA + '" x1="170" y1="90" x2="260" y2="145"/><line class="mac-topo-link ' + linkB + '" x1="430" y1="90" x2="340" y2="145"/>' +
        node('A', 125, statusFor('A'), stateA) + node('B', 475, statusFor('B'), stateB) +
        '<g class="mac-topo-channel ' + (step.channel === 'busy' ? 'is-busy' : step.channel === 'collision' ? 'is-collision' : '') + '"><rect x="220" y="125" width="160" height="68" rx="5"/><text class="mac-topo-channel-name" x="300" y="151">SHARED ETHERNET</text><text class="mac-topo-channel-state" x="300" y="174">' + channel + '</text></g></svg>' +
        '<p class="mac-event">' + (step.text || 'Press Start or Step to let stations sense the shared bus.') + '</p>';
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
      if (step.phase === 'success' && step.winner === name) return 'is-transmitting';
      if ((step.phase === 'success' || step.phase === 'defer') && step.loser === name) return 'is-waiting';
      return '';
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
