/* ==========================================================================
   NetSim — simulations/network-types.js
   Steps through the four network scales (PAN, LAN, MAN, WAN), pairing a
   simple scale diagram with real comparative figures for each.
   ========================================================================== */

(function (NetSim) {
  'use strict';

  const SCALES = [
    {
      key: 'PAN', name: 'Personal Area Network', range: '~10 m', speed: '~1–3 Mbps (Bluetooth/NFC)',
      example: 'A phone connected to wireless earbuds and a smartwatch', devices: '2 – 5', boxScale: 0.22,
      dots: 3
    },
    {
      key: 'LAN', name: 'Local Area Network', range: '~100 m – 1 km', speed: '100 Mbps – 10 Gbps (Ethernet/Wi-Fi)',
      example: 'Computers and printers across one office building', devices: '5 – 100s', boxScale: 0.45,
      dots: 6
    },
    {
      key: 'MAN', name: 'Metropolitan Area Network', range: '~5 – 50 km', speed: '10 Mbps – 1 Gbps',
      example: 'Connected campuses or offices across a city', devices: '100s – 1,000s', boxScale: 0.7,
      dots: 9
    },
    {
      key: 'WAN', name: 'Wide Area Network', range: 'Country-wide to global', speed: 'Varies — multi-Gbps backbones',
      example: 'The internet itself, linking cities and countries', devices: 'Millions+', boxScale: 1,
      dots: 12
    }
  ];

  NetSim.SimRegistry.register('network-types', function factory(ctx) {
    let index = 0;
    let timer = null;
    let host = null;

    function draw() {
      const s = SCALES[index];
      const maxW = 560, maxH = 200;
      const w = 60 + (maxW - 60) * s.boxScale;
      const h = 50 + (maxH - 50) * s.boxScale;
      const x = (600 - w) / 2, y = 20 + (maxH - h);

      const dots = [];
      for (let i = 0; i < s.dots; i++) {
        const angle = (i / s.dots) * Math.PI * 2;
        const rx = (w / 2) * 0.7, ry = (h / 2) * 0.7;
        const cx = x + w / 2 + rx * Math.cos(angle);
        const cy = y + h / 2 + ry * Math.sin(angle);
        dots.push(`<circle class="nettype-dot" cx="${cx.toFixed(1)}" cy="${cy.toFixed(1)}" r="5"></circle>
          <line class="nettype-spoke" x1="${(x + w / 2).toFixed(1)}" y1="${(y + h / 2).toFixed(1)}" x2="${cx.toFixed(1)}" y2="${cy.toFixed(1)}"></line>`);
      }

      host.innerHTML = `
        <svg class="net-svg" viewBox="0 0 600 240" role="img" aria-label="${s.name} scale diagram">
          <rect class="nettype-bound" x="${x}" y="${y}" width="${w}" height="${h}" rx="6"></rect>
          ${dots.join('')}
          <circle class="nettype-hub" cx="${(x + w / 2).toFixed(1)}" cy="${(y + h / 2).toFixed(1)}" r="7"></circle>
          <text class="nettype-label" x="300" y="${y - 10 < 16 ? 16 : y - 10}" text-anchor="middle">${s.key} coverage area</text>
        </svg>
      `;

      ctx.setMetrics([
        { label: 'Scale', value: s.key + ' — ' + s.name },
        { label: 'Typical Range', value: s.range },
        { label: 'Typical Speed', value: s.speed },
        { label: 'Approx. Devices', value: s.devices },
        { label: 'Example', value: s.example }
      ]);

      renderTabs();
    }

    function renderTabs() {
      ctx.params.hidden = false;
      ctx.params.innerHTML = `
        <fieldset class="switch-mode-group" role="radiogroup" aria-label="Network scale">
          <legend class="section-label" style="margin:0 0 0.5rem;border:none;padding:0;">Jump to a scale</legend>
          ${SCALES.map((s, i) => `
            <label class="switch-mode-option ${i === index ? 'is-checked' : ''}">
              <input type="radio" name="netTypeChoice" value="${i}" ${i === index ? 'checked' : ''}>
              ${s.key} \u2014 ${s.name}
            </label>
          `).join('')}
        </fieldset>
      `;
      ctx.params.querySelectorAll('input[name="netTypeChoice"]').forEach((r) => {
        r.addEventListener('change', () => {
          stop();
          index = Number(r.value);
          ctx.log('Now viewing: ' + SCALES[index].key + ' — ' + SCALES[index].name + '.');
          draw();
        });
      });
    }

    function stop() { if (timer) { NetSim.SimTiming.clearInterval(timer); timer = null; } }

    function advance() {
      if (index >= SCALES.length - 1) { stop(); return; }
      index += 1;
      ctx.log('Now viewing: ' + SCALES[index].key + ' — ' + SCALES[index].name + '.');
      draw();
    }

    return {
      initialize() {
        ctx.canvas.classList.add('net-canvas');
        ctx.canvas.innerHTML = '<div class="net-mount"></div>';
        host = ctx.canvas.querySelector('.net-mount');
        index = 0;
        draw();
        ctx.log('Starting at the smallest scale — PAN.');
      },
      start() {
        if (timer) return;
        timer = NetSim.SimTiming.setInterval(() => { if (index >= SCALES.length - 1) { stop(); return; } advance(); }, 1400);
      },
      pause() { stop(); },
      step() { stop(); advance(); },
      reset() { stop(); index = 0; draw(); ctx.log('Reset to PAN.'); },
      destroy() { stop(); }
    };
  });

})(window.NetSim = window.NetSim || {});
