/* ==========================================================================
   NetSim — simulations/ospf.js
   OSPF's scalability trick over plain link-state: LSAs only flood within
   an area. The Area Border Router (ABR) computes its real distance into
   each area and advertises a single summarized cost to the other side —
   hiding that area's internal topology instead of flooding it everywhere.
   ========================================================================== */

(function (NetSim) {
  'use strict';

  // Area 1: A1, A2, ABR. Area 2: B1, B2, ABR.
  const AREA1_LINKS = [{ a: 'A1', b: 'A2', cost: 3 }, { a: 'A1', b: 'ABR', cost: 2 }, { a: 'A2', b: 'ABR', cost: 4 }];
  const AREA2_LINKS = [{ a: 'B1', b: 'B2', cost: 3 }, { a: 'ABR', b: 'B1', cost: 2 }, { a: 'ABR', b: 'B2', cost: 5 }];

  function neighborsOf(node, links) {
    const out = [];
    links.forEach((l) => { if (l.a === node) out.push({ node: l.b, cost: l.cost }); if (l.b === node) out.push({ node: l.a, cost: l.cost }); });
    return out;
  }
  function shortestFrom(source, nodes, links) {
    const dist = {}; nodes.forEach((n) => { dist[n] = n === source ? 0 : Infinity; });
    const visited = new Set();
    while (visited.size < nodes.length) {
      let u = null;
      nodes.forEach((n) => { if (!visited.has(n) && (u === null || dist[n] < dist[u])) u = n; });
      if (dist[u] === Infinity) break;
      visited.add(u);
      neighborsOf(u, links).forEach(({ node: v, cost: c }) => { if (!visited.has(v) && dist[u] + c < dist[v]) dist[v] = dist[u] + c; });
    }
    return dist;
  }

  NetSim.SimRegistry.register('ospf', function factory(ctx) {
    let phases = [];
    let index = -1;
    let timer = null;
    let host = null;

    function buildPhases() {
      const distFromAbrInArea1 = shortestFrom('ABR', ['A1', 'A2', 'ABR'], AREA1_LINKS);
      const distFromAbrInArea2 = shortestFrom('ABR', ['B1', 'B2', 'ABR'], AREA2_LINKS);
      const area1Cost = Math.max(distFromAbrInArea1.A1, distFromAbrInArea1.A2); // summarized as the worst-case reach
      const area2Cost = Math.max(distFromAbrInArea2.B1, distFromAbrInArea2.B2);

      return [
        { text: 'Area 1 routers (A1, A2, ABR) flood LSAs \u2014 but only within Area 1.', view: 'flood1' },
        { text: 'Every router in Area 1 now has Area 1\u2019s full topology: A1\u2013A2 cost 3, A1\u2013ABR cost 2, A2\u2013ABR cost 4.', view: 'topo1' },
        { text: 'Area 2 routers (B1, B2, ABR) flood LSAs \u2014 only within Area 2.', view: 'flood2' },
        { text: 'Every router in Area 2 now has Area 2\u2019s full topology: B1\u2013B2 cost 3, ABR\u2013B1 cost 2, ABR\u2013B2 cost 5.', view: 'topo2' },
        { text: 'The ABR computes its own real distance to every network inside Area 1 (A1: ' + distFromAbrInArea1.A1 + ', A2: ' + distFromAbrInArea1.A2 + ').', view: 'compute1' },
        { text: 'Instead of flooding Area 1\u2019s internal topology into the backbone, the ABR injects one Summary LSA: "Area 1 reachable at cost \u2248 ' + area1Cost + '."', view: 'summary1', level: 'success' },
        { text: 'The same happens in reverse: the ABR summarizes Area 2 as reachable at cost \u2248 ' + area2Cost + ' and advertises it into Area 1.', view: 'summary2', level: 'success' },
        { text: 'Area 2 routers now know how to reach Area 1 \u2014 but have no idea A1 and A2 even exist as separate routers. That hidden detail is exactly what keeps OSPF\u2019s flooding scoped and scalable.', view: 'done', level: 'success' }
      ];
    }

    function draw() {
      const phase = phases[Math.max(0, index)];
      const seenArea1 = index >= 1, seenArea2 = index >= 3, summarized1 = index >= 5, summarized2 = index >= 6;
      host.innerHTML = `
        <div style="display:flex;justify-content:center;gap:1.5rem;flex-wrap:wrap;">
          <div style="border:1px solid var(--line-strong);padding:0.75rem;min-width:140px;">
            <div class="section-label" style="margin:0 0 0.5rem;border:none;padding:0;font-size:0.78rem;">Area 1</div>
            <div class="packet-status-strip">
              <span class="packet-chip ${seenArea1 ? 'delivered' : 'pending'}">A1</span>
              <span class="packet-chip ${seenArea1 ? 'delivered' : 'pending'}">A2</span>
            </div>
          </div>
          <div style="border:1px solid var(--accent);padding:0.75rem;min-width:100px;align-self:center;">
            <div class="section-label" style="margin:0 0 0.5rem;border:none;padding:0;font-size:0.78rem;color:var(--accent);">Backbone</div>
            <span class="packet-chip delivered">ABR</span>
          </div>
          <div style="border:1px solid var(--line-strong);padding:0.75rem;min-width:140px;">
            <div class="section-label" style="margin:0 0 0.5rem;border:none;padding:0;font-size:0.78rem;">Area 2</div>
            <div class="packet-status-strip">
              <span class="packet-chip ${seenArea2 ? 'delivered' : 'pending'}">B1</span>
              <span class="packet-chip ${seenArea2 ? 'delivered' : 'pending'}">B2</span>
            </div>
          </div>
        </div>
        <p class="net-hint" style="margin-top:0.9rem;">${summarized1 ? 'Area 2 sees Area 1 only as: <strong>one summarized route via ABR</strong>.' : 'Summaries not yet exchanged.'}</p>
      `;
      ctx.setMetrics([
        { label: 'Area 1 Routers', value: 'A1, A2 (+ ABR)' },
        { label: 'Area 2 Routers', value: 'B1, B2 (+ ABR)' },
        { label: 'LSA Flooding Scope', value: 'Within each area only' },
        { label: 'Summary Toward Area 2', value: summarized1 ? 'Sent' : 'Not yet' },
        { label: 'Summary Toward Area 1', value: summarized2 ? 'Sent' : 'Not yet' }
      ]);
    }

    function rebuild() {
      stop();
      index = -1;
      phases = buildPhases();
      ctx.params.hidden = true;
      draw();
      ctx.log('Ready \u2014 two OSPF areas about to flood internally, then summarize across the backbone.');
    }

    function stop() { if (timer) { NetSim.SimTiming.clearInterval(timer); timer = null; } }

    function advance() {
      if (index >= phases.length - 1) { stop(); return; }
      index += 1;
      ctx.log(phases[index].text, phases[index].level);
      draw();
    }

    return {
      initialize() {
        ctx.canvas.classList.add('net-canvas');
        ctx.canvas.innerHTML = '<div class="ospf-mount"></div>';
        host = ctx.canvas.querySelector('.ospf-mount');
        rebuild();
      },
      start() { if (timer) return; timer = NetSim.SimTiming.setInterval(() => { if (index >= phases.length - 1) { stop(); return; } advance(); }, 800); },
      pause() { stop(); },
      step() { stop(); advance(); },
      reset() { rebuild(); },
      destroy() { stop(); }
    };
  });

})(window.NetSim = window.NetSim || {});
