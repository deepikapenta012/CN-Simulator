/* ==========================================================================
   NetSim — components/concept-explorer.js
   Cross-layer concepts that don't belong cleanly to one OSI layer
   (section 5 of the brief) — switching, topologies, OSI vs TCP/IP, etc.
   ========================================================================== */

(function (NetSim) {
  'use strict';

  function renderConceptExplorer(container) {
    const concepts = NetSim.OSIData.getConcepts();

    container.innerHTML = `
      <div class="layer-head">
        <div class="layer-eyebrow">Concept Explorer</div>
        <h1>Cross-layer concepts</h1>
        <p class="lede">Some topics — switching methods, topologies, how OSI maps
        to TCP/IP — cut across multiple layers. Rather than force them into one
        layer, they live here.</p>
      </div>

      <div class="concept-grid">
        ${concepts.map(conceptCardHTML).join('')}
      </div>
    `;
  }

  const CONCEPT_LINKS = {
    'circuit-switching': { href: '#/sim/network/switching-concepts', label: 'Open switching simulation' },
    'message-switching': { href: '#/sim/network/switching-concepts', label: 'Open switching simulation' },
    'packet-switching': { href: '#/sim/network/switching-concepts', label: 'Open switching simulation' },
    'topologies': { href: '#/concept/topologies', label: 'Open simulation' },
    'network-types': { href: '#/concept/network-types', label: 'Open simulation' },
    'osi-vs-tcpip': { href: '#/concept/osi-vs-tcpip', label: 'Open simulation' }
  };

  function conceptCardHTML(concept) {
    const linkInfo = CONCEPT_LINKS[concept.id];
    const link = linkInfo
      ? `<a class="btn secondary" href="${linkInfo.href}" style="margin-top:0.5rem;font-size:0.78rem;padding:0.35rem 0.7rem;">${linkInfo.label}</a>`
      : '';
    return `
      <div class="concept-card">
        <h3>${concept.name}</h3>
        <p>${concept.desc}</p>
        <div class="layers-touched">Touches: ${concept.layers.join(', ')}</div>
        ${link}
      </div>
    `;
  }

  NetSim.Components = NetSim.Components || {};
  NetSim.Components.renderConceptExplorer = renderConceptExplorer;

})(window.NetSim = window.NetSim || {});
