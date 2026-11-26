/* ==========================================================================
   NetSim — simulations/session-manage.js  (REBUILT)
   Interactive Session Management simulation with two modes:
     A) Checkpointing — SVG page-transfer timeline with sync points,
        failure + resume visualization, configurable interval/failure
     B) Dialog Control — SVG token-passing timeline showing half-duplex
        turn-taking with blocked sends
   ========================================================================== */

(function (NetSim) {
  'use strict';

  var TOTAL_PAGES = 12;

  /* ---- Build checkpoint events ---- */
  function buildCheckpointEvents(interval, failAt) {
    var events = [];
    var lastCp = Math.floor((failAt - 1) / interval) * interval;

    for (var p = 1; p < failAt; p++) {
      events.push({ type: 'page', page: p, state: 'ok', text: 'Page ' + p + ' sent and delivered.', level: 'info' });
      if (p % interval === 0) {
        events.push({ type: 'checkpoint', page: p, text: '✓ Checkpoint at page ' + p + ' — receiver confirms everything up to here is safely stored. If the connection fails, resume from here.', level: 'success' });
      }
    }

    events.push({ type: 'fail', page: failAt, text: '⚡ Connection FAILS while sending page ' + failAt + '! Data in transit is lost.', level: 'warning' });

    events.push({ type: 'resume', resumeFrom: lastCp, text: 'Session re-established. Both sides agree to resume from last checkpoint: page ' + (lastCp || 0) + (lastCp === 0 ? ' (none — restart from beginning!)' : '') + '. Saved retransmitting ' + lastCp + ' pages.', level: 'info' });

    for (var p2 = lastCp + 1; p2 <= TOTAL_PAGES; p2++) {
      events.push({ type: 'page', page: p2, state: p2 < failAt ? 'resent' : 'ok', text: 'Page ' + p2 + (p2 < failAt ? ' RE-SENT (was lost after failure)' : ' sent and delivered') + '.', level: p2 < failAt ? 'warning' : 'info' });
      if (p2 % interval === 0 && p2 < TOTAL_PAGES) {
        events.push({ type: 'checkpoint', page: p2, text: '✓ Checkpoint at page ' + p2 + ' confirmed.', level: 'success' });
      }
    }

    events.push({ type: 'done', text: '✅ Transfer complete! All ' + TOTAL_PAGES + ' pages delivered. Without checkpoints, all ' + (failAt - 1) + ' pages before the failure would have been re-sent.', level: 'success' });

    return { events: events, lastCp: lastCp, resent: failAt - 1 - lastCp, withCp: (failAt - 1) + (TOTAL_PAGES - lastCp), withoutCp: (failAt - 1) + TOTAL_PAGES };
  }

  /* ---- Build dialog events ---- */
  function buildDialogEvents() {
    return [
      { holder: 'A', dir: 'none', text: 'Half-duplex dialog: only the side holding the TOKEN may send. Party A holds it first.', level: 'info', sent: false, blocked: false },
      { holder: 'A', dir: 'right', text: 'A sends a request message. A holds the token, so the session layer allows this.', level: 'info', sent: true, blocked: false },
      { holder: 'A', dir: 'left-blocked', text: 'B tries to send without the token — the session layer BLOCKS it! B must wait for A to release the token.', level: 'warning', sent: false, blocked: true },
      { holder: 'pass-to-B', dir: 'right', text: 'A is finished and passes the token to B. The S-TOKEN-GIVE SPDU transfers send permission.', level: 'success', sent: false, blocked: false },
      { holder: 'B', dir: 'left', text: 'B now holds the token and sends its response. The session layer permits this.', level: 'info', sent: true, blocked: false },
      { holder: 'B', dir: 'right-blocked', text: 'A tries to send again without the token — BLOCKED! Strict turn-taking is enforced.', level: 'warning', sent: false, blocked: true },
      { holder: 'pass-to-A', dir: 'left', text: 'B passes the token back to A. Dialog control ensures orderly communication.', level: 'success', sent: false, blocked: false },
      { holder: 'A', dir: 'right', text: 'A sends a follow-up message. The token mechanism kept the entire dialog orderly.', level: 'success', sent: true, blocked: false }
    ];
  }

  /* ---- SVG for checkpoint mode ---- */
  function renderCheckpointSVG(events, currentIdx, interval) {
    var W = 560, cellW = 38, cellH = 36, pad = 10;
    var cols = TOTAL_PAGES;
    var H = cellH + pad * 2 + 60;

    var svg = '<svg class="smgr-cp-svg" viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="Checkpoint transfer">';
    svg += '<text x="' + (W / 2) + '" y="15" text-anchor="middle" class="smgr-cp-title">Page Transfer Progress</text>';

    var pageState = {};
    var checkpoints = {};
    var failed = false;
    var resumed = false;

    for (var i = 0; i <= Math.min(currentIdx, events.length - 1); i++) {
      var e = events[i];
      if (e.type === 'page') pageState[e.page] = e.state;
      if (e.type === 'checkpoint') checkpoints[e.page] = true;
      if (e.type === 'fail') { pageState[e.page] = 'lost'; failed = true; }
      if (e.type === 'resume') { resumed = true; for (var k in pageState) { if (parseInt(k) > e.resumeFrom) delete pageState[k]; } }
    }

    var startX = (W - cols * cellW) / 2;
    for (var p = 1; p <= TOTAL_PAGES; p++) {
      var x = startX + (p - 1) * cellW;
      var y = pad + 22;
      var st = pageState[p] || 'pending';
      var fill, stroke, textFill;

      if (st === 'ok') { fill = '#e8f5e9'; stroke = '#2e7d32'; textFill = '#1b5e20'; }
      else if (st === 'resent') { fill = '#fff3e0'; stroke = '#e65100'; textFill = '#e65100'; }
      else if (st === 'lost') { fill = '#ffebee'; stroke = '#d32f2f'; textFill = '#d32f2f'; }
      else { fill = 'var(--paper-raised)'; stroke = 'var(--line)'; textFill = 'var(--ink-faint)'; }

      svg += '<rect x="' + x + '" y="' + y + '" width="' + (cellW - 2) + '" height="' + cellH + '" rx="4" fill="' + fill + '" stroke="' + stroke + '" stroke-width="1.5"/>';
      svg += '<text x="' + (x + cellW / 2 - 1) + '" y="' + (y + cellH / 2 + 5) + '" text-anchor="middle" class="smgr-cp-page" fill="' + textFill + '">' + p + '</text>';

      if (checkpoints[p]) {
        svg += '<text x="' + (x + cellW / 2 - 1) + '" y="' + (y + cellH + 14) + '" text-anchor="middle" fill="#2e7d32" font-size="11">◆</text>';
      }
      if (p % interval === 0) {
        svg += '<line x1="' + (x + cellW / 2 - 1) + '" y1="' + (y - 2) + '" x2="' + (x + cellW / 2 - 1) + '" y2="' + (y - 6) + '" stroke="#2e7d32" stroke-width="1.5"/>';
      }
    }

    // Legend
    var ly = H - 14;
    svg += '<rect x="10" y="' + (ly - 8) + '" width="10" height="10" rx="2" fill="#e8f5e9" stroke="#2e7d32"/>';
    svg += '<text x="24" y="' + ly + '" class="smgr-legend">Delivered</text>';
    svg += '<rect x="90" y="' + (ly - 8) + '" width="10" height="10" rx="2" fill="#fff3e0" stroke="#e65100"/>';
    svg += '<text x="104" y="' + ly + '" class="smgr-legend">Re-sent</text>';
    svg += '<rect x="160" y="' + (ly - 8) + '" width="10" height="10" rx="2" fill="#ffebee" stroke="#d32f2f"/>';
    svg += '<text x="174" y="' + ly + '" class="smgr-legend">Lost</text>';
    svg += '<text x="230" y="' + ly + '" fill="#2e7d32" font-size="11">◆</text>';
    svg += '<text x="244" y="' + ly + '" class="smgr-legend">Checkpoint</text>';

    svg += '</svg>';
    return svg;
  }

  /* ---- SVG for dialog mode ---- */
  function renderDialogSVG(events, currentIdx) {
    var W = 520, rowH = 44, topPad = 50;
    var visible = events.slice(0, currentIdx + 1);
    var rows = Math.max(visible.length, 1);
    var H = topPad + rows * rowH + 20;
    var aX = 100, bX = 420;

    var svg = '<svg class="smgr-dlg-svg" viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="Dialog control timeline">';

    svg += '<text x="' + aX + '" y="20" text-anchor="middle" class="smgr-dlg-header" fill="#1565c0">Party A</text>';
    svg += '<text x="' + bX + '" y="20" text-anchor="middle" class="smgr-dlg-header" fill="#6a1b9a">Party B</text>';

    svg += '<line x1="' + aX + '" y1="40" x2="' + aX + '" y2="' + (H - 5) + '" stroke="#1565c0" stroke-width="2" stroke-dasharray="4 3"/>';
    svg += '<line x1="' + bX + '" y1="40" x2="' + bX + '" y2="' + (H - 5) + '" stroke="#6a1b9a" stroke-width="2" stroke-dasharray="4 3"/>';

    // Show token holder
    visible.forEach(function (ev, i) {
      var y = topPad + i * rowH;
      var active = i === currentIdx;
      var sw = active ? '3' : '2';
      var midX = (aX + bX) / 2;

      if (ev.dir === 'right') {
        svg += '<line x1="' + aX + '" y1="' + y + '" x2="' + bX + '" y2="' + (y + rowH * 0.35) + '" stroke="#1565c0" stroke-width="' + sw + '" marker-end="url(#smgr-arr)"/>';
      } else if (ev.dir === 'left') {
        svg += '<line x1="' + bX + '" y1="' + y + '" x2="' + aX + '" y2="' + (y + rowH * 0.35) + '" stroke="#6a1b9a" stroke-width="' + sw + '" marker-end="url(#smgr-arr)"/>';
      } else if (ev.dir === 'right-blocked' || ev.dir === 'left-blocked') {
        var fromX = ev.dir === 'right-blocked' ? aX : bX;
        var toX = ev.dir === 'right-blocked' ? bX : aX;
        svg += '<line x1="' + fromX + '" y1="' + y + '" x2="' + midX + '" y2="' + (y + rowH * 0.2) + '" stroke="#d32f2f" stroke-width="' + sw + '" stroke-dasharray="5 3"/>';
        svg += '<text x="' + midX + '" y="' + (y + rowH * 0.2 + 5) + '" text-anchor="middle" fill="#d32f2f" font-size="16" font-weight="800">✕</text>';
        svg += '<text x="' + (midX + 14) + '" y="' + (y + rowH * 0.2 + 5) + '" class="smgr-blocked-label" fill="#d32f2f">BLOCKED</text>';
      } else {
        var noteColor = ev.level === 'success' ? '#2e7d32' : '#6a1b9a';
        svg += '<rect x="' + (aX + 10) + '" y="' + (y + 5) + '" width="' + (bX - aX - 20) + '" height="22" rx="11" fill="' + noteColor + '" fill-opacity="0.08" stroke="' + noteColor + '" stroke-width="1.5"/>';
      }

      // Label
      var holder = ev.holder;
      var labelText = '';
      if (ev.blocked) labelText = 'BLOCKED — no token!';
      else if (holder === 'pass-to-B') labelText = '🎫 Token → B';
      else if (holder === 'pass-to-A') labelText = '🎫 Token → A';
      else if (ev.sent) labelText = (holder === 'A' ? 'A' : 'B') + ' sends (has token)';
      else labelText = 'Token: ' + holder;

      svg += '<text x="' + midX + '" y="' + (y - 3) + '" text-anchor="middle" class="smgr-dlg-label" fill="' + (ev.blocked ? '#d32f2f' : 'var(--ink-soft)') + '">' + labelText + '</text>';
    });

    svg += '<defs><marker id="smgr-arr" markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto"><path d="M0,1 L0,7 L7,4 z" fill="var(--ink)"/></marker></defs>';
    svg += '</svg>';
    return svg;
  }

  /* ---- Token display ---- */
  function renderTokenStrip(ev) {
    if (!ev) return '';
    var holder = ev.holder;
    var realHolder = holder === 'pass-to-B' ? 'B' : holder === 'pass-to-A' ? 'A' : holder;
    var html = '<div class="smgr-token-strip">';
    html += '<span class="smgr-token-label">Token Holder:</span>';
    html += '<span class="smgr-token-box' + (realHolder === 'A' ? ' is-holder' : '') + '" style="border-color:#1565c0;color:#1565c0">A' + (realHolder === 'A' ? ' 🎫' : '') + '</span>';
    html += '<span class="smgr-token-box' + (realHolder === 'B' ? ' is-holder' : '') + '" style="border-color:#6a1b9a;color:#6a1b9a">B' + (realHolder === 'B' ? ' 🎫' : '') + '</span>';
    if (ev.blocked) html += '<span class="smgr-token-warn">⚠ Send attempt without token!</span>';
    html += '</div>';
    return html;
  }

  /* ==== Main simulation ==== */
  NetSim.SimRegistry.register('session-manage', function factory(ctx) {
    var mode = 'checkpoint';
    var interval = 3;
    var failAt = 8;
    var sim = null;
    var dialogEvents = [];
    var events = [];
    var index = -1;
    var timer = null;
    var host = null;

    function rebuild() {
      stop(); index = -1;
      if (mode === 'checkpoint') {
        sim = buildCheckpointEvents(interval, failAt);
        events = sim.events;
      } else {
        dialogEvents = buildDialogEvents();
        events = dialogEvents;
        sim = null;
      }
      draw(); renderParams();
      ctx.log(mode === 'checkpoint' ? 'Checkpointing — ' + TOTAL_PAGES + ' pages, checkpoint every ' + interval + ', fail at page ' + failAt : 'Dialog Control — half-duplex token passing');
    }

    function draw() {
      var ev = index >= 0 && events[index] ? events[index] : null;
      var html = '';

      if (mode === 'checkpoint') {
        html += renderCheckpointSVG(events, index, interval);

        // Comparison box
        if (sim) {
          html += '<div class="smgr-compare">';
          html += '<div class="smgr-compare-col smgr-compare-with"><div class="smgr-compare-title">With Checkpoints</div><div class="smgr-compare-val">' + sim.withCp + ' pages sent</div><div class="smgr-compare-note">Resume from page ' + sim.lastCp + '</div></div>';
          html += '<div class="smgr-compare-col smgr-compare-without"><div class="smgr-compare-title">Without Checkpoints</div><div class="smgr-compare-val">' + sim.withoutCp + ' pages sent</div><div class="smgr-compare-note">Restart from page 0</div></div>';
          html += '</div>';
        }

        ctx.setMetrics([
          { label: 'Mode', value: 'Checkpointing' },
          { label: 'Checkpoint Interval', value: 'Every ' + interval + ' pages' },
          { label: 'Failure At', value: 'Page ' + failAt },
          { label: 'Last Checkpoint', value: sim.lastCp === 0 ? 'None' : 'Page ' + sim.lastCp },
          { label: 'Pages Re-sent', value: String(sim.resent) },
          { label: 'Step', value: (index + 1) + ' / ' + events.length }
        ]);
      } else {
        html += renderTokenStrip(ev);
        html += renderDialogSVG(events, index);

        var sent = 0, blocked = 0;
        for (var i = 0; i <= Math.min(index, events.length - 1); i++) {
          if (events[i].sent) sent++;
          if (events[i].blocked) blocked++;
        }
        ctx.setMetrics([
          { label: 'Mode', value: 'Dialog Control (Half-duplex)' },
          { label: 'Token Holder', value: ev ? (ev.holder === 'pass-to-B' ? 'B' : ev.holder === 'pass-to-A' ? 'A' : ev.holder) : 'A' },
          { label: 'Messages Sent', value: String(sent) },
          { label: 'Sends Blocked', value: String(blocked) },
          { label: 'Step', value: (index + 1) + ' / ' + events.length }
        ]);
      }

      // Info
      html += '<div class="smgr-info"><h4 class="smgr-info-title">Session Layer — Management</h4>';
      html += '<ul class="smgr-info-props">';
      if (mode === 'checkpoint') {
        html += '<li><strong>Synchronization points</strong> — save progress so failures don\'t require full restart</li>';
        html += '<li><strong>Major sync point</strong> — both sides confirm; can\'t roll back past it</li>';
        html += '<li><strong>Minor sync point</strong> — sender marks progress; receiver may or may not confirm</li>';
        html += '<li><strong>Resynchronize</strong> — after failure, both sides agree on the last confirmed checkpoint</li>';
      } else {
        html += '<li><strong>Token management</strong> — controls who can send in half-duplex mode</li>';
        html += '<li><strong>S-TOKEN-GIVE</strong> — SPDU that transfers send permission</li>';
        html += '<li><strong>Full-duplex</strong> — both sides can send simultaneously (no token needed)</li>';
        html += '<li><strong>Half-duplex</strong> — only token holder may send; prevents collisions</li>';
      }
      html += '</ul></div>';

      host.innerHTML = html;
    }

    function renderParams() {
      ctx.params.hidden = false;
      var html = '<fieldset class="switch-mode-group" role="radiogroup" aria-label="Mode">';
      html += '<legend class="section-label" style="margin:0 0 0.5rem;border:none;padding:0;">Topic</legend>';
      html += '<label class="switch-mode-option ' + (mode === 'checkpoint' ? 'is-checked' : '') + '"><input type="radio" name="smgrMode" value="checkpoint" ' + (mode === 'checkpoint' ? 'checked' : '') + '> Checkpointing</label>';
      html += '<label class="switch-mode-option ' + (mode === 'dialog' ? 'is-checked' : '') + '"><input type="radio" name="smgrMode" value="dialog" ' + (mode === 'dialog' ? 'checked' : '') + '> Dialog Control</label>';
      html += '</fieldset>';

      if (mode === 'checkpoint') {
        html += '<div class="sim-param-row"><label for="smInterval">Checkpoint Every</label><input type="range" id="smInterval" min="2" max="6" step="1" value="' + interval + '"><span class="val" id="smIntervalVal">' + interval + '</span></div>';
        html += '<div class="sim-param-row"><label for="smFail">Failure At Page</label><input type="range" id="smFail" min="3" max="11" step="1" value="' + failAt + '"><span class="val" id="smFailVal">' + failAt + '</span></div>';
      }

      ctx.params.innerHTML = html;
      ctx.params.querySelectorAll('input[name="smgrMode"]').forEach(function (r) { r.addEventListener('change', function () { mode = r.value; rebuild(); }); });
      if (mode === 'checkpoint') {
        var intEl = ctx.params.querySelector('#smInterval');
        var failEl = ctx.params.querySelector('#smFail');
        if (intEl) { intEl.addEventListener('input', function (e) { ctx.params.querySelector('#smIntervalVal').textContent = e.target.value; }); intEl.addEventListener('change', function (e) { interval = parseInt(e.target.value, 10); rebuild(); }); }
        if (failEl) { failEl.addEventListener('input', function (e) { ctx.params.querySelector('#smFailVal').textContent = e.target.value; }); failEl.addEventListener('change', function (e) { failAt = parseInt(e.target.value, 10); rebuild(); }); }
      }
    }

    function stop() { if (timer) { NetSim.SimTiming.clearInterval(timer); timer = null; } }
    function advance() { if (index >= events.length - 1) { stop(); return; } index++; ctx.log(events[index].text, events[index].level); draw(); }

    return {
      initialize: function () { ctx.canvas.classList.add('net-canvas'); ctx.canvas.innerHTML = '<div class="smgr-mount"></div>'; host = ctx.canvas.querySelector('.smgr-mount'); rebuild(); },
      start: function () { if (timer) return; timer = NetSim.SimTiming.setInterval(function () { if (index >= events.length - 1) { stop(); return; } advance(); }, 600); },
      pause: function () { stop(); },
      step: function () { stop(); advance(); },
      reset: function () { rebuild(); },
      destroy: function () { stop(); }
    };
  });

})(window.NetSim = window.NetSim || {});
