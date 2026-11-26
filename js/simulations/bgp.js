/* ==========================================================================
   NetSim — simulations/bgp.js   (rebuilt)
   BGP path-vector routing with:
   • SVG AS topology: AS100 ↔ AS200 ↔ AS300 ↔ AS400 (+ direct peering)
   • AS-PATH propagation animation with prepend visualisation
   • Route comparison table (candidate routes, AS-PATH length)
   • Loop prevention explanation
   • BGP message type breakdown
   • Randomised prefix per reset
   ========================================================================== */

(function (NetSim) {
  'use strict';

  function randomPrefix() {
    var firsts = [10, 172, 192, 198, 203];
    var masks  = [8, 16, 20, 24];
    var a = firsts[Math.floor(Math.random() * firsts.length)];
    var b = Math.floor(Math.random() * 256);
    var c = Math.floor(Math.random() * 256);
    var m = masks[Math.floor(Math.random() * masks.length)];
    return a + '.' + b + '.' + c + '.0/' + m;
  }

  /* AS positions for SVG */
  var AS_POS = {
    AS100: [100, 100], AS200: [300, 40],
    AS300: [500, 100], AS400: [300, 180]
  };
  var AS_LINKS = [
    { a: 'AS100', b: 'AS200' },
    { a: 'AS200', b: 'AS300' },
    { a: 'AS100', b: 'AS300' },  /* direct peering */
    { a: 'AS300', b: 'AS400' }
  ];

  NetSim.SimRegistry.register('bgp', function factory(ctx) {
    var phases = [];
    var index  = -1;
    var timer  = null;
    var mount  = null;
    var routes = [];
    var prefix = randomPrefix();

    function buildPhases() {
      routes = [];
      return [
        { t: 'AS400 originates ' + prefix + ' and advertises to AS300.  AS-PATH = [AS400].', v: 'origin', activeLink: 3, msgType: 'UPDATE' },
        { t: 'AS300 receives, prepends its ASN: AS-PATH = [AS300, AS400].  Advertises to AS200 and AS100.', v: 'as300', activeLink: 1, msgType: 'UPDATE' },
        { t: 'AS100 receives directly from AS300 — candidate route with AS-PATH length 2.', v: 'route1', addRoute: { via: 'AS300 (direct)', path: ['AS300', 'AS400'], len: 2 } },
        { t: 'AS200 receives from AS300, prepends: AS-PATH = [AS200, AS300, AS400].  Advertises to AS100.', v: 'as200', activeLink: 0, msgType: 'UPDATE' },
        { t: 'AS100 now has a second candidate: via AS200 — AS-PATH length 3.', v: 'route2', addRoute: { via: 'AS200', path: ['AS200', 'AS300', 'AS400'], len: 3 } },
        { t: 'AS100 selects the route with the shorter AS-PATH: via AS300 (length 2).', v: 'select', lv: 'success' },
        { t: 'Loop prevention: if AS-PATH already contained AS100, the route would be rejected immediately.', v: 'loop' }
      ];
    }

    /* ── SVG AS topology ──────────────────────────────────────────────── */
    function svgDiagram() {
      var step = phases[Math.max(0, index)] || {};
      var W = 620, H = 230, R = 30;
      var html = '<svg class="bgp-svg" viewBox="0 0 ' + W + ' ' + H + '" preserveAspectRatio="xMidYMid meet">';

      /* links */
      var linkLabels = ['eBGP', 'eBGP', 'Direct Peering', 'eBGP'];
      for (var i = 0; i < AS_LINKS.length; i++) {
        var l = AS_LINKS[i];
        var pa = AS_POS[l.a], pb = AS_POS[l.b];
        var active = step.activeLink === i;
        var isDirect = i === 2;
        html += '<line x1="' + pa[0] + '" y1="' + pa[1] + '" x2="' + pb[0] + '" y2="' + pb[1] + '" stroke="' + (active ? '#0097a7' : (isDirect ? '#66bb6a' : '#ccc')) + '" stroke-width="' + (active ? 3 : 1.5) + '"' + (isDirect ? ' stroke-dasharray="6,3"' : '') + '/>';
        var mx = (pa[0] + pb[0]) / 2, my = (pa[1] + pb[1]) / 2;
        html += '<text x="' + (mx + (isDirect ? -30 : 8)) + '" y="' + (my - 6) + '" font-size="8" fill="' + (active ? '#0097a7' : '#888') + '">' + linkLabels[i] + '</text>';
      }

      /* AS nodes */
      var asNames = ['AS100', 'AS200', 'AS300', 'AS400'];
      var asCols  = ['#42a5f5', '#ffa726', '#66bb6a', '#ab47bc'];
      for (var i = 0; i < asNames.length; i++) {
        var n = asNames[i];
        var p = AS_POS[n];
        var c = asCols[i];
        var isOrigin = n === 'AS400';
        html += '<circle cx="' + p[0] + '" cy="' + p[1] + '" r="' + R + '" fill="' + c + '22" stroke="' + c + '" stroke-width="' + (isOrigin ? 3 : 2) + '"/>';
        html += '<text x="' + p[0] + '" y="' + (p[1] + 5) + '" text-anchor="middle" font-size="11" font-weight="700" fill="' + c + '">' + n + '</text>';
        if (isOrigin) {
          html += '<text x="' + p[0] + '" y="' + (p[1] + R + 14) + '" text-anchor="middle" font-size="8" fill="' + c + '">Origin: ' + prefix + '</text>';
        }
      }

      /* active arrow animation */
      if (step.activeLink !== undefined) {
        var al = AS_LINKS[step.activeLink];
        var pa = AS_POS[al.a], pb = AS_POS[al.b];
        var mx = (pa[0] + pb[0]) / 2, my = (pa[1] + pb[1]) / 2;
        html += '<circle cx="' + mx + '" cy="' + my + '" r="5" fill="#0097a7"><animate attributeName="r" values="3;7;3" dur="0.8s" repeatCount="indefinite"/></circle>';
      }

      html += '</svg>';
      return html;
    }

    /* ── route table ──────────────────────────────────────────────────── */
    function routeTable() {
      /* accumulate routes */
      var liveRoutes = [];
      for (var i = 0; i <= Math.max(0, index) && i < phases.length; i++) {
        if (phases[i].addRoute) liveRoutes.push(phases[i].addRoute);
      }
      if (liveRoutes.length === 0) return '';

      var selected = index >= 5;
      var html = '<div class="bgp-routes"><div class="bgp-routes-title">AS100 Candidate Routes for ' + prefix + '</div>';
      html += '<table class="bgp-route-tbl"><thead><tr><th>Via</th><th>AS-PATH</th><th>Length</th><th>Status</th></tr></thead><tbody>';
      for (var i = 0; i < liveRoutes.length; i++) {
        var r = liveRoutes[i];
        var best = selected && r.len === 2;
        html += '<tr class="' + (best ? 'bgp-route-best' : '') + '">';
        html += '<td>' + r.via + '</td>';
        html += '<td class="bgp-route-path">' + r.path.join(' \u2192 ') + '</td>';
        html += '<td>' + r.len + '</td>';
        html += '<td>' + (best ? '<span class="bgp-route-sel">\u2713 Selected</span>' : (selected ? 'Rejected' : 'Candidate')) + '</td>';
        html += '</tr>';
      }
      html += '</tbody></table></div>';
      return html;
    }

    /* ── AS-PATH strip ────────────────────────────────────────────────── */
    function pathStrip() {
      var step = phases[Math.max(0, index)] || {};
      if (step.v !== 'origin' && step.v !== 'as300' && step.v !== 'as200') return '';
      var paths = {
        'origin': ['AS400'],
        'as300':  ['AS300', 'AS400'],
        'as200':  ['AS200', 'AS300', 'AS400']
      };
      var p = paths[step.v] || [];
      var html = '<div class="bgp-path-strip"><span class="bgp-path-label">AS-PATH:</span>';
      for (var i = 0; i < p.length; i++) {
        if (i > 0) html += '<span class="bgp-path-arrow">\u2192</span>';
        html += '<span class="bgp-path-as' + (i === 0 ? ' bgp-path-prepend' : '') + '">' + p[i] + '</span>';
      }
      html += '</div>';
      return html;
    }

    /* ── BGP message panel ────────────────────────────────────────────── */
    function msgPanel() {
      var step = phases[Math.max(0, index)] || {};
      if (!step.msgType) return '';
      var html = '<div class="bgp-msg">';
      html += '<div class="bgp-msg-title">BGP ' + step.msgType + ' Message</div>';
      html += '<div class="bgp-msg-row"><span>Type</span><strong>' + step.msgType + '</strong></div>';
      html += '<div class="bgp-msg-row"><span>NLRI</span><strong>' + prefix + '</strong></div>';
      html += '<div class="bgp-msg-row"><span>Attribute</span><strong>AS_PATH (well-known mandatory)</strong></div>';
      html += '</div>';
      return html;
    }

    function draw() {
      mount.innerHTML = svgDiagram() + pathStrip() + routeTable() + msgPanel();

      var liveRoutes = [];
      for (var i = 0; i <= Math.max(0, index) && i < phases.length; i++) {
        if (phases[i].addRoute) liveRoutes.push(phases[i].addRoute);
      }
      ctx.setMetrics([
        { label: 'Prefix', value: prefix },
        { label: 'Originator', value: 'AS400' },
        { label: 'Candidates at AS100', value: String(liveRoutes.length) },
        { label: 'Selected', value: index >= 5 ? 'Via AS300 (length 2)' : 'Not yet' },
        { label: 'Loop Prevention', value: 'AS-PATH contains own ASN \u2192 reject' }
      ]);
    }

    function rebuild() {
      stop(); index = -1;
      prefix = randomPrefix();
      phases = buildPhases();
      ctx.params.hidden = true;
      draw();
      ctx.log('Ready \u2014 AS400 originating ' + prefix + '.');
    }

    function stop() { if (timer) { NetSim.SimTiming.clearInterval(timer); timer = null; } }

    function advance() {
      if (index >= phases.length - 1) { stop(); return; }
      index++;
      ctx.log(phases[index].t, phases[index].lv);
      draw();
    }

    return {
      initialize: function () {
        ctx.canvas.innerHTML = '<div class="bgp-mount"></div>';
        mount = ctx.canvas.querySelector('.bgp-mount');
        rebuild();
      },
      start: function () { if (timer) return; timer = NetSim.SimTiming.setInterval(function () { if (index >= phases.length - 1) { stop(); return; } advance(); }, 800); },
      pause: function () { stop(); },
      step:  function () { stop(); advance(); },
      reset: function () { rebuild(); },
      destroy: function () { stop(); }
    };
  });

})(window.NetSim = window.NetSim || {});
