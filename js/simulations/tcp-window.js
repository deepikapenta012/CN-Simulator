/* ==========================================================================
   NetSim — simulations/tcp-window.js
   The receiver advertises how much buffer space it has left (rwnd). A
   slow-reading application lets that buffer fill up — all the way to a
   genuine zero window, forcing the sender to pause and probe — then
   drains it again as the application catches up.
   ========================================================================== */

(function (NetSim) {
  'use strict';

  const BUFFER_CAPACITY = 8;
  // per-round: [segments sender attempts to send is derived from rwnd, app reads this many]
  const APP_READ_SCHEDULE = [1, 1, 0, 0, 1, 3, 2, 2];

  NetSim.SimRegistry.register('tcp-window', function factory(ctx) {
    let rounds = [];
    let index = -1;
    let timer = null;
    let host = null;

    function buildRounds() {
      const out = [];
      let bufferedUnread = 0;
      let totalSent = 0;
      const totalData = 14;

      APP_READ_SCHEDULE.forEach((readAmt, i) => {
        const rwnd = BUFFER_CAPACITY - bufferedUnread;
        if (rwnd === 0) {
          out.push({ text: 'Round ' + (i + 1) + ': receive window is 0 \u2014 sender cannot send data, only a 1-byte window probe to check if space has opened up.', rwnd: 0, level: 'warning', bufferedUnread });
        } else if (totalSent < totalData) {
          const toSend = Math.min(rwnd, totalData - totalSent);
          bufferedUnread += toSend;
          totalSent += toSend;
          out.push({ text: 'Round ' + (i + 1) + ': rwnd = ' + rwnd + ' \u2014 sender transmits ' + toSend + ' segment(s). Receiver buffer now holds ' + bufferedUnread + '/' + BUFFER_CAPACITY + ' unread.', rwnd, level: 'normal', bufferedUnread });
        } else {
          out.push({ text: 'Round ' + (i + 1) + ': all data already sent, nothing more to transmit.', rwnd, bufferedUnread });
        }
        const read = Math.min(readAmt, bufferedUnread);
        bufferedUnread -= read;
        if (read > 0) out.push({ text: 'The application reads ' + read + ' segment(s) from the buffer. Unread drops to ' + bufferedUnread + '/' + BUFFER_CAPACITY + ' \u2014 window reopens to ' + (BUFFER_CAPACITY - bufferedUnread) + '.', level: 'success', bufferedUnread });
      });
      out.push({ text: 'All ' + totalData + ' segments delivered.', level: 'success', bufferedUnread: 0 });
      return out;
    }

    function draw() {
      const r = rounds[Math.max(0, index)] || { bufferedUnread: 0 };
      const filled = r.bufferedUnread || 0;
      const cells = [];
      for (let i = 0; i < BUFFER_CAPACITY; i++) cells.push(`<span class="bitbox ${i < filled ? 'is-active' : ''}" style="width:1.8rem;height:1.8rem;"></span>`);
      host.innerHTML = `
        <p class="net-hint" style="text-align:center;">Receiver buffer (${filled}/${BUFFER_CAPACITY} unread)</p>
        <div class="bitgrid">${cells.join('')}</div>
        <p class="net-hint" style="text-align:center;margin-top:0.5rem;">Advertised window (rwnd) = ${BUFFER_CAPACITY - filled}</p>
      `;
      ctx.setMetrics([
        { label: 'Buffer Capacity', value: String(BUFFER_CAPACITY) + ' segments' },
        { label: 'Currently Unread', value: String(filled) },
        { label: 'Current rwnd', value: String(BUFFER_CAPACITY - filled) },
        { label: 'Zero-Window Events', value: String(rounds.slice(0, index + 1).filter((e) => e.rwnd === 0).length) }
      ]);
    }

    function rebuild() {
      stop();
      index = -1;
      rounds = buildRounds();
      ctx.params.hidden = true;
      draw();
      ctx.log('Ready \u2014 sender about to transmit while the application reads slowly at first.');
    }

    function stop() { if (timer) { NetSim.SimTiming.clearInterval(timer); timer = null; } }

    function advance() {
      if (index >= rounds.length - 1) { stop(); return; }
      index += 1;
      ctx.log(rounds[index].text, rounds[index].level === 'normal' ? undefined : rounds[index].level);
      draw();
    }

    return {
      initialize() {
        ctx.canvas.classList.add('net-canvas');
        ctx.canvas.innerHTML = '<div class="tcpwin-mount"></div>';
        host = ctx.canvas.querySelector('.tcpwin-mount');
        rebuild();
      },
      start() { if (timer) return; timer = NetSim.SimTiming.setInterval(() => { if (index >= rounds.length - 1) { stop(); return; } advance(); }, 600); },
      pause() { stop(); },
      step() { stop(); advance(); },
      reset() { rebuild(); },
      destroy() { stop(); }
    };
  });

})(window.NetSim = window.NetSim || {});
