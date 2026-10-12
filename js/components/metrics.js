/* ==========================================================================
   NetSim — components/metrics.js
   A small key/value metrics strip each simulation can update.
   ========================================================================== */

(function (NetSim) {
  'use strict';

  function metricsHTML(initialMetrics) {
    const items = initialMetrics || [];
    return `
      <div class="sim-metrics">
        <div class="sim-metrics-head">Metrics</div>
        <div class="sim-metrics-body" id="simMetricsBody">
          ${items.map(metricItemHTML).join('') || '<div class="sim-log-empty">No metrics yet.</div>'}
        </div>
      </div>
    `;
  }

  function metricItemHTML(item) {
    return `
      <div class="metric">
        <span class="metric-val">${item.value}</span>
        <span class="metric-label">${item.label}</span>
      </div>
    `;
  }

  function updateMetrics(scopeEl, items) {
    const body = scopeEl.querySelector('#simMetricsBody');
    if (!body) return;
    body.innerHTML = items.map(metricItemHTML).join('');
  }

  NetSim.Components = NetSim.Components || {};
  NetSim.Components.metricsHTML = metricsHTML;
  NetSim.Components.updateMetrics = updateMetrics;

})(window.NetSim = window.NetSim || {});
