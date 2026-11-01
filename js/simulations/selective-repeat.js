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
      out.push({ text: 'Sender times out waiting for ACK ' + L + '.', level: 'warning', state: 'timeout' });
      out.push({ text: 'Selective Repeat: sender retransmits only frame ' + L + ' \u2014 the rest already arrived and are buffered.', level: 'success', state: 'info' });
      out.push({ frame: L, text: 'Sender retransmits frame ' + L + '.', state: 'resent' });
      out.push({ frame: L, text: 'Frame ' + L + ' arrives \u2014 receiver now has a contiguous run and delivers frame ' + L + ' plus all buffered frames after it.', level: 'success', state: 'acked' });
      for (let f = L + 1; f <= windowSize; f++) out.push({ frame: f, text: 'Frame ' + f + ' (previously buffered) delivered in order.', level: 'success', state: 'delivered' });
      out.push({ text: 'All frames now delivered, in order.', level: 'success', state: 'done' });

      stats = { buffered: windowSize - L, retransmitted: 1, totalTx: windowSize + 1 };
      return out;
    }

    /**
     * Replay full sender/receiver state up to index i.
     */
    function replayState(i) {
      const L = Math.min(lostFrame, windowSize);
      const senderFrameState = {};   // frame -> status string
      const receiverFrameState = {}; // frame -> status string
      let senderBase = 1;
      let receiverExpects = 1;

      for (let k = 0; k <= i; k++) {
        const e = events[k];
        if (!e) continue;
        if (e.state === 'sent' || e.state === 'resent') {
          senderFrameState[e.frame] = e.state;
        }
        if (e.state === 'lost') {
          senderFrameState[e.frame] = 'lost';
          receiverFrameState[e.frame] = 'lost';
        }
        if (e.state === 'buffered') {
          receiverFrameState[e.frame] = 'buffered';
          senderFrameState[e.frame] = 'acked'; // ACK was sent back for buffered
        }
        if (e.state === 'acked') {
          senderFrameState[e.frame] = 'acked';
          receiverFrameState[e.frame] = 'received';
          // Recalculate senderBase: lowest unacked
          let newBase = e.frame + 1;
          while (newBase <= windowSize && senderFrameState[newBase] === 'acked') newBase++;
          senderBase = newBase;
          receiverExpects = newBase;
        }
        if (e.state === 'delivered') {
          receiverFrameState[e.frame] = 'received';
          senderFrameState[e.frame] = 'acked';
          let newBase = e.frame + 1;
          while (newBase <= windowSize && senderFrameState[newBase] === 'acked') newBase++;
          senderBase = newBase;
          receiverExpects = newBase;
        }
      }

      const senderWindowEnd = Math.min(senderBase + windowSize - 1, windowSize);
      const senderWindow = [];
      for (let f = 1; f <= windowSize; f++) {
        const inWindow = f >= senderBase && f <= senderWindowEnd;
        senderWindow.push({ frame: f, status: senderFrameState[f] || (inWindow ? 'pending' : 'outside'), inWindow });
      }

      const receiverWindow = [];
      for (let f = 1; f <= windowSize; f++) {
        receiverWindow.push({ frame: f, status: receiverFrameState[f] || 'waiting' });
      }

      return { senderWindow, receiverWindow, senderBase, receiverExpects, senderWindowEnd };
    }

    function renderWindowStrip(label, frames, side) {
      let html = '<div class="sw-window-strip sw-window-strip--' + side + '">';
      html += '<span class="sw-window-label">' + label + '</span>';
      html += '<div class="sw-window-slots">';
      for (let i = 0; i < frames.length; i++) {
        const f = frames[i];
        let cls = 'sw-slot';
        cls += ' sw-slot--' + f.status;
        if (f.inWindow !== undefined && f.inWindow) cls += ' sw-slot--in-window';
        html += '<div class="' + cls + '" title="Frame ' + f.frame + ' (' + f.status + ')">' + f.frame + '</div>';
      }
      html += '</div></div>';
      return html;
    }

    function draw() {
      const state = replayState(index);

      const actions = events.slice(0, index + 1).flatMap((event) => {
        if (event.state === 'sent' || event.state === 'resent') return [{ type: 'frame', label: 'F' + event.frame }];
        if (event.state === 'lost') return [{ type: 'frame', label: 'F' + event.frame, outcome: 'lost' }];
        if (event.state === 'buffered') return [{ type: 'deliver', label: 'F' + event.frame + ' buffered' }, { type: 'ack', label: 'ACK' + event.frame }];
        if (event.state === 'acked') return [{ type: 'frame', label: 'F' + event.frame }, { type: 'ack', label: 'ACK' + event.frame }];
        if (event.state === 'timeout') return [{ type: 'timeout', label: 'timeout' }];
        if (event.state === 'delivered') return [{ type: 'deliver', label: 'F' + event.frame + ' delivered' }];
        return [];
      });

      const senderStrip = renderWindowStrip(
        'Sender Window [' + state.senderBase + '\u2013' + state.senderWindowEnd + '] size=' + windowSize,
        state.senderWindow, 'sender');
      const receiverStrip = renderWindowStrip(
        'Receiver (expects frame ' + state.receiverExpects + ')',
        state.receiverWindow, 'receiver');

      host.innerHTML = `
        <div class="sw-window-panel">${senderStrip}${receiverStrip}</div>
        ${NetSim.Components.renderTimingDiagram(actions, actions.length - 1)}
        <p class="timing-caption">The receiver buffers out-of-order frames and the sender retransmits only the missing frame.</p>
      `;

      /* Scroll the timing diagram to the bottom so the latest step is visible. */
      const scrollBox = host.querySelector('.timing-diagram-scroll');
      if (scrollBox) scrollBox.scrollTop = scrollBox.scrollHeight;

      ctx.setMetrics([
        { label: 'Window Size', value: String(windowSize) },
        { label: 'Sender Window', value: 'F' + state.senderBase + '\u2013F' + state.senderWindowEnd },
        { label: 'Receiver Expects', value: 'Frame ' + state.receiverExpects },
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
        ctx.canvas.innerHTML = '<div class="sr-mount"></div>';
        host = ctx.canvas.querySelector('.sr-mount');
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
