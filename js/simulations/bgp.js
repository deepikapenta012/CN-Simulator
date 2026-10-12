/* ==========================================================================
   NetSim — simulations/bgp.js
   Path-vector routing: AS400 originates a prefix, each AS prepends its
   own number to the AS-PATH as it re-advertises, and the receiving AS
   picks the route with the shortest AS-PATH — with a direct peering
   link giving AS100 a genuine choice between two real paths.
   ========================================================================== */

(function (NetSim) {
  'use strict';

  const PREFIX = '203.0.113.0/24';

  NetSim.SimRegistry.register('bgp', function factory(ctx) {
    let phases = [];
    let index = -1;
    let timer = null;
    let host = null;
    let routes = [];

    function buildPhases() {
      routes = [];
      const p = [];
      p.push({ text: 'AS400 originates ' + PREFIX + ' and advertises it to AS300 with AS-PATH = [AS400].', view: 'origin' });
      p.push({ text: 'AS300 receives it, prepends its own AS number: AS-PATH = [AS300, AS400]. Advertises to AS100 and AS200.', view: 'as300' });
      p.push({ text: 'AS100 receives the route directly from AS300 \u2014 a candidate route with AS-PATH length 2.', view: 'route1', addRoute: { via: 'AS300 (direct)', path: ['AS300', 'AS400'] } });
      p.push({ text: 'AS200 receives from AS300, prepends its own AS: AS-PATH = [AS200, AS300, AS400]. Advertises to AS100.', view: 'as200' });
      p.push({ text: 'AS100 now has a second candidate route, via AS200 \u2014 AS-PATH length 3.', view: 'route2', addRoute: { via: 'AS200', path: ['AS200', 'AS300', 'AS400'] } });
      p.push({ text: 'AS100 compares both candidates and selects the one with the shorter AS-PATH: via AS300 directly.', view: 'select', level: 'success' });
      p.push({ text: 'Loop prevention: if a route\u2019s AS-PATH ever already contained AS100, AS100 would reject it immediately \u2014 accepting it would create a routing loop.', view: 'loop' });
      return p;
    }

    function draw() {
      const phase = phases[Math.max(0, index)];
      phases.slice(0, index + 1).forEach((ph) => { if (ph.addRoute && !routes.includes(ph.addRoute)) routes.push(ph.addRoute); });
      const selected = index >= 5;

      host.innerHTML = `
        <div style="display:flex;align-items:center;justify-content:center;gap:0.3rem;margin-bottom:1rem;flex-wrap:wrap;">
          ${['AS100', 'AS200', 'AS300', 'AS400'].map((as, i, arr) => `
            <span class="packet-chip pending" style="min-width:3.2rem;">${as}</span>
            ${i < arr.length - 1 ? '<span style="color:var(--ink-faint);">\u2014</span>' : ''}
          `).join('')}
        </div>
        <p class="net-hint" style="text-align:center;margin-bottom:0.75rem;">AS100 and AS300 also peer directly (not shown above) \u2014 that\u2019s the shortcut route.</p>
        <div style="overflow-x:auto;">
          <table class="compare-table">
            <thead><tr><th>Via</th><th>AS-PATH</th><th>Length</th></tr></thead>
            <tbody>${routes.map((r) => `
              <tr class="${selected && r.via.includes('direct') ? 'highlight' : ''}">
                <td>${r.via}</td><td class="mono">${r.path.join(' \u2192 ')}</td><td>${r.path.length}</td>
              </tr>
            `).join('') || '<tr><td colspan="3" style="color:var(--ink-faint);">No routes received yet</td></tr>'}</tbody>
          </table>
        </div>
      `;

      ctx.setMetrics([
        { label: 'Prefix', value: PREFIX },
        { label: 'Originating AS', value: 'AS400' },
        { label: 'Candidate Routes at AS100', value: String(routes.length) },
        { label: 'Selected Route', value: selected ? 'Via AS300 (AS-PATH length 2)' : 'Not yet selected' }
      ]);
    }

    function rebuild() {
      stop();
      index = -1;
      phases = buildPhases();
      ctx.params.hidden = true;
      draw();
      ctx.log('Ready \u2014 AS400 is about to originate ' + PREFIX + '.');
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
        ctx.canvas.innerHTML = '<div class="bgp-mount"></div>';
        host = ctx.canvas.querySelector('.bgp-mount');
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
