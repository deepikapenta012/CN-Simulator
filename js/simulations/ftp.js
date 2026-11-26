/* ==========================================================================
   NetSim — simulations/ftp.js
   Interactive FTP Transfer simulation:
     - Dual-channel SVG timeline (Control port 21 + Data port 20/ephemeral)
     - Active vs Passive mode toggle
     - Operation presets (List, Download, Upload, Delete)
     - FTP command/reply display with numeric codes
     - Reply code reference
   ========================================================================== */

(function (NetSim) {
  'use strict';

  var OPERATIONS = {
    list:   { label: 'List Directory',  cmd: 'LIST',  hasData: true,  desc: 'Retrieve directory listing' },
    retr:   { label: 'Download File',   cmd: 'RETR report.txt', hasData: true, desc: 'Download a file from server' },
    stor:   { label: 'Upload File',     cmd: 'STOR backup.zip', hasData: true, desc: 'Upload a file to server' },
    dele:   { label: 'Delete File',     cmd: 'DELE old.log',    hasData: false, desc: 'Delete a file on server' }
  };

  /* ---- Build events ---- */
  function buildEvents(operation, passive) {
    var op = OPERATIONS[operation];
    var events = [];
    var dataPort = passive ? (49152 + Math.floor(Math.random() * 1000)) : 20;

    // 1 — Control connection
    events.push({
      channel: 'ctrl', dir: 'right', label: 'TCP Connect → port 21',
      text: 'Client opens a TCP connection to server port 21. This is the CONTROL channel — it carries commands and reply codes, never file data.',
      tag: 'Control Channel', level: 'info',
      cmd: null, reply: null
    });

    // 2 — Server ready
    events.push({
      channel: 'ctrl', dir: 'left', label: '220 Service Ready',
      text: 'Server responds with 220, indicating it is ready to accept commands. FTP reply codes: 1xx=preliminary, 2xx=completion, 3xx=intermediate, 4xx/5xx=error.',
      tag: '220 Ready', level: 'success',
      cmd: null, reply: { code: 220, text: 'Welcome to NetSim FTP Server.' }
    });

    // 3 — Authentication
    events.push({
      channel: 'ctrl', dir: 'right', label: 'USER student',
      text: 'Client sends the USER command with the username. The server will ask for a password next.',
      tag: 'USER', level: 'info',
      cmd: 'USER student', reply: null
    });

    events.push({
      channel: 'ctrl', dir: 'left', label: '331 Password required',
      text: 'Server responds with 331 — user name accepted, now send the password.',
      tag: '331', level: 'info',
      cmd: null, reply: { code: 331, text: 'Password required for student.' }
    });

    events.push({
      channel: 'ctrl', dir: 'right', label: 'PASS ****',
      text: 'Client sends the PASS command. Note: Classic FTP sends passwords in cleartext! Use SFTP/FTPS in production.',
      tag: 'PASS', level: 'warning',
      cmd: 'PASS ****', reply: null
    });

    events.push({
      channel: 'ctrl', dir: 'left', label: '230 Logged in',
      text: 'Server responds with 230 — authentication successful. The client can now issue file commands.',
      tag: '230 Login OK', level: 'success',
      cmd: null, reply: { code: 230, text: 'Login successful.' }
    });

    // 4 — Data channel setup
    if (passive) {
      events.push({
        channel: 'ctrl', dir: 'right', label: 'PASV',
        text: 'Client requests PASSIVE mode. The SERVER will open a listening port and tell the client where to connect. This is firewall-friendly because the client initiates both connections.',
        tag: 'PASV (Passive)', level: 'info',
        cmd: 'PASV', reply: null
      });
      events.push({
        channel: 'ctrl', dir: 'left', label: '227 Entering Passive (' + dataPort + ')',
        text: 'Server responds with 227 and the IP/port for the data connection. The client will connect TO the server on port ' + dataPort + '.',
        tag: '227 Passive OK', level: 'success',
        cmd: null, reply: { code: 227, text: 'Entering Passive Mode (192,168,1,10,' + Math.floor(dataPort / 256) + ',' + (dataPort % 256) + ').' }
      });
      if (op.hasData) {
        events.push({
          channel: 'data', dir: 'right', label: 'TCP Connect → port ' + dataPort,
          text: 'Client opens a NEW TCP connection to the server on port ' + dataPort + '. This is the DATA channel — file contents flow here, separate from commands.',
          tag: 'Data Channel', level: 'info',
          cmd: null, reply: null
        });
      }
    } else {
      events.push({
        channel: 'ctrl', dir: 'right', label: 'PORT 192,168,1,5,200,15',
        text: 'Client requests ACTIVE mode with PORT command, telling the server: "Connect back to me on port ' + (200 * 256 + 15) + '." The SERVER initiates the data connection — this often fails behind NAT/firewalls.',
        tag: 'PORT (Active)', level: 'warning',
        cmd: 'PORT 192,168,1,5,200,15', reply: null
      });
      events.push({
        channel: 'ctrl', dir: 'left', label: '200 PORT OK',
        text: 'Server acknowledges the PORT command. It will connect back to the client for data transfer.',
        tag: '200 OK', level: 'success',
        cmd: null, reply: { code: 200, text: 'PORT command successful.' }
      });
      if (op.hasData) {
        events.push({
          channel: 'data', dir: 'left', label: 'TCP Connect from port 20 →',
          text: 'Server opens a data connection FROM its port 20 TO the client. In active mode, the server initiates — this is why firewalls often block active FTP.',
          tag: 'Data Channel', level: 'info',
          cmd: null, reply: null
        });
      }
    }

    // 5 — The actual FTP command
    events.push({
      channel: 'ctrl', dir: 'right', label: op.cmd,
      text: 'Client sends ' + op.cmd + ' on the control channel. ' +
        (op.hasData ? 'The file data will flow on the separate data channel.' : 'This command does not need a data channel.'),
      tag: op.cmd.split(' ')[0], level: 'info',
      cmd: op.cmd, reply: null
    });

    if (op.hasData) {
      events.push({
        channel: 'ctrl', dir: 'left', label: '150 Opening data connection',
        text: 'Server responds with 150 — the data connection is open and the transfer is about to begin.',
        tag: '150 Transfer Start', level: 'info',
        cmd: null, reply: { code: 150, text: 'Opening BINARY mode data connection for ' + op.cmd + '.' }
      });

      // Data transfer
      var transferDir = operation === 'stor' ? 'right' : 'left';
      var transferLabel = operation === 'stor' ? 'Uploading data →' : '← File data';
      var transferSize = Math.floor(Math.random() * 900) + 100;
      events.push({
        channel: 'data', dir: transferDir, label: transferLabel + ' (' + transferSize + ' KB)',
        text: 'File data flows on the DATA channel (' + transferSize + ' KB). The control channel remains idle during transfer — it only carries commands and replies.',
        tag: 'Data Transfer', level: 'info',
        cmd: null, reply: null
      });

      events.push({
        channel: 'data', dir: 'none', label: 'Data connection closed',
        text: 'The DATA connection is closed after the transfer completes. FTP uses a fresh data connection for each transfer — unlike the persistent control connection.',
        tag: 'Data Close', level: 'info',
        cmd: null, reply: null
      });

      events.push({
        channel: 'ctrl', dir: 'left', label: '226 Transfer complete',
        text: 'Server confirms on the control channel: transfer completed successfully (226).',
        tag: '226 Complete', level: 'success',
        cmd: null, reply: { code: 226, text: 'Transfer complete.' }
      });
    } else {
      events.push({
        channel: 'ctrl', dir: 'left', label: '250 File deleted',
        text: 'Server confirms the file was deleted (250). No data channel needed for DELE.',
        tag: '250 OK', level: 'success',
        cmd: null, reply: { code: 250, text: 'DELE command successful.' }
      });
    }

    // 6 — Quit
    events.push({
      channel: 'ctrl', dir: 'right', label: 'QUIT',
      text: 'Client sends QUIT to close the session gracefully.',
      tag: 'QUIT', level: 'info',
      cmd: 'QUIT', reply: null
    });

    events.push({
      channel: 'ctrl', dir: 'left', label: '221 Goodbye',
      text: 'Server responds with 221 and closes the control connection. The FTP session is complete.',
      tag: '221 Bye', level: 'success',
      cmd: null, reply: { code: 221, text: 'Goodbye.' }
    });

    return events;
  }

  /* ---- SVG Timeline ---- */
  function renderTimeline(events, currentIdx) {
    var W = 620, rowH = 44, topPad = 55;
    var visible = events.slice(0, currentIdx + 1);
    var rows = Math.max(visible.length, 1);
    var H = topPad + rows * rowH + 20;
    var cX = 100, sX = 520;

    var svg = '<svg class="ftp-tl-svg" viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="FTP timeline">';

    // Headers
    svg += '<text x="' + cX + '" y="18" text-anchor="middle" class="ftp-tl-header" fill="#1565c0">FTP Client</text>';
    svg += '<text x="' + sX + '" y="18" text-anchor="middle" class="ftp-tl-header" fill="#2e7d32">FTP Server</text>';
    svg += '<text x="' + cX + '" y="32" text-anchor="middle" class="ftp-tl-subhdr">192.168.1.5</text>';
    svg += '<text x="' + sX + '" y="32" text-anchor="middle" class="ftp-tl-subhdr">192.168.1.10</text>';

    // Legend
    svg += '<line x1="' + (W/2 - 60) + '" y1="43" x2="' + (W/2 - 30) + '" y2="43" stroke="#1565c0" stroke-width="2"/>';
    svg += '<text x="' + (W/2 - 27) + '" y="47" class="ftp-legend-label" fill="#1565c0">Control</text>';
    svg += '<line x1="' + (W/2 + 20) + '" y1="43" x2="' + (W/2 + 50) + '" y2="43" stroke="#e65100" stroke-width="2" stroke-dasharray="5 3"/>';
    svg += '<text x="' + (W/2 + 53) + '" y="47" class="ftp-legend-label" fill="#e65100">Data</text>';

    // Lifelines
    svg += '<line x1="' + cX + '" y1="' + topPad + '" x2="' + cX + '" y2="' + (H - 5) + '" stroke="#1565c0" stroke-width="2" stroke-dasharray="4 3"/>';
    svg += '<line x1="' + sX + '" y1="' + topPad + '" x2="' + sX + '" y2="' + (H - 5) + '" stroke="#2e7d32" stroke-width="2" stroke-dasharray="4 3"/>';

    visible.forEach(function (ev, i) {
      var y = topPad + i * rowH;
      var active = i === currentIdx;
      var sw = active ? '3' : '2';
      var isData = ev.channel === 'data';
      var baseColor = isData ? '#e65100' : '#1565c0';
      var dash = isData ? ' stroke-dasharray="6 3"' : '';

      if (ev.dir === 'right') {
        svg += '<line x1="' + cX + '" y1="' + y + '" x2="' + sX + '" y2="' + (y + rowH * 0.35) + '" stroke="' + baseColor + '" stroke-width="' + sw + '"' + dash + ' marker-end="url(#ftp-arr)"/>';
      } else if (ev.dir === 'left') {
        var respColor = isData ? '#e65100' : '#2e7d32';
        svg += '<line x1="' + sX + '" y1="' + y + '" x2="' + cX + '" y2="' + (y + rowH * 0.35) + '" stroke="' + respColor + '" stroke-width="' + sw + '"' + dash + ' marker-end="url(#ftp-arr)"/>';
      } else {
        svg += '<rect x="' + (cX + 10) + '" y="' + (y + 5) + '" width="' + (sX - cX - 20) + '" height="22" rx="11" fill="' + baseColor + '" fill-opacity="0.08" stroke="' + baseColor + '" stroke-width="1.5"/>';
      }

      var midX = (cX + sX) / 2;
      var labelY = ev.dir === 'none' ? (y + 20) : (y - 3);
      svg += '<text x="' + midX + '" y="' + labelY + '" text-anchor="middle" class="ftp-arrow-label" fill="' + baseColor + '">' + ev.label + '</text>';
    });

    svg += '<defs><marker id="ftp-arr" markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto"><path d="M0,1 L0,7 L7,4 z" fill="var(--ink)"/></marker></defs>';
    svg += '</svg>';
    return svg;
  }

  /* ---- Reply code display ---- */
  function renderReply(ev) {
    if (!ev) return '';
    var html = '';
    if (ev.cmd) {
      html += '<div class="ftp-cmd-box ftp-cmd-sent"><span class="ftp-cmd-label">→ Command:</span><code class="ftp-cmd-code">' + ev.cmd + '</code></div>';
    }
    if (ev.reply) {
      var cat = String(ev.reply.code).charAt(0);
      var cls = cat === '2' ? 'ftp-reply-ok' : cat === '3' ? 'ftp-reply-mid' : cat === '1' ? 'ftp-reply-pre' : 'ftp-reply-err';
      html += '<div class="ftp-cmd-box ' + cls + '"><span class="ftp-cmd-label">← Reply:</span><code class="ftp-cmd-code">' + ev.reply.code + ' ' + ev.reply.text + '</code></div>';
    }
    return html;
  }

  /* ==== Main simulation ==== */
  NetSim.SimRegistry.register('ftp', function factory(ctx) {
    var operation = 'retr';
    var passive = true;
    var events = [];
    var index = -1;
    var timer = null;
    var host = null;

    function rebuild() {
      stop(); index = -1;
      events = buildEvents(operation, passive);
      draw(); renderParams();
      ctx.log('FTP — ' + OPERATIONS[operation].label + ' (' + (passive ? 'Passive' : 'Active') + ' mode)');
    }

    function draw() {
      var ev = index >= 0 && events[index] ? events[index] : null;
      var tlHtml = renderTimeline(events, index);
      var replyHtml = ev ? renderReply(ev) : '';

      // Channel indicator
      var chanHtml = '<div class="ftp-chan-strip">';
      chanHtml += '<span class="ftp-chan-pill ftp-chan-ctrl' + (ev && ev.channel === 'ctrl' ? ' is-active' : '') + '">⚡ Control :21</span>';
      chanHtml += '<span class="ftp-chan-pill ftp-chan-data' + (ev && ev.channel === 'data' ? ' is-active' : '') + '">📦 Data :' + (passive ? 'ephemeral' : '20') + '</span>';
      chanHtml += '<span class="ftp-chan-mode">' + (passive ? '🛡️ Passive (PASV)' : '⚠️ Active (PORT)') + '</span>';
      chanHtml += '</div>';

      // Info box
      var infoHtml = '<div class="ftp-info">';
      infoHtml += '<h4 class="ftp-info-title">FTP — File Transfer Protocol</h4>';
      infoHtml += '<ul class="ftp-info-props">';
      infoHtml += '<li><strong>Dual-channel</strong> — control (commands) and data (files) on separate TCP connections</li>';
      infoHtml += '<li><strong>Active mode</strong> — server connects back to client (blocked by NAT/firewalls)</li>';
      infoHtml += '<li><strong>Passive mode</strong> — client connects to server\'s data port (firewall-friendly)</li>';
      infoHtml += '<li><strong>Stateful</strong> — server tracks login, working directory, transfer mode</li>';
      infoHtml += '<li><strong>Reply codes</strong> — 1xx preliminary, 2xx success, 3xx needs more info, 4xx/5xx error</li>';
      infoHtml += '</ul></div>';

      host.innerHTML = chanHtml + replyHtml + tlHtml + infoHtml;

      var ctrlMsgs = 0, dataMsgs = 0;
      for (var i = 0; i <= Math.min(index, events.length - 1); i++) {
        if (events[i].channel === 'ctrl') ctrlMsgs++;
        else dataMsgs++;
      }

      ctx.setMetrics([
        { label: 'Operation', value: OPERATIONS[operation].label },
        { label: 'Mode', value: passive ? 'Passive (PASV)' : 'Active (PORT)' },
        { label: 'Step', value: (index + 1) + ' / ' + events.length },
        { label: 'Control Messages', value: String(ctrlMsgs) },
        { label: 'Data Messages', value: String(dataMsgs) },
        { label: 'Control Port', value: '21' },
        { label: 'Data Port', value: passive ? 'Ephemeral (server picks)' : '20 (server→client)' }
      ]);
    }

    function renderParams() {
      ctx.params.hidden = false;
      var html = '';

      html += '<fieldset class="switch-mode-group" role="radiogroup" aria-label="Operation">';
      html += '<legend class="section-label" style="margin:0 0 0.5rem;border:none;padding:0;">Operation</legend>';
      Object.keys(OPERATIONS).forEach(function (k) {
        html += '<label class="switch-mode-option ' + (k === operation ? 'is-checked' : '') + '">' +
                '<input type="radio" name="ftpOp" value="' + k + '" ' + (k === operation ? 'checked' : '') + '> ' + OPERATIONS[k].label + '</label>';
      });
      html += '</fieldset>';

      html += '<fieldset class="switch-mode-group" role="radiogroup" aria-label="Mode">';
      html += '<legend class="section-label" style="margin:0 0 0.5rem;border:none;padding:0;">Mode</legend>';
      html += '<label class="switch-mode-option ' + (passive ? 'is-checked' : '') + '"><input type="radio" name="ftpMode" value="passive" ' + (passive ? 'checked' : '') + '> Passive (PASV)</label>';
      html += '<label class="switch-mode-option ' + (!passive ? 'is-checked' : '') + '"><input type="radio" name="ftpMode" value="active" ' + (!passive ? 'checked' : '') + '> Active (PORT)</label>';
      html += '</fieldset>';

      ctx.params.innerHTML = html;
      ctx.params.querySelectorAll('input[name="ftpOp"]').forEach(function (r) { r.addEventListener('change', function () { operation = r.value; rebuild(); }); });
      ctx.params.querySelectorAll('input[name="ftpMode"]').forEach(function (r) { r.addEventListener('change', function () { passive = r.value === 'passive'; rebuild(); }); });
    }

    function stop() { if (timer) { NetSim.SimTiming.clearInterval(timer); timer = null; } }
    function advance() { if (index >= events.length - 1) { stop(); return; } index++; ctx.log(events[index].text, events[index].level); draw(); }

    return {
      initialize: function () { ctx.canvas.classList.add('net-canvas'); ctx.canvas.innerHTML = '<div class="ftp-mount"></div>'; host = ctx.canvas.querySelector('.ftp-mount'); rebuild(); },
      start: function () { if (timer) return; timer = NetSim.SimTiming.setInterval(function () { if (index >= events.length - 1) { stop(); return; } advance(); }, 800); },
      pause: function () { stop(); },
      step: function () { stop(); advance(); },
      reset: function () { rebuild(); },
      destroy: function () { stop(); }
    };
  });

})(window.NetSim = window.NetSim || {});
