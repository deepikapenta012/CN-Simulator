/* ==========================================================================
   NetSim — router.js
   Minimal hash router. No history API needed — the whole app must work by
   double-clicking the HTML file, so hash navigation keeps things simple
   and dependency-free.
   ========================================================================== */

(function (NetSim) {
  'use strict';

  const appEl = () => document.getElementById('app');
  const crumbEl = () => document.getElementById('crumb');

  function parseHash() {
    const raw = window.location.hash.replace(/^#\/?/, '');
    const parts = raw.split('/').filter(Boolean);

    if (parts.length === 0 || parts[0] === 'osi') return { name: 'osi', params: {} };
    if (parts[0] === 'layer' && parts[1]) return { name: 'layer', params: { layerId: parts[1] } };
    if (parts[0] === 'sim' && parts[1] && parts[2]) return { name: 'sim', params: { layerId: parts[1], simId: parts[2] } };
    if (parts[0] === 'concepts') return { name: 'concepts', params: {} };
    if (parts[0] === 'concept' && parts[1]) return { name: 'concept', params: { conceptId: parts[1] } };
    if (parts[0] === 'history') return { name: 'history', params: {} };
    if (parts[0] === 'settings') return { name: 'settings', params: {} };
    return { name: 'osi', params: {} };
  }

  function breadcrumbFor(route) {
    switch (route.name) {
      case 'osi': return 'OSI Model';
      case 'layer': {
        const layer = NetSim.OSIData.getLayerById(route.params.layerId);
        return `<a href="#/osi">OSI Model</a> / ${layer ? layer.name : 'Layer'}`;
      }
      case 'sim': {
        const layer = NetSim.OSIData.getLayerById(route.params.layerId);
        const sim = layer ? NetSim.OSIData.getSimulation(route.params.layerId, route.params.simId) : null;
        return `<a href="#/osi">OSI Model</a> / <a href="#/layer/${route.params.layerId}">${layer ? layer.name : 'Layer'}</a> / ${sim ? sim.name : 'Simulation'}`;
      }
      case 'concepts': return `<a href="#/osi">OSI Model</a> / Concept Explorer`;
      case 'concept': {
        const concept = NetSim.OSIData.getConceptById(route.params.conceptId);
        return `<a href="#/osi">OSI Model</a> / <a href="#/concepts">Concept Explorer</a> / ${concept ? concept.name : 'Concept'}`;
      }
      case 'history': return `<a href="#/osi">OSI Model</a> / Simulation History`;
      case 'settings': return `<a href="#/osi">OSI Model</a> / Settings`;
      default: return '';
    }
  }

  function renderHistoryPage(container) {
    const history = NetSim.State.getState().history;
    container.innerHTML = `
      <div class="layer-head">
        <div class="layer-eyebrow">Simulation History</div>
        <h1>Recently visited</h1>
        <p class="lede">Pages you've opened this session, most recent first.</p>
      </div>
      ${history.length ? `
        <ul class="plain-list">
          ${history.map((h) => `
            <li>
              <a href="${h.path}">${h.label}</a>
              <span class="ts">${h.ts.toLocaleTimeString([], { hour12: false })}</span>
            </li>
          `).join('')}
        </ul>
      ` : `
        <div class="placeholder-box">
          <strong>Nothing yet</strong>
          Open a layer or simulation and it will show up here.
        </div>
      `}
    `;
  }

  function renderSettingsPage(container) {
    const settings = NetSim.State.getState().settings;
    container.innerHTML = `
      <div class="layer-head">
        <div class="layer-eyebrow">Settings</div>
        <h1>Preferences</h1>
        <p class="lede">These apply for the current session only.</p>
      </div>
      <div class="settings-row">
        <div>
          <div class="label">Reduce motion</div>
          <div class="desc">Skip auto-play animation in the data flow visualization.</div>
        </div>
        <input type="checkbox" id="setReduceMotion" ${settings.reduceMotion ? 'checked' : ''}>
      </div>
      <div class="settings-row">
        <div>
          <div class="label">Compact simulation cards</div>
          <div class="desc">Tighter spacing on layer pages for smaller screens.</div>
        </div>
        <input type="checkbox" id="setCompactCards" ${settings.compactCards ? 'checked' : ''}>
      </div>
    `;
    container.querySelector('#setReduceMotion').addEventListener('change', (e) => {
      NetSim.State.updateSetting('reduceMotion', e.target.checked);
    });
    container.querySelector('#setCompactCards').addEventListener('change', (e) => {
      NetSim.State.updateSetting('compactCards', e.target.checked);
    });
  }

  let currentContainer = null;

  function render() {
    const route = parseHash();
    NetSim.State.setRoute(route.name, route.params);

    const container = appEl();

    if (currentContainer && typeof currentContainer._simDestroy === 'function') {
      currentContainer._simDestroy();
    }

    crumbEl().innerHTML = breadcrumbFor(route);

    document.querySelectorAll('.nav-menu a').forEach((a) => {
      a.classList.toggle('active', a.dataset.route === route.name ||
        (a.dataset.route === 'osi' && route.name === 'layer') ||
        (a.dataset.route === 'osi' && route.name === 'sim') ||
        (a.dataset.route === 'concepts' && route.name === 'concept'));
    });

    switch (route.name) {
      case 'osi':
        NetSim.Components.renderOSIHome(container);
        break;
      case 'layer':
        NetSim.Components.renderLayerPage(container, route.params.layerId);
        NetSim.State.logVisit(
          (NetSim.OSIData.getLayerById(route.params.layerId) || {}).name + ' layer',
          '#/layer/' + route.params.layerId
        );
        break;
      case 'sim':
        NetSim.Components.renderSimulationPage(container, route.params.layerId, route.params.simId);
        break;
      case 'concepts':
        NetSim.Components.renderConceptExplorer(container);
        break;
      case 'concept':
        NetSim.Components.renderConceptPage(container, route.params.conceptId);
        NetSim.State.logVisit(
          (NetSim.OSIData.getConceptById(route.params.conceptId) || {}).name,
          '#/concept/' + route.params.conceptId
        );
        break;
      case 'history':
        renderHistoryPage(container);
        break;
      case 'settings':
        renderSettingsPage(container);
        break;
      default:
        NetSim.Components.renderOSIHome(container);
    }

    currentContainer = container;
    window.scrollTo(0, 0);
  }

  NetSim.Router = { render, parseHash };

})(window.NetSim = window.NetSim || {});
