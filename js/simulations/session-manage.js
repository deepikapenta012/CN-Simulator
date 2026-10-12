/* ==========================================================================
   NetSim — simulations/session-manage.js
   Two tabs covering what the session layer does *during* a session:
   - Checkpointing: synchronization points let a failed transfer resume
     from the last confirmed checkpoint instead of starting over.
   - Dialog Control: in half-duplex mode only the token holder may send.
   ========================================================================== */

(function (NetSim) {
  'use strict';

  const TOTAL_PAGES = 12;

  NetSim.SimRegistry.register('session-manage', function factory(ctx) {
    let mode = 'checkpoint';
    let interval = 3;
    let failAt = 8;
    let events = [];
    let index = -1;
    let timer = null;
    let host = null;
    let stats = {};

    function buildCheckpointEvents() {
      const out = [];
      const lastCheckpoint = Math.floor((failAt - 1) / interval) * interval;
      for (let p = 1; p < failAt; p++) {
        out.push({ text: 'Page ' + p + ' sent and delivered.', page: p, state: 'delivered' });
        if (p % interval === 0) out.push({ text: 'Checkpoint at page ' + p + ' confirmed \u2014 the receiver acknowledges everything up to here is safely stored.', level: 'success', checkpoint: p });
      }
      out.push({ text: 'Connection fails while page ' + failAt + ' is being sent!', level: 'error', page: failAt, state: 'lost' });
      out.push({ text: 'Session is re-established. Both sides agree to resume from the last checkpoint: page ' + lastCheckpoint + (lastCheckpoint === 0 ? ' (none reached \u2014 restart from the beginning).' : '.'), level: 'warning', resumeFrom: lastCheckpoint });
      for (let p = lastCheckpoint + 1; p <= TOTAL_PAGES; p++) {
        out.push({ text: 'Page ' + p + ' sent and delivered' + (p < failAt ? ' (re-sent)' : '') + '.', page: p, state: 'delivered' });
        if (p % interval === 0 && p < TOTAL_PAGES) out.push({ text: 'Checkpoint at page ' + p + ' confirmed.', level: 'success', checkpoint: p });
      }
      out.push({ text: 'Transfer complete.', level: 'success' });
      stats = {
        lastCheckpoint,
        resent: failAt - 1 - lastCheckpoint,
        withCheckpoints: (failAt - 1) + (TOTAL_PAGES - lastCheckpoint),
        without: (failAt - 1) + TOTAL_PAGES
      };
      return out;
    }

    function buildDialogEvents() {
      stats = { sent: 0, blocked: 0 };
      return [
        { text: 'Half-duplex dialog: only the side holding the token may send. A holds it first.', holder: 'A' },
        { text: 'A sends a request.', holder: 'A', dir: 'a2b', sent: true },
        { text: 'B tries to send a message without the token \u2014 the session layer blocks it.', holder: 'A', dir: 'b2a', level: 'warning', blocked: true },
        { text: 'A is finished and passes the token to B.', holder: 'B', level: 'success' },
        { text: 'B sends its response.', holder: 'B', dir: 'b2a', sent: true },
        { text: 'A tries to send again without the token \u2014 blocked.', holder: 'B', dir: 'a2b', level: 'warning', blocked: true },
        { text: 'B passes the token back to A.', holder: 'A', level: 'success' },
        { text: 'A sends a follow-up. Strict turn-taking kept the dialog orderly the whole time.', holder: 'A', dir: 'a2b', sent: true, level: 'success' }
      ];
    }

    function drawCheckpoint() {
      const upTo = events.slice(0, index + 1);
      const pageState = {};
      const checkpoints = new Set();
      upTo.forEach((e) => {
        if (e.page) pageState[e.page] = e.state;
        if (e.checkpoint) checkpoints.add(e.checkpoint);
        if (e.resumeFrom !== undefined) { for (let p = e.resumeFrom + 1; p <= TOTAL_PAGES; p++) delete pageState[p]; }
      });
      const chips = [];
      for (let p = 1; p <= TOTAL_PAGES; p++) {
        const st = pageState[p] || 'pending';
        const cls = st === 'delivered' ? 'delivered' : st === 'lost' ? 'lost' : 'pending';
        chips.push(`<span class="packet-chip ${cls}">${p}${checkpoints.has(p) ? '\u25c6' : ''}</span>`);
      }
      host.innerHTML = `
        <div class="packet-status-strip">${chips.join('')}</div>
        <p class="net-hint" style="margin-top:0.7rem;">\u25c6 = confirmed checkpoint &nbsp;\u00b7&nbsp; red = page lost when the connection failed</p>
      `;
      const recovered = upTo.some((e) => e.resumeFrom !== undefined);
      ctx.setMetrics([
        { label: 'Checkpoint Interval', value: 'every ' + interval + ' pages' },
        { label: 'Failure At', value: 'page ' + failAt },
        { label: 'Last Checkpoint', value: stats.lastCheckpoint === 0 ? 'none' : 'page ' + stats.lastCheckpoint },
        { label: 'Pages Sent (with checkpoints)', value: String(stats.withCheckpoints) },
        { label: 'Pages Sent (no checkpoints)', value: String(stats.without) },
        { label: 'Transmissions Saved', value: recovered ? String(stats.lastCheckpoint) : '\u2014' }
      ]);
    }

    function drawDialog() {
      const step = events[Math.max(0, index)] || {};
      const holder = step.holder || 'A';
      const upTo = events.slice(0, index + 1);
      const arrow = step.dir === 'a2b' ? '\u2192' : step.dir === 'b2a' ? '\u2190' : '\u2194';
      host.innerHTML = `
        <div class="fw-diagram">
          <div class="fw-node" style="${holder === 'A' ? 'border-color:var(--accent);background:var(--accent-soft);' : ''}">A${holder === 'A' ? '<br><span style="font-size:0.65rem;">[TOKEN]</span>' : ''}</div>
          <div class="fw-packet-track"><span class="fw-arrow" style="font-size:1.3rem;${step.blocked ? 'color:var(--err);' : ''}">${step.blocked ? '\u2717' : arrow}</span></div>
          <div class="fw-node" style="${holder === 'B' ? 'border-color:var(--accent);background:var(--accent-soft);' : ''}">B${holder === 'B' ? '<br><span style="font-size:0.65rem;">[TOKEN]</span>' : ''}</div>
        </div>
      `;
      ctx.setMetrics([
        { label: 'Dialog Mode', value: 'Half-duplex (token-controlled)' },
        { label: 'Token Holder', value: holder },
        { label: 'Messages Sent', value: String(upTo.filter((e) => e.sent).length) },
        { label: 'Sends Blocked (no token)', value: String(upTo.filter((e) => e.blocked).length) }
      ]);
    }

    function draw() { if (mode === 'checkpoint') drawCheckpoint(); else drawDialog(); }

    function renderParams() {
      ctx.params.hidden = false;
      const tabs = `
        <div class="switch-tabs" role="tablist" aria-label="Session management topic">
          <button type="button" class="switch-tab ${mode === 'checkpoint' ? 'is-active' : ''}" data-mode="checkpoint" role="tab">Checkpointing</button>
          <button type="button" class="switch-tab ${mode === 'dialog' ? 'is-active' : ''}" data-mode="dialog" role="tab">Dialog Control</button>
        </div>
      `;
      const sliders = mode === 'checkpoint' ? `
        <div class="sim-param-row"><label for="smInterval">Checkpoint Every</label>
          <input type="range" id="smInterval" min="2" max="6" step="1" value="${interval}">
          <span class="val" id="smIntervalVal">${interval}</span></div>
        <div class="sim-param-row"><label for="smFail">Failure At Page</label>
          <input type="range" id="smFail" min="3" max="11" step="1" value="${failAt}">
          <span class="val" id="smFailVal">${failAt}</span></div>
      ` : '';
      ctx.params.innerHTML = tabs + sliders;
      ctx.params.querySelectorAll('.switch-tab').forEach((tab) => {
        tab.addEventListener('click', () => { if (tab.dataset.mode === mode) return; mode = tab.dataset.mode; rebuild(); });
      });
      if (mode === 'checkpoint') {
        ctx.params.querySelector('#smInterval').addEventListener('change', (e) => { interval = parseInt(e.target.value, 10); rebuild(); });
        ctx.params.querySelector('#smInterval').addEventListener('input', (e) => { ctx.params.querySelector('#smIntervalVal').textContent = e.target.value; });
        ctx.params.querySelector('#smFail').addEventListener('change', (e) => { failAt = parseInt(e.target.value, 10); rebuild(); });
        ctx.params.querySelector('#smFail').addEventListener('input', (e) => { ctx.params.querySelector('#smFailVal').textContent = e.target.value; });
      }
    }

    function rebuild() {
      stop();
      index = -1;
      events = mode === 'checkpoint' ? buildCheckpointEvents() : buildDialogEvents();
      renderParams();
      draw();
      ctx.log(mode === 'checkpoint' ? 'Ready \u2014 a ' + TOTAL_PAGES + '-page transfer with checkpoints every ' + interval + ' pages.' : 'Ready \u2014 two parties sharing one token.');
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
        ctx.canvas.innerHTML = '<div class="smgr-mount"></div>';
        host = ctx.canvas.querySelector('.smgr-mount');
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
