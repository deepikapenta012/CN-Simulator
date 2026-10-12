/* ==========================================================================
   NetSim — simulations/go-back-n.js
   One window's worth of frames, one of them lost: the receiver discards
   every frame after the loss (they arrive out of order) and the sender,
   once it times out, retransmits everything from the lost frame onward —
   the defining, costly behavior of Go-Back-N.
   ========================================================================== */

(function (NetSim) {
  'use strict';

  NetSim.SimRegistry.register('go-back-n', function factory(ctx) {
    let windowSize = 6;
    let lostFrame = 3;
    let events = [];
    let index = -1;
    let timer = null;
    let host = null;
    let stats = {};

    function buildEvents() {
      const out = [];
      const L = Math.min(lostFrame, windowSize);
      for (let f = 1; f <= windowSize; f++) out.push({ frame: f, text: 'Sender transmits frame ' + f + '.', state: 'sent' });
      for (let f = 1; f <= windowSize; f++) {
        if (f === L) out.push({ frame: f, text: 'Frame ' + f + ' is lost in transit.', level: 'warning', state: 'lost' });
        else if (f > L) out.push({ frame: f, text: 'Frame ' + f + ' arrives, but is out of order (expecting ' + L + ') \u2014 receiver discards it.', level: 'warning', state: 'discarded' });
        else out.push({ frame: f, text: 'Frame ' + f + ' arrives in order \u2014 receiver delivers it and sends ACK ' + f + '.', level: 'success', state: 'acked' });
      }
      out.push({ text: 'Sender times out waiting for ACK ' + L + '.', level: 'warning' });
      out.push({ text: 'Go-Back-N: sender retransmits every frame from ' + L + ' to ' + windowSize + ' \u2014 including ones already delivered.', level: 'warning' });
      for (let f = L; f <= windowSize; f++) {
        out.push({ frame: f, text: 'Sender retransmits frame ' + f + '.', state: 'resent' });
        out.push({ frame: f, text: 'Frame ' + f + ' arrives in order this time \u2014 receiver delivers it and sends ACK ' + f + '.', level: 'success', state: 'acked' });
      }
      out.push({ text: 'All frames now delivered.', level: 'success' });

      stats = {
        discarded: windowSize - L,
        retransmitted: windowSize - L + 1,
        totalTx: windowSize + (windowSize - L + 1)
      };
      return out;
    }

    function frameState(upToIndex) {
      const state = {};
      for (let i = 0; i <= upToIndex; i++) {
        const e = events[i];
        if (e && e.frame && e.state) state[e.frame] = e.state;
      }
      return state;
    }

    function draw() {
      const actions = events.slice(0, index + 1).flatMap((event) => {
        if (event.state === 'sent' || event.state === 'resent') return [{ type: 'frame', label: 'F' + event.frame }];
        if (event.state === 'lost') return [{ type: 'frame', label: 'F' + event.frame, outcome: 'lost' }];
        if (event.state === 'discarded') return [{ type: 'discard', label: 'F' + event.frame + ' discarded' }];
        if (event.state === 'acked') return [{ type: 'frame', label: 'F' + event.frame }, { type: 'ack', label: 'ACK' + event.frame }];
        if (event.text.startsWith('Sender times out')) return [{ type: 'timeout', label: 'timeout' }];
        return [];
      });
      host.innerHTML = `${NetSim.Components.renderTimingDiagram(actions, actions.length - 1)}
        <p class="timing-caption">After a loss, Go-Back-N retransmits the lost frame and all later frames in the window.</p>`;

      ctx.setMetrics([
        { label: 'Window Size', value: String(windowSize) },
        { label: 'Frame Lost', value: String(Math.min(lostFrame, windowSize)) },
        { label: 'Frames Discarded', value: String(stats.discarded) },
        { label: 'Frames Retransmitted', value: String(stats.retransmitted) },
        { label: 'Total Transmissions', value: String(stats.totalTx) },
        { label: 'Efficiency', value: (windowSize / stats.totalTx * 100).toFixed(0) + '%' }
      ]);
    }

    function renderParams() {
      ctx.params.hidden = false;
      ctx.params.innerHTML = `
        <div class="sim-param-row"><label for="gbnWindow">Window Size</label>
          <input type="range" id="gbnWindow" min="3" max="8" step="1" value="${windowSize}">
          <span class="val" id="gbnWindowVal">${windowSize}</span></div>
        <div class="sim-param-row"><label for="gbnLost">Frame Lost (#)</label>
          <input type="range" id="gbnLost" min="1" max="${windowSize}" step="1" value="${Math.min(lostFrame, windowSize)}">
          <span class="val" id="gbnLostVal">${Math.min(lostFrame, windowSize)}</span></div>
      `;
      ctx.params.querySelector('#gbnWindow').addEventListener('change', (e) => { windowSize = parseInt(e.target.value, 10); rebuild(); });
      ctx.params.querySelector('#gbnWindow').addEventListener('input', (e) => { ctx.params.querySelector('#gbnWindowVal').textContent = e.target.value; });
      ctx.params.querySelector('#gbnLost').addEventListener('change', (e) => { lostFrame = parseInt(e.target.value, 10); rebuild(); });
      ctx.params.querySelector('#gbnLost').addEventListener('input', (e) => { ctx.params.querySelector('#gbnLostVal').textContent = e.target.value; });
    }

    function rebuild() {
      stop();
      index = -1;
      events = buildEvents();
      renderParams();
      draw();
      ctx.log('Ready \u2014 window of ' + windowSize + ' frames, frame ' + Math.min(lostFrame, windowSize) + ' will be lost.');
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
        ctx.canvas.innerHTML = '<div class="gbn-mount"></div>';
        host = ctx.canvas.querySelector('.gbn-mount');
        rebuild();
      },
      start() { if (timer) return; timer = NetSim.SimTiming.setInterval(() => { if (index >= events.length - 1) { stop(); return; } advance(); }, 550); },
      pause() { stop(); },
      step() { stop(); advance(); },
      reset() { rebuild(); },
      destroy() { stop(); }
    };
  });

})(window.NetSim = window.NetSim || {});
