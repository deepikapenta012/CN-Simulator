/* ==========================================================================
   NetSim — simulations/link-state.js
   Real link-state routing: every router floods its direct link costs so
   all routers end up with an identical full topology map, then each
   runs Dijkstra's algorithm locally (traced step by step here) to build
   its own shortest-path tree — contrast with distance vector, where no
   router ever sees the whole picture.
   ========================================================================== */

(function (NetSim) {
  'use strict';

  const NODES = ['R1', 'R2', 'R3', 'R4', 'R5'];
  const LINKS = [
    { a: 'R1', b: 'R2', cost: 2 },
    { a: 'R1', b: 'R3', cost: 5 },
    { a: 'R2', b: 'R3', cost: 1 },
    { a: 'R2', b: 'R4', cost: 4 },
    { a: 'R3', b: 'R4', cost: 1 },
    { a: 'R3', b: 'R5', cost: 7 },
    { a: 'R4', b: 'R5', cost: 3 }
  ];

  function neighborsOf(node) {
    const out = [];
    LINKS.forEach((l) => {
      if (l.a === node) out.push({ node: l.b, cost: l.cost });
      if (l.b === node) out.push({ node: l.a, cost: l.cost });
    });
    return out;
  }

  /** Real Dijkstra, with a trace of every selection and relaxation. */
  function dijkstraTraced(source) {
    const dist = {}, prev = {}, visited = new Set();
    NODES.forEach((n) => { dist[n] = n === source ? 0 : Infinity; prev[n] = null; });
    const trace = [];
    while (visited.size < NODES.length) {
      let u = null;
      NODES.forEach((n) => { if (!visited.has(n) && (u === null || dist[n] < dist[u])) u = n; });
      if (dist[u] === Infinity) break;
      visited.add(u);
      trace.push({ type: 'select', node: u, dist: dist[u] });
      neighborsOf(u).forEach(({ node: v, cost: c }) => {
        if (visited.has(v)) return;
        const candidate = dist[u] + c;
        if (candidate < dist[v]) {
          dist[v] = candidate; prev[v] = u;
          trace.push({ type: 'relax', from: u, to: v, newDist: candidate });
        }
      });
    }
    return { dist, prev, trace };
  }

  NetSim.SimRegistry.register('link-state', function factory(ctx) {
    let source = 'R1';
    let phases = [];
    let index = -1;
    let timer = null;
    let host = null;
    let result = null;

    function buildPhases() {
      result = dijkstraTraced(source);
      const p = [];
      NODES.forEach((n) => {
        const links = neighborsOf(n).map((nb) => nb.node + ':' + nb.cost).join(', ');
        p.push({ text: n + ' floods its link state: {' + links + '}', view: 'flood' });
      });
      p.push({ text: 'All routers now hold an identical, complete map of the topology.', view: 'complete', level: 'success' });
      p.push({ text: 'Running Dijkstra from ' + source + ': distance to itself = 0, everything else = \u221e.', view: 'init' });
      result.trace.forEach((t) => {
        if (t.type === 'select') {
          p.push({ text: 'Visit the closest unvisited node: ' + t.node + ' (distance ' + t.dist + ').', view: 'select', node: t.node });
        } else {
          p.push({ text: 'Relax edge ' + t.from + '\u2192' + t.to + ': shorter path found, distance ' + t.newDist + '.', view: 'relax', to: t.to });
        }
      });
      p.push({ text: 'Shortest-path tree from ' + source + ' complete.', view: 'done', level: 'success' });
      return p;
    }

    function draw() {
      const visitedSoFar = new Set();
      const distSoFar = {};
      NODES.forEach((n) => { distSoFar[n] = n === source ? 0 : Infinity; });
      phases.slice(0, index + 1).forEach((ph) => {
        if (ph.view === 'select') { visitedSoFar.add(ph.node); distSoFar[ph.node] = result.dist[ph.node]; }
        if (ph.view === 'relax') distSoFar[ph.to] = result.dist[ph.to];
      });

      const rows = NODES.map((n) => `
        <tr class="${visitedSoFar.has(n) ? 'highlight' : ''}">
          <td>${n}</td>
          <td class="mono">${distSoFar[n] === Infinity ? '\u221e' : distSoFar[n]}</td>
          <td class="mono">${result.prev[n] && visitedSoFar.has(n) ? result.prev[n] : '\u2014'}</td>
        </tr>
      `).join('');

      host.innerHTML = `
        <div style="overflow-x:auto;">
          <table class="compare-table">
            <thead><tr><th>Node</th><th>Distance from ${source}</th><th>Via</th></tr></thead>
            <tbody>${rows}</tbody>
          </table>
        </div>
      `;

      ctx.setMetrics([
        { label: 'Source Router', value: source },
        { label: 'Nodes Visited', value: visitedSoFar.size + ' / ' + NODES.length },
        { label: 'Algorithm', value: 'Dijkstra (shortest path first)' },
        { label: 'Each Router Knows', value: 'The full topology map' }
      ]);
    }

    function renderParams() {
      ctx.params.hidden = false;
      ctx.params.innerHTML = `
        <div class="switch-tabs" role="tablist" aria-label="Source router">
          ${NODES.map((n) => `<button type="button" class="switch-tab ${n === source ? 'is-active' : ''}" data-node="${n}" role="tab">${n}</button>`).join('')}
        </div>
      `;
      ctx.params.querySelectorAll('.switch-tab').forEach((tab) => {
        tab.addEventListener('click', () => {
          if (tab.dataset.node === source) return;
          source = tab.dataset.node;
          rebuild();
        });
      });
    }

    function rebuild() {
      stop();
      index = -1;
      phases = buildPhases();
      renderParams();
      draw();
      ctx.log('Ready \u2014 5 routers about to flood their link state, then compute shortest paths from ' + source + '.');
    }

    function stop() { if (timer) { clearInterval(timer); timer = null; } }

    function advance() {
      if (index >= phases.length - 1) { stop(); return; }
      index += 1;
      ctx.log(phases[index].text, phases[index].level);
      draw();
    }

    return {
      initialize() {
        ctx.canvas.classList.add('net-canvas');
        ctx.canvas.innerHTML = '<div class="ls-mount"></div>';
        host = ctx.canvas.querySelector('.ls-mount');
        rebuild();
      },
      start() { if (timer) return; timer = setInterval(() => { if (index >= phases.length - 1) { stop(); return; } advance(); }, 500); },
      pause() { stop(); },
      step() { stop(); advance(); },
      reset() { rebuild(); },
      destroy() { stop(); }
    };
  });

})(window.NetSim = window.NetSim || {});
