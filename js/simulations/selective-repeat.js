/* ==========================================================================
   NetSim — simulations/selective-repeat.js
   Same lost-frame scenario as Go-Back-N, but the receiver buffers
   out-of-order frames instead of discarding them, and the sender
   retransmits only the one frame that was actually lost.
   ========================================================================== */

(function (NetSim) {
  'use strict';

  NetSim.SimRegistry.register('selective-repeat', function factory(ctx) {
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
        else if (f > L) out.push({ frame: f, text: 'Frame ' + f + ' arrives out of order \u2014 receiver buffers it and sends ACK ' + f + ' anyway.', level: 'success', state: 'buffered' });
        else out.push({ frame: f, text: 'Frame ' + f + ' arrives in order \u2014 receiver delivers it and sends ACK ' + f + '.', level: 'success', state: 'acked' });
      }
      out.push({ text: 'Sender times out waiting for ACK ' + L + '.', level: 'warning' });
      out.push({ text: 'Selective Repeat: sender retransmits only frame ' + L + ' \u2014 the rest already arrived and are buffered.', level: 'success' });
      out.push({ frame: L, text: 'Sender retransmits frame ' + L + '.', state: 'resent' });
      out.push({ frame: L, text: 'Frame ' + L + ' arrives \u2014 receiver now has a contiguous run and delivers frame ' + L + ' plus all buffered frames after it.', level: 'success', state: 'acked' });
      for (let f = L + 1; f <= windowSize; f++) out.push({ frame: f, text: 'Frame ' + f + ' (previously buffered) delivered in order.', level: 'success', state: 'acked' });
      out.push({ text: 'All frames now delivered, in order.', level: 'success' });

      stats = { buffered: windowSize - L, retransmitted: 1, totalTx: windowSize + 1 };
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
      const state = frameState(index);
      const boxes = [];
      for (let f = 1; f <= windowSize; f++) {
        const s = state[f] || 'pending';
        const cls = s === 'acked' ? 'delivered' : s === 'lost' ? 'lost' : s === 'buffered' ? 'in-flight' : s === 'sent' || s === 'resent' ? 'in-flight' : 'pending';
        const label = s === 'lost' ? f + ' \u2717 lost' : s === 'buffered' ? f + ' (buf)' : String(f);
        boxes.push(`<span class="packet-chip ${cls}">${label}</span>`);
      }
      host.innerHTML = `<div class="packet-status-strip">${boxes.join('')}</div>
        <p class="net-hint" style="margin-top:0.8rem;">green = delivered &amp; acked &nbsp;\u00b7&nbsp; teal = in flight / buffered &nbsp;\u00b7&nbsp; red = lost &nbsp;\u00b7&nbsp; grey = not yet sent</p>`;

      ctx.setMetrics([
        { label: 'Window Size', value: String(windowSize) },
        { label: 'Frame Lost', value: String(Math.min(lostFrame, windowSize)) },
        { label: 'Frames Buffered', value: String(stats.buffered) },
        { label: 'Frames Retransmitted', value: String(stats.retransmitted) + ' (vs. Go-Back-N\u2019s ' + (windowSize - Math.min(lostFrame, windowSize) + 1) + ')' },
        { label: 'Total Transmissions', value: String(stats.totalTx) },
        { label: 'Efficiency', value: (windowSize / stats.totalTx * 100).toFixed(0) + '%' }
      ]);
    }

    function renderParams() {
      ctx.params.hidden = false;
      ctx.params.innerHTML = `
        <div class="sim-param-row"><label for="srWindow">Window Size</label>
          <input type="range" id="srWindow" min="3" max="8" step="1" value="${windowSize}">
          <span class="val" id="srWindowVal">${windowSize}</span></div>
        <div class="sim-param-row"><label for="srLost">Frame Lost (#)</label>
          <input type="range" id="srLost" min="1" max="${windowSize}" step="1" value="${Math.min(lostFrame, windowSize)}">
          <span class="val" id="srLostVal">${Math.min(lostFrame, windowSize)}</span></div>
        <p style="font-size:0.78rem;color:var(--ink-faint);margin-top:0.5rem;">Compare this to Go-Back-N with the same
        settings — Selective Repeat needs individual ACK/NAK tracking and receiver buffering, but wastes far less bandwidth.</p>
      `;
      ctx.params.querySelector('#srWindow').addEventListener('change', (e) => { windowSize = parseInt(e.target.value, 10); rebuild(); });
      ctx.params.querySelector('#srWindow').addEventListener('input', (e) => { ctx.params.querySelector('#srWindowVal').textContent = e.target.value; });
      ctx.params.querySelector('#srLost').addEventListener('change', (e) => { lostFrame = parseInt(e.target.value, 10); rebuild(); });
      ctx.params.querySelector('#srLost').addEventListener('input', (e) => { ctx.params.querySelector('#srLostVal').textContent = e.target.value; });
    }

    function rebuild() {
      stop();
      index = -1;
      events = buildEvents();
      renderParams();
      draw();
      ctx.log('Ready \u2014 window of ' + windowSize + ' frames, frame ' + Math.min(lostFrame, windowSize) + ' will be lost.');
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
        ctx.canvas.innerHTML = '<div class="sr-mount"></div>';
        host = ctx.canvas.querySelector('.sr-mount');
        rebuild();
      },
      start() { if (timer) return; timer = setInterval(() => { if (index >= events.length - 1) { stop(); return; } advance(); }, 550); },
      pause() { stop(); },
      step() { stop(); advance(); },
      reset() { rebuild(); },
      destroy() { stop(); }
    };
  });

})(window.NetSim = window.NetSim || {});
