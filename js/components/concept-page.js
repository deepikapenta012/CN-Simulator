/* ==========================================================================
   NetSim — components/concept-page.js
   The page template for cross-layer Concept Explorer simulations
   (topologies, network types, protocols & standards, OSI vs TCP/IP,
   network security). Structurally identical to simulation-page.js —
   canvas, controls, params, log, metrics — but keyed by concept id
   instead of layer+simulation id, since these concepts don't belong to
   one OSI layer.
   ========================================================================== */

(function (NetSim) {
  'use strict';

  function renderConceptPage(container, conceptId) {
    const concept = NetSim.OSIData.getConceptById(conceptId);
    const isNetworkTypes = conceptId === 'network-types';
    const isTopologies = conceptId === 'topologies';

    if (!concept || !NetSim.SimRegistry.has(conceptId)) {
      container.innerHTML = `
        <div class="placeholder-box">
          <strong>Simulation not found</strong>
          <a href="#/concepts">Return to the Concept Explorer</a>
        </div>
      `;
      return;
    }

    container.innerHTML = `
      <div class="sim-page-head">
        <div class="layer-eyebrow"><a href="#/concepts">\u2190 Concept Explorer</a></div>
        <h1>${concept.name}</h1>
        <p class="sim-tagline">${concept.desc}</p>
      </div>

      <div class="sim-layout">
        <div>
          <div class="sim-canvas" id="simCanvas"></div>
          ${NetSim.Components.controlsHTML()}
          <div class="sim-params" id="simParams" hidden></div>
        </div>
        <div class="sim-side">
          ${isNetworkTypes ? networkTypesTableHTML() : isTopologies ? topologiesTableHTML() : `${NetSim.Components.eventLogHTML()}${NetSim.Components.metricsHTML([])}`}
        </div>
      </div>
    `;

    const canvas = container.querySelector('#simCanvas');
    const paramsEl = container.querySelector('#simParams');
    const log = NetSim.Components.createLogger(container);

    const lifecycle = NetSim.SimRegistry.create(conceptId, {
      canvas,
      params: paramsEl,
      log,
      setMetrics: (items) => NetSim.Components.updateMetrics(container, items)
    });

    NetSim.Components.wireControls(container, lifecycle);
    lifecycle.initialize();

    container._simDestroy = lifecycle.destroy;
  }

  function networkTypesTableHTML() {
    const rows = [
      ['PAN', 'Personal devices', 'About 10 m', 'Phone, earbuds, and watch'],
      ['LAN', 'Room, home, or building', 'About 100 m to 1 km', 'Office computers and printers'],
      ['MAN', 'Across a city', 'About 5 to 50 km', 'Connected campuses or city offices'],
      ['WAN', 'Countries or worldwide', 'Regional to global', 'The internet']
    ];
    return `<section class="network-types-table-wrap" aria-labelledby="networkTypesTableTitle">
      <h2 id="networkTypesTableTitle">Network types compared</h2>
      <div class="network-types-table-scroll"><table class="network-types-table">
        <thead><tr><th scope="col">Type</th><th scope="col">Typical scope</th><th scope="col">Range</th><th scope="col">Example</th></tr></thead>
        <tbody>${rows.map((row) => `<tr>${row.map((cell, i) => `<${i === 0 ? 'th scope="row"' : 'td'}>${cell}</${i === 0 ? 'th' : 'td'}>`).join('')}</tr>`).join('')}</tbody>
      </table></div>
    </section>`;
  }

  function topologiesTableHTML() {
    const rows = [
      ['Bus', 'All devices share one backbone cable.', 'Low', 'A break in the shared cable can stop the whole segment.'],
      ['Star', 'Each device connects to a central switch or hub.', 'Medium', 'Central device failure disconnects all nodes.'],
      ['Ring', 'Each device connects to two neighbors in a loop.', 'Medium', 'A link break disrupts a plain ring.'],
      ['Mesh', 'Devices have multiple direct links to other devices.', 'Very high', 'Redundant links can provide alternate paths.'],
      ['Tree', 'Star-like branches connect in a hierarchy.', 'Medium', 'A branch device failure isolates its downstream nodes.']
    ];
    return `<section class="network-types-table-wrap" aria-labelledby="topologiesTableTitle">
      <h2 id="topologiesTableTitle">Topologies compared</h2>
      <div class="network-types-table-scroll"><table class="network-types-table topology-table">
        <thead><tr><th scope="col">Type</th><th scope="col">Layout</th><th scope="col">Cabling</th><th scope="col">Failure behavior</th></tr></thead>
        <tbody>${rows.map((row) => `<tr>${row.map((cell, i) => `<${i === 0 ? 'th scope="row"' : 'td'}>${cell}</${i === 0 ? 'th' : 'td'}>`).join('')}</tr>`).join('')}</tbody>
      </table></div>
    </section>`;
  }

  NetSim.Components = NetSim.Components || {};
  NetSim.Components.renderConceptPage = renderConceptPage;

})(window.NetSim = window.NetSim || {});
