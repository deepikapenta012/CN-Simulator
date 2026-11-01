/* ==========================================================================
   NetSim — simulations/sliding-window.js
   Pure flow-control mechanics (no loss — that's Go-Back-N/Selective
   Repeat's job): a window of size W lets the sender keep multiple
   frames outstanding, sliding forward one step per cumulative ACK.
   ========================================================================== */

(function (NetSim) {
  'use strict';

  NetSim.SimRegistry.register('sliding-window', function factory(ctx) {
    let totalFrames = 12;
    let windowSize = 4;
    let events = [];
    let index = -1;
    let timer = null;
    let host = null;
    let sentSet = new Set();
    let ackedSet = new Set();

    function buildEvents() {
      const out = [];
      let base = 1, sent = 0;
      while (base <= totalFrames) {
        const windowEnd = Math.min(base + windowSize - 1, totalFrames);
        while (sent < windowEnd) {
          sent += 1;
          out.push({ type: 'send', frame: sent, base, text: 'Sender transmits frame ' + sent + ' (window covers ' + base + '\u2013' + windowEnd + ').' });
        }
        out.push({ type: 'ack', frame: base, text: 'ACK ' + base + ' received \u2014 window slides forward.', level: 'success' });
        base += 1;
      }
      out.push({ type: 'done', text: 'All ' + totalFrames + ' frames sent and acknowledged.', level: 'success' });
      return out;
    }

    /**
     * Replay state up to step i and return { base, sentSet, ackedSet,
     * senderWindow, receiverWindow, receiverExpects }.
     */
    function replayState(i) {
      const sSet = new Set();
      const aSet = new Set();
      let base = 1;
      for (let k = 0; k <= i; k++) {
        const e = events[k];
        if (!e) continue;
        if (e.type === 'send') sSet.add(e.frame);
        if (e.type === 'ack') { aSet.add(e.frame); base = e.frame + 1; }
      }
      const windowEnd = Math.min(base + windowSize - 1, totalFrames);
      const senderWindow = [];
      for (let f = base; f <= windowEnd; f++) {
        senderWindow.push({ frame: f, status: aSet.has(f) ? 'acked' : sSet.has(f) ? 'sent' : 'pending' });
      }
      const receiverExpects = base;
      const receiverWindow = [];
      for (let f = base; f <= windowEnd; f++) {
        receiverWindow.push({ frame: f, status: aSet.has(f) ? 'received' : 'waiting' });
      }
      return { base, sentSet: sSet, ackedSet: aSet, senderWindow, receiverWindow, receiverExpects, windowEnd };
    }

    /** Render the window strip for sender or receiver. */
    function renderWindowStrip(label, windowFrames, totalF, side) {
      let html = '<div class="sw-window-strip sw-window-strip--' + side + '">';
      html += '<span class="sw-window-label">' + label + '</span>';
      html += '<div class="sw-window-slots">';
      for (let f = 1; f <= totalF; f++) {
        const entry = windowFrames.find((w) => w.frame === f);
        let cls = 'sw-slot';
        if (entry) {
          cls += ' sw-slot--in-window';
          cls += ' sw-slot--' + entry.status;
        } else {
          cls += ' sw-slot--outside';
        }
        html += '<div class="' + cls + '" title="Frame ' + f + '">' + f + '</div>';
      }
      html += '</div></div>';
      return html;
    }

    function draw() {
      const state = replayState(index);
      sentSet = state.sentSet;
      ackedSet = state.ackedSet;

      const actions = events.slice(0, index + 1).flatMap((event) => event.type === 'send'
        ? [{ type: 'frame', label: 'F' + event.frame }]
        : event.type === 'ack' ? [{ type: 'ack', label: 'ACK' + event.frame }] : []);

      const senderStrip = renderWindowStrip(
        'Sender Window [' + state.base + '\u2013' + state.windowEnd + '] size=' + windowSize,
        state.senderWindow, totalFrames, 'sender');
      const receiverStrip = renderWindowStrip(
        'Receiver (expects frame ' + state.receiverExpects + ')',
        state.receiverWindow, totalFrames, 'receiver');

      host.innerHTML = `
        <div class="sw-window-panel">${senderStrip}${receiverStrip}</div>
        ${NetSim.Components.renderTimingDiagram(actions, actions.length - 1)}
        <p class="timing-caption">Multiple frames may be in flight before cumulative ACKs slide the sender window.</p>
      `;

      /* Scroll the timing diagram to the bottom so the latest step is visible. */
      const scrollBox = host.querySelector('.timing-diagram-scroll');
      if (scrollBox) scrollBox.scrollTop = scrollBox.scrollHeight;

      const sentCount = sentSet.size, ackedCount = ackedSet.size;
      ctx.setMetrics([
        { label: 'Window Size', value: String(windowSize) },
        { label: 'Sender Window', value: state.base <= totalFrames ? 'F' + state.base + '\u2013F' + state.windowEnd : 'done' },
        { label: 'Receiver Expects', value: state.base <= totalFrames ? 'Frame ' + state.receiverExpects : 'done' },
        { label: 'Frames Sent', value: sentCount + ' / ' + totalFrames },
        { label: 'Frames Acknowledged', value: ackedCount + ' / ' + totalFrames },
        { label: 'In Flight (unacked)', value: String(sentCount - ackedCount) },
        { label: 'vs. Stop-and-Wait', value: 'Up to ' + windowSize + '\u00d7 fewer round trips' }
      ]);
    }

    function renderParams() {
      ctx.params.hidden = false;
      ctx.params.innerHTML = `
        <div class="sim-param-row"><label for="winSize">Window Size</label>
          <input type="range" id="winSize" min="1" max="8" step="1" value="${windowSize}">
          <span class="val" id="winSizeVal">${windowSize}</span></div>
        <div class="sim-param-row"><label for="winFrames">Total Frames</label>
          <input type="range" id="winFrames" min="4" max="16" step="1" value="${totalFrames}">
          <span class="val" id="winFramesVal">${totalFrames}</span></div>
        <p style="font-size:0.78rem;color:var(--ink-faint);margin-top:0.5rem;">Window size 1 behaves exactly like
        Stop-and-Wait — try it and compare the number of steps needed.</p>
      `;
      ctx.params.querySelector('#winSize').addEventListener('change', (e) => { windowSize = parseInt(e.target.value, 10); rebuild(); });
      ctx.params.querySelector('#winSize').addEventListener('input', (e) => { ctx.params.querySelector('#winSizeVal').textContent = e.target.value; });
      ctx.params.querySelector('#winFrames').addEventListener('change', (e) => { totalFrames = parseInt(e.target.value, 10); rebuild(); });
      ctx.params.querySelector('#winFrames').addEventListener('input', (e) => { ctx.params.querySelector('#winFramesVal').textContent = e.target.value; });
    }

    function rebuild() {
      stop();
      index = -1;
      events = buildEvents();
      renderParams();
      draw();
      ctx.log('Ready \u2014 window size ' + windowSize + ', ' + totalFrames + ' frames to send.');
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
        ctx.canvas.innerHTML = '<div class="sw-mount"></div>';
        host = ctx.canvas.querySelector('.sw-mount');
        rebuild();
      },
      start() { if (timer) return; timer = NetSim.SimTiming.setInterval(() => { if (index >= events.length - 1) { stop(); return; } advance(); }, 500); },
      pause() { stop(); },
      step() { stop(); advance(); },
      reset() { rebuild(); },
      destroy() { stop(); }
    };
  });

})(window.NetSim = window.NetSim || {});
