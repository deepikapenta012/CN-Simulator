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
          ${NetSim.Components.eventLogHTML()}
          ${NetSim.Components.metricsHTML([])}
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

  NetSim.Components = NetSim.Components || {};
  NetSim.Components.renderConceptPage = renderConceptPage;

})(window.NetSim = window.NetSim || {});
