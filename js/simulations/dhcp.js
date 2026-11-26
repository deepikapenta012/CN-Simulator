/* ==========================================================================
   NetSim — simulations/dhcp.js   (rebuilt)
   DHCP DORA sequence with:
   • SVG timeline: Client ↔ Server A / Server B with message arrows
   • DORA phase badges (Discover, Offer, Request, Acknowledge)
   • Server competition visualisation (two offers, one selected)
   • Lease info card + renewal timer
   • 2 presets: dual-server competition vs single-server
   ========================================================================== */

(function (NetSim) {
  'use strict';

  var PRESETS = [
    { label: 'Two Servers', tag: 'Competition + withdraw', servers: 2 },
    { label: 'Single Server', tag: 'Standard DORA', servers: 1 }
  ];

  NetSim.SimRegistry.register('dhcp', function factory(ctx) {
    var preIdx = 0;
    var events = [];
    var index  = -1;
    var timer  = null;
    var mount  = null;
    var offerA = '192.168.1.105';
    var offerB = '192.168.1.210';
    var lease  = '24 hours';

    /* ── build events ─────────────────────────────────────────────────── */
    function buildEvents() {
      var dual = PRESETS[preIdx].servers === 2;
      var out = [];
      out.push({ t: 'Client boots with no IP.  Broadcasts DHCPDISCOVER to 255.255.255.255.', phase: 'discover', dir: 'right', badge: 'DISCOVER' });
      out.push({ t: 'Server A receives the broadcast.', phase: 'recv-a', dir: 'none' });
      out.push({ t: 'Server A replies: DHCPOFFER ' + offerA + ', lease ' + lease + '.', phase: 'offer-a', dir: 'left-a', badge: 'OFFER', lv: 'success' });

      if (dual) {
        out.push({ t: 'Server B also replies: DHCPOFFER ' + offerB + ', lease ' + lease + '.', phase: 'offer-b', dir: 'left-b', badge: 'OFFER' });
        out.push({ t: 'Client accepts Server A\'s offer.  Broadcasts DHCPREQUEST for ' + offerA + '.', phase: 'request', dir: 'right', badge: 'REQUEST' });
        out.push({ t: 'Server B sees the REQUEST naming Server A\'s address — withdraws its offer, returns ' + offerB + ' to pool.', phase: 'withdraw', dir: 'none', lv: 'warning' });
      } else {
        out.push({ t: 'Client broadcasts DHCPREQUEST for ' + offerA + '.', phase: 'request', dir: 'right', badge: 'REQUEST' });
      }

      out.push({ t: 'Server A sends DHCPACK, confirming ' + offerA + ' for ' + lease + '.', phase: 'ack', dir: 'left-a', badge: 'ACK', lv: 'success' });
      out.push({ t: 'Client configures its interface with ' + offerA + '.  It can now communicate.', phase: 'done', dir: 'none', lv: 'success' });
      out.push({ t: 'At 50% lease time, client unicasts DHCPREQUEST to Server A to renew before expiry.', phase: 'renew', dir: 'right-uni', badge: 'RENEW' });
      return out;
    }

    /* ── SVG timeline ─────────────────────────────────────────────────── */
    function svgTimeline() {
      var dual = PRESETS[preIdx].servers === 2;
      var W = 680, rowH = 32;
      var revealed = Math.max(0, index + 1);
      var H = 60 + revealed * rowH + 20;

      var colClient = 120, colSrvA = dual ? 380 : 440, colSrvB = 560;
      var html = '<svg class="dhcp-svg" viewBox="0 0 ' + W + ' ' + H + '" preserveAspectRatio="xMidYMid meet">';

      /* column headers */
      html += '<rect x="' + (colClient - 40) + '" y="5" width="80" height="28" rx="6" fill="#e3f2fd" stroke="#42a5f5" stroke-width="1.5"/>';
      html += '<text x="' + colClient + '" y="24" text-anchor="middle" font-size="11" font-weight="700" fill="#1565c0">Client</text>';

      html += '<rect x="' + (colSrvA - 40) + '" y="5" width="80" height="28" rx="6" fill="#e8f5e9" stroke="#66bb6a" stroke-width="1.5"/>';
      html += '<text x="' + colSrvA + '" y="24" text-anchor="middle" font-size="11" font-weight="700" fill="#2e7d32">Server A</text>';

      if (dual) {
        html += '<rect x="' + (colSrvB - 40) + '" y="5" width="80" height="28" rx="6" fill="#fff3e0" stroke="#ffa726" stroke-width="1.5"/>';
        html += '<text x="' + colSrvB + '" y="24" text-anchor="middle" font-size="11" font-weight="700" fill="#e65100">Server B</text>';
      }

      /* vertical lifelines */
      var lifeTop = 38, lifeBot = 38 + revealed * rowH + 10;
      html += '<line x1="' + colClient + '" y1="' + lifeTop + '" x2="' + colClient + '" y2="' + lifeBot + '" stroke="#42a5f5" stroke-width="1" stroke-dasharray="4,3"/>';
      html += '<line x1="' + colSrvA + '" y1="' + lifeTop + '" x2="' + colSrvA + '" y2="' + lifeBot + '" stroke="#66bb6a" stroke-width="1" stroke-dasharray="4,3"/>';
      if (dual) {
        html += '<line x1="' + colSrvB + '" y1="' + lifeTop + '" x2="' + colSrvB + '" y2="' + lifeBot + '" stroke="#ffa726" stroke-width="1" stroke-dasharray="4,3"/>';
      }

      /* arrows */
      var cols = { 'right': [colClient, colSrvA], 'right-uni': [colClient, colSrvA],
                   'left-a': [colSrvA, colClient], 'left-b': [colSrvB, colClient] };
      var arrowCols = { 'right': '#42a5f5', 'right-uni': '#0097a7', 'left-a': '#66bb6a', 'left-b': '#ffa726' };

      for (var i = 0; i < revealed; i++) {
        var ev = events[i];
        var y = 50 + i * rowH;
        if (ev.dir && ev.dir !== 'none' && cols[ev.dir]) {
          var c = cols[ev.dir];
          var ac = arrowCols[ev.dir] || '#888';
          html += '<line x1="' + c[0] + '" y1="' + y + '" x2="' + c[1] + '" y2="' + y + '" stroke="' + ac + '" stroke-width="2" marker-end="url(#dhcpArr)"/>';
          if (ev.badge) {
            var mx = (c[0] + c[1]) / 2;
            html += '<rect x="' + (mx - 30) + '" y="' + (y - 10) + '" width="60" height="14" rx="3" fill="' + ac + '"/>';
            html += '<text x="' + mx + '" y="' + (y - 1) + '" text-anchor="middle" font-size="8" font-weight="700" fill="#fff">' + ev.badge + '</text>';
          }
        }
        /* withdraw X on server B */
        if (ev.phase === 'withdraw') {
          html += '<text x="' + colSrvB + '" y="' + (y + 5) + '" text-anchor="middle" font-size="16" fill="#ef5350" font-weight="700">✗</text>';
        }
      }

      /* marker def */
      html += '<defs><marker id="dhcpArr" markerWidth="8" markerHeight="6" refX="8" refY="3" orient="auto"><path d="M0,0 L8,3 L0,6 Z" fill="#888"/></marker></defs>';
      html += '</svg>';
      return html;
    }

    /* ── lease card ───────────────────────────────────────────────────── */
    function leaseCard() {
      var done = false;
      for (var i = 0; i <= index; i++) {
        if (events[i] && events[i].phase === 'done') done = true;
      }
      if (!done) return '';
      var html = '<div class="dhcp-lease">';
      html += '<div class="dhcp-lease-title">Lease Acquired</div>';
      html += '<div class="dhcp-lease-row"><span>IP Address</span><strong>' + offerA + '</strong></div>';
      html += '<div class="dhcp-lease-row"><span>Server</span><strong>Server A</strong></div>';
      html += '<div class="dhcp-lease-row"><span>Lease Time</span><strong>' + lease + '</strong></div>';
      html += '<div class="dhcp-lease-row"><span>Renewal (T1)</span><strong>50% = 12 hours</strong></div>';
      html += '<div class="dhcp-lease-row"><span>Rebind (T2)</span><strong>87.5% = 21 hours</strong></div>';
      html += '</div>';
      return html;
    }

    /* ── DORA phase strip ─────────────────────────────────────────────── */
    function doraStrip() {
      var dora = ['DISCOVER', 'OFFER', 'REQUEST', 'ACK'];
      var current = '';
      for (var i = 0; i <= index; i++) {
        if (events[i] && events[i].badge && dora.indexOf(events[i].badge) >= 0) current = events[i].badge;
      }
      var html = '<div class="dhcp-dora">';
      for (var i = 0; i < dora.length; i++) {
        var active = dora[i] === current;
        var passed = dora.indexOf(current) > i;
        html += '<div class="dhcp-dora-step' + (active ? ' dhcp-dora-active' : '') + (passed ? ' dhcp-dora-done' : '') + '">' + dora[i].charAt(0) + '</div>';
        if (i < 3) html += '<div class="dhcp-dora-line' + (passed || active ? ' dhcp-dora-line-on' : '') + '"></div>';
      }
      html += '</div>';
      return html;
    }

    /* ── draw ──────────────────────────────────────────────────────────── */
    function draw() {
      mount.innerHTML = doraStrip() + svgTimeline() + leaseCard();

      var step = events[Math.max(0, index)] || {};
      var offersCount = 0;
      for (var i = 0; i <= index; i++) {
        if (events[i] && (events[i].phase === 'offer-a' || events[i].phase === 'offer-b')) offersCount++;
      }
      ctx.setMetrics([
        { label: 'Scenario', value: PRESETS[preIdx].label },
        { label: 'Offers Received', value: String(offersCount) },
        { label: 'Chosen Server', value: index >= 3 ? 'Server A' : '—' },
        { label: 'Leased IP', value: step.phase === 'done' || step.phase === 'renew' ? offerA : '—' },
        { label: 'Lease Duration', value: lease }
      ]);
    }

    /* ── params ────────────────────────────────────────────────────────── */
    function renderParams() {
      ctx.params.hidden = false;
      var html = '<div class="dhcp-presets">';
      for (var i = 0; i < PRESETS.length; i++) {
        html += '<label class="switch-mode-option' + (i === preIdx ? ' is-checked' : '') + '">' +
          '<input type="radio" name="dhcppre" value="' + i + '"' + (i === preIdx ? ' checked' : '') + '> ' +
          '<strong>' + PRESETS[i].label + '</strong><br><span style="font-size:0.72rem;color:var(--ink-faint);">' + PRESETS[i].tag + '</span></label>';
      }
      html += '</div>';
      ctx.params.innerHTML = html;

      var radios = ctx.params.querySelectorAll('input[name="dhcppre"]');
      for (var i = 0; i < radios.length; i++) {
        radios[i].addEventListener('change', function (e) {
          preIdx = parseInt(e.target.value, 10);
          rebuild();
        });
      }
    }

    function rebuild() {
      stop(); index = -1;
      events = buildEvents();
      renderParams(); draw();
      ctx.log('Ready — ' + PRESETS[preIdx].label + ': client about to request an IP address.');
    }

    function stop() { if (timer) { NetSim.SimTiming.clearInterval(timer); timer = null; } }

    function advance() {
      if (index >= events.length - 1) { stop(); return; }
      index++;
      ctx.log(events[index].t, events[index].lv);
      draw();
    }

    return {
      initialize: function () {
        ctx.canvas.innerHTML = '<div class="dhcp-mount"></div>';
        mount = ctx.canvas.querySelector('.dhcp-mount');
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
      step:  function () { stop(); advance(); },
      reset: function () { rebuild(); },
      destroy: function () { stop(); }
    };
  });

})(window.NetSim = window.NetSim || {});
