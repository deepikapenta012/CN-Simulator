/* ==========================================================================
   NetSim — simulations/link-state.js   (rebuilt)
   Link-state routing (Dijkstra) with:
   • SVG 5-router mesh topology with link costs
   • Step-by-step Dijkstra trace (select → relax) with visited highlighting
   • Shortest-path tree visualisation
   • Distance/previous-hop table with live updates
   • Source router selector (tab buttons)
   ========================================================================== */

(function (NetSim) {
  'use strict';

  var NODES = ['R1', 'R2', 'R3', 'R4', 'R5'];
  var LINK_PAIRS = [
    { a: 'R1', b: 'R2' }, { a: 'R1', b: 'R3' },
    { a: 'R2', b: 'R3' }, { a: 'R2', b: 'R4' },
    { a: 'R3', b: 'R4' }, { a: 'R3', b: 'R5' },
    { a: 'R4', b: 'R5' }
  ];

  /* node positions for SVG (pentagon-ish layout) */
  var POS = { R1: [170, 20], R2: [420, 20], R3: [100, 120], R4: [490, 120], R5: [295, 180] };

  function randomLinks() {
    var out = [];
    for (var i = 0; i < LINK_PAIRS.length; i++) {
      out.push({ a: LINK_PAIRS[i].a, b: LINK_PAIRS[i].b, cost: Math.floor(Math.random() * 9) + 1 });
    }
    return out;
  }

  function neighborsOf(node, links) {
    var out = [];
    for (var i = 0; i < links.length; i++) {
      if (links[i].a === node) out.push({ node: links[i].b, cost: links[i].cost });
      if (links[i].b === node) out.push({ node: links[i].a, cost: links[i].cost });
    }
    return out;
  }

  var INF = Infinity;
  function fd(v) { return v === INF ? '\u221e' : String(v); }

  function dijkstraTraced(source, links) {
    var dist = {}, prev = {}, visited = {};
    for (var i = 0; i < NODES.length; i++) {
      dist[NODES[i]] = NODES[i] === source ? 0 : INF;
      prev[NODES[i]] = null;
      visited[NODES[i]] = false;
    }
    var trace = [];
    var visitCount = 0;
    while (visitCount < NODES.length) {
      var u = null;
      for (var i = 0; i < NODES.length; i++) {
        if (!visited[NODES[i]] && (u === null || dist[NODES[i]] < dist[u])) u = NODES[i];
      }
      if (dist[u] === INF) break;
      visited[u] = true;
      visitCount++;
      trace.push({ type: 'select', node: u, dist: dist[u] });
      var nbs = neighborsOf(u, links);
      for (var ni = 0; ni < nbs.length; ni++) {
        var v = nbs[ni].node, c = nbs[ni].cost;
        if (visited[v]) continue;
        var cand = dist[u] + c;
        if (cand < dist[v]) {
          dist[v] = cand; prev[v] = u;
          trace.push({ type: 'relax', from: u, to: v, newDist: cand });
        }
      }
    }
    return { dist: dist, prev: prev, trace: trace };
  }

  NetSim.SimRegistry.register('link-state', function factory(ctx) {
    var source = 'R1';
    var phases = [];
    var index  = -1;
    var timer  = null;
    var mount  = null;
    var result = null;
    var curLinks = randomLinks();

    function buildPhases() {
      result = dijkstraTraced(source, curLinks);
      var p = [];
      /* flooding phase */
      for (var i = 0; i < NODES.length; i++) {
        var nbs = neighborsOf(NODES[i], curLinks);
        var desc = nbs.map(function (n) { return n.node + ':' + n.cost; }).join(', ');
        p.push({ t: NODES[i] + ' floods its LSA: {' + desc + '}', v: 'flood', node: NODES[i] });
      }
      p.push({ t: 'All routers now hold an identical, complete topology map.', v: 'complete', lv: 'success' });
      p.push({ t: 'Running Dijkstra from ' + source + ': distance to self = 0, everything else = \u221e.', v: 'init' });

      for (var i = 0; i < result.trace.length; i++) {
        var tr = result.trace[i];
        if (tr.type === 'select') {
          p.push({ t: 'Visit closest unvisited: ' + tr.node + ' (distance ' + tr.dist + ').', v: 'select', node: tr.node });
        } else {
          p.push({ t: 'Relax edge ' + tr.from + '\u2192' + tr.to + ': shorter path found, distance ' + tr.newDist + '.', v: 'relax', node: tr.to });
        }
      }
      p.push({ t: 'Shortest-path tree from ' + source + ' complete.', v: 'done', lv: 'success' });
      return p;
    }

    /* ── SVG topology ─────────────────────────────────────────────────── */
    function svgTopology() {
      var W = 600, H = 220, nodeR = 20;
      /* visited set so far */
      var visited = {};
      for (var i = 0; i <= index && i < phases.length; i++) {
        if (phases[i].v === 'select') visited[phases[i].node] = true;
      }
      var currentNode = null;
      if (index >= 0 && phases[index] && (phases[index].v === 'select' || phases[index].v === 'relax'))
        currentNode = phases[index].node;

      var html = '<svg class="ls-svg" viewBox="0 0 ' + W + ' ' + H + '" preserveAspectRatio="xMidYMid meet">';

      /* links */
      for (var i = 0; i < curLinks.length; i++) {
        var l = curLinks[i];
        var pa = POS[l.a], pb = POS[l.b];
        /* check if this is part of SPT */
        var isSPT = (result.prev[l.b] === l.a || result.prev[l.a] === l.b) && visited[l.a] && visited[l.b];
        html += '<line x1="' + pa[0] + '" y1="' + pa[1] + '" x2="' + pb[0] + '" y2="' + pb[1] + '" stroke="' + (isSPT ? '#0097a7' : '#ccc') + '" stroke-width="' + (isSPT ? 3 : 1.5) + '"/>';
        html += '<text x="' + ((pa[0] + pb[0]) / 2) + '" y="' + ((pa[1] + pb[1]) / 2 - 5) + '" text-anchor="middle" font-size="10" font-weight="700" fill="' + (isSPT ? '#0097a7' : '#888') + '">' + l.cost + '</text>';
      }

      /* nodes */
      for (var i = 0; i < NODES.length; i++) {
        var n = NODES[i];
        var p = POS[n];
        var isVisited = visited[n];
        var isCurrent = n === currentNode;
        var isSource = n === source;
        var fill = isCurrent ? '#fff3e0' : (isVisited ? '#e0f7fa' : '#fafafa');
        var stroke = isCurrent ? '#f9a825' : (isSource ? '#0097a7' : (isVisited ? '#0097a7' : '#bbb'));
        html += '<circle cx="' + p[0] + '" cy="' + p[1] + '" r="' + nodeR + '" fill="' + fill + '" stroke="' + stroke + '" stroke-width="' + (isCurrent ? 3 : 2) + '"/>';
        html += '<text x="' + p[0] + '" y="' + (p[1] + 5) + '" text-anchor="middle" font-size="11" font-weight="700" fill="var(--ink)">' + n + '</text>';
        /* distance label */
        if (isVisited) {
          html += '<text x="' + p[0] + '" y="' + (p[1] + nodeR + 14) + '" text-anchor="middle" font-size="9" font-weight="600" fill="#0097a7">d=' + result.dist[n] + '</text>';
        }
      }

      html += '</svg>';
      return html;
    }

    /* ── distance table ───────────────────────────────────────────────── */
    function distTable() {
      var visited = {};
      var distSoFar = {};
      for (var i = 0; i < NODES.length; i++) distSoFar[NODES[i]] = NODES[i] === source ? 0 : INF;
      for (var i = 0; i <= index && i < phases.length; i++) {
        if (phases[i].v === 'select') { visited[phases[i].node] = true; distSoFar[phases[i].node] = result.dist[phases[i].node]; }
        if (phases[i].v === 'relax') distSoFar[phases[i].node] = result.dist[phases[i].node];
      }

      var html = '<div class="ls-tbl-wrap"><table class="ls-tbl">';
      html += '<thead><tr><th>Node</th><th>Distance from ' + source + '</th><th>Previous</th><th>Status</th></tr></thead><tbody>';
      for (var i = 0; i < NODES.length; i++) {
        var n = NODES[i];
        var v = visited[n];
        html += '<tr class="' + (v ? 'ls-tbl-visited' : '') + '">';
        html += '<td class="ls-tbl-node">' + n + '</td>';
        html += '<td>' + fd(distSoFar[n]) + '</td>';
        html += '<td>' + (result.prev[n] && v ? result.prev[n] : '\u2014') + '</td>';
        html += '<td>' + (v ? '<span class="ls-tbl-ok">\u2713 Visited</span>' : '<span class="ls-tbl-pending">\u25cb Pending</span>') + '</td>';
        html += '</tr>';
      }
      html += '</tbody></table></div>';
      return html;
    }

    function draw() {
      mount.innerHTML = svgTopology() + distTable();

      var visitedCount = 0;
      for (var i = 0; i <= index && i < phases.length; i++) {
        if (phases[i].v === 'select') visitedCount++;
      }
      ctx.setMetrics([
        { label: 'Source', value: source },
        { label: 'Nodes Visited', value: visitedCount + ' / ' + NODES.length },
        { label: 'Algorithm', value: 'Dijkstra (SPF)' },
        { label: 'Knowledge', value: 'Full topology map' }
      ]);
    }

    function renderParams() {
      ctx.params.hidden = false;
      var html = '<div class="ls-tabs">';
      for (var i = 0; i < NODES.length; i++) {
        html += '<label class="switch-mode-option' + (NODES[i] === source ? ' is-checked' : '') + '">' +
          '<input type="radio" name="lsSrc" value="' + NODES[i] + '"' + (NODES[i] === source ? ' checked' : '') + '> ' + NODES[i] + '</label>';
      }
      html += '</div>';
      ctx.params.innerHTML = html;

      var radios = ctx.params.querySelectorAll('input[name="lsSrc"]');
      for (var i = 0; i < radios.length; i++) {
        radios[i].addEventListener('change', function (e) {
          source = e.target.value;
          rebuild();
        });
      }
    }

    function rebuild() {
      stop(); index = -1;
      curLinks = randomLinks();
      phases = buildPhases();
      renderParams(); draw();
      ctx.log('Ready — 5 routers with randomized costs, Dijkstra from ' + source + '.');
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
        ctx.canvas.innerHTML = '<div class="ls-mount"></div>';
        mount = ctx.canvas.querySelector('.ls-mount');
        rebuild();
      },
      start: function () { if (timer) return; timer = NetSim.SimTiming.setInterval(function () { if (index >= phases.length - 1) { stop(); return; } advance(); }, 600); },
      pause: function () { stop(); },
      step:  function () { stop(); advance(); },
      reset: function () { rebuild(); },
      destroy: function () { stop(); }
    };
  });

})(window.NetSim = window.NetSim || {});
