/* Application and presentation layer walkthroughs. Each topic is a small,
   deterministic protocol/data transformation with the shared playback API. */
(function (NetSim) {
  'use strict';

  const scenarios = {
    dns: { title: 'DNS recursive resolution', steps: [
      ['Client', 'Resolver', 'Client asks its recursive resolver for www.example.com.', 'question'],
      ['Resolver', 'Root DNS', 'Resolver asks a root server which server knows .com.', 'root referral'],
      ['Resolver', '.com DNS', 'The .com server refers the resolver to example.com authoritative DNS.', 'TLD referral'],
      ['Resolver', 'Authoritative DNS', 'The authoritative server returns A 93.184.216.34 (TTL 3600).', 'A record'],
      ['Resolver', 'Client', 'Resolver caches the answer and returns 93.184.216.34 to the client.', 'cached answer']
    ], explain: 'Recursive DNS resolution follows referrals from the root to the authoritative zone. The resolver caches the answer for its TTL.' },
    http: { title: 'HTTP request and response', steps: [
      ['Browser', 'Web server', 'Client opens a TCP connection to the server.', 'connection'],
      ['Browser', 'Web server', 'GET / HTTP/1.1 with Host: example.com and Accept headers.', 'GET request'],
      ['Web server', 'Browser', 'HTTP/1.1 200 OK with Content-Type and Content-Length headers.', '200 response'],
      ['Web server', 'Browser', 'HTML response body is delivered; the browser parses the document.', 'HTML body'],
      ['Browser', 'Web server', 'Connection is reused or closed according to HTTP version and headers.', 'complete']
    ], explain: 'HTTP defines application requests and responses. The status code, headers, and body carry different parts of the exchange.' },
    ftp: { title: 'FTP control and data channels', steps: [
      ['FTP client', 'FTP server', 'Control connection opens (typically TCP port 21).', 'control'],
      ['FTP server', 'FTP client', '220 service ready; client authenticates with USER and PASS.', 'login'],
      ['FTP client', 'FTP server', 'Client requests RETR report.txt over the control channel.', 'RETR'],
      ['FTP client', 'FTP server', 'A separate data connection transfers the file bytes.', 'data channel'],
      ['FTP server', 'FTP client', '226 transfer complete; control connection remains available.', 'complete']
    ], explain: 'Classic FTP separates commands and replies on a persistent control connection from file bytes on a data connection.' },
    smtp: { title: 'SMTP mail delivery', steps: [
      ['Mail client', 'Submission server', 'Client connects and identifies itself with EHLO.', 'EHLO'],
      ['Mail client', 'Submission server', 'MAIL FROM and RCPT TO establish envelope sender and recipient.', 'envelope'],
      ['Mail client', 'Submission server', 'DATA begins the message headers and body; a dot ends the message.', 'DATA'],
      ['Submission server', 'Recipient MX', 'Sender server looks up the recipient domain MX and relays the message.', 'relay'],
      ['Recipient MX', 'Mailbox', 'Recipient server accepts and stores the message for retrieval.', 'delivery']
    ], explain: 'SMTP is a store-and-forward protocol. Envelope commands route the message, while headers and body form its content.' },
    snmp: { title: 'SNMP polling and traps', steps: [
      ['Manager', 'Router agent', 'Manager sends a GET for sysUpTime.0 using a community or authenticated context.', 'GET'],
      ['Router agent', 'Manager', 'Agent returns a RESPONSE containing the uptime counter.', 'RESPONSE'],
      ['Manager', 'Router agent', 'Manager sends GET for ifInOctets.2 to inspect interface traffic.', 'GET'],
      ['Router agent', 'Manager', 'Agent returns the interface counter; manager compares samples over time.', 'counter'],
      ['Router agent', 'Manager', 'An interface-down TRAP is sent asynchronously when the link fails.', 'TRAP']
    ], explain: 'SNMP managers poll agents for managed object values. Traps and informs report events without waiting for the next poll.' },
    encoding: { title: 'Character encoding', steps: null, explain: 'A character encoding maps Unicode text to bytes. UTF-8 uses one to four bytes per code point; UTF-16 uses one or two 16-bit code units.' },
    encryption: { title: 'Symmetric encryption', steps: null, explain: 'A shared secret key transforms plaintext into ciphertext. This teaching model uses repeating-key XOR to make reversible encryption visible; it is not secure cryptography.' },
    compression: { title: 'Run-length compression', steps: null, explain: 'Run-length encoding stores repeated symbols as a count and value. It works well for repeated data and can expand data with few repetitions.' }
  };

  const escapeHTML = (value) => String(value).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const toBytes = (text, encoding) => {
    if (encoding === 'utf-16') return Array.from({ length: text.length }, (_, i) => text.charCodeAt(i));
    return Array.from(new TextEncoder().encode(text));
  };

  function create(id, ctx) {
    const spec = scenarios[id];
    let index = -1, timer = null, host, text = 'Hello, network!', key = 'NETSIM', encoding = 'utf-8';
    let derived = null;
    function stop() { if (timer) { NetSim.SimTiming.clearInterval(timer); timer = null; } }
    function transform() {
      if (id === 'encoding') {
        const bytes = toBytes(text, encoding);
        derived = { label: encoding.toUpperCase() + ' bytes', value: bytes.map((b) => b.toString(16).padStart(2, '0').toUpperCase()).join(' '), count: bytes.length };
      } else if (id === 'encryption') {
        const bytes = Array.from(new TextEncoder().encode(text));
        const keyBytes = Array.from(new TextEncoder().encode(key || 'K'));
        const cipher = bytes.map((b, i) => b ^ keyBytes[i % keyBytes.length]);
        derived = { label: 'Ciphertext (hex)', value: cipher.map((b) => b.toString(16).padStart(2, '0').toUpperCase()).join(' '), count: cipher.length };
      } else {
        const pairs = text.match(/(.)\1*/gu) || [];
        derived = { label: 'RLE output', value: pairs.map((run) => run.length + ':' + run[0]).join('  '), count: pairs.reduce((n, run) => n + 2, 0) };
      }
    }
    function draw() {
      const item = spec.steps ? spec.steps[Math.max(0, Math.min(index, spec.steps.length - 1))] : null;
      if (spec.steps) {
        host.innerHTML = `<div class="fw-diagram"><div class="fw-node">${escapeHTML(item[0])}</div><div class="fw-packet-track"><span class="fw-arrow">${index < 0 ? '·' : '→'}</span></div><div class="fw-node">${escapeHTML(item[1])}</div></div><div class="packet-status-strip"><span class="packet-chip ${index < 0 ? 'pending' : 'delivered'}">${escapeHTML(item[3])}</span></div><p class="net-hint">${index < 0 ? 'Press Step to begin.' : escapeHTML(item[2])}</p>`;
        ctx.setMetrics([{ label: 'Exchange', value: `${Math.max(0, index + 1)} / ${spec.steps.length}` }, { label: 'Current message', value: item[3] }, { label: 'Participants', value: item[0] + ' ↔ ' + item[1] }]);
      } else {
        transform();
        const count = Math.max(0, index + 1);
        host.innerHTML = `<div class="fw-diagram"><div class="fw-node">Input</div><div class="fw-packet-track"><span class="fw-arrow">${count ? '→' : '·'}</span></div><div class="fw-node">${escapeHTML(derived.label)}</div></div><div class="sim-param-row"><strong>Source text</strong><code>${escapeHTML(text)}</code></div><div class="sim-param-row"><strong>${escapeHTML(derived.label)}</strong><code style="overflow-wrap:anywhere">${escapeHTML(derived.value || '(empty)')}</code></div><p class="net-hint">${count ? escapeHTML(spec.explain) : 'Press Step to apply the transformation.'}</p>`;
        const inputBytes = new TextEncoder().encode(text).length;
        ctx.setMetrics([{ label: 'Input bytes (UTF-8)', value: String(inputBytes) }, { label: 'Output units', value: count ? String(derived.count) : '—' }, { label: 'Method', value: id === 'encoding' ? encoding.toUpperCase() : id === 'encryption' ? 'Repeating-key XOR demo' : 'Run-length encoding' }]);
      }
    }
    function renderParams() {
      if (spec.steps) { ctx.params.hidden = true; ctx.params.innerHTML = ''; return; }
      ctx.params.hidden = false;
      ctx.params.innerHTML = `<div class="sim-param-row"><label for="appText">Text</label><input id="appText" type="text" maxlength="64" value="${escapeHTML(text)}"></div>${id === 'encoding' ? `<div class="sim-param-row"><label for="appEncoding">Encoding</label><select id="appEncoding"><option value="utf-8" ${encoding === 'utf-8' ? 'selected' : ''}>UTF-8</option><option value="utf-16" ${encoding === 'utf-16' ? 'selected' : ''}>UTF-16 code units</option></select></div>` : ''}${id === 'encryption' ? `<div class="sim-param-row"><label for="appKey">Shared key</label><input id="appKey" type="text" maxlength="24" value="${escapeHTML(key)}"></div>` : ''}`;
      ctx.params.querySelector('#appText').addEventListener('input', (e) => { text = e.target.value; index = -1; draw(); });
      const select = ctx.params.querySelector('#appEncoding'); if (select) select.addEventListener('change', (e) => { encoding = e.target.value; index = -1; draw(); });
      const keyInput = ctx.params.querySelector('#appKey'); if (keyInput) keyInput.addEventListener('input', (e) => { key = e.target.value; index = -1; draw(); });
    }
    function rebuild() { stop(); index = -1; renderParams(); draw(); ctx.log('Ready — ' + spec.title + '.'); }
    function advance() { if (index >= (spec.steps ? spec.steps.length - 1 : 0)) { stop(); return; } index++; if (spec.steps) ctx.log(spec.steps[index][2], 'success'); else ctx.log(spec.explain); draw(); }
    return {
      initialize() { ctx.canvas.classList.add('net-canvas'); ctx.canvas.innerHTML = '<div class="app-sim-mount"></div>'; host = ctx.canvas.querySelector('.app-sim-mount'); rebuild(); },
      start() { if (timer) return; timer = NetSim.SimTiming.setInterval(() => { if (index >= (spec.steps ? spec.steps.length - 1 : 0)) { stop(); return; } advance(); }, 700); },
      pause: stop, step() { stop(); advance(); }, reset: rebuild, destroy: stop
    };
  }
  Object.keys(scenarios).forEach((id) => NetSim.SimRegistry.register(id, (ctx) => create(id, ctx)));
})(window.NetSim = window.NetSim || {});
