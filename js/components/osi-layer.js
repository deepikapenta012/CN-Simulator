/* ==========================================================================
   NetSim — components/osi-layer.js
   The home page: OSI model as the primary navigation surface.
   ========================================================================== */

(function (NetSim) {
  'use strict';

  function renderOSIHome(container) {
    const layers = NetSim.OSIData.getLayers();
    const state = NetSim.State.getState();

    container.innerHTML = `
      <section class="hero">
        <h1>NetSim</h1>
        <p class="lede">Explore computer networks layer by layer. Start at the top of the
        stack with the protocols your browser speaks, and work your way down to raw bits
        on the wire.</p>
        <div class="hero-actions">
          <a class="btn" href="#/concepts">Concept explorer</a>
        </div>
      </section>

      <div class="osi-stack" role="list" aria-label="OSI model layers">
        ${layers.map(layerButtonHTML).join('')}
      </div>
      <div id="layerPreview"></div>
      <p class="osi-hint">Click a layer to open its simulations. Hover to preview.</p>
    `;

    const stackEl = container.querySelector('.osi-stack');
    const previewEl = container.querySelector('#layerPreview');

    function paintPreview(layerId) {
      const layer = NetSim.OSIData.getLayerById(layerId);
      if (!layer) { previewEl.innerHTML = ''; return; }
      previewEl.innerHTML = `
        <div class="layer-preview">
          <dl>
            <div class="kv"><dt>Responsibility</dt><dd>${layer.responsibility}</dd></div>
            <div class="kv"><dt>Common protocols</dt><dd class="mono">${layer.protocols.join(' · ')}</dd></div>
            <div class="kv"><dt>Data unit</dt><dd class="mono">${layer.dataUnit}</dd></div>
            <div class="kv"><dt>Simulations</dt><dd>${layer.simulations.length} available</dd></div>
          </dl>
        </div>
      `;
    }

    stackEl.querySelectorAll('.osi-layer').forEach((btn) => {
      const id = btn.dataset.layerId;

      btn.addEventListener('mouseenter', () => {
        NetSim.State.setHoveredLayer(id);
        paintPreview(id);
      });
      btn.addEventListener('focus', () => {
        NetSim.State.setHoveredLayer(id);
        paintPreview(id);
      });
      btn.addEventListener('click', () => {
        NetSim.State.setSelectedLayer(id);
        window.location.hash = '#/layer/' + id;
      });
    });

    if (state.hoveredLayerId) paintPreview(state.hoveredLayerId);
  }

  function layerButtonHTML(layer) {
    return `
      <button class="osi-layer" type="button" data-layer-id="${layer.id}" role="listitem"
        aria-label="Layer ${layer.number}, ${layer.name}. ${layer.simulations.length} simulations available.">
        <span class="osi-layer-num">${layer.number}</span>
        <span class="osi-layer-body">
          <span class="osi-layer-name">${layer.name}</span>
          <span class="osi-layer-topics">${layer.protocols.join(' • ')}</span>
        </span>
        <span class="osi-layer-unit">${layer.dataUnit}</span>
      </button>
    `;
  }

  NetSim.Components = NetSim.Components || {};
  NetSim.Components.renderOSIHome = renderOSIHome;

})(window.NetSim = window.NetSim || {});
