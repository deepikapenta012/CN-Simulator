/* ==========================================================================
   NetSim — simulations/switching.js
   Registers the interactive Circuit / Message / Packet switching lab
   under the 'switching-concepts' simulation id (Network layer). This file
   only wires DOM <-> engine together; all actual simulation logic lives
   in js/core/*.
   ========================================================================== */

(function (NetSim) {
  'use strict';

  NetSim.SimRegistry.register('switching-concepts', function factory(ctx) {
    const engine = NetSim.Core.SimulationEngine.createEngine();
    let network = null;
    let compareOpen = false;
    let extraEl = null; // packet strip + compare button/panel, appended after the SVG

    function buildCanvasChrome() {
      ctx.canvas.classList.add('net-canvas');
      ctx.canvas.innerHTML = '<div class="net-mount"></div>';
      const mountEl = ctx.canvas.querySelector('.net-mount');
      network = NetSim.Components.NetworkCanvas.mount(mountEl, {
        onLinkClick(linkId) { engine.failLink(linkId); }
      });

      extraEl = document.createElement('div');
      extraEl.className = 'switch-extra';
      extraEl.innerHTML = `
        <div class="packet-status-strip" id="packetStrip" hidden></div>
        <button type="button" class="btn secondary" id="compareBtn" style="margin-top:0.75rem;">Compare switching methods</button>
        <div class="compare-panel" id="comparePanel" hidden></div>
      `;
      ctx.canvas.appendChild(extraEl);

      extraEl.querySelector('#compareBtn').addEventListener('click', () => {
        compareOpen = !compareOpen;
        paintCompare();
      });
    }

    function paintPacketStrip() {
      const strip = extraEl.querySelector('#packetStrip');
      if (engine.state.mode !== 'packet' || !engine.state.packets.length) {
        strip.hidden = true;
        return;
      }
      strip.hidden = false;
      const chips = engine.state.packets.map((p) => {
        const symbol = p.state === 'delivered' ? '✓' : p.state === 'lost' ? '✗' : p.state === 'in-flight' ? '…' : '';
        return `<span class="packet-chip ${p.state}">${p.id} ${symbol}</span>`;
      }).join('');
      const reassembly = engine.state.done
        ? (engine.state.message.complete
            ? '<span class="packet-chip delivered">Reassembled: "' + engine.state.message.deliveredText + '"</span>'
            : '<span class="packet-chip lost">Message incomplete</span>')
        : '';
      strip.innerHTML = chips + reassembly;
    }

    function paintCompare() {
      const panel = extraEl.querySelector('#comparePanel');
      const btn = extraEl.querySelector('#compareBtn');
      panel.hidden = !compareOpen;
      btn.textContent = compareOpen ? 'Hide comparison' : 'Compare switching methods';
      if (!compareOpen) return;

      const theo = NetSim.Core.SimulationEngine.computeTheoreticalMetrics(engine.params);
      panel.innerHTML = `
        <h3>Structural comparison</h3>
        <table class="compare-table">
          <thead><tr><th></th><th>Circuit</th><th>Message</th><th>Packet</th></tr></thead>
          <tbody>
            <tr><td>Dedicated path</td><td class="yes">✓</td><td class="no">✗</td><td class="no">✗</td></tr>
            <tr><td>Connection setup</td><td class="yes">✓</td><td class="no">✗</td><td class="no">✗</td></tr>
            <tr><td>Store &amp; forward</td><td class="no">✗</td><td class="yes">✓</td><td class="yes">✓</td></tr>
            <tr><td>Message division</td><td class="no">✗</td><td class="no">✗</td><td class="yes">✓</td></tr>
            <tr><td>Independent routes</td><td class="no">✗</td><td class="no">✗</td><td class="yes">✓</td></tr>
          </tbody>
        </table>
        <h3>Calculated total delay (current parameters)</h3>
        <table class="compare-table">
          <thead><tr><th>Method</th><th>Total Delay</th></tr></thead>
          <tbody>
            <tr class="${engine.state.mode === 'circuit' ? 'highlight' : ''}"><td>Circuit</td><td class="mono">${Math.round(theo.circuit.totalDelay)} ms</td></tr>
            <tr class="${engine.state.mode === 'message' ? 'highlight' : ''}"><td>Message</td><td class="mono">${Math.round(theo.message.totalDelay)} ms</td></tr>
            <tr class="${engine.state.mode === 'packet' ? 'highlight' : ''}"><td>Packet</td><td class="mono">${Math.round(theo.packet.totalDelay)} ms</td></tr>
          </tbody>
        </table>
        <p style="font-size:0.8rem;color:var(--ink-faint);margin:0;">Calculated from the current message, packet size, link delay and transmission speed — change a parameter and reopen to see it update.</p>
      `;
    }

    function refreshParamsPanel() {
      NetSim.Components.SwitchingControls.render(ctx.params, engine.params, {
        onChange(patch) {
          engine.configure(patch);
          engine.reset();
          refreshParamsPanel();
        }
      });
    }

    function syncAll() {
      network.sync(engine.state, engine.params);
      ctx.setMetrics(Object.entries(engine.state.metrics).map(([label, value]) => ({ label, value })));
      paintPacketStrip();
      if (compareOpen) paintCompare();
    }

    return {
      initialize() {
        buildCanvasChrome();
        engine.onEvent((entry) => ctx.log(entry.text, entry.level === 'normal' ? undefined : entry.level));
        engine.onChange(syncAll);
        refreshParamsPanel();
        engine.reset();
        ctx.log('Switching lab ready — choose a method and press Start or Step.');
      },
      start() { engine.start(); },
      pause() { engine.pause(); },
      step() { engine.step(); },
      reset() {
        engine.reset();
        refreshParamsPanel();
        ctx.log('Simulation reset.');
      },
      destroy() { engine.destroy(); }
    };
  });

})(window.NetSim = window.NetSim || {});
