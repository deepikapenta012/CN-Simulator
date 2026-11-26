/* ==========================================================================
   NetSim — simulations/smtp.js
   Interactive SMTP Mail Delivery simulation:
     - SVG timeline: MUA → MSA → MTA(relay) → MDA → Mailbox
     - Scenario presets (Simple, Relay, Bounce, STARTTLS)
     - SMTP command/reply display with numeric codes
     - Envelope vs Message Headers comparison
     - Mail pipeline visualization
   ========================================================================== */

(function (NetSim) {
  'use strict';

  var SCENARIOS = {
    simple:  { label: 'Simple Send',    desc: 'Direct delivery to same domain' },
    relay:   { label: 'Cross-Domain',   desc: 'Relay across different mail domains' },
    bounce:  { label: 'Bounce (550)',    desc: 'Recipient does not exist — bounce' },
    tls:     { label: 'STARTTLS',       desc: 'Encrypted submission with STARTTLS' }
  };

  /* ---- Build events ---- */
  function buildEvents(scenario) {
    var events = [];
    var from = 'alice@sender.com';
    var to = scenario === 'bounce' ? 'nobody@receiver.org' : 'bob@receiver.org';

    // 1 — TCP connect
    events.push({
      from: 'client', to: 'server',
      label: 'TCP Connect → port 587',
      text: 'Mail User Agent (MUA) connects to the Mail Submission Agent (MSA) on port 587 (submission) or 25 (relay). Port 587 requires authentication.',
      tag: 'Connect', level: 'info',
      cmd: null, reply: null
    });

    // 2 — Banner
    events.push({
      from: 'server', to: 'client',
      label: '220 sender.com ESMTP',
      text: 'The server sends its 220 greeting banner, identifying itself and announcing ESMTP support.',
      tag: '220 Banner', level: 'success',
      cmd: null, reply: { code: 220, text: 'sender.com ESMTP Postfix — Welcome' }
    });

    // 3 — EHLO
    events.push({
      from: 'client', to: 'server',
      label: 'EHLO alice-laptop.local',
      text: 'Client introduces itself with EHLO (Extended HELO). The server will respond with its capabilities (SIZE, STARTTLS, AUTH, 8BITMIME, etc.).',
      tag: 'EHLO', level: 'info',
      cmd: 'EHLO alice-laptop.local', reply: null
    });

    events.push({
      from: 'server', to: 'client',
      label: '250 OK + capabilities',
      text: 'Server responds with 250 and lists its capabilities: SIZE 35882577, STARTTLS, AUTH PLAIN LOGIN, 8BITMIME, PIPELINING.',
      tag: '250 Capabilities', level: 'success',
      cmd: null, reply: { code: 250, text: 'sender.com\n250-SIZE 35882577\n250-STARTTLS\n250-AUTH PLAIN LOGIN\n250 8BITMIME' }
    });

    // TLS path
    if (scenario === 'tls') {
      events.push({
        from: 'client', to: 'server',
        label: 'STARTTLS',
        text: 'Client requests TLS encryption. All subsequent SMTP traffic will be encrypted — protecting the email content and credentials from eavesdropping.',
        tag: 'STARTTLS', level: 'info',
        cmd: 'STARTTLS', reply: null
      });
      events.push({
        from: 'server', to: 'client',
        label: '220 Ready for TLS',
        text: 'Server agrees to TLS upgrade. A TLS handshake now occurs (not shown), and the connection becomes encrypted.',
        tag: '🔒 TLS Active', level: 'success',
        cmd: null, reply: { code: 220, text: 'Ready to start TLS' }
      });
      events.push({
        from: 'client', to: 'server',
        label: 'EHLO alice-laptop.local (re-EHLO)',
        text: 'After TLS, the client must re-issue EHLO. The server may advertise different capabilities over the encrypted channel (e.g., AUTH becomes available).',
        tag: 'Re-EHLO', level: 'info',
        cmd: 'EHLO alice-laptop.local', reply: null
      });
      events.push({
        from: 'server', to: 'client',
        label: '250 OK (TLS capabilities)',
        text: 'Server confirms re-EHLO with TLS-specific capabilities. AUTH is now safely available over the encrypted tunnel.',
        tag: '250 TLS OK', level: 'success',
        cmd: null, reply: { code: 250, text: 'sender.com\n250-AUTH PLAIN LOGIN\n250 SIZE 35882577' }
      });
    }

    // 4 — MAIL FROM (envelope sender)
    events.push({
      from: 'client', to: 'server',
      label: 'MAIL FROM:<' + from + '>',
      text: 'Client specifies the ENVELOPE sender. This is the "bounce address" — where delivery failure notifications are sent. It may differ from the From: header in the message!',
      tag: 'MAIL FROM', level: 'info',
      cmd: 'MAIL FROM:<' + from + '>', reply: null
    });

    events.push({
      from: 'server', to: 'client',
      label: '250 OK',
      text: 'Server accepts the envelope sender.',
      tag: '250 Sender OK', level: 'success',
      cmd: null, reply: { code: 250, text: 'Ok' }
    });

    // 5 — RCPT TO (envelope recipient)
    events.push({
      from: 'client', to: 'server',
      label: 'RCPT TO:<' + to + '>',
      text: 'Client specifies the ENVELOPE recipient. The server checks if it can deliver to this address.',
      tag: 'RCPT TO', level: 'info',
      cmd: 'RCPT TO:<' + to + '>', reply: null
    });

    if (scenario === 'bounce') {
      events.push({
        from: 'server', to: 'client',
        label: '550 User not found',
        text: 'Server rejects the recipient: 550 means the mailbox does not exist. The email cannot be delivered. A Non-Delivery Report (bounce) will be generated.',
        tag: '❌ 550 Bounce', level: 'warning',
        cmd: null, reply: { code: 550, text: 'No such user - nobody@receiver.org' }
      });

      events.push({
        from: 'client', to: 'server',
        label: 'QUIT',
        text: 'Client closes the session after the rejection. The email was never sent.',
        tag: 'QUIT', level: 'info',
        cmd: 'QUIT', reply: null
      });

      events.push({
        from: 'server', to: 'client',
        label: '221 Bye',
        text: 'Server says goodbye. The bounce scenario is complete — the sender will receive a Non-Delivery Report.',
        tag: '221 Bye', level: 'info',
        cmd: null, reply: { code: 221, text: 'Bye' }
      });

      return events;
    }

    events.push({
      from: 'server', to: 'client',
      label: '250 OK',
      text: 'Server accepts the recipient.',
      tag: '250 Recipient OK', level: 'success',
      cmd: null, reply: { code: 250, text: 'Ok' }
    });

    // 6 — DATA
    events.push({
      from: 'client', to: 'server',
      label: 'DATA',
      text: 'Client signals it is ready to send the message content (headers + body). The server responds with 354, meaning "go ahead, end with a single dot on a line."',
      tag: 'DATA', level: 'info',
      cmd: 'DATA', reply: null
    });

    events.push({
      from: 'server', to: 'client',
      label: '354 Start mail input',
      text: 'Server is ready to receive the message. The client will now send the message HEADERS (From:, To:, Subject:, Date:) followed by a blank line and the BODY.',
      tag: '354 Go Ahead', level: 'info',
      cmd: null, reply: { code: 354, text: 'End data with <CR><LF>.<CR><LF>' }
    });

    events.push({
      from: 'client', to: 'server',
      label: 'Headers + Body + "."',
      text: 'Client sends message headers (From: ' + from + ', To: ' + to + ', Subject: Hello!) then a blank line, then the body, terminated by a single dot on its own line.',
      tag: 'Message Content', level: 'info',
      cmd: 'From: ' + from + '\nTo: ' + to + '\nSubject: Hello from NetSim!\nDate: Mon, 24 Nov 2026\n\nHi Bob, this is a test email.\n.', reply: null
    });

    events.push({
      from: 'server', to: 'client',
      label: '250 Queued as ABC123',
      text: 'Server accepts the message and assigns a queue ID. The message is now in the server\'s outbound queue for delivery.',
      tag: '250 Queued', level: 'success',
      cmd: null, reply: { code: 250, text: 'Ok: queued as ABC123' }
    });

    // Relay step for cross-domain
    if (scenario === 'relay') {
      events.push({
        from: 'server', to: 'relay',
        label: 'MX lookup → relay to receiver.org',
        text: 'The sending MTA looks up the MX record for receiver.org to find the recipient\'s mail server. It opens a new SMTP connection to relay the message.',
        tag: 'MX Relay', level: 'info',
        cmd: null, reply: null
      });

      events.push({
        from: 'relay', to: 'server',
        label: '250 Delivered to receiver.org',
        text: 'The recipient\'s MTA accepts the message and delivers it to bob\'s mailbox. The relay chain is complete.',
        tag: '250 Relayed', level: 'success',
        cmd: null, reply: { code: 250, text: 'Delivered to mailbox' }
      });
    }

    // 7 — QUIT
    events.push({
      from: 'client', to: 'server',
      label: 'QUIT',
      text: 'Client closes the SMTP session.',
      tag: 'QUIT', level: 'info',
      cmd: 'QUIT', reply: null
    });

    events.push({
      from: 'server', to: 'client',
      label: '221 Bye',
      text: 'Server closes the connection. The email has been successfully submitted' + (scenario === 'relay' ? ' and relayed across domains' : '') + '.',
      tag: '221 Complete', level: 'success',
      cmd: null, reply: { code: 221, text: 'Bye' }
    });

    return events;
  }

  /* ---- SVG Timeline ---- */
  function renderTimeline(events, currentIdx, scenario) {
    var W = 620, rowH = 42, topPad = 50;
    var visible = events.slice(0, currentIdx + 1);
    var rows = Math.max(visible.length, 1);
    var H = topPad + rows * rowH + 20;

    var hasRelay = scenario === 'relay';
    var cX = 80, sX = hasRelay ? 320 : 540, rX = 540;

    var svg = '<svg class="smtp-tl-svg" viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="SMTP timeline">';

    svg += '<text x="' + cX + '" y="20" text-anchor="middle" class="smtp-tl-header" fill="#1565c0">MUA</text>';
    svg += '<text x="' + cX + '" y="34" text-anchor="middle" class="smtp-tl-subhdr">Mail Client</text>';
    svg += '<text x="' + sX + '" y="20" text-anchor="middle" class="smtp-tl-header" fill="#6a1b9a">MSA/MTA</text>';
    svg += '<text x="' + sX + '" y="34" text-anchor="middle" class="smtp-tl-subhdr">sender.com</text>';
    if (hasRelay) {
      svg += '<text x="' + rX + '" y="20" text-anchor="middle" class="smtp-tl-header" fill="#2e7d32">MTA/MDA</text>';
      svg += '<text x="' + rX + '" y="34" text-anchor="middle" class="smtp-tl-subhdr">receiver.org</text>';
    }

    // Lifelines
    svg += '<line x1="' + cX + '" y1="40" x2="' + cX + '" y2="' + (H - 5) + '" stroke="#1565c0" stroke-width="2" stroke-dasharray="4 3"/>';
    svg += '<line x1="' + sX + '" y1="40" x2="' + sX + '" y2="' + (H - 5) + '" stroke="#6a1b9a" stroke-width="2" stroke-dasharray="4 3"/>';
    if (hasRelay) {
      svg += '<line x1="' + rX + '" y1="40" x2="' + rX + '" y2="' + (H - 5) + '" stroke="#2e7d32" stroke-width="2" stroke-dasharray="4 3"/>';
    }

    var nodeMap = { client: cX, server: sX, relay: rX };

    visible.forEach(function (ev, i) {
      var y = topPad + i * rowH;
      var active = i === currentIdx;
      var sw = active ? '3' : '2';
      var fromX = nodeMap[ev.from] || cX;
      var toX = nodeMap[ev.to] || sX;

      if (fromX === toX) {
        // Self/note
        svg += '<rect x="' + (fromX - 80) + '" y="' + (y + 3) + '" width="160" height="22" rx="11" fill="#6a1b9a" fill-opacity="0.08" stroke="#6a1b9a" stroke-width="1.5"/>';
        svg += '<text x="' + fromX + '" y="' + (y + 18) + '" text-anchor="middle" class="smtp-note-label" fill="#6a1b9a">' + ev.label + '</text>';
      } else {
        var color = fromX < toX ? '#1565c0' : (ev.reply && ev.reply.code >= 400 ? '#d32f2f' : '#6a1b9a');
        if (ev.from === 'server' && ev.to === 'relay') color = '#6a1b9a';
        if (ev.from === 'relay') color = '#2e7d32';
        svg += '<line x1="' + fromX + '" y1="' + y + '" x2="' + toX + '" y2="' + (y + rowH * 0.35) + '" stroke="' + color + '" stroke-width="' + sw + '" marker-end="url(#smtp-arr)"/>';
        var midX = (fromX + toX) / 2;
        svg += '<text x="' + midX + '" y="' + (y - 3) + '" text-anchor="middle" class="smtp-arrow-label" fill="' + color + '">' + ev.label + '</text>';
      }
    });

    svg += '<defs><marker id="smtp-arr" markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto"><path d="M0,1 L0,7 L7,4 z" fill="var(--ink)"/></marker></defs>';
    svg += '</svg>';
    return svg;
  }

  /* ---- Command/Reply display ---- */
  function renderCmdReply(ev) {
    if (!ev) return '';
    var html = '';
    if (ev.cmd) {
      html += '<div class="smtp-cmd-box smtp-cmd-sent"><span class="smtp-cmd-dir">C:</span><code class="smtp-cmd-code">' + ev.cmd.replace(/\n/g, '<br>') + '</code></div>';
    }
    if (ev.reply) {
      var cls = ev.reply.code < 400 ? 'smtp-reply-ok' : 'smtp-reply-err';
      html += '<div class="smtp-cmd-box ' + cls + '"><span class="smtp-cmd-dir">S:</span><code class="smtp-cmd-code">' + ev.reply.code + ' ' + ev.reply.text.replace(/\n/g, '<br>') + '</code></div>';
    }
    return html;
  }

  /* ---- Envelope vs Headers ---- */
  function renderEnvelopeComparison(from, to) {
    var html = '<div class="smtp-env-compare">';
    html += '<div class="smtp-env-col"><div class="smtp-env-title">📨 Envelope (SMTP)</div>';
    html += '<div class="smtp-env-field"><span class="smtp-env-key">MAIL FROM:</span>' + from + '</div>';
    html += '<div class="smtp-env-field"><span class="smtp-env-key">RCPT TO:</span>' + to + '</div>';
    html += '<div class="smtp-env-note">Used for routing — like the address on a physical envelope</div>';
    html += '</div>';
    html += '<div class="smtp-env-col"><div class="smtp-env-title">📝 Headers (Message)</div>';
    html += '<div class="smtp-env-field"><span class="smtp-env-key">From:</span>' + from + '</div>';
    html += '<div class="smtp-env-field"><span class="smtp-env-key">To:</span>' + to + '</div>';
    html += '<div class="smtp-env-field"><span class="smtp-env-key">Subject:</span>Hello from NetSim!</div>';
    html += '<div class="smtp-env-note">Displayed to user — like the letter inside the envelope</div>';
    html += '</div></div>';
    return html;
  }

  /* ==== Main simulation ==== */
  NetSim.SimRegistry.register('smtp', function factory(ctx) {
    var scenario = 'simple';
    var events = [];
    var index = -1;
    var timer = null;
    var host = null;

    function rebuild() {
      stop(); index = -1;
      events = buildEvents(scenario);
      draw(); renderParams();
      ctx.log('SMTP — ' + SCENARIOS[scenario].label + ': ' + SCENARIOS[scenario].desc);
    }

    function draw() {
      var ev = index >= 0 && events[index] ? events[index] : null;
      var tlHtml = renderTimeline(events, index, scenario);
      var cmdHtml = ev ? renderCmdReply(ev) : '';
      var envHtml = renderEnvelopeComparison('alice@sender.com', scenario === 'bounce' ? 'nobody@receiver.org' : 'bob@receiver.org');

      // Mail pipeline
      var pipeHtml = '<div class="smtp-pipeline">';
      var stages = scenario === 'relay'
        ? ['MUA', 'MSA', 'MTA (sender)', 'MTA (receiver)', 'MDA', 'Mailbox']
        : ['MUA', 'MSA/MTA', 'MDA', 'Mailbox'];
      stages.forEach(function (s, i) {
        pipeHtml += '<span class="smtp-pipe-stage">' + s + '</span>';
        if (i < stages.length - 1) pipeHtml += '<span class="smtp-pipe-arrow">→</span>';
      });
      pipeHtml += '</div>';

      // Info
      var infoHtml = '<div class="smtp-info"><h4 class="smtp-info-title">SMTP — Simple Mail Transfer Protocol</h4>';
      infoHtml += '<ul class="smtp-info-props">';
      infoHtml += '<li><strong>Push-only</strong> — SMTP delivers mail; retrieval uses IMAP/POP3</li>';
      infoHtml += '<li><strong>Store-and-forward</strong> — each server queues then relays</li>';
      infoHtml += '<li><strong>Envelope ≠ Headers</strong> — routing info vs display info (can differ!)</li>';
      infoHtml += '<li><strong>STARTTLS</strong> — opportunistic encryption upgrade on the same port</li>';
      infoHtml += '<li><strong>Reply codes</strong> — 2xx success, 3xx more input needed, 4xx temp fail, 5xx permanent fail</li>';
      infoHtml += '</ul></div>';

      host.innerHTML = pipeHtml + cmdHtml + tlHtml + envHtml + infoHtml;

      var cmds = 0, replies = 0;
      for (var i = 0; i <= Math.min(index, events.length - 1); i++) {
        if (events[i].cmd) cmds++;
        if (events[i].reply) replies++;
      }

      ctx.setMetrics([
        { label: 'Scenario', value: SCENARIOS[scenario].label },
        { label: 'From', value: 'alice@sender.com' },
        { label: 'To', value: scenario === 'bounce' ? 'nobody@receiver.org' : 'bob@receiver.org' },
        { label: 'Step', value: (index + 1) + ' / ' + events.length },
        { label: 'Commands Sent', value: String(cmds) },
        { label: 'Replies Received', value: String(replies) },
        { label: 'Port', value: '587 (submission)' },
        { label: 'Encryption', value: scenario === 'tls' ? 'STARTTLS 🔒' : 'None (cleartext)' }
      ]);
    }

    function renderParams() {
      ctx.params.hidden = false;
      var html = '<fieldset class="switch-mode-group" role="radiogroup" aria-label="Scenario">';
      html += '<legend class="section-label" style="margin:0 0 0.5rem;border:none;padding:0;">Scenario</legend>';
      Object.keys(SCENARIOS).forEach(function (k) {
        html += '<label class="switch-mode-option ' + (k === scenario ? 'is-checked' : '') + '">' +
                '<input type="radio" name="smtpScenario" value="' + k + '" ' + (k === scenario ? 'checked' : '') + '> ' + SCENARIOS[k].label + '</label>';
      });
      html += '</fieldset>';
      ctx.params.innerHTML = html;
      ctx.params.querySelectorAll('input[name="smtpScenario"]').forEach(function (r) { r.addEventListener('change', function () { scenario = r.value; rebuild(); }); });
    }

    function stop() { if (timer) { NetSim.SimTiming.clearInterval(timer); timer = null; } }
    function advance() { if (index >= events.length - 1) { stop(); return; } index++; ctx.log(events[index].text, events[index].level); draw(); }

    return {
      initialize: function () { ctx.canvas.classList.add('net-canvas'); ctx.canvas.innerHTML = '<div class="smtp-mount"></div>'; host = ctx.canvas.querySelector('.smtp-mount'); rebuild(); },
      start: function () { if (timer) return; timer = NetSim.SimTiming.setInterval(function () { if (index >= events.length - 1) { stop(); return; } advance(); }, 800); },
      pause: function () { stop(); },
      step: function () { stop(); advance(); },
      reset: function () { rebuild(); },
      destroy: function () { stop(); }
    };
  });

})(window.NetSim = window.NetSim || {});
