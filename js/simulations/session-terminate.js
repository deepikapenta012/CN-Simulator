/* ==========================================================================
   NetSim — simulations/session-terminate.js  (REBUILT)
   Interactive Session Termination simulation:
     - Graceful vs Abrupt teardown with SVG timeline
     - In-flight message visualization (delivered / lost)
     - State boxes showing both sides' state transitions
     - Resource cleanup tracking
   ========================================================================== */

(function (NetSim) {
  'use strict';

  /* ---- Build events ---- */
  function buildGracefulEvents() {
    return [
      { dir: 'none', label: '3 messages in flight',
        text: 'The client application decides to end the session. There are still 3 messages in the pipeline that have not yet been acknowledged.',
        cState: 'ESTABLISHED', sState: 'ESTABLISHED', delivered: 0, lost: 0, level: 'info' },
      { dir: 'right', label: 'S-RELEASE.request',
        text: 'Client sends a session release request (S-RELEASE.request SPDU). But first, it waits for all pending data to be flushed and acknowledged — no data will be lost.',
        cState: 'RELEASING', sState: 'ESTABLISHED', delivered: 0, lost: 0, level: 'info' },
      { dir: 'left', label: 'ACK all 3 messages',
        text: 'Server receives and acknowledges all 3 pending messages. All data is safely delivered before the session is torn down.',
        cState: 'RELEASING', sState: 'RELEASING', delivered: 3, lost: 0, level: 'success' },
      { dir: 'left', label: 'S-RELEASE.response (accept)',
        text: 'Server agrees to the release and sends S-RELEASE.response. It has no more data to send either.',
        cState: 'RELEASING', sState: 'CLOSING', delivered: 3, lost: 0, level: 'info' },
      { dir: 'right', label: 'S-RELEASE.confirm',
        text: 'Client acknowledges the release. Both sides now deallocate session resources: buffers, timers, session ID, and state.',
        cState: 'CLOSING', sState: 'CLOSING', delivered: 3, lost: 0, level: 'info' },
      { dir: 'none', label: '✅ Orderly release complete',
        text: 'Session terminated gracefully. All 3 messages were delivered. Both sides freed their resources and know the session is over. No data was lost.',
        cState: 'IDLE', sState: 'IDLE', delivered: 3, lost: 0, freed: true, level: 'success' }
    ];
  }

  function buildAbruptEvents() {
    return [
      { dir: 'none', label: '3 messages in flight',
        text: 'The client application suddenly crashes (or the network link is severed). There are 3 messages in the pipeline.',
        cState: 'ESTABLISHED', sState: 'ESTABLISHED', delivered: 0, lost: 0, level: 'info' },
      { dir: 'none', label: '⚡ Client crashes — connection severed',
        text: 'No release request is sent — the connection is simply aborted. The client\'s session context is destroyed immediately without notifying the server.',
        cState: 'DEAD', sState: 'ESTABLISHED', delivered: 0, lost: 0, level: 'warning' },
      { dir: 'none', label: 'Only 1 of 3 messages arrived',
        text: 'Of the 3 in-flight messages, only message 1 reached the server before the connection died. Messages 2 and 3 are permanently lost — there is no mechanism to recover them.',
        cState: 'DEAD', sState: 'ESTABLISHED', delivered: 1, lost: 2, level: 'warning' },
      { dir: 'none', label: 'Server still waiting…',
        text: 'The server has no idea anything went wrong. It still considers the session ESTABLISHED and waits for more data. This is the danger of abrupt termination.',
        cState: 'DEAD', sState: 'ESTABLISHED', delivered: 1, lost: 2, level: 'info' },
      { dir: 'none', label: '⏱️ 30s inactivity timeout expires',
        text: 'The server\'s inactivity timer (set during session establishment) fires after 30 seconds of silence. The server now suspects the session is dead.',
        cState: 'DEAD', sState: 'TIMEOUT', delivered: 1, lost: 2, level: 'warning' },
      { dir: 'none', label: '❌ Server declares session dead',
        text: 'Server discards partial data, frees buffers, invalidates the session ID. The 2 lost messages are never recovered. Unlike graceful release, one side discovered the end only via a timeout.',
        cState: 'DEAD', sState: 'IDLE', delivered: 1, lost: 2, freed: true, level: 'warning' }
    ];
  }

  /* ---- SVG Timeline ---- */
  function renderTimeline(events, currentIdx, mode) {
    var W = 560, rowH = 48, topPad = 50;
    var visible = events.slice(0, currentIdx + 1);
    var rows = Math.max(visible.length, 1);
    var H = topPad + rows * rowH + 20;
    var cX = 100, sX = 460;

    var svg = '<svg class="sterm-tl-svg" viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="Session termination timeline">';

    svg += '<text x="' + cX + '" y="20" text-anchor="middle" class="sterm-tl-header" fill="#1565c0">Client</text>';
    svg += '<text x="' + sX + '" y="20" text-anchor="middle" class="sterm-tl-header" fill="#2e7d32">Server</text>';

    svg += '<line x1="' + cX + '" y1="40" x2="' + cX + '" y2="' + (H - 5) + '" stroke="' + (mode === 'abrupt' && currentIdx >= 1 ? '#d32f2f' : '#1565c0') + '" stroke-width="2" stroke-dasharray="4 3"/>';
    svg += '<line x1="' + sX + '" y1="40" x2="' + sX + '" y2="' + (H - 5) + '" stroke="#2e7d32" stroke-width="2" stroke-dasharray="4 3"/>';

    // Break marker for abrupt
    if (mode === 'abrupt' && currentIdx >= 1) {
      var breakY = topPad + 1 * rowH + 10;
      svg += '<line x1="' + (cX - 8) + '" y1="' + (breakY - 5) + '" x2="' + (cX + 8) + '" y2="' + (breakY + 5) + '" stroke="#d32f2f" stroke-width="3"/>';
      svg += '<line x1="' + (cX - 8) + '" y1="' + (breakY + 5) + '" x2="' + (cX + 8) + '" y2="' + (breakY - 5) + '" stroke="#d32f2f" stroke-width="3"/>';
    }

    visible.forEach(function (ev, i) {
      var y = topPad + i * rowH;
      var active = i === currentIdx;
      var sw = active ? '3' : '2';
      var midX = (cX + sX) / 2;

      if (ev.dir === 'right') {
        svg += '<line x1="' + cX + '" y1="' + y + '" x2="' + sX + '" y2="' + (y + rowH * 0.35) + '" stroke="#1565c0" stroke-width="' + sw + '" marker-end="url(#sterm-arr)"/>';
        svg += '<text x="' + midX + '" y="' + (y - 3) + '" text-anchor="middle" class="sterm-arrow-label" fill="#1565c0">' + ev.label + '</text>';
      } else if (ev.dir === 'left') {
        svg += '<line x1="' + sX + '" y1="' + y + '" x2="' + cX + '" y2="' + (y + rowH * 0.35) + '" stroke="#2e7d32" stroke-width="' + sw + '" marker-end="url(#sterm-arr)"/>';
        svg += '<text x="' + midX + '" y="' + (y - 3) + '" text-anchor="middle" class="sterm-arrow-label" fill="#2e7d32">' + ev.label + '</text>';
      } else {
        var color = ev.level === 'success' ? '#2e7d32' : ev.level === 'warning' ? '#d32f2f' : '#6a1b9a';
        svg += '<rect x="' + (cX + 10) + '" y="' + (y + 5) + '" width="' + (sX - cX - 20) + '" height="24" rx="12" fill="' + color + '" fill-opacity="0.08" stroke="' + color + '" stroke-width="1.5"/>';
        svg += '<text x="' + midX + '" y="' + (y + 21) + '" text-anchor="middle" class="sterm-note-label" fill="' + color + '">' + ev.label + '</text>';
      }
    });

    svg += '<defs><marker id="sterm-arr" markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto"><path d="M0,1 L0,7 L7,4 z" fill="var(--ink)"/></marker></defs>';
    svg += '</svg>';
    return svg;
  }

  /* ---- Message status strip ---- */
  function renderMsgStrip(delivered, lost) {
    var html = '<div class="sterm-msg-strip">';
    html += '<span class="sterm-msg-title">In-flight Messages:</span>';
    for (var i = 0; i < 3; i++) {
      var cls = i < delivered ? 'sterm-msg-ok' : (i >= 3 - lost ? 'sterm-msg-lost' : 'sterm-msg-flight');
      var label = i < delivered ? 'M' + (i + 1) + ' ✓' : (i >= 3 - lost ? 'M' + (i + 1) + ' ✕' : 'M' + (i + 1) + ' ⏳');
      html += '<span class="sterm-msg ' + cls + '">' + label + '</span>';
    }
    html += '</div>';
    return html;
  }

  /* ---- State boxes ---- */
  function renderStates(ev) {
    if (!ev) return '';
    var states = { IDLE: '#757575', ESTABLISHED: '#2e7d32', RELEASING: '#1565c0', CLOSING: '#e65100', DEAD: '#d32f2f', TIMEOUT: '#d32f2f' };
    var cColor = states[ev.cState] || '#757575';
    var sColor = states[ev.sState] || '#757575';

    var html = '<div class="sterm-states-row">';
    html += '<div class="sterm-state-box" style="border-color:' + cColor + '"><span class="sterm-state-side" style="color:' + cColor + '">Client</span><span class="sterm-state-name" style="color:' + cColor + '">' + ev.cState + '</span></div>';
    html += '<div class="sterm-state-box" style="border-color:' + sColor + '"><span class="sterm-state-side" style="color:' + sColor + '">Server</span><span class="sterm-state-name" style="color:' + sColor + '">' + ev.sState + '</span></div>';
    html += '</div>';
    return html;
  }

  /* ==== Main simulation ==== */
  NetSim.SimRegistry.register('session-terminate', function factory(ctx) {
    var mode = 'graceful';
    var events = [];
    var index = -1;
    var timer = null;
    var host = null;

    function rebuild() {
      stop(); index = -1;
      events = mode === 'graceful' ? buildGracefulEvents() : buildAbruptEvents();
      draw(); renderParams();
      ctx.log('Session Termination — ' + (mode === 'graceful' ? 'Graceful (orderly release)' : 'Abrupt (crash/abort)') + ' with 3 messages in flight');
    }

    function draw() {
      var ev = index >= 0 && events[index] ? events[index] : null;
      var statesHtml = renderStates(ev);
      var msgHtml = renderMsgStrip(ev ? ev.delivered : 0, ev ? ev.lost : 0);
      var tlHtml = renderTimeline(events, index, mode);

      // Comparison
      var compHtml = '<div class="sterm-compare">';
      compHtml += '<div class="sterm-compare-col sterm-compare-grace"><div class="sterm-compare-title">✅ Graceful</div>';
      compHtml += '<ul class="sterm-compare-list"><li>All data delivered</li><li>Both sides notified</li><li>Resources freed cleanly</li><li>No data loss</li></ul></div>';
      compHtml += '<div class="sterm-compare-col sterm-compare-abort"><div class="sterm-compare-title">❌ Abrupt</div>';
      compHtml += '<ul class="sterm-compare-list"><li>In-flight data lost</li><li>Server unaware (timeout)</li><li>Orphaned resources</li><li>Data may be unrecoverable</li></ul></div>';
      compHtml += '</div>';

      host.innerHTML = statesHtml + msgHtml + tlHtml + compHtml;

      ctx.setMetrics([
        { label: 'Type', value: mode === 'graceful' ? 'Graceful Release' : 'Abrupt Abort' },
        { label: 'Messages Delivered', value: (ev ? ev.delivered : 0) + ' / 3' },
        { label: 'Messages Lost', value: String(ev ? ev.lost : 0) },
        { label: 'Server Aware', value: mode === 'graceful' ? 'Yes (release handshake)' : (ev && ev.sState === 'IDLE' ? 'Yes (timeout)' : 'No — still waiting') },
        { label: 'Resources Freed', value: ev && ev.freed ? 'Yes' : 'Not yet' },
        { label: 'Step', value: (index + 1) + ' / ' + events.length }
      ]);
    }

    function renderParams() {
      ctx.params.hidden = false;
      var html = '<fieldset class="switch-mode-group" role="radiogroup" aria-label="Termination type">';
      html += '<legend class="section-label" style="margin:0 0 0.5rem;border:none;padding:0;">Termination Type</legend>';
      html += '<label class="switch-mode-option ' + (mode === 'graceful' ? 'is-checked' : '') + '"><input type="radio" name="stermMode" value="graceful" ' + (mode === 'graceful' ? 'checked' : '') + '> Graceful Release</label>';
      html += '<label class="switch-mode-option ' + (mode === 'abrupt' ? 'is-checked' : '') + '"><input type="radio" name="stermMode" value="abrupt" ' + (mode === 'abrupt' ? 'checked' : '') + '> Abrupt Abort</label>';
      html += '</fieldset>';

      ctx.params.innerHTML = html;
      ctx.params.querySelectorAll('input[name="stermMode"]').forEach(function (r) { r.addEventListener('change', function () { mode = r.value; rebuild(); }); });
    }

    function stop() { if (timer) { NetSim.SimTiming.clearInterval(timer); timer = null; } }
    function advance() { if (index >= events.length - 1) { stop(); return; } index++; ctx.log(events[index].text, events[index].level); draw(); }

    return {
      initialize: function () { ctx.canvas.classList.add('net-canvas'); ctx.canvas.innerHTML = '<div class="sterm-mount"></div>'; host = ctx.canvas.querySelector('.sterm-mount'); rebuild(); },
      start: function () { if (timer) return; timer = NetSim.SimTiming.setInterval(function () { if (index >= events.length - 1) { stop(); return; } advance(); }, 800); },
      pause: function () { stop(); },
      step: function () { stop(); advance(); },
      reset: function () { rebuild(); },
      destroy: function () { stop(); }
    };
  });

})(window.NetSim = window.NetSim || {});
