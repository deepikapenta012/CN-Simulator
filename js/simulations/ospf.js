/* ==========================================================================
   NetSim — simulations/ospf.js   (rebuilt)
   OSPF area-based link-state routing with:
   • SVG dual-area topology: Area 1 (A1, A2) ↔ ABR ↔ Area 2 (B1, B2)
   • Intra-area LSA flooding animation
   • ABR summary LSA generation with computed costs
   • Area isolation demonstration (what each area knows)
   • Randomised link costs per reset
   ========================================================================== */

(function (NetSim) {
  'use strict';

  function rc() { return Math.floor(Math.random() * 7) + 1; }

  function randomAreaLinks() {
    return {
      area1: [{ a: 'A1', b: 'A2', cost: rc() }, { a: 'A1', b: 'ABR', cost: rc() }, { a: 'A2', b: 'ABR', cost: rc() }],
      area2: [{ a: 'B1', b: 'B2', cost: rc() }, { a: 'ABR', b: 'B1', cost: rc() }, { a: 'ABR', b: 'B2', cost: rc() }]
    };
  }

  function neighborsOf(node, links) {
    var out = [];
    for (var i = 0; i < links.length; i++) {
      if (links[i].a === node) out.push({ node: links[i].b, cost: links[i].cost });
      if (links[i].b === node) out.push({ node: links[i].a, cost: links[i].cost });
    }
    return out;
  }

  function shortestFrom(source, nodes, links) {
    var dist = {};
    for (var i = 0; i < nodes.length; i++) dist[nodes[i]] = nodes[i] === source ? 0 : Infinity;
    var visited = {};
    var count = 0;
    while (count < nodes.length) {
      var u = null;
      for (var i = 0; i < nodes.length; i++) {
        if (!visited[nodes[i]] && (u === null || dist[nodes[i]] < dist[u])) u = nodes[i];
      }
      if (dist[u] === Infinity) break;
      visited[u] = true; count++;
      var nbs = neighborsOf(u, links);
      for (var ni = 0; ni < nbs.length; ni++) {
        if (!visited[nbs[ni].node] && dist[u] + nbs[ni].cost < dist[nbs[ni].node])
          dist[nbs[ni].node] = dist[u] + nbs[ni].cost;
      }
    }
    return dist;
  }

  /* SVG positions */
  var POS = {
    A1:  [80,  50], A2:  [80, 150],
    ABR: [320, 100],
    B1:  [560, 50], B2:  [560, 150]
  };

  NetSim.SimRegistry.register('ospf', function factory(ctx) {
    var phases = [];
    var index  = -1;
    var timer  = null;
    var mount  = null;
    var area   = randomAreaLinks();
    var dists  = {};

    function buildPhases() {
      var d1 = shortestFrom('ABR', ['A1', 'A2', 'ABR'], area.area1);
      var d2 = shortestFrom('ABR', ['B1', 'B2', 'ABR'], area.area2);
      dists = { d1: d1, d2: d2 };
      var a1Str = area.area1.map(function (l) { return l.a + '\u2013' + l.b + ':' + l.cost; }).join(', ');
      var a2Str = area.area2.map(function (l) { return l.a + '\u2013' + l.b + ':' + l.cost; }).join(', ');

      return [
        { t: 'Area 1 routers (A1, A2, ABR) flood LSAs within Area 1 only.  Links: ' + a1Str + '.', v: 'flood1', area: 1 },
        { t: 'Every router in Area 1 now has Area 1\u2019s complete topology.', v: 'topo1', area: 1, lv: 'success' },
        { t: 'Area 2 routers (B1, B2, ABR) flood LSAs within Area 2 only.  Links: ' + a2Str + '.', v: 'flood2', area: 2 },
        { t: 'Every router in Area 2 now has Area 2\u2019s complete topology.', v: 'topo2', area: 2, lv: 'success' },
        { t: 'ABR computes distances in Area 1: A1=' + d1.A1 + ', A2=' + d1.A2 + '.', v: 'compute1' },
        { t: 'ABR injects Summary LSA into backbone: "Area 1 reachable, cost \u2248 ' + Math.max(d1.A1, d1.A2) + '."', v: 'summary1', lv: 'success' },
        { t: 'ABR summarises Area 2 (B1=' + d2.B1 + ', B2=' + d2.B2 + ') and advertises into Area 1: cost \u2248 ' + Math.max(d2.B1, d2.B2) + '.', v: 'summary2', lv: 'success' },
        { t: 'Area 2 routers can reach Area 1 via ABR \u2014 but have no idea about A1 or A2 as individual routers.  This topology hiding keeps OSPF scalable.', v: 'done', lv: 'success' }
      ];
    }

    /* ── SVG ───────────────────────────────────────────────────────────── */
    function svgDiagram() {
      var W = 660, H = 210, R = 22;
      var step = phases[Math.max(0, index)] || {};
      var showArea1 = index >= 0;
      var showArea2 = index >= 2;
      var showSummary1 = index >= 5;
      var showSummary2 = index >= 6;

      var html = '<svg class="ospf-svg" viewBox="0 0 ' + W + ' ' + H + '" preserveAspectRatio="xMidYMid meet">';

      /* Area boxes */
      html += '<rect x="20" y="15" width="180" height="180" rx="10" fill="none" stroke="#42a5f5" stroke-width="2" stroke-dasharray="6,3"/>';
      html += '<text x="110" y="12" text-anchor="middle" font-size="10" font-weight="700" fill="#1565c0">Area 1</text>';
      html += '<rect x="460" y="15" width="180" height="180" rx="10" fill="none" stroke="#ffa726" stroke-width="2" stroke-dasharray="6,3"/>';
      html += '<text x="550" y="12" text-anchor="middle" font-size="10" font-weight="700" fill="#e65100">Area 2</text>';

      /* Backbone zone */
      html += '<rect x="230" y="60" width="180" height="85" rx="8" fill="#e8f5e933" stroke="#66bb6a" stroke-width="1.5" stroke-dasharray="4,3"/>';
      html += '<text x="320" y="57" text-anchor="middle" font-size="9" font-weight="600" fill="#2e7d32">Backbone (Area 0)</text>';

      /* Links within areas */
      var allLinks = area.area1.concat(area.area2);
      for (var i = 0; i < allLinks.length; i++) {
        var l = allLinks[i];
        var pa = POS[l.a], pb = POS[l.b];
        var isA1 = i < area.area1.length;
        var show = isA1 ? showArea1 : showArea2;
        var col = show ? (isA1 ? '#42a5f5' : '#ffa726') : '#ddd';
        html += '<line x1="' + pa[0] + '" y1="' + pa[1] + '" x2="' + pb[0] + '" y2="' + pb[1] + '" stroke="' + col + '" stroke-width="2"/>';
        html += '<text x="' + ((pa[0] + pb[0]) / 2 + 8) + '" y="' + ((pa[1] + pb[1]) / 2 - 4) + '" font-size="10" font-weight="700" fill="' + col + '">' + l.cost + '</text>';
      }

      /* Summary arrows */
      if (showSummary1) {
        html += '<line x1="250" y1="95" x2="200" y2="95" stroke="#66bb6a" stroke-width="2.5" marker-end="url(#ospfArr)"/>';
        html += '<text x="225" y="88" text-anchor="middle" font-size="8" fill="#2e7d32" font-weight="600">Summary LSA</text>';
      }
      if (showSummary2) {
        html += '<line x1="390" y1="105" x2="440" y2="105" stroke="#66bb6a" stroke-width="2.5" marker-end="url(#ospfArr)"/>';
        html += '<text x="415" y="98" text-anchor="middle" font-size="8" fill="#2e7d32" font-weight="600">Summary LSA</text>';
      }

      /* Nodes */
      var nodes = ['A1', 'A2', 'ABR', 'B1', 'B2'];
      var nodeColors = { A1: '#42a5f5', A2: '#42a5f5', ABR: '#66bb6a', B1: '#ffa726', B2: '#ffa726' };
      for (var i = 0; i < nodes.length; i++) {
        var n = nodes[i];
        var p = POS[n];
        var col = nodeColors[n];
        var isABR = n === 'ABR';
        html += '<circle cx="' + p[0] + '" cy="' + p[1] + '" r="' + (isABR ? R + 4 : R) + '" fill="' + col + '22" stroke="' + col + '" stroke-width="' + (isABR ? 3 : 2) + '"/>';
        html += '<text x="' + p[0] + '" y="' + (p[1] + 5) + '" text-anchor="middle" font-size="' + (isABR ? '12' : '11') + '" font-weight="700" fill="' + col + '">' + n + '</text>';
      }

      html += '<defs><marker id="ospfArr" markerWidth="8" markerHeight="6" refX="8" refY="3" orient="auto"><path d="M0,0 L8,3 L0,6 Z" fill="#66bb6a"/></marker></defs>';
      html += '</svg>';
      return html;
    }

    /* ── area knowledge panel ─────────────────────────────────────────── */
    function knowledgePanel() {
      if (index < 5) return '';
      var html = '<div class="ospf-know">';
      html += '<div class="ospf-know-box ospf-know-a1">';
      html += '<div class="ospf-know-title">Area 1 Knows</div>';
      html += '<div>A1, A2, ABR (full internal topology)</div>';
      html += '<div>Area 2: reachable via ABR, cost \u2248 ' + Math.max(dists.d2.B1, dists.d2.B2) + '</div>';
      html += '<div class="ospf-know-hidden">B1, B2 details: <strong>hidden</strong></div>';
      html += '</div>';
      html += '<div class="ospf-know-box ospf-know-a2">';
      html += '<div class="ospf-know-title">Area 2 Knows</div>';
      html += '<div>B1, B2, ABR (full internal topology)</div>';
      html += '<div>Area 1: reachable via ABR, cost \u2248 ' + Math.max(dists.d1.A1, dists.d1.A2) + '</div>';
      html += '<div class="ospf-know-hidden">A1, A2 details: <strong>hidden</strong></div>';
      html += '</div>';
      html += '</div>';
      return html;
    }

    function draw() {
      mount.innerHTML = svgDiagram() + knowledgePanel();

      ctx.setMetrics([
        { label: 'Area 1 Routers', value: 'A1, A2 (+ ABR)' },
        { label: 'Area 2 Routers', value: 'B1, B2 (+ ABR)' },
        { label: 'LSA Scope', value: 'Within each area' },
        { label: 'Summary → Area 2', value: index >= 5 ? 'Sent' : 'Not yet' },
        { label: 'Summary → Area 1', value: index >= 6 ? 'Sent' : 'Not yet' }
      ]);
    }

    function rebuild() {
      stop(); index = -1;
      area = randomAreaLinks();
      phases = buildPhases();
      ctx.params.hidden = true;
      draw();
      ctx.log('Ready \u2014 two OSPF areas with randomised costs, flooding and summarising.');
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
        ctx.canvas.innerHTML = '<div class="ospf-mount"></div>';
        mount = ctx.canvas.querySelector('.ospf-mount');
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
