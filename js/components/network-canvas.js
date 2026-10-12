/* ==========================================================================
   NetSim — components/network-canvas.js
   Renders the shared topology as SVG and keeps it in sync with engine
   state. The DOM here is purely a *representation* of simulationState —
   every attribute set in sync() is read straight off the state object
   (section 22/23 of the brief): nothing here decides simulation outcomes.
   ========================================================================== */

(function (NetSim) {
  'use strict';

  const VIEW_W = 720, VIEW_H = 300;

  function mount(container, opts) {
    opts = opts || {};
    const topo = NetSim.Core.Network.createTopology(); // layout reference only
    const nodeById = new Map(topo.nodes.map((n) => [n.id, n]));

    container.innerHTML = `
      <svg class="net-svg" viewBox="0 0 ${VIEW_W} ${VIEW_H}" role="img" aria-label="Network topology">
        <g class="net-links"></g>
        <g class="net-nodes"></g>
        <g class="net-entities"></g>
      </svg>
      <p class="net-hint">Click a link to simulate a failure. Click again to restore it.</p>
    `;

    const svg = container.querySelector('svg');
    const linksLayer = svg.querySelector('.net-links');
    const nodesLayer = svg.querySelector('.net-nodes');
    const entitiesLayer = svg.querySelector('.net-entities');

    topo.links.forEach((link) => {
      const from = nodeById.get(link.from), to = nodeById.get(link.to);
      const g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
      g.setAttribute('class', 'net-link-group');
      g.dataset.linkId = link.id;
      g.innerHTML = `
        <line class="net-link-hit" x1="${from.x}" y1="${from.y}" x2="${to.x}" y2="${to.y}"></line>
        <line class="net-link" x1="${from.x}" y1="${from.y}" x2="${to.x}" y2="${to.y}"></line>
        <text class="net-link-mark" x="${(from.x + to.x) / 2}" y="${(from.y + to.y) / 2 - 8}" text-anchor="middle"></text>
      `;
      g.addEventListener('click', () => { if (opts.onLinkClick) opts.onLinkClick(link.id); });
      linksLayer.appendChild(g);
    });

    topo.nodes.forEach((node) => {
      const g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
      g.setAttribute('class', 'net-node net-node--' + node.kind);
      g.dataset.nodeId = node.id;
      const w = node.kind === 'host' ? 64 : 46;
      const h = node.kind === 'host' ? 34 : 34;
      g.innerHTML = node.kind === 'host'
        ? `<rect x="${node.x - w / 2}" y="${node.y - h / 2}" width="${w}" height="${h}" rx="3"></rect>
           <text x="${node.x}" y="${node.y + 4}" text-anchor="middle">${node.label}</text>`
        : `<circle cx="${node.x}" cy="${node.y}" r="${w / 2}"></circle>
           <text x="${node.x}" y="${node.y + 4}" text-anchor="middle">${node.label}</text>`;
      nodesLayer.appendChild(g);
    });

    function sync(state, params) {
      const activeLinkIds = new Set(
        state.entities.filter((e) => e.linkId).map((e) => e.linkId)
      );

      linksLayer.querySelectorAll('.net-link-group').forEach((g) => {
        const link = state.links.find((l) => l.id === g.dataset.linkId);
        if (!link) return;
        const cls = ['net-link-group', 'is-' + link.status];
        if (activeLinkIds.has(link.id) && link.status !== 'failed') cls.push('is-carrying');
        g.setAttribute('class', cls.join(' '));
        const mark = g.querySelector('.net-link-mark');
        mark.textContent = link.status === 'failed' ? '✕' : (link.status === 'reserved' ? 'RESERVED' : '');
      });

      nodesLayer.querySelectorAll('.net-node').forEach((g) => {
        const hasEntity = state.entities.some((e) => e.atNode === g.dataset.nodeId);
        g.classList.toggle('is-current', hasEntity);
      });

      const seen = new Set();
      state.entities.forEach((entity, i) => {
        seen.add(entity.id);
        const node = nodeById.get(entity.atNode);
        if (!node) return;
        let marker = entitiesLayer.querySelector('[data-entity-id="' + entity.id + '"]');
        const stackOffset = (i % 3) * 10 - 10;
        const duration = Math.max(0.15, 0.6 / (params.animationSpeed || 1));

        if (!marker) {
          marker = document.createElementNS('http://www.w3.org/2000/svg', 'g');
          marker.setAttribute('class', 'net-entity net-entity--' + entity.kind);
          marker.dataset.entityId = entity.id;
          marker.style.transition = 'transform ' + duration + 's linear';
          marker.innerHTML = entity.kind === 'message'
            ? '<rect x="-16" y="-10" width="32" height="20" rx="2"></rect><text y="4">MSG</text>'
            : '<circle r="11"></circle><text y="4">' + entity.seq + '</text>';
          entitiesLayer.appendChild(marker);
        } else {
          marker.style.transition = 'transform ' + duration + 's linear';
        }
        marker.style.transform = `translate(${node.x}px, ${node.y + stackOffset}px)`;
      });

      entitiesLayer.querySelectorAll('.net-entity').forEach((marker) => {
        if (!seen.has(marker.dataset.entityId)) marker.remove();
      });
    }

    return { sync };
  }

  NetSim.Components = NetSim.Components || {};
  NetSim.Components.NetworkCanvas = { mount };

})(window.NetSim = window.NetSim || {});
