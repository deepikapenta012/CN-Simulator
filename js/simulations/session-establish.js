/* ==========================================================================
   NetSim — simulations/session-establish.js  (REBUILT)
   Interactive Session Establishment simulation:
     - SVG Client↔Server timeline with credential exchange arrows
     - State boxes showing both sides' session state
     - Session parameter negotiation display
     - Valid vs Invalid credentials toggle
     - Dialog mode selection (full-duplex / half-duplex)
     - Session ID assignment visualization
   ========================================================================== */

(function (NetSim) {
  'use strict';

  var SESSION_ID = '0x4F2A';

  /* ---- Build events ---- */
  function buildEvents(validCreds, dialogMode) {
    var events = [];

    events.push({
      dir: 'right', label: 'Session Request + Credentials',
      text: 'Client sends a session establishment request to the server, presenting its credentials (username + hashed password). The session layer packages this into a connect SPDU (Session Protocol Data Unit).',
      tag: 'S-CONNECT.request', level: 'info',
      cState: 'REQUESTING', sState: 'IDLE',
      params: null
    });

    events.push({
      dir: 'none', label: 'Server authenticates credentials',
      text: 'Server receives the request and validates the credentials against its user database. This is a session-layer function — it determines whether a dialog may begin.',
      tag: 'Authentication', level: 'info',
      cState: 'WAITING', sState: 'AUTHENTICATING',
      params: null
    });

    if (!validCreds) {
      events.push({
        dir: 'left', label: 'Session Refused (bad credentials)',
        text: 'Credentials rejected — the username/password do not match. The server sends S-CONNECT.response with result=refused. No session ID is assigned and no session resources are allocated.',
        tag: 'S-CONNECT.refuse', level: 'warning',
        cState: 'IDLE', sState: 'IDLE',
        params: { result: 'REFUSED', reason: 'Invalid credentials' }
      });

      events.push({
        dir: 'none', label: 'No session established',
        text: 'The client receives the refusal. No session was created — no ID, no buffers, no timers. The client must retry with valid credentials.',
        tag: 'Connection Failed', level: 'warning',
        cState: 'IDLE', sState: 'IDLE',
        params: null
      });
      return events;
    }

    events.push({
      dir: 'none', label: 'Credentials accepted ✓',
      text: 'Credentials accepted. The server now prepares session parameter proposals.',
      tag: 'Auth OK', level: 'success',
      cState: 'WAITING', sState: 'PROPOSING',
      params: null
    });

    events.push({
      dir: 'left', label: 'Session Parameter Proposal',
      text: 'Server proposes session parameters: Dialog Mode = ' + dialogMode + ', Sync Points = enabled, Activity Management = on, Inactivity Timeout = 300s. The client can accept or negotiate these.',
      tag: 'S-CONNECT.response', level: 'info',
      cState: 'NEGOTIATING', sState: 'PROPOSING',
      params: { dialog: dialogMode, syncPoints: 'Enabled', activityMgmt: 'On', timeout: '300s' }
    });

    events.push({
      dir: 'right', label: 'Parameters Accepted',
      text: 'Client reviews and accepts the proposed parameters. Both sides now agree on the rules of the dialog.',
      tag: 'S-CONNECT.confirm', level: 'info',
      cState: 'ACCEPTING', sState: 'CONFIRMING',
      params: null
    });

    events.push({
      dir: 'left', label: 'Session ID: ' + SESSION_ID + ' assigned',
      text: 'Server assigns Session ID ' + SESSION_ID + ' and confirms the session. Both sides allocate buffers, start timers, and initialize their session context.',
      tag: 'Session ID Assigned', level: 'success',
      cState: 'ESTABLISHED', sState: 'ESTABLISHED',
      params: { sessionId: SESSION_ID, dialog: dialogMode }
    });

    events.push({
      dir: 'none', label: 'Session ESTABLISHED ✓',
      text: 'Session is fully established — both sides are in the ESTABLISHED state. Data exchange can now begin within this session context. The session ID ' + SESSION_ID + ' identifies this dialog.',
      tag: '✅ Established', level: 'success',
      cState: 'ESTABLISHED', sState: 'ESTABLISHED',
      params: null
    });

    return events;
  }

  /* ---- SVG Timeline ---- */
  function renderTimeline(events, currentIdx) {
    var W = 580, rowH = 48, topPad = 50;
    var visible = events.slice(0, currentIdx + 1);
    var rows = Math.max(visible.length, 1);
    var H = topPad + rows * rowH + 20;
    var cX = 100, sX = 480;

    var svg = '<svg class="sess-tl-svg" viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="Session establishment timeline">';

    svg += '<text x="' + cX + '" y="20" text-anchor="middle" class="sess-tl-header" fill="#1565c0">Client</text>';
    svg += '<text x="' + sX + '" y="20" text-anchor="middle" class="sess-tl-header" fill="#2e7d32">Server</text>';
    svg += '<text x="' + cX + '" y="35" text-anchor="middle" class="sess-tl-subhdr">Session Initiator</text>';
    svg += '<text x="' + sX + '" y="35" text-anchor="middle" class="sess-tl-subhdr">Session Responder</text>';

    svg += '<line x1="' + cX + '" y1="40" x2="' + cX + '" y2="' + (H - 5) + '" stroke="#1565c0" stroke-width="2" stroke-dasharray="4 3"/>';
    svg += '<line x1="' + sX + '" y1="40" x2="' + sX + '" y2="' + (H - 5) + '" stroke="#2e7d32" stroke-width="2" stroke-dasharray="4 3"/>';

    visible.forEach(function (ev, i) {
      var y = topPad + i * rowH;
      var active = i === currentIdx;
      var sw = active ? '3' : '2';
      var midX = (cX + sX) / 2;

      if (ev.dir === 'right') {
        var color = '#1565c0';
        svg += '<line x1="' + cX + '" y1="' + y + '" x2="' + sX + '" y2="' + (y + rowH * 0.35) + '" stroke="' + color + '" stroke-width="' + sw + '" marker-end="url(#sess-arr)"/>';
        svg += '<text x="' + midX + '" y="' + (y - 3) + '" text-anchor="middle" class="sess-arrow-label" fill="' + color + '">' + ev.label + '</text>';
      } else if (ev.dir === 'left') {
        var color2 = ev.level === 'warning' ? '#d32f2f' : '#2e7d32';
        svg += '<line x1="' + sX + '" y1="' + y + '" x2="' + cX + '" y2="' + (y + rowH * 0.35) + '" stroke="' + color2 + '" stroke-width="' + sw + '" marker-end="url(#sess-arr)"/>';
        svg += '<text x="' + midX + '" y="' + (y - 3) + '" text-anchor="middle" class="sess-arrow-label" fill="' + color2 + '">' + ev.label + '</text>';
      } else {
        var noteColor = ev.level === 'success' ? '#2e7d32' : ev.level === 'warning' ? '#d32f2f' : '#6a1b9a';
        svg += '<rect x="' + (cX + 10) + '" y="' + (y + 5) + '" width="' + (sX - cX - 20) + '" height="24" rx="12" fill="' + noteColor + '" fill-opacity="0.08" stroke="' + noteColor + '" stroke-width="1.5"/>';
        svg += '<text x="' + midX + '" y="' + (y + 21) + '" text-anchor="middle" class="sess-note-label" fill="' + noteColor + '">' + ev.label + '</text>';
      }
    });

    svg += '<defs><marker id="sess-arr" markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto"><path d="M0,1 L0,7 L7,4 z" fill="var(--ink)"/></marker></defs>';
    svg += '</svg>';
    return svg;
  }

  /* ---- State boxes ---- */
  function renderStates(ev) {
    if (!ev) return '';
    var cColor = ev.cState === 'ESTABLISHED' ? '#2e7d32' : ev.cState === 'IDLE' ? '#757575' : '#1565c0';
    var sColor = ev.sState === 'ESTABLISHED' ? '#2e7d32' : ev.sState === 'IDLE' ? '#757575' : ev.sState === 'AUTHENTICATING' ? '#e65100' : '#6a1b9a';

    var html = '<div class="sess-states-row">';
    html += '<div class="sess-state-box" style="border-color:' + cColor + '"><span class="sess-state-side" style="color:' + cColor + '">Client</span><span class="sess-state-name" style="color:' + cColor + '">' + ev.cState + '</span></div>';
    html += '<div class="sess-state-box" style="border-color:' + sColor + '"><span class="sess-state-side" style="color:' + sColor + '">Server</span><span class="sess-state-name" style="color:' + sColor + '">' + ev.sState + '</span></div>';
    html += '</div>';
    return html;
  }

  /* ---- Parameter display ---- */
  function renderSessionParams(params) {
    if (!params) return '';
    var html = '<div class="sess-params-box"><div class="sess-params-title">📋 Session Parameters</div><div class="sess-params-fields">';
    Object.keys(params).forEach(function (k) {
      html += '<div class="sess-pf"><span class="sess-pf-name">' + k + '</span><span class="sess-pf-val">' + params[k] + '</span></div>';
    });
    html += '</div></div>';
    return html;
  }

  /* ==== Main simulation ==== */
  NetSim.SimRegistry.register('session-establish', function factory(ctx) {
    var validCreds = true;
    var dialogMode = 'full-duplex';
    var events = [];
    var index = -1;
    var timer = null;
    var host = null;

    function rebuild() {
      stop(); index = -1;
      events = buildEvents(validCreds, dialogMode);
      draw(); renderParams();
      ctx.log('Session Establishment — ' + (validCreds ? 'valid credentials' : 'INVALID credentials') + ', ' + dialogMode + ' mode');
    }

    function draw() {
      var ev = index >= 0 && events[index] ? events[index] : null;
      var statesHtml = renderStates(ev);
      var tlHtml = renderTimeline(events, index);
      var paramsHtml = ev ? renderSessionParams(ev.params) : '';

      var infoHtml = '<div class="sess-info"><h4 class="sess-info-title">Session Layer — Establishment</h4>';
      infoHtml += '<ul class="sess-info-props">';
      infoHtml += '<li><strong>Authentication</strong> — session layer verifies identity before creating a session</li>';
      infoHtml += '<li><strong>Parameter negotiation</strong> — dialog mode, sync points, timeouts agreed upon</li>';
      infoHtml += '<li><strong>Session ID</strong> — unique identifier for this dialog, used throughout</li>';
      infoHtml += '<li><strong>SPDU</strong> — Session Protocol Data Unit: the session layer\'s message format</li>';
      infoHtml += '<li><strong>Protocols</strong> — NetBIOS, RPC, PPTP, ISO 8327 (X.225)</li>';
      infoHtml += '</ul></div>';

      host.innerHTML = statesHtml + tlHtml + paramsHtml + infoHtml;

      var done = index >= events.length - 1;
      var status = !validCreds && index >= 2 ? 'Refused' : done && validCreds ? 'Established' : index < 0 ? 'Not started' : 'Negotiating…';

      ctx.setMetrics([
        { label: 'Session State', value: status },
        { label: 'Credentials', value: validCreds ? '✓ Valid' : '✕ Invalid' },
        { label: 'Dialog Mode', value: validCreds ? dialogMode : '—' },
        { label: 'Session ID', value: ev && ev.cState === 'ESTABLISHED' ? SESSION_ID : '— (not yet assigned)' },
        { label: 'Step', value: (index + 1) + ' / ' + events.length },
        { label: 'Sync Points', value: validCreds ? 'Enabled' : '—' }
      ]);
    }

    function renderParams() {
      ctx.params.hidden = false;
      var html = '<div class="sim-param-row"><label class="switch-mode-option ' + (validCreds ? 'is-checked' : '') + '">' +
                 '<input type="checkbox" id="sessCreds" ' + (validCreds ? 'checked' : '') + '> Valid Credentials</label></div>';

      html += '<fieldset class="switch-mode-group" role="radiogroup" aria-label="Dialog mode" style="margin-top:0.5rem;">';
      html += '<legend class="section-label" style="margin:0 0 0.5rem;border:none;padding:0;">Dialog Mode</legend>';
      html += '<label class="switch-mode-option ' + (dialogMode === 'full-duplex' ? 'is-checked' : '') + '"><input type="radio" name="sessDialog" value="full-duplex" ' + (dialogMode === 'full-duplex' ? 'checked' : '') + '> Full-duplex</label>';
      html += '<label class="switch-mode-option ' + (dialogMode === 'half-duplex' ? 'is-checked' : '') + '"><input type="radio" name="sessDialog" value="half-duplex" ' + (dialogMode === 'half-duplex' ? 'checked' : '') + '> Half-duplex</label>';
      html += '</fieldset>';

      ctx.params.innerHTML = html;
      ctx.params.querySelector('#sessCreds').addEventListener('change', function (e) { validCreds = e.target.checked; rebuild(); });
      ctx.params.querySelectorAll('input[name="sessDialog"]').forEach(function (r) { r.addEventListener('change', function () { dialogMode = r.value; rebuild(); }); });
    }

    function stop() { if (timer) { NetSim.SimTiming.clearInterval(timer); timer = null; } }
    function advance() { if (index >= events.length - 1) { stop(); return; } index++; ctx.log(events[index].text, events[index].level); draw(); }

    return {
      initialize: function () { ctx.canvas.classList.add('net-canvas'); ctx.canvas.innerHTML = '<div class="sess-mount"></div>'; host = ctx.canvas.querySelector('.sess-mount'); rebuild(); },
      start: function () { if (timer) return; timer = NetSim.SimTiming.setInterval(function () { if (index >= events.length - 1) { stop(); return; } advance(); }, 800); },
      pause: function () { stop(); },
      step: function () { stop(); advance(); },
      reset: function () { rebuild(); },
      destroy: function () { stop(); }
    };
  });

})(window.NetSim = window.NetSim || {});
