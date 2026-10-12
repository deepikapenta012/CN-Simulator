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
      out.push({ text: 'Station A and Station B both have a frame ready to send.', phase: 'idle' });
      out.push({ text: 'Both sense the medium idle and wait a DIFS (distributed inter-frame space).', phase: 'difs' });
      while (attempt <= 5) {
        const windowSize = 8 * Math.pow(2, Math.min(attempt - 1, 5));
        finalWindow = windowSize;
        let bA = Math.floor(Math.random() * windowSize);
        let bB = Math.floor(Math.random() * windowSize);
        if (attempt >= 5 && bA === bB) bB = bA === 0 ? 1 : 0;
        out.push({ text: 'Contention window = 0\u2013' + (windowSize - 1) + ' slots (attempt ' + attempt + '). Station A picks ' + bA + ', Station B picks ' + bB + '.', phase: 'backoff' });
        if (bA === bB) {
          out.push({ text: 'Both counters reach zero on the same slot \u2014 a collision, invisible to either station until the ACK fails to arrive.', level: 'warning', phase: 'collide' });
          out.push({ text: 'No ACK received by either station \u2014 both double their contention window and retry.', level: 'warning', phase: 'noack' });
          attempt += 1;
          continue;
        }
        winner = bA < bB ? 'A' : 'B';
        const loser = winner === 'A' ? 'B' : 'A';
        loserRemaining = Math.abs(bA - bB);
        out.push({ text: 'Station ' + winner + '\u2019s counter reaches zero first \u2014 it transmits its frame.', phase: 'transmit', winner });
        out.push({ text: 'Station ' + loser + ' senses the medium busy and freezes its backoff with ' + loserRemaining + ' slot(s) remaining.', phase: 'freeze' });
        out.push({ text: 'The receiver sends an ACK \u2014 Station ' + winner + '\u2019s transmission is confirmed successful \u2713', level: 'success', phase: 'ack', winner });
        out.push({ text: 'Station ' + loser + ' resumes counting down from ' + loserRemaining + ' slot(s) once the medium goes idle again.', phase: 'resume' });
        break;
      }
      finalStats = { attempts: attempt, window: finalWindow, winner, loserRemaining };
      return out;
    }

    function draw() {
      const step = events[Math.max(0, index)] || {};
      const symbol = step.phase === 'collide' ? '\u2717' : step.phase === 'transmit' || step.phase === 'ack' ? '\u2192' : step.phase === 'difs' || step.phase === 'backoff' ? '\u23f3' : '\u2194';
      host.innerHTML = `
        <div class="fw-diagram">
          <div class="fw-node">Station A</div>
          <div class="fw-packet-track"><span class="fw-arrow">${symbol}</span></div>
          <div class="fw-node" style="border-color:var(--teal);color:var(--teal);">Medium</div>
          <div class="fw-packet-track"><span class="fw-arrow">${symbol}</span></div>
          <div class="fw-node">Station B</div>
        </div>
      `;
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

    function stop() { if (timer) { clearInterval(timer); timer = null; } }

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
      start() { if (timer) return; timer = setInterval(() => { if (index >= events.length - 1) { stop(); return; } advance(); }, 700); },
      pause() { stop(); },
      step() { stop(); advance(); },
      reset() { rebuild(); },
      destroy() { stop(); }
    };
  });

})(window.NetSim = window.NetSim || {});
