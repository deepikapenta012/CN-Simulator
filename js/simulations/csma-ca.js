/* ==========================================================================
   NetSim — simulations/csma-ca.js
   Wireless can't detect a collision while transmitting, so it avoids one
   instead: sense the medium, wait a DIFS, count down a random backoff
   (freezing whenever the medium is busy), transmit, and confirm success
   only via an explicit ACK from the receiver.
   ========================================================================== */

(function (NetSim) {
  'use strict';

  NetSim.SimRegistry.register('csma-ca', function factory(ctx) {
    let events = [];
    let index = -1;
    let timer = null;
    let host = null;
    let finalStats = {};

    function buildRun() {
      const out = [];
      let attempt = 1;
      let winner = null, loserRemaining = 0, finalWindow = 0;
      out.push({ text: 'Station A and Station B have frames queued and listen to the shared wireless channel.', phase: 'idle', channel: 'idle' });
      out.push({ text: 'Both stations sense an idle channel, then wait one DIFS before counting down.', phase: 'difs', channel: 'idle', wait: 'DIFS' });
      while (attempt <= 5) {
        const windowSize = 8 * Math.pow(2, Math.min(attempt - 1, 5));
        finalWindow = windowSize;
        let bA = Math.floor(Math.random() * windowSize);
        let bB = Math.floor(Math.random() * windowSize);
        if (attempt >= 5 && bA === bB) bB = bA === 0 ? 1 : 0;
        out.push({ text: 'Contention window = 0\u2013' + (windowSize - 1) + ' slots (attempt ' + attempt + '). Station A picks ' + bA + ', Station B picks ' + bB + '.', phase: 'backoff', channel: 'idle', bA, bB, windowSize, attempt });
        if (bA === bB) {
          out.push({ text: 'Both counters reach zero together and transmit. The collision is discovered when no ACK arrives.', level: 'warning', phase: 'collide', channel: 'collision', bA, bB });
          out.push({ text: 'No ACK arrives, so both stations increase the contention window and retry.', level: 'warning', phase: 'noack', channel: 'idle', wait: 'Retry' });
          attempt += 1;
          continue;
        }
        winner = bA < bB ? 'A' : 'B';
        const loser = winner === 'A' ? 'B' : 'A';
        loserRemaining = Math.abs(bA - bB);
        out.push({ text: 'Station ' + winner + '\u2019s counter reaches zero first; it transmits while the other station defers.', phase: 'transmit', channel: 'busy', winner, bA, bB });
        out.push({ text: 'Station ' + loser + ' senses the busy channel and freezes its backoff with ' + loserRemaining + ' slot(s) remaining.', phase: 'freeze', channel: 'busy', winner, loser, loserRemaining, bA, bB });
        out.push({ text: 'The receiver returns an ACK, confirming Station ' + winner + '\u2019s frame arrived successfully.', level: 'success', phase: 'ack', channel: 'busy', winner, loser, loserRemaining });
        out.push({ text: 'When the channel is idle again, Station ' + loser + ' resumes its countdown from ' + loserRemaining + ' slot(s).', phase: 'resume', channel: 'idle', loser, loserRemaining });
        break;
      }
      finalStats = { attempts: attempt, window: finalWindow, winner, loserRemaining };
      return out;
    }

    function draw() {
      const step = events[Math.max(0, index)] || {};
      const stateFor = (name) => {
        if (step.phase === 'transmit' || step.phase === 'freeze' || step.phase === 'ack') return step.winner === name ? 'transmitting' : step.phase === 'transmit' ? 'defer' : 'frozen';
        if (step.phase === 'collide') return 'collision';
        if (step.phase === 'backoff') return 'backoff';
        if (step.phase === 'difs') return 'DIFS wait';
        if (step.phase === 'resume') return step.loser === name ? 'resuming backoff' : 'channel idle';
        return step.phase === 'noack' ? 'retrying' : 'sensing';
      };
      const channelClass = step.channel === 'busy' ? 'is-busy' : step.channel === 'collision' ? 'is-collision' : '';
      const channel = step.channel === 'busy' ? 'BUSY' : step.channel === 'collision' ? 'COLLISION' : 'IDLE';
      const statusFor = (name) => stateFor(name).toUpperCase();
      const countForNode = (name) => {
        if (step.phase === 'freeze' && step.loser === name) return step.loserRemaining + ' FROZEN';
        if (step.phase === 'resume' && step.loser === name) return step.loserRemaining + ' LEFT';
        const count = name === 'A' ? step.bA : step.bB;
        return count == null ? 'BACKOFF --' : 'BACKOFF ' + count;
      };
      const node = (name, x, klass) => '<g class="mac-topo-station ' + klass + '"><circle cx="' + x + '" cy="80" r="52"/><text class="mac-topo-name" x="' + x + '" y="70">Station ' + name + '</text><text class="mac-topo-state" x="' + x + '" y="87">' + statusFor(name) + '</text><text class="mac-topo-count" x="' + x + '" y="103">' + countForNode(name) + '</text></g>';
      const linkA = step.phase === 'transmit' && step.winner === 'A' ? 'is-active' : step.phase === 'ack' && step.winner === 'A' ? 'is-active is-reverse' : '';
      const linkB = step.phase === 'transmit' && step.winner === 'B' ? 'is-active' : step.phase === 'ack' && step.winner === 'B' ? 'is-active is-reverse' : '';
      host.innerHTML = '<svg class="mac-topology-svg" viewBox="0 0 600 250" role="img" aria-label="Wireless star network with two stations sharing an access channel">' +
        '<line class="mac-topo-link ' + linkA + '" x1="160" y1="112" x2="260" y2="160"/><line class="mac-topo-link ' + linkB + '" x1="440" y1="112" x2="340" y2="160"/>' +
        node('A', 108, stateFor('A') === 'transmitting' ? 'is-transmitting' : stateFor('A') === 'frozen' || stateFor('A') === 'defer' ? 'is-waiting' : '') +
        node('B', 492, stateFor('B') === 'transmitting' ? 'is-transmitting' : stateFor('B') === 'frozen' || stateFor('B') === 'defer' ? 'is-waiting' : '') +
        '<g class="mac-topo-channel ' + channelClass + '"><rect x="220" y="130" width="160" height="72" rx="5"/><text class="mac-topo-channel-name" x="300" y="158">WIRELESS CHANNEL</text><text class="mac-topo-channel-state" x="300" y="182">' + channel + '</text></g></svg>' +
        '<p class="mac-event">' + (step.text || 'Press Start or Step to let stations sense the wireless channel.') + '</p>';
      ctx.setMetrics([
        { label: 'Attempts', value: String(finalStats.attempts) },
        { label: 'Final Contention Window', value: '0\u2013' + (finalStats.window - 1) + ' slots' },
        { label: 'DIFS Observed', value: 'Yes' },
        { label: 'Winner', value: finalStats.winner ? 'Station ' + finalStats.winner : '\u2014' },
        { label: 'ACK Received', value: finalStats.winner ? 'Yes' : '\u2014' },
        { label: 'Loser Remaining Backoff', value: finalStats.winner ? finalStats.loserRemaining + ' slots' : '\u2014' }
      ]);
    }

    function rebuild() {
      stop();
      index = -1;
      events = buildRun();
      ctx.params.hidden = true;
      draw();
      ctx.log('Ready \u2014 two stations about to contend for the wireless medium.');
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
        ctx.canvas.innerHTML = '<div class="ca-mount"></div>';
        host = ctx.canvas.querySelector('.ca-mount');
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
