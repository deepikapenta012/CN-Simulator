/* ==========================================================================
   NetSim — simulations/topologies.js
   Lets the user pick a topology (bus/star/ring/mesh/tree), watch a frame
   travel from N1 to N4 across it, and toggle each topology's classic
   single point of failure to see how differently each one degrades.
   ========================================================================== */

(function (NetSim) {
  'use strict';

  const CENTER = { x: 320, y: 130 };
  const RADIUS = 100;

  function circlePositions(n) {
    const out = {};
    for (let i = 0; i < n; i++) {
      const angle = (i * (360 / n) - 90) * (Math.PI / 180);
      out['N' + (i + 1)] = { x: CENTER.x + RADIUS * Math.cos(angle), y: CENTER.y + RADIUS * Math.sin(angle) };
    }
    return out;
  }

  const TOPOLOGIES = {
    bus: (() => {
      const nodes = {};
      const xs = [60, 164, 268, 372, 476, 580];
      xs.forEach((x, i) => { nodes['N' + (i + 1)] = { x, y: 70 }; });
      return {
        label: 'Bus', nodes,
        links: [], busRail: { x1: 40, x2: 600, y: 150 },
        stubs: Object.keys(nodes),
        failId: 'bus-rail',
        cabling: 'Low', spof: 'The single shared cable — one break can silence the whole segment.'
      };
    })(),
    star: (() => {
      const nodes = circlePositions(6);
      const links = Object.keys(nodes).map((id) => ({ id: 'HUB-' + id, a: 'HUB', b: id }));
      nodes.HUB = { x: CENTER.x, y: CENTER.y, isHub: true };
      return {
        label: 'Star', nodes, links,
        failId: 'HUB',
        cabling: 'Medium', spof: 'The central switch/hub — if it fails, every node loses connectivity.'
      };
    })(),
    ring: (() => {
      const nodes = circlePositions(6);
      const ids = Object.keys(nodes);
      const links = ids.map((id, i) => ({ id: id + '-' + ids[(i + 1) % ids.length], a: id, b: ids[(i + 1) % ids.length] }));
      return {
        label: 'Ring', nodes, links,
        failId: 'N2-N3',
        cabling: 'Medium', spof: 'Any single link — a plain ring has no alternate direction once broken.'
      };
    })(),
    mesh: (() => {
      const nodes = circlePositions(6);
      const ids = Object.keys(nodes);
      const links = [];
      for (let i = 0; i < ids.length; i++) {
        for (let j = i + 1; j < ids.length; j++) links.push({ id: ids[i] + '-' + ids[j], a: ids[i], b: ids[j] });
      }
      return {
        label: 'Mesh', nodes, links,
        failId: 'N1-N4',
        cabling: 'Very High', spof: 'None by design — every node has a direct, redundant path to every other.'
      };
    })(),
    tree: (() => {
      const nodes = {
        ROOT: { x: 320, y: 40, isHub: true },
        BRA: { x: 160, y: 130, isHub: true },
        BRB: { x: 480, y: 130, isHub: true },
        N1: { x: 70, y: 220 }, N2: { x: 160, y: 220 }, N3: { x: 250, y: 220 },
        N4: { x: 390, y: 220 }, N5: { x: 480, y: 220 }, N6: { x: 570, y: 220 }
      };
      const links = [
        { id: 'ROOT-BRA', a: 'ROOT', b: 'BRA' }, { id: 'ROOT-BRB', a: 'ROOT', b: 'BRB' },
        { id: 'BRA-N1', a: 'BRA', b: 'N1' }, { id: 'BRA-N2', a: 'BRA', b: 'N2' }, { id: 'BRA-N3', a: 'BRA', b: 'N3' },
        { id: 'BRB-N4', a: 'BRB', b: 'N4' }, { id: 'BRB-N5', a: 'BRB', b: 'N5' }, { id: 'BRB-N6', a: 'BRB', b: 'N6' }
      ];
      return {
        label: 'Tree', nodes, links,
        failId: 'BRA',
        cabling: 'Medium', spof: 'Any branch hub — its failure isolates every leaf beneath it.'
      };
    })()
  };

  function buildPlan(key, failed) {
    if (key === 'bus') {
      if (failed) {
        return [
          { nodes: ['N1'], links: ['bus-rail'], text: 'N1 broadcasts a frame onto the shared bus.', level: 'normal' },
          { links: ['bus-rail'], text: 'Cable break on the bus — the signal cannot propagate past the break. N4 never sees the frame.', level: 'error', outcome: 'failed' }
        ];
      }
      const order = ['N2', 'N3', 'N4', 'N5', 'N6'];
      const steps = [{ nodes: ['N1'], links: ['bus-rail'], text: 'N1 broadcasts a frame onto the shared bus — every node hears it.', level: 'normal' }];
      order.forEach((n) => {
        if (n === 'N4') steps.push({ nodes: [n], text: n + ' checks the address — it matches. Frame accepted \u2713', level: 'success', outcome: 'delivered' });
        else steps.push({ nodes: [n], text: n + ' checks the address — no match, frame discarded.', level: 'normal' });
      });
      return steps;
    }

    if (key === 'star') {
      const steps = [
        { nodes: ['N1'], links: ['HUB-N1'], text: 'N1 sends the frame to the central switch.', level: 'normal' },
        { nodes: ['HUB'], text: 'The switch receives the frame.', level: 'normal' }
      ];
      if (failed) {
        steps.push({ nodes: ['HUB'], text: 'The switch is down — no node can reach any other node.', level: 'error', outcome: 'failed' });
        return steps;
      }
      steps.push({ links: ['HUB-N4'], text: 'The switch forwards the frame to N4.', level: 'normal' });
      steps.push({ nodes: ['N4'], text: 'N4 receives the frame \u2713', level: 'success', outcome: 'delivered' });
      return steps;
    }

    if (key === 'ring') {
      if (failed) {
        return [
          { nodes: ['N1'], links: ['N1-N2'], text: 'N1 sends the frame to N2, the next node on the ring.', level: 'normal' },
          { nodes: ['N2'], links: ['N2-N3'], text: 'N2 checks the address — not for me, forwards toward N3.', level: 'normal' },
          { links: ['N2-N3'], text: 'The ring is broken between N2 and N3 — the frame cannot continue.', level: 'error', outcome: 'failed' }
        ];
      }
      return [
        { nodes: ['N1'], links: ['N1-N2'], text: 'N1 sends the frame to N2, the next node on the ring.', level: 'normal' },
        { nodes: ['N2'], links: ['N2-N3'], text: 'N2 checks the address — not for me, forwards toward N3.', level: 'normal' },
        { nodes: ['N3'], links: ['N3-N4'], text: 'N3 checks the address — not for me, forwards toward N4.', level: 'normal' },
        { nodes: ['N4'], text: 'N4 checks the address — it matches. Frame accepted \u2713', level: 'success', outcome: 'delivered' }
      ];
    }

    if (key === 'mesh') {
      if (failed) {
        return [
          { nodes: ['N1'], links: ['N1-N4'], text: 'N1 tries the direct link to N4...', level: 'normal' },
          { links: ['N1-N4'], text: 'Direct link N1–N4 has failed.', level: 'warning' },
          { nodes: ['N1', 'N2'], links: ['N1-N2', 'N2-N4'], text: 'Rerouting via N1 \u2192 N2 \u2192 N4 — mesh has a redundant path available.', level: 'normal' },
          { nodes: ['N4'], text: 'N4 receives the frame \u2713 (via the alternate path)', level: 'success', outcome: 'delivered' }
        ];
      }
      return [
        { nodes: ['N1'], links: ['N1-N4'], text: 'N1 sends the frame directly to N4 over their dedicated link.', level: 'normal' },
        { nodes: ['N4'], text: 'N4 receives the frame \u2713', level: 'success', outcome: 'delivered' }
      ];
    }

    // tree
    if (failed) {
      return [
        { nodes: ['N1', 'BRA'], text: 'N1 tries to send the frame up to Branch Hub A...', level: 'normal' },
        { nodes: ['BRA'], text: 'Branch Hub A is down — N1, N2 and N3 are isolated from the rest of the tree.', level: 'error', outcome: 'failed' }
      ];
    }
    return [
      { nodes: ['N1', 'BRA'], links: ['BRA-N1'], text: 'N1 sends the frame up to Branch Hub A.', level: 'normal' },
      { nodes: ['BRA', 'ROOT'], links: ['ROOT-BRA'], text: 'Branch Hub A forwards it up to the Root Hub.', level: 'normal' },
      { nodes: ['ROOT', 'BRB'], links: ['ROOT-BRB'], text: 'The Root Hub forwards it down to Branch Hub B.', level: 'normal' },
      { nodes: ['BRB', 'N4'], links: ['BRB-N4'], text: 'Branch Hub B forwards it to N4.', level: 'normal' },
      { nodes: ['N4'], text: 'N4 receives the frame \u2713', level: 'success', outcome: 'delivered' }
    ];
  }

  function cssEscape(id) {
    return id.replace(/[^a-zA-Z0-9_-]/g, '\\$&');
  }

  NetSim.SimRegistry.register('topologies', function factory(ctx) {
    let topoKey = 'star';
    let failed = false;
    let steps = [];
    let index = 0;
    let timer = null;
    let svgHost = null;

    function drawTopology() {
      const topo = TOPOLOGIES[topoKey];
      const parts = ['<svg class="net-svg" viewBox="0 0 640 260" role="img" aria-label="' + topo.label + ' topology"><g class="topo-links">'];

      if (topo.busRail) {
        parts.push(`<line class="topo-link" id="bus-rail" x1="${topo.busRail.x1}" y1="${topo.busRail.y}" x2="${topo.busRail.x2}" y2="${topo.busRail.y}"></line>`);
        topo.stubs.forEach((id) => {
          const n = topo.nodes[id];
          parts.push(`<line class="topo-stub" x1="${n.x}" y1="${n.y + 14}" x2="${n.x}" y2="${topo.busRail.y}"></line>`);
        });
      }
      (topo.links || []).forEach((l) => {
        const a = topo.nodes[l.a], b = topo.nodes[l.b];
        parts.push(`<line class="topo-link" id="${l.id}" x1="${a.x}" y1="${a.y}" x2="${b.x}" y2="${b.y}"></line>`);
      });
      parts.push('</g><g class="topo-nodes">');
      Object.keys(topo.nodes).forEach((id) => {
        const n = topo.nodes[id];
        const r = n.isHub ? 16 : 15;
        parts.push(`<g class="topo-node ${n.isHub ? 'is-hub' : ''}" id="node-${id}">
          <circle cx="${n.x}" cy="${n.y}" r="${r}"></circle>
          <text x="${n.x}" y="${n.y + 4}" text-anchor="middle">${id}</text>
        </g>`);
      });
      parts.push('</g></svg><p class="net-hint">Choose a topology and a failure scenario in the parameters below.</p>');
      svgHost.innerHTML = parts.join('');
    }

    function paint() {
      const container = svgHost;
      container.querySelectorAll('.topo-node, .topo-link, .topo-stub').forEach((el) => el.classList.remove('is-active'));
      if (index >= 0 && steps[index]) {
        (steps[index].nodes || []).forEach((id) => {
          const el = container.querySelector('#node-' + id);
          if (el) el.classList.add('is-active');
        });
        (steps[index].links || []).forEach((id) => {
          const el = container.querySelector('#' + cssEscape(id));
          if (el) el.classList.add('is-active');
        });
      }
      const failTargetId = TOPOLOGIES[topoKey].failId;
      const failEl = container.querySelector('#' + cssEscape(failTargetId)) || container.querySelector('#node-' + cssEscape(failTargetId));
      if (failEl) failEl.classList.toggle('is-failed', failed);

      const outcome = steps.slice(0, index + 1).map((s) => s.outcome).filter(Boolean).pop();
      ctx.setMetrics([
        { label: 'Topology', value: TOPOLOGIES[topoKey].label },
        { label: 'Hops', value: String(Math.max(0, steps.filter((s) => s.nodes).length - 1)) },
        { label: 'Relative Cabling', value: TOPOLOGIES[topoKey].cabling },
        { label: 'Single Point of Failure', value: TOPOLOGIES[topoKey].spof },
        { label: 'Outcome', value: outcome === 'delivered' ? 'Delivered \u2713' : outcome === 'failed' ? 'Failed \u2717' : 'In progress' }
      ]);
    }

    function renderParams() {
      ctx.params.hidden = false;
      const options = ['bus', 'star', 'ring', 'mesh', 'tree'];
      ctx.params.innerHTML = `
        <fieldset class="switch-mode-group" role="radiogroup" aria-label="Topology">
          <legend class="section-label" style="margin:0 0 0.5rem;border:none;padding:0;">Topology</legend>
          ${options.map((k) => `
            <label class="switch-mode-option ${k === topoKey ? 'is-checked' : ''}">
              <input type="radio" name="topoChoice" value="${k}" ${k === topoKey ? 'checked' : ''}>
              ${TOPOLOGIES[k].label}
            </label>
          `).join('')}
        </fieldset>
        <label class="switch-mode-option ${failed ? 'is-checked' : ''}" style="margin-top:0.5rem;">
          <input type="checkbox" id="topoFail" ${failed ? 'checked' : ''}>
          Simulate this topology's classic failure
        </label>
      `;
      ctx.params.querySelectorAll('input[name="topoChoice"]').forEach((r) => {
        r.addEventListener('change', () => { topoKey = r.value; rebuild(); });
      });
      ctx.params.querySelector('#topoFail').addEventListener('change', (e) => { failed = e.target.checked; rebuild(); });
    }

    function rebuild() {
      stop();
      index = 0;
      steps = buildPlan(topoKey, failed);
      drawTopology();
      renderParams();
      paint();
      ctx.log('Topology set to ' + TOPOLOGIES[topoKey].label + (failed ? ' (failure scenario active)' : '') + '.');
    }

    function stop() { if (timer) { clearInterval(timer); timer = null; } }

    function advance() {
      if (index >= steps.length - 1) { stop(); return; }
      index += 1;
      ctx.log(steps[index].text, steps[index].level === 'normal' ? undefined : steps[index].level);
      paint();
    }

    return {
      initialize() {
        ctx.canvas.classList.add('net-canvas');
        ctx.canvas.innerHTML = '<div class="net-mount"></div>';
        svgHost = ctx.canvas.querySelector('.net-mount');
        rebuild();
        ctx.log('Ready — N1 will try to reach N4.');
      },
      start() {
        if (timer) return;
        timer = setInterval(() => { if (index >= steps.length - 1) { stop(); return; } advance(); }, 900);
      },
      pause() { stop(); },
      step() { stop(); advance(); },
      reset() { rebuild(); },
      destroy() { stop(); }
    };
  });

})(window.NetSim = window.NetSim || {});
