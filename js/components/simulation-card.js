/* ==========================================================================
   NetSim — components/simulation-card.js
   ========================================================================== */

(function (NetSim) {
  'use strict';

  function simulationCardHTML(layer, sim) {
    const statusLabel = sim.status === 'available' ? 'available' : 'placeholder';
    return `
      <div class="sim-card">
        <span class="sim-card-status ${statusLabel}">${statusLabel}</span>
        <div class="sim-card-name">${sim.name}</div>
        <div class="sim-card-tag">${sim.tag}</div>
        <p class="sim-card-desc">${sim.desc}</p>
        <a class="btn secondary" href="#/sim/${layer.id}/${sim.id}">Open simulation</a>
      </div>
    `;
  }

  function simulationListItemHTML(layer, sim) {
    const statusLabel = sim.status === 'available' ? 'available' : 'placeholder';
    return `
      <li class="sim-list-item">
        <div class="sim-list-main">
          <span class="sim-list-name">${sim.name}</span>
          <span class="sim-card-tag">${sim.tag}</span>
        </div>
        <span class="sim-card-status ${statusLabel}">${statusLabel}</span>
        <a class="btn secondary" href="#/sim/${layer.id}/${sim.id}">Open</a>
      </li>
    `;
  }

  NetSim.Components = NetSim.Components || {};
  NetSim.Components.simulationCardHTML = simulationCardHTML;
  NetSim.Components.simulationListItemHTML = simulationListItemHTML;

})(window.NetSim = window.NetSim || {});
