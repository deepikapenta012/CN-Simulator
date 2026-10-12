/* ==========================================================================
   NetSim — simulations/session-terminate.js
   Two tabs, one scenario: the client has three messages in flight when
   the session ends. A graceful release drains them first and loses
   nothing; an abrupt abort loses the unsent ones, and the server only
   finds out when its inactivity timeout fires.
   ========================================================================== */

(function (NetSim) {
  'use strict';

  NetSim.SimRegistry.register('session-terminate', function factory(ctx) {
    let mode = 'graceful';
    let events = [];
    let index = -1;
    let timer = null;
    let host = null;

    function buildEvents() {
      if (mode === 'graceful') {
        return [
          { text: 'The client has 3 messages still in flight when its application decides to end the session.', delivered: 0, lost: 0 },
          { text: 'Client sends a session release request \u2014 but first waits for its pending data to be acknowledged.', dir: 'c2s', delivered: 0, lost: 0 },
          { text: 'Server receives and acknowledges all 3 pending messages.', dir: 's2c', delivered: 3, lost: 0, level: 'success' },
          { text: 'Server sends a release confirmation.', dir: 's2c', delivered: 3, lost: 0 },
          { text: 'Client acknowledges. Session ID, buffers and timers are freed on both sides.', dir: 'c2s', delivered: 3, lost: 0, freed: true, level: 'success' },
          { text: 'Orderly release complete \u2014 nothing was lost, and both sides know the session is over.', delivered: 3, lost: 0, freed: true, level: 'success' }
        ];
      }
      return [
        { text: 'The client has 3 messages still in flight when its application suddenly crashes.', delivered: 0, lost: 0 },
        { text: 'No release request is ever sent \u2014 the connection is simply aborted.', level: 'error', delivered: 0, lost: 0 },
        { text: 'Only 1 of the 3 in-flight messages reached the server. The other 2 are gone.', level: 'warning', delivered: 1, lost: 2 },
        { text: 'The server has no idea anything went wrong \u2014 it just waits for more data.', delivered: 1, lost: 2 },
        { text: 'The 30-second inactivity timeout expires. The server declares the session dead.', level: 'warning', delivered: 1, lost: 2, waited: true },
        { text: 'Server discards the partial data and frees the session resources. The client\u2019s 2 lost messages are never recovered.', level: 'error', delivered: 1, lost: 2, freed: true, waited: true }
      ];
    }

    function draw() {
      const step = events[Math.max(0, index)] || { delivered: 0, lost: 0 };
      const arrow = step.dir === 'c2s' ? '\u2192' : step.dir === 's2c' ? '\u2190' : '\u2194';
      const chips = [0, 1, 2].map((i) => {
        const cls = mode === 'graceful'
          ? (step.delivered > i ? 'delivered' : 'in-flight')
          : (i < step.delivered ? 'delivered' : (step.lost > 0 && i >= 3 - step.lost ? 'lost' : 'in-flight'));
        return `<span class="packet-chip ${cls}">M${i + 1}</span>`;
      }).join('');
      host.innerHTML = `
        <div class="fw-diagram">
          <div class="fw-node">Client</div>
          <div class="fw-packet-track"><span class="fw-arrow" style="font-size:1.3rem;${mode === 'abrupt' && index >= 1 ? 'color:var(--err);' : ''}">${mode === 'abrupt' && index >= 1 ? '\u2717' : arrow}</span></div>
          <div class="fw-node" style="border-color:var(--teal);color:var(--teal);">Server</div>
        </div>
        <div class="packet-status-strip" style="margin-top:0.75rem;">${chips}</div>
      `;
      ctx.setMetrics([
        { label: 'Termination Type', value: mode === 'graceful' ? 'Graceful (orderly release)' : 'Abrupt (abort)' },
        { label: 'Messages Delivered', value: step.delivered + ' / 3' },
        { label: 'Messages Lost', value: String(step.lost) },
        { label: 'Server Learned of End Via', value: mode === 'graceful' ? 'Release handshake' : (step.waited ? '30 s inactivity timeout' : 'Not yet \u2014 still waiting') },
        { label: 'Resources Freed', value: step.freed ? 'Yes' : 'Not yet' }
      ]);
    }

    function renderParams() {
      ctx.params.hidden = false;
      ctx.params.innerHTML = `
        <div class="switch-tabs" role="tablist" aria-label="Termination type">
          <button type="button" class="switch-tab ${mode === 'graceful' ? 'is-active' : ''}" data-mode="graceful" role="tab">Graceful</button>
          <button type="button" class="switch-tab ${mode === 'abrupt' ? 'is-active' : ''}" data-mode="abrupt" role="tab">Abrupt</button>
        </div>
      `;
      ctx.params.querySelectorAll('.switch-tab').forEach((tab) => {
        tab.addEventListener('click', () => { if (tab.dataset.mode === mode) return; mode = tab.dataset.mode; rebuild(); });
      });
    }

    function rebuild() {
      stop();
      index = -1;
      events = buildEvents();
      renderParams();
      draw();
      ctx.log('Ready \u2014 a ' + mode + ' session termination with 3 messages in flight.');
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
        ctx.canvas.innerHTML = '<div class="sterm-mount"></div>';
        host = ctx.canvas.querySelector('.sterm-mount');
        rebuild();
      },
      start() { if (timer) return; timer = setInterval(() => { if (index >= events.length - 1) { stop(); return; } advance(); }, 750); },
      pause() { stop(); },
      step() { stop(); advance(); },
      reset() { rebuild(); },
      destroy() { stop(); }
    };
  });

})(window.NetSim = window.NetSim || {});
