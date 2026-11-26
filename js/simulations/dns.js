/* ==========================================================================
   NetSim — simulations/dns.js
   Interactive DNS Resolution simulation with:
     - SVG network diagram showing Client → Resolver → Root → TLD → Auth
     - Step-by-step recursive / iterative resolution timeline
     - DNS query/response header breakdown
     - Cache hit/miss visualisation
     - Domain name presets and custom input
     - Record type toggle (A, AAAA, MX, CNAME)
   ========================================================================== */

(function (NetSim) {
  'use strict';

  /* ---- Colour palette ---- */
  var COLORS = {
    client:  '#1565c0',
    resolver:'#6a1b9a',
    root:    '#e65100',
    tld:     '#2e7d32',
    auth:    '#c62828',
    cache:   '#00838f'
  };

  /* ---- Domain presets ---- */
  var PRESETS = {
    web:   { label: 'www.example.com',   domain: 'www.example.com',   type: 'A',     ip: '93.184.216.34',       ttl: 3600 },
    mail:  { label: 'mail.google.com',   domain: 'mail.google.com',   type: 'MX',    ip: 'alt1.gmail-smtp-in.l.google.com (pri 5)', ttl: 600 },
    ipv6:  { label: 'ipv6.example.org',  domain: 'ipv6.example.org',  type: 'AAAA',  ip: '2606:2800:220:1:248:1893:25c8:1946',       ttl: 7200 },
    alias: { label: 'cdn.example.net',   domain: 'cdn.example.net',   type: 'CNAME', ip: 'cdn.example.net → edge.cdn.example.net → 104.26.10.78', ttl: 300 },
    custom:{ label: 'Custom Domain',     domain: 'my.custom.domain',  type: 'A',     ip: '10.0.0.1',            ttl: 1800 }
  };

  /* ---- Build resolution events ---- */
  function buildEvents(preset, recordType, cached) {
    var p = PRESETS[preset];
    var domain = p.domain;
    var parts = domain.split('.');
    var tldPart = '.' + parts[parts.length - 1];
    var sldPart = parts.slice(-2).join('.');
    var rtype = recordType || p.type;
    var answer = p.ip;
    var ttl = p.ttl;
    var events = [];
    var qId = Math.floor(Math.random() * 65535);

    // Step 0 — Application request
    events.push({
      from: 'app', to: 'client',
      label: 'Application needs IP',
      text: 'The application (browser, curl, etc.) calls getaddrinfo("' + domain + '") — the OS must resolve this hostname to an IP address.',
      tag: 'getaddrinfo()', level: 'info',
      header: null
    });

    // Step 1 — Client → Resolver query
    events.push({
      from: 'client', to: 'resolver',
      label: rtype + ' query → Resolver',
      text: 'Client sends a recursive DNS query (ID ' + qId + ') to its configured resolver: "What is the ' + rtype + ' record for ' + domain + '?"',
      tag: 'Query ID ' + qId, level: 'info',
      header: { id: qId, qr: 0, opcode: 'QUERY', rd: 1, qdcount: 1, ancount: 0, name: domain, type: rtype, class: 'IN' }
    });

    if (cached) {
      // Cache hit path
      events.push({
        from: 'resolver', to: 'resolver',
        label: '✓ Cache HIT',
        text: 'The resolver finds "' + domain + ' → ' + answer + '" in its cache (TTL still valid). No need to query root/TLD/authoritative servers.',
        tag: 'Cache Hit', level: 'success',
        header: null
      });
    } else {
      // Step 2 — Resolver → Root
      events.push({
        from: 'resolver', to: 'root',
        label: 'Query root for ' + tldPart,
        text: 'Resolver has no cache entry. It queries a root server: "Who handles ' + tldPart + '?"',
        tag: 'Root query', level: 'info',
        header: { id: qId, qr: 0, opcode: 'QUERY', rd: 0, qdcount: 1, ancount: 0, name: domain, type: rtype, class: 'IN' }
      });

      // Step 3 — Root referral
      events.push({
        from: 'root', to: 'resolver',
        label: 'Referral → ' + tldPart + ' servers',
        text: 'Root server responds with NS referral: "I don\'t know, but here are the nameservers for ' + tldPart + '."',
        tag: 'NS Referral', level: 'info',
        header: { id: qId, qr: 1, opcode: 'QUERY', aa: 0, nscount: 2, name: tldPart, type: 'NS', ns1: 'a.gtld-servers.net', ns2: 'b.gtld-servers.net' }
      });

      // Step 4 — Resolver → TLD
      events.push({
        from: 'resolver', to: 'tld',
        label: 'Query TLD for ' + sldPart,
        text: 'Resolver follows the referral and asks the ' + tldPart + ' TLD server: "Who is authoritative for ' + sldPart + '?"',
        tag: 'TLD query', level: 'info',
        header: { id: qId, qr: 0, opcode: 'QUERY', rd: 0, qdcount: 1, ancount: 0, name: domain, type: rtype, class: 'IN' }
      });

      // Step 5 — TLD referral
      events.push({
        from: 'tld', to: 'resolver',
        label: 'Referral → ' + sldPart + ' NS',
        text: 'TLD server responds: "Here are the authoritative nameservers for ' + sldPart + '."',
        tag: 'NS Referral', level: 'info',
        header: { id: qId, qr: 1, opcode: 'QUERY', aa: 0, nscount: 1, name: sldPart, type: 'NS', ns1: 'ns1.' + sldPart }
      });

      // Step 6 — Resolver → Authoritative
      events.push({
        from: 'resolver', to: 'auth',
        label: rtype + ' query → Authoritative',
        text: 'Resolver queries the authoritative server for ' + sldPart + ': "What is the ' + rtype + ' record for ' + domain + '?"',
        tag: 'Auth query', level: 'info',
        header: { id: qId, qr: 0, opcode: 'QUERY', rd: 0, qdcount: 1, ancount: 0, name: domain, type: rtype, class: 'IN' }
      });

      // Step 7 — Authoritative answer
      events.push({
        from: 'auth', to: 'resolver',
        label: rtype + ' = ' + (answer.length > 24 ? answer.substring(0, 22) + '…' : answer),
        text: 'Authoritative server returns the answer: ' + domain + ' ' + rtype + ' = ' + answer + ' (TTL ' + ttl + 's). This is the DEFINITIVE answer.',
        tag: 'Authoritative Answer', level: 'success',
        header: { id: qId, qr: 1, opcode: 'QUERY', aa: 1, ancount: 1, name: domain, type: rtype, rdata: answer, ttl: ttl }
      });
    }

    // Final — Resolver → Client answer
    events.push({
      from: 'resolver', to: 'client',
      label: rtype + ' = ' + (answer.length > 24 ? answer.substring(0, 22) + '…' : answer),
      text: 'Resolver caches the result (TTL ' + ttl + 's) and returns the answer to the client. Total queries: ' + (cached ? '0 (cache hit)' : '3 (root + TLD + auth)') + '.',
      tag: cached ? 'Cached Answer' : 'Final Answer', level: 'success',
      header: { id: qId, qr: 1, opcode: 'QUERY', ra: 1, ancount: 1, name: domain, type: rtype, rdata: answer, ttl: ttl }
    });

    // Done
    events.push({
      from: 'client', to: 'app',
      label: 'IP delivered to app',
      text: 'Client OS delivers the resolved address to the application. getaddrinfo() returns ' + answer + '. The app can now open a socket.',
      tag: 'Resolution Complete', level: 'success',
      header: null
    });

    return events;
  }

  /* ---- SVG Node positions ---- */
  var NODES = {
    app:      { x: 50,  y: 50,  label: 'Application',    color: '#546e7a', icon: '🖥️' },
    client:   { x: 50,  y: 140, label: 'Client Stub\nResolver', color: COLORS.client, icon: '💻' },
    resolver: { x: 300, y: 140, label: 'Recursive\nResolver',   color: COLORS.resolver, icon: '🔄' },
    root:     { x: 550, y: 50,  label: 'Root DNS\n(13 clusters)', color: COLORS.root, icon: '🌐' },
    tld:      { x: 550, y: 140, label: 'TLD DNS\n(.com/.org/…)',  color: COLORS.tld, icon: '📋' },
    auth:     { x: 550, y: 230, label: 'Authoritative\nDNS',      color: COLORS.auth, icon: '🏛️' }
  };

  /* ---- Render SVG network + timeline ---- */
  function renderSVG(events, currentIdx) {
    var W = 650, nodeH = 44, nodeW = 110;
    // Timeline below the network diagram
    var netH = 290;
    var tlRowH = 44;
    var visible = events.slice(0, currentIdx + 1);
    var tlH = Math.max(visible.length, 1) * tlRowH + 30;
    var H = netH + tlH;

    var svg = '<svg class="dns-svg" viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="DNS Resolution diagram">';

    // ---- Network diagram ----
    // Draw nodes
    var nodeKeys = ['app', 'client', 'resolver', 'root', 'tld', 'auth'];
    nodeKeys.forEach(function (k) {
      var n = NODES[k];
      var lines = n.label.split('\n');
      svg += '<rect x="' + (n.x - nodeW/2) + '" y="' + (n.y - nodeH/2) + '" width="' + nodeW + '" height="' + nodeH + '" rx="8" ' +
             'fill="' + n.color + '" fill-opacity="0.10" stroke="' + n.color + '" stroke-width="2"/>';

      // Highlight active nodes
      var active = currentIdx >= 0 && currentIdx < events.length;
      var ev = active ? events[currentIdx] : null;
      if (ev && (ev.from === k || ev.to === k)) {
        svg += '<rect x="' + (n.x - nodeW/2 - 3) + '" y="' + (n.y - nodeH/2 - 3) + '" width="' + (nodeW + 6) + '" height="' + (nodeH + 6) + '" rx="10" ' +
               'fill="none" stroke="' + n.color + '" stroke-width="3" stroke-dasharray="5 3">' +
               '<animate attributeName="stroke-dashoffset" from="0" to="16" dur="0.8s" repeatCount="indefinite"/>' +
               '</rect>';
      }

      svg += '<text x="' + n.x + '" y="' + (n.y - (lines.length > 1 ? 5 : 0)) + '" text-anchor="middle" class="dns-node-label" fill="' + n.color + '">' + lines[0] + '</text>';
      if (lines[1]) {
        svg += '<text x="' + n.x + '" y="' + (n.y + 10) + '" text-anchor="middle" class="dns-node-sub" fill="' + n.color + '">' + lines[1] + '</text>';
      }
    });

    // Static connection lines (faint)
    var connections = [
      ['app', 'client'], ['client', 'resolver'], ['resolver', 'root'], ['resolver', 'tld'], ['resolver', 'auth']
    ];
    connections.forEach(function (c) {
      var a = NODES[c[0]], b = NODES[c[1]];
      svg += '<line x1="' + a.x + '" y1="' + a.y + '" x2="' + b.x + '" y2="' + b.y + '" stroke="var(--line)" stroke-width="1" stroke-dasharray="4 3"/>';
    });

    // Active arrow on network diagram
    if (currentIdx >= 0 && currentIdx < events.length) {
      var ev = events[currentIdx];
      if (ev.from !== ev.to) {
        var fromN = NODES[ev.from], toN = NODES[ev.to];
        if (fromN && toN) {
          svg += '<line x1="' + fromN.x + '" y1="' + fromN.y + '" x2="' + toN.x + '" y2="' + toN.y + '" ' +
                 'stroke="' + (fromN.color || 'var(--accent)') + '" stroke-width="3" marker-end="url(#dns-arr)"/>';
        }
      }
    }

    // ---- Separator ----
    svg += '<line x1="10" y1="' + (netH - 10) + '" x2="' + (W - 10) + '" y2="' + (netH - 10) + '" stroke="var(--line)" stroke-width="1"/>';
    svg += '<text x="' + (W / 2) + '" y="' + (netH + 5) + '" text-anchor="middle" class="dns-tl-title">Resolution Timeline</text>';

    // ---- Timeline ----
    var tlTop = netH + 18;
    visible.forEach(function (ev, i) {
      var y = tlTop + i * tlRowH;
      var active = i === currentIdx;
      var fromN = NODES[ev.from];
      var toN = NODES[ev.to];

      // Tag pill
      var tagColor = (toN && toN.color) || 'var(--accent)';
      svg += '<rect x="10" y="' + (y + 2) + '" width="' + Math.min(ev.tag.length * 7 + 16, 180) + '" height="20" rx="10" ' +
             'fill="' + tagColor + '" fill-opacity="' + (active ? '0.18' : '0.08') + '" stroke="' + tagColor + '" stroke-width="' + (active ? '2' : '1') + '"/>';
      svg += '<text x="' + (10 + Math.min(ev.tag.length * 7 + 16, 180) / 2) + '" y="' + (y + 15) + '" text-anchor="middle" ' +
             'class="dns-tl-tag" fill="' + tagColor + '">' + ev.tag + '</text>';

      // Label
      var labelX = Math.min(ev.tag.length * 7 + 16, 180) + 20;
      svg += '<text x="' + labelX + '" y="' + (y + 15) + '" class="dns-tl-label" fill="' + (active ? 'var(--ink)' : 'var(--ink-soft)') + '">' +
             ev.label + '</text>';

      // Direction indicator
      if (ev.from !== ev.to) {
        var dirStr = (fromN ? fromN.label.split('\n')[0] : ev.from) + ' → ' + (toN ? toN.label.split('\n')[0] : ev.to);
        svg += '<text x="' + (W - 15) + '" y="' + (y + 15) + '" text-anchor="end" class="dns-tl-dir" fill="var(--ink-faint)">' + dirStr + '</text>';
      } else {
        svg += '<text x="' + (W - 15) + '" y="' + (y + 15) + '" text-anchor="end" class="dns-tl-dir" fill="' + COLORS.cache + '">⚡ Cache</text>';
      }

      // Step separator line
      if (i < visible.length - 1) {
        svg += '<line x1="20" y1="' + (y + tlRowH - 5) + '" x2="' + (W - 20) + '" y2="' + (y + tlRowH - 5) + '" stroke="var(--line)" stroke-width="0.5"/>';
      }
    });

    // Arrowhead def
    svg += '<defs><marker id="dns-arr" markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto">' +
           '<path d="M0,1 L0,7 L7,4 z" fill="var(--ink)"/></marker></defs>';

    svg += '</svg>';
    return svg;
  }

  /* ---- DNS Header breakdown ---- */
  function renderDNSHeader(header) {
    if (!header) return '';
    var html = '<div class="dns-hdr-box">';
    html += '<div class="dns-hdr-title">' + (header.qr === 0 ? '📤 DNS Query Header' : '📥 DNS Response Header') + '</div>';
    html += '<div class="dns-hdr-fields">';

    var fields = [];
    fields.push({ name: 'ID', val: header.id, cls: '' });
    fields.push({ name: 'QR', val: header.qr === 0 ? '0 (Query)' : '1 (Response)', cls: header.qr === 0 ? 'dns-hf-query' : 'dns-hf-resp' });
    fields.push({ name: 'Opcode', val: header.opcode || 'QUERY', cls: '' });

    if (header.rd !== undefined) fields.push({ name: 'RD', val: header.rd ? '1 (Recurse)' : '0', cls: '' });
    if (header.ra !== undefined) fields.push({ name: 'RA', val: header.ra ? '1 (Available)' : '0', cls: '' });
    if (header.aa !== undefined) fields.push({ name: 'AA', val: header.aa ? '1 (Auth)' : '0 (Not Auth)', cls: header.aa ? 'dns-hf-auth' : '' });

    if (header.qdcount !== undefined) fields.push({ name: 'QDCOUNT', val: header.qdcount, cls: '' });
    if (header.ancount !== undefined) fields.push({ name: 'ANCOUNT', val: header.ancount, cls: header.ancount > 0 ? 'dns-hf-resp' : '' });
    if (header.nscount !== undefined) fields.push({ name: 'NSCOUNT', val: header.nscount, cls: '' });

    if (header.name) fields.push({ name: 'QNAME', val: header.name, cls: 'dns-hf-name' });
    if (header.type) fields.push({ name: 'QTYPE', val: header.type, cls: '' });
    if (header.class) fields.push({ name: 'QCLASS', val: header.class, cls: '' });

    if (header.rdata) fields.push({ name: 'RDATA', val: header.rdata.length > 30 ? header.rdata.substring(0, 28) + '…' : header.rdata, cls: 'dns-hf-rdata' });
    if (header.ttl !== undefined) fields.push({ name: 'TTL', val: header.ttl + 's', cls: '' });
    if (header.ns1) fields.push({ name: 'NS', val: header.ns1, cls: '' });
    if (header.ns2) fields.push({ name: 'NS', val: header.ns2, cls: '' });

    fields.forEach(function (f) {
      html += '<div class="dns-hf ' + f.cls + '">';
      html += '<span class="dns-hf-name">' + f.name + '</span>';
      html += '<span class="dns-hf-val">' + f.val + '</span>';
      html += '</div>';
    });
    html += '</div></div>';
    return html;
  }

  /* ---- DNS hierarchy visualization ---- */
  function renderHierarchy(domain) {
    var parts = domain.split('.');
    var html = '<div class="dns-hierarchy">';
    html += '<span class="dns-hier-title">Domain Hierarchy:</span>';

    // Root
    html += '<span class="dns-hier-level dns-hier-root">. (Root)</span>';
    html += '<span class="dns-hier-arrow">→</span>';
    // TLD
    html += '<span class="dns-hier-level dns-hier-tld">.' + parts[parts.length - 1] + '</span>';
    html += '<span class="dns-hier-arrow">→</span>';
    // SLD
    html += '<span class="dns-hier-level dns-hier-sld">' + parts.slice(-2).join('.') + '</span>';
    if (parts.length > 2) {
      html += '<span class="dns-hier-arrow">→</span>';
      html += '<span class="dns-hier-level dns-hier-host">' + domain + '</span>';
    }
    html += '</div>';
    return html;
  }

  /* ==== Main simulation ==== */
  NetSim.SimRegistry.register('dns', function factory(ctx) {
    var preset = 'web';
    var recordType = 'A';
    var cached = false;
    var events = [];
    var index = -1;
    var timer = null;
    var host = null;

    function rebuild() {
      stop();
      index = -1;
      var p = PRESETS[preset];
      if (preset !== 'custom') { recordType = p.type; }
      events = buildEvents(preset, recordType, cached);
      draw();
      renderParams();
      ctx.log('DNS Resolution — ' + p.label + ' (' + recordType + ' record)' + (cached ? ' [cached]' : ' [full recursive]'));
    }

    function draw() {
      var ev = index >= 0 && events[index] ? events[index] : null;

      var hierHtml = renderHierarchy(PRESETS[preset].domain);
      var svgHtml = renderSVG(events, index);
      var headerHtml = ev && ev.header ? renderDNSHeader(ev.header) : '';

      // Query path summary
      var pathHtml = '<div class="dns-path-box">';
      pathHtml += '<div class="dns-path-title">Resolution Path</div>';
      pathHtml += '<div class="dns-path-steps">';

      var pathSteps = cached
        ? ['Client', 'Resolver (cached)']
        : ['Client', 'Resolver', 'Root', 'TLD', 'Auth', 'Resolver', 'Client'];
      pathSteps.forEach(function (s, i) {
        var done = false;
        if (cached) {
          done = index >= i;
        } else {
          done = index >= i;
        }
        pathHtml += '<span class="dns-path-step ' + (done ? 'dns-path-done' : '') + '">' + s + '</span>';
        if (i < pathSteps.length - 1) {
          pathHtml += '<span class="dns-path-sep">→</span>';
        }
      });
      pathHtml += '</div></div>';

      host.innerHTML = hierHtml + svgHtml + headerHtml + pathHtml;

      // Metrics
      var queriesSent = 0;
      if (index >= 0) {
        for (var i = 0; i <= index; i++) {
          if (events[i].header && events[i].header.qr === 0) queriesSent++;
        }
      }
      var responsesReceived = 0;
      if (index >= 0) {
        for (var j = 0; j <= index; j++) {
          if (events[j].header && events[j].header.qr === 1) responsesReceived++;
        }
      }

      ctx.setMetrics([
        { label: 'Domain', value: PRESETS[preset].domain },
        { label: 'Record Type', value: recordType },
        { label: 'Step', value: (index + 1) + ' / ' + events.length },
        { label: 'Queries Sent', value: String(queriesSent) },
        { label: 'Responses', value: String(responsesReceived) },
        { label: 'Cache', value: cached ? 'HIT ✓' : 'MISS — full recursion' },
        { label: 'Transport', value: 'UDP port 53 (< 512 B) / TCP if truncated' },
        { label: 'Answer', value: index >= events.length - 2 ? PRESETS[preset].ip : '…pending' }
      ]);
    }

    function renderParams() {
      ctx.params.hidden = false;
      var html = '';

      // Preset selector
      html += '<fieldset class="switch-mode-group" role="radiogroup" aria-label="Domain Preset">';
      html += '<legend class="section-label" style="margin:0 0 0.5rem;border:none;padding:0;">Domain</legend>';
      Object.keys(PRESETS).forEach(function (k) {
        html += '<label class="switch-mode-option ' + (k === preset ? 'is-checked' : '') + '">' +
                '<input type="radio" name="dnsPreset" value="' + k + '" ' + (k === preset ? 'checked' : '') + '> ' +
                PRESETS[k].label + '</label>';
      });
      html += '</fieldset>';

      // Record type (for custom)
      if (preset === 'custom') {
        html += '<fieldset class="switch-mode-group" role="radiogroup" aria-label="Record Type">';
        html += '<legend class="section-label" style="margin:0 0 0.5rem;border:none;padding:0;">Record Type</legend>';
        ['A', 'AAAA', 'MX', 'CNAME'].forEach(function (t) {
          html += '<label class="switch-mode-option ' + (t === recordType ? 'is-checked' : '') + '">' +
                  '<input type="radio" name="dnsRecType" value="' + t + '" ' + (t === recordType ? 'checked' : '') + '> ' +
                  t + '</label>';
        });
        html += '</fieldset>';
      }

      // Cache toggle
      html += '<div class="sim-param-row">';
      html += '<label class="switch-mode-option ' + (cached ? 'is-checked' : '') + '">' +
              '<input type="checkbox" id="dnsCached" ' + (cached ? 'checked' : '') + '> Cache Hit (skip root/TLD/auth)</label>';
      html += '</div>';

      ctx.params.innerHTML = html;

      // Event listeners
      ctx.params.querySelectorAll('input[name="dnsPreset"]').forEach(function (r) {
        r.addEventListener('change', function () { preset = r.value; rebuild(); });
      });
      ctx.params.querySelectorAll('input[name="dnsRecType"]').forEach(function (r) {
        r.addEventListener('change', function () { recordType = r.value; rebuild(); });
      });
      var cacheEl = ctx.params.querySelector('#dnsCached');
      if (cacheEl) {
        cacheEl.addEventListener('change', function () { cached = cacheEl.checked; rebuild(); });
      }
    }

    function stop() {
      if (timer) { NetSim.SimTiming.clearInterval(timer); timer = null; }
    }

    function advance() {
      if (index >= events.length - 1) { stop(); return; }
      index++;
      var e = events[index];
      ctx.log(e.text, e.level);
      draw();
    }

    return {
      initialize: function () {
        ctx.canvas.classList.add('net-canvas');
        ctx.canvas.innerHTML = '<div class="dns-mount"></div>';
        host = ctx.canvas.querySelector('.dns-mount');
        rebuild();
      },
      start: function () {
        if (timer) return;
        timer = NetSim.SimTiming.setInterval(function () {
          if (index >= events.length - 1) { stop(); return; }
          advance();
        }, 900);
      },
      pause: function () { stop(); },
      step: function () { stop(); advance(); },
      reset: function () { rebuild(); },
      destroy: function () { stop(); }
    };
  });

})(window.NetSim = window.NetSim || {});
