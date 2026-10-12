/* ==========================================================================
   NetSim — simulations/osi-vs-tcpip.js
   Walks down the 7 OSI layers while showing which single TCP/IP layer
   each one folds into — the two columns share the same total height (7
   flex units) so the grouping brackets line up honestly, not by eyeballing.
   ========================================================================== */

(function (NetSim) {
  'use strict';

  const STEPS = [
    { osi: 'Application', tcpip: 'Application', span: 3, note: 'Both models start with Application-level protocols like HTTP, FTP and DNS.' },
    { osi: 'Presentation', tcpip: 'Application', span: 3, note: 'TCP/IP has no separate Presentation layer — formatting/encryption is handled inside Application-layer protocols.' },
    { osi: 'Session', tcpip: 'Application', span: 3, note: 'TCP/IP folds session management into the Application layer (or into TCP itself) instead of giving it its own layer.' },
    { osi: 'Transport', tcpip: 'Transport', span: 1, note: 'Both models agree here — TCP and UDP live at this layer in either model.' },
    { osi: 'Network', tcpip: 'Internet', span: 1, note: 'OSI\u2019s Network layer corresponds to TCP/IP\u2019s Internet layer — IP addressing and routing.' },
    { osi: 'Data Link', tcpip: 'Network Access', span: 2, note: 'TCP/IP merges Data Link into its Network Access layer.' },
    { osi: 'Physical', tcpip: 'Network Access', span: 2, note: '...along with Physical — TCP/IP treats media access and physical transmission as one combined layer.' }
  ];

  const TCPIP_LAYERS = [
    { name: 'Application', flex: 3 },
    { name: 'Transport', flex: 1 },
    { name: 'Internet', flex: 1 },
    { name: 'Network Access', flex: 2 }
  ];

  NetSim.SimRegistry.register('osi-vs-tcpip', function factory(ctx) {
    let index = 0;
    let timer = null;
    let host = null;

    function draw() {
      host.innerHTML = `
        <div class="compare-hosts">
          <span>OSI Model (7 layers)</span><span>TCP/IP Model (4 layers)</span>
        </div>
        <div class="compare-cols">
          <div class="compare-col" id="osiCol">
            ${STEPS.map((s, i) => `
              <div class="compare-pill" data-i="${i}" style="flex:1;">
                <span class="layer">${s.osi}</span>
              </div>
            `).join('')}
          </div>
          <div class="compare-col compare-col--tcpip" id="tcpipCol">
            ${TCPIP_LAYERS.map((l) => `
              <div class="compare-pill" data-layer="${l.name}" style="flex:${l.flex};">
                <span class="layer">${l.name}</span>
              </div>
            `).join('')}
          </div>
        </div>
        <p class="encap3-caption" id="compareCaption"></p>
      `;
      paint();
    }

    function paint() {
      const step = STEPS[index];
      host.querySelectorAll('#osiCol .compare-pill').forEach((el) => {
        const i = Number(el.dataset.i);
        el.classList.toggle('is-active', i === index);
        el.classList.toggle('is-done', i < index);
      });
      host.querySelectorAll('#tcpipCol .compare-pill').forEach((el) => {
        el.classList.toggle('is-active', el.dataset.layer === step.tcpip);
      });
      host.querySelector('#compareCaption').innerHTML =
        '<strong>OSI ' + step.osi + '</strong> \u2192 <strong>TCP/IP ' + step.tcpip + '</strong> \u2014 ' + step.note;

      ctx.setMetrics([
        { label: 'OSI Layer', value: step.osi },
        { label: 'Maps to TCP/IP Layer', value: step.tcpip },
        { label: 'OSI Layers Covered', value: String(index + 1) + ' / 7' },
        { label: 'Layer Count', value: 'OSI: 7 \u00b7 TCP/IP: 4' }
      ]);
    }

    function stop() { if (timer) { clearInterval(timer); timer = null; } }

    function advance() {
      if (index >= STEPS.length - 1) { stop(); return; }
      index += 1;
      ctx.log('OSI ' + STEPS[index].osi + ' \u2192 TCP/IP ' + STEPS[index].tcpip + '.');
      paint();
    }

    return {
      initialize() {
        ctx.canvas.classList.add('net-canvas');
        ctx.canvas.innerHTML = '<div class="compare-mount"></div>';
        host = ctx.canvas.querySelector('.compare-mount');
        ctx.params.hidden = true;
        index = 0;
        draw();
        ctx.log('Starting at OSI\u2019s Application layer.');
      },
      start() {
        if (timer) return;
        timer = setInterval(() => { if (index >= STEPS.length - 1) { stop(); return; } advance(); }, 1300);
      },
      pause() { stop(); },
      step() { stop(); advance(); },
      reset() { stop(); index = 0; paint(); ctx.log('Reset to OSI Application layer.'); },
      destroy() { stop(); }
    };
  });

})(window.NetSim = window.NetSim || {});
