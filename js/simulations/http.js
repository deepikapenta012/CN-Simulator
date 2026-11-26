/* ==========================================================================
   NetSim — simulations/http.js
   Interactive HTTP Request/Response simulation:
     - SVG Client↔Server timeline with request & response arrows
     - Method presets (GET/POST/PUT/DELETE)
     - Status code scenarios (200/301/404/500)
     - Request & response header breakdown
     - Body preview panel
   ========================================================================== */

(function (NetSim) {
  'use strict';

  var METHODS = {
    GET:    { label: 'GET',    body: false, desc: 'Retrieve a resource' },
    POST:   { label: 'POST',   body: true,  desc: 'Submit data / create resource' },
    PUT:    { label: 'PUT',    body: true,  desc: 'Replace / update resource' },
    DELETE: { label: 'DELETE', body: false, desc: 'Remove a resource' }
  };

  var STATUS_PRESETS = {
    200: { code: 200, text: 'OK',                  color: '#2e7d32' },
    201: { code: 201, text: 'Created',              color: '#2e7d32' },
    204: { code: 204, text: 'No Content',           color: '#2e7d32' },
    301: { code: 301, text: 'Moved Permanently',    color: '#e65100' },
    404: { code: 404, text: 'Not Found',            color: '#d32f2f' },
    500: { code: 500, text: 'Internal Server Error', color: '#d32f2f' }
  };

  function statusFor(method, scenario) {
    if (scenario !== 'ok') {
      if (scenario === 'redirect') return STATUS_PRESETS[301];
      if (scenario === 'notfound') return STATUS_PRESETS[404];
      if (scenario === 'error')    return STATUS_PRESETS[500];
    }
    if (method === 'POST')   return STATUS_PRESETS[201];
    if (method === 'DELETE') return STATUS_PRESETS[204];
    return STATUS_PRESETS[200];
  }

  /* ---- Build events ---- */
  function buildEvents(method, scenario) {
    var events = [];
    var st = statusFor(method, scenario);
    var reqId = Math.floor(Math.random() * 9000) + 1000;

    // 1 — TCP connect
    events.push({
      dir: 'right', label: 'TCP SYN → SYN-ACK → ACK',
      text: 'Client opens a TCP connection to the server on port 80 (or 443 for HTTPS). The three-way handshake establishes the transport channel.',
      tag: 'TCP Connect', level: 'info',
      headers: null
    });

    // 2 — HTTP Request
    var reqHeaders = {
      Method: method, URL: '/api/resource', Version: 'HTTP/1.1',
      Host: 'example.com', Accept: 'text/html, application/json',
      'User-Agent': 'NetSim/1.0', Connection: 'keep-alive'
    };
    if (METHODS[method].body) {
      reqHeaders['Content-Type'] = method === 'PUT' ? 'application/json' : 'application/x-www-form-urlencoded';
      reqHeaders['Content-Length'] = method === 'PUT' ? '82' : '45';
    }
    var reqBody = '';
    if (method === 'POST') reqBody = 'name=NetSim&type=simulation&version=2';
    if (method === 'PUT')  reqBody = '{"name":"NetSim","type":"simulation","version":2}';

    events.push({
      dir: 'right', label: method + ' /api/resource HTTP/1.1',
      text: 'Client sends ' + method + ' request with headers' + (reqBody ? ' and body (' + reqHeaders['Content-Length'] + ' bytes)' : '') + '. The Host header identifies the target virtual host.',
      tag: method + ' Request', level: 'info',
      headers: reqHeaders, body: reqBody || null, isRequest: true
    });

    // 2b — Redirect extra step
    if (scenario === 'redirect') {
      events.push({
        dir: 'left', label: '301 Moved Permanently',
        text: 'Server responds with 301 and a Location header pointing to the new URL. The client must follow the redirect.',
        tag: '301 Redirect', level: 'warning',
        headers: { Status: '301 Moved Permanently', Location: 'https://example.com/new/resource', 'Content-Length': '0' },
        body: null, isRequest: false
      });
      events.push({
        dir: 'right', label: method + ' /new/resource HTTP/1.1',
        text: 'Client follows the redirect and sends the same request to the new URL.',
        tag: 'Follow Redirect', level: 'info',
        headers: { Method: method, URL: '/new/resource', Version: 'HTTP/1.1', Host: 'example.com' },
        body: reqBody || null, isRequest: true
      });
    }

    // 3 — HTTP Response
    var respHeaders = {
      Status: st.code + ' ' + st.text, 'Content-Type': 'text/html; charset=UTF-8',
      Server: 'nginx/1.24', Date: 'Mon, 24 Nov 2026 18:30:00 GMT',
      Connection: 'keep-alive'
    };
    var respBody = '';
    if (st.code === 200) {
      respHeaders['Content-Length'] = '1842';
      respHeaders['Cache-Control'] = 'max-age=3600';
      respBody = '<!DOCTYPE html><html><head><title>Example</title></head><body><h1>Hello NetSim!</h1>...</body></html>';
    } else if (st.code === 201) {
      respHeaders['Content-Type'] = 'application/json';
      respHeaders['Content-Length'] = '64';
      respHeaders.Location = '/api/resource/42';
      respBody = '{"id":42,"name":"NetSim","created":true}';
    } else if (st.code === 204) {
      delete respHeaders['Content-Type'];
      respHeaders['Content-Length'] = '0';
    } else if (st.code === 404) {
      respHeaders['Content-Length'] = '124';
      respBody = '<!DOCTYPE html><html><body><h1>404 Not Found</h1><p>The requested resource does not exist.</p></body></html>';
    } else if (st.code === 500) {
      respHeaders['Content-Length'] = '98';
      respBody = '<!DOCTYPE html><html><body><h1>500 Internal Server Error</h1><p>Something went wrong.</p></body></html>';
    }

    events.push({
      dir: 'left', label: 'HTTP/1.1 ' + st.code + ' ' + st.text,
      text: 'Server responds with ' + st.code + ' ' + st.text + '.' +
        (st.code === 200 ? ' The response includes HTML content and caching headers.' : '') +
        (st.code === 201 ? ' The new resource location is returned in the Location header.' : '') +
        (st.code === 204 ? ' No response body — the resource was deleted successfully.' : '') +
        (st.code === 404 ? ' The server could not find the requested resource.' : '') +
        (st.code === 500 ? ' An unexpected server error occurred.' : ''),
      tag: st.code + ' ' + st.text, level: st.code < 400 ? 'success' : 'warning',
      headers: respHeaders, body: respBody || null, isRequest: false
    });

    // 4 — Body delivery (if any)
    if (respBody) {
      events.push({
        dir: 'left', label: 'Response Body (' + respHeaders['Content-Length'] + ' B)',
        text: 'The response body is delivered. The browser parses it according to the Content-Type header (' + (respHeaders['Content-Type'] || 'none') + ').',
        tag: 'Body', level: 'info',
        headers: null, body: respBody, isRequest: false
      });
    }

    // 5 — Connection
    events.push({
      dir: 'none', label: 'Connection: keep-alive',
      text: 'HTTP/1.1 defaults to persistent connections (keep-alive). The TCP connection stays open for subsequent requests, avoiding repeated handshakes.',
      tag: 'Keep-Alive', level: 'success',
      headers: null
    });

    return events;
  }

  /* ---- SVG Timeline ---- */
  function renderTimeline(events, currentIdx) {
    var W = 600, rowH = 48, topPad = 50;
    var visible = events.slice(0, currentIdx + 1);
    var rows = Math.max(visible.length, 1);
    var H = topPad + rows * rowH + 20;
    var cX = 100, sX = 500;

    var svg = '<svg class="http-tl-svg" viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="HTTP timeline">';

    svg += '<text x="' + cX + '" y="22" text-anchor="middle" class="http-tl-header" fill="#1565c0">Client</text>';
    svg += '<text x="' + sX + '" y="22" text-anchor="middle" class="http-tl-header" fill="#2e7d32">Server</text>';
    svg += '<text x="' + cX + '" y="37" text-anchor="middle" class="http-tl-subhdr">Browser</text>';
    svg += '<text x="' + sX + '" y="37" text-anchor="middle" class="http-tl-subhdr">example.com:80</text>';

    svg += '<line x1="' + cX + '" y1="42" x2="' + cX + '" y2="' + (H - 5) + '" stroke="#1565c0" stroke-width="2" stroke-dasharray="4 3"/>';
    svg += '<line x1="' + sX + '" y1="42" x2="' + sX + '" y2="' + (H - 5) + '" stroke="#2e7d32" stroke-width="2" stroke-dasharray="4 3"/>';

    visible.forEach(function (ev, i) {
      var y = topPad + i * rowH;
      var active = i === currentIdx;
      var sw = active ? '3' : '2';

      if (ev.dir === 'right') {
        var color = '#1565c0';
        svg += '<line x1="' + cX + '" y1="' + y + '" x2="' + sX + '" y2="' + (y + rowH * 0.4) + '" stroke="' + color + '" stroke-width="' + sw + '" marker-end="url(#http-arr)"/>';
        svg += '<text x="' + ((cX + sX) / 2) + '" y="' + (y - 3) + '" text-anchor="middle" class="http-arrow-label" fill="' + color + '">' + ev.label + '</text>';
      } else if (ev.dir === 'left') {
        var color2 = ev.tag.indexOf('301') >= 0 ? '#e65100' : ev.tag.indexOf('4') === 0 || ev.tag.indexOf('5') === 0 ? '#d32f2f' : '#2e7d32';
        svg += '<line x1="' + sX + '" y1="' + y + '" x2="' + cX + '" y2="' + (y + rowH * 0.4) + '" stroke="' + color2 + '" stroke-width="' + sw + '" marker-end="url(#http-arr)"/>';
        svg += '<text x="' + ((cX + sX) / 2) + '" y="' + (y - 3) + '" text-anchor="middle" class="http-arrow-label" fill="' + color2 + '">' + ev.label + '</text>';
      } else {
        // note banner
        svg += '<rect x="' + (cX + 10) + '" y="' + (y + 5) + '" width="' + (sX - cX - 20) + '" height="26" rx="13" fill="#2e7d32" fill-opacity="0.08" stroke="#2e7d32" stroke-width="1.5"/>';
        svg += '<text x="' + ((cX + sX) / 2) + '" y="' + (y + 22) + '" text-anchor="middle" class="http-note-label" fill="#2e7d32">' + ev.label + '</text>';
      }
    });

    svg += '<defs><marker id="http-arr" markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto">' +
           '<path d="M0,1 L0,7 L7,4 z" fill="var(--ink)"/></marker></defs>';
    svg += '</svg>';
    return svg;
  }

  /* ---- Header breakdown ---- */
  function renderHeaders(hdr, isReq) {
    if (!hdr) return '';
    var html = '<div class="http-hdr-box">';
    html += '<div class="http-hdr-title">' + (isReq ? '📤 Request Headers' : '📥 Response Headers') + '</div>';
    html += '<div class="http-hdr-fields">';
    Object.keys(hdr).forEach(function (k) {
      var cls = '';
      if (k === 'Method') cls = 'http-hf-method';
      else if (k === 'Status') cls = (String(hdr[k]).charAt(0) === '2' ? 'http-hf-ok' : String(hdr[k]).charAt(0) === '3' ? 'http-hf-redir' : 'http-hf-err');
      else if (k === 'Content-Type') cls = 'http-hf-ct';
      html += '<div class="http-hf ' + cls + '"><span class="http-hf-name">' + k + '</span><span class="http-hf-val">' + hdr[k] + '</span></div>';
    });
    html += '</div></div>';
    return html;
  }

  /* ---- Body preview ---- */
  function renderBody(body) {
    if (!body) return '';
    var display = body.length > 100 ? body.substring(0, 100) + '…' : body;
    return '<div class="http-body-box"><div class="http-body-title">Body Preview</div><pre class="http-body-pre">' +
           display.replace(/</g, '&lt;').replace(/>/g, '&gt;') + '</pre></div>';
  }

  /* ==== Main simulation ==== */
  NetSim.SimRegistry.register('http', function factory(ctx) {
    var method = 'GET';
    var scenario = 'ok';
    var events = [];
    var index = -1;
    var timer = null;
    var host = null;

    function rebuild() {
      stop();
      index = -1;
      events = buildEvents(method, scenario);
      draw();
      renderParams();
      var st = statusFor(method, scenario);
      ctx.log('HTTP — ' + method + ' → ' + st.code + ' ' + st.text);
    }

    function draw() {
      var ev = index >= 0 && events[index] ? events[index] : null;
      var tlHtml = renderTimeline(events, index);
      var hdrHtml = ev && ev.headers ? renderHeaders(ev.headers, ev.isRequest) : '';
      var bodyHtml = ev && ev.body ? renderBody(ev.body) : '';

      // Summary bar
      var st = statusFor(method, scenario);
      var sumHtml = '<div class="http-summary-bar">';
      sumHtml += '<span class="http-sum-method">' + method + '</span>';
      sumHtml += '<span class="http-sum-url">/api/resource</span>';
      sumHtml += '<span class="http-sum-arrow">→</span>';
      sumHtml += '<span class="http-sum-status" style="color:' + st.color + '">' + st.code + ' ' + st.text + '</span>';
      sumHtml += '</div>';

      // Info box
      var infoHtml = '<div class="http-info">';
      infoHtml += '<h4 class="http-info-title">HTTP — HyperText Transfer Protocol</h4>';
      infoHtml += '<ul class="http-info-props">';
      infoHtml += '<li><strong>Stateless</strong> — each request is independent; no built-in session</li>';
      infoHtml += '<li><strong>Request-Response</strong> — client always initiates; server always responds</li>';
      infoHtml += '<li><strong>Persistent connections</strong> — HTTP/1.1 keeps TCP open by default</li>';
      infoHtml += '<li><strong>Content Negotiation</strong> — Accept / Content-Type headers agree on format</li>';
      infoHtml += '<li><strong>Methods</strong> — GET (read), POST (create), PUT (update), DELETE (remove)</li>';
      infoHtml += '</ul></div>';

      host.innerHTML = sumHtml + tlHtml + hdrHtml + bodyHtml + infoHtml;

      // Metrics
      ctx.setMetrics([
        { label: 'Method', value: method },
        { label: 'Status', value: st.code + ' ' + st.text },
        { label: 'Step', value: (index + 1) + ' / ' + events.length },
        { label: 'Has Body (request)', value: METHODS[method].body ? 'Yes' : 'No' },
        { label: 'Connection', value: 'keep-alive (persistent)' },
        { label: 'Transport', value: 'TCP port 80 / 443 (TLS)' }
      ]);
    }

    function renderParams() {
      ctx.params.hidden = false;
      var html = '';

      // Method selector
      html += '<fieldset class="switch-mode-group" role="radiogroup" aria-label="HTTP Method">';
      html += '<legend class="section-label" style="margin:0 0 0.5rem;border:none;padding:0;">Method</legend>';
      Object.keys(METHODS).forEach(function (m) {
        html += '<label class="switch-mode-option ' + (m === method ? 'is-checked' : '') + '">' +
                '<input type="radio" name="httpMethod" value="' + m + '" ' + (m === method ? 'checked' : '') + '> ' + m + '</label>';
      });
      html += '</fieldset>';

      // Scenario selector
      html += '<fieldset class="switch-mode-group" role="radiogroup" aria-label="Scenario">';
      html += '<legend class="section-label" style="margin:0 0 0.5rem;border:none;padding:0;">Scenario</legend>';
      var scenarios = { ok: 'Success', redirect: '301 Redirect', notfound: '404 Not Found', error: '500 Error' };
      Object.keys(scenarios).forEach(function (s) {
        html += '<label class="switch-mode-option ' + (s === scenario ? 'is-checked' : '') + '">' +
                '<input type="radio" name="httpScenario" value="' + s + '" ' + (s === scenario ? 'checked' : '') + '> ' + scenarios[s] + '</label>';
      });
      html += '</fieldset>';

      ctx.params.innerHTML = html;

      ctx.params.querySelectorAll('input[name="httpMethod"]').forEach(function (r) {
        r.addEventListener('change', function () { method = r.value; rebuild(); });
      });
      ctx.params.querySelectorAll('input[name="httpScenario"]').forEach(function (r) {
        r.addEventListener('change', function () { scenario = r.value; rebuild(); });
      });
    }

    function stop() { if (timer) { NetSim.SimTiming.clearInterval(timer); timer = null; } }

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
        ctx.canvas.innerHTML = '<div class="http-mount"></div>';
        host = ctx.canvas.querySelector('.http-mount');
        rebuild();
      },
      start: function () {
        if (timer) return;
        timer = NetSim.SimTiming.setInterval(function () {
          if (index >= events.length - 1) { stop(); return; }
          advance();
        }, 800);
      },
      pause: function () { stop(); },
      step: function () { stop(); advance(); },
      reset: function () { rebuild(); },
      destroy: function () { stop(); }
    };
  });

})(window.NetSim = window.NetSim || {});
