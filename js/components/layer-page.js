/* ==========================================================================
   NetSim — components/layer-page.js
   Layer detail page: responsibility summary + its simulations, filterable
   by a search bar and switchable between grid and list view. The view
   mode and search text are kept at module scope so they persist as the
   person moves between layers in the same session.
   ========================================================================== */

(function (NetSim) {
  'use strict';

  let viewMode = 'grid'; // 'grid' | 'list'
  let searchQuery = '';

  function renderLayerPage(container, layerId) {
    const layer = NetSim.OSIData.getLayerById(layerId);

    if (!layer) {
      container.innerHTML = `
        <div class="placeholder-box">
          <strong>Layer not found</strong>
          <a href="#/osi">Return to the OSI model</a>
        </div>
      `;
      return;
    }

    container.innerHTML = `
      <div class="layer-head">
        <div class="layer-eyebrow">Layer ${layer.number} of 7</div>
        <h1>${layer.name} Layer</h1>
        <h2 class="responsibility-title">Responsibilities</h2>
        <p class="lede">${layer.responsibility}</p>
        <dl class="layer-facts">
          <div class="fact"><dt>Data unit:</dt><dd>${layer.dataUnit}</dd></div>
          <div class="fact"><dt>Protocols:</dt><dd>${layer.protocols.join(', ')}</dd></div>
          <div class="fact"><dt>Simulations:</dt><dd>${layer.simulations.length}</dd></div>
        </dl>
      </div>

      <div class="sim-toolbar">
        <h2 class="section-label" style="margin:0;border:none;padding:0;">Simulations</h2>
        <div class="sim-toolbar-controls">
          <input type="search" class="sim-search" id="simSearch" placeholder="Search simulations..." value="${escapeHtml(searchQuery)}" aria-label="Search simulations">
          <div class="view-toggle" role="group" aria-label="View mode">
            <button type="button" class="view-toggle-btn ${viewMode === 'grid' ? 'is-active' : ''}" data-view="grid" aria-label="Grid view">Grid</button>
            <button type="button" class="view-toggle-btn ${viewMode === 'list' ? 'is-active' : ''}" data-view="list" aria-label="List view">List</button>
          </div>
        </div>
      </div>

      <div id="simResults"></div>
    `;

    const resultsEl = container.querySelector('#simResults');
    paintResults(layer, resultsEl);

    container.querySelector('#simSearch').addEventListener('input', (e) => {
      searchQuery = e.target.value;
      paintResults(layer, resultsEl);
    });

    container.querySelectorAll('.view-toggle-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        viewMode = btn.dataset.view;
        container.querySelectorAll('.view-toggle-btn').forEach((b) => b.classList.toggle('is-active', b === btn));
        paintResults(layer, resultsEl);
      });
    });
  }

  function escapeHtml(str) {
    return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  function paintResults(layer, resultsEl) {
    const q = searchQuery.trim().toLowerCase();
    const matches = q
      ? layer.simulations.filter((sim) => sim.name.toLowerCase().includes(q) || sim.tag.toLowerCase().includes(q))
      : layer.simulations;

    if (!matches.length) {
      resultsEl.innerHTML = `
        <div class="placeholder-box">
          <strong>No simulations match "${escapeHtml(searchQuery)}"</strong>
          Try a different search term.
        </div>
      `;
      return;
    }

    const groups = layer.simulationGroups || [];
    const assigned = new Set();
    const html = groups.map((group) => {
      const groupMatches = matches.filter((sim) => group.simulationIds.includes(sim.id));
      groupMatches.forEach((sim) => assigned.add(sim.id));
      if (!groupMatches.length) return '';
      const items = viewMode === 'grid'
        ? `<div class="sim-grid">${groupMatches.map((sim) => NetSim.Components.simulationCardHTML(layer, sim)).join('')}</div>`
        : `<ul class="sim-list">${groupMatches.map((sim) => NetSim.Components.simulationListItemHTML(layer, sim)).join('')}</ul>`;
      return `<section class="sim-group"><h3 class="sim-group-title">${escapeHtml(group.title)}</h3>${items}</section>`;
    }).join('');
    const ungrouped = matches.filter((sim) => !assigned.has(sim.id));
    const ungroupedHtml = ungrouped.length
      ? `<section class="sim-group"><h3 class="sim-group-title">Other layer topics</h3>${viewMode === 'grid'
        ? `<div class="sim-grid">${ungrouped.map((sim) => NetSim.Components.simulationCardHTML(layer, sim)).join('')}</div>`
        : `<ul class="sim-list">${ungrouped.map((sim) => NetSim.Components.simulationListItemHTML(layer, sim)).join('')}</ul>`}</section>`
      : '';
    resultsEl.innerHTML = html + ungroupedHtml;
  }

  NetSim.Components = NetSim.Components || {};
  NetSim.Components.renderLayerPage = renderLayerPage;

})(window.NetSim = window.NetSim || {});
