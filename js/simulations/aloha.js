/* ==========================================================================
   NetSim — simulations/aloha.js
   Several stations independently attempt to transmit each slot. Slotted
   ALOHA only collides when two stations pick the exact same slot; Pure
   ALOHA's frames can start anytime, so we approximate its doubled
   vulnerable period by also colliding with neighboring-slot activity —
   which is exactly why slotted ALOHA gets roughly double the throughput.
   ========================================================================== */

(function (NetSim) {
  'use strict';

  NetSim.SimRegistry.register('aloha', function factory(ctx) {
    let mode = 'slotted';
    let stationCount = 5;
    let p = 0.25;
    const totalSlots = 20;
    let attempts = [];
    let outcomes = []; // per slot: 'idle' | 'success' | 'collision'
    let index = -1;
    let timer = null;
    let host = null;

    function buildRun() {
      attempts = [];
      for (let t = 0; t < totalSlots; t++) {
        const stations = [];
        for (let s = 1; s <= stationCount; s++) if (Math.random() < p) stations.push(s);
        attempts.push(stations);
      }
      outcomes = attempts.map((stations, t) => {
        if (stations.length === 0) return 'idle';
        if (mode === 'slotted') return stations.length === 1 ? 'success' : 'collision';
        const prevBusy = t > 0 && attempts[t - 1].length > 0;
        const nextBusy = t < totalSlots - 1 && attempts[t + 1].length > 0;
        return (stations.length === 1 && !prevBusy && !nextBusy) ? 'success' : 'collision';
      });
    }

    function draw() {
      const shown = Math.max(0, index + 1);
      const cells = attempts.slice(0, shown).map((stations, t) => {
        const o = outcomes[t];
        const cls = o === 'success' ? 'delivered' : o === 'collision' ? 'lost' : 'pending';
        const label = stations.length ? stations.map((s) => 'S' + s).join(',') : '\u00b7';
        return `<span class="packet-chip ${cls}" title="Slot ${t}">${label}</span>`;
      }).join('');

      host.innerHTML = `
        <p class="net-hint" style="margin-bottom:0.5rem;">${mode === 'pure' ? 'Pure' : 'Slotted'} ALOHA \u2014 ${stationCount} stations, each attempting with probability ${(p * 100).toFixed(0)}% per slot</p>
        <div class="packet-status-strip">${cells || '<span class="net-hint">Press Start or Step to run the slots.</span>'}</div>
        <p class="net-hint" style="margin-top:0.8rem;">green = successful transmission &nbsp;\u00b7&nbsp; red = collision &nbsp;\u00b7&nbsp; grey \u00b7 = idle slot</p>
      `;

      const seen = outcomes.slice(0, shown);
      const successes = seen.filter((o) => o === 'success').length;
      const collisions = seen.filter((o) => o === 'collision').length;
      const totalAttempts = attempts.slice(0, shown).reduce((s, a) => s + a.length, 0);
      ctx.setMetrics([
        { label: 'Mode', value: mode === 'pure' ? 'Pure ALOHA' : 'Slotted ALOHA' },
        { label: 'Slots Elapsed', value: shown + ' / ' + totalSlots },
        { label: 'Successful Transmissions', value: String(successes) },
        { label: 'Collisions', value: String(collisions) },
        { label: 'Throughput', value: shown ? (successes / shown * 100).toFixed(0) + '%' : '\u2014' },
        { label: 'Theoretical Max Efficiency', value: mode === 'pure' ? '18.4% (1/2e)' : '36.8% (1/e)' }
      ]);
    }

    function renderParams() {
      ctx.params.hidden = false;
      ctx.params.innerHTML = `
        <fieldset class="switch-mode-group" role="radiogroup" aria-label="ALOHA mode">
          <legend class="section-label" style="margin:0 0 0.5rem;border:none;padding:0;">Mode</legend>
          <label class="switch-mode-option ${mode === 'pure' ? 'is-checked' : ''}">
            <input type="radio" name="alohaMode" value="pure" ${mode === 'pure' ? 'checked' : ''}> Pure ALOHA (transmit anytime)
          </label>
          <label class="switch-mode-option ${mode === 'slotted' ? 'is-checked' : ''}">
            <input type="radio" name="alohaMode" value="slotted" ${mode === 'slotted' ? 'checked' : ''}> Slotted ALOHA (wait for slot boundary)
          </label>
        </fieldset>
        <div class="sim-param-row"><label for="alohaStations">Stations</label>
          <input type="range" id="alohaStations" min="2" max="8" step="1" value="${stationCount}">
          <span class="val" id="alohaStationsVal">${stationCount}</span></div>
        <div class="sim-param-row"><label for="alohaP">Attempt Probability</label>
          <input type="range" id="alohaP" min="5" max="50" step="5" value="${Math.round(p * 100)}">
          <span class="val" id="alohaPVal">${Math.round(p * 100)}%</span></div>
      `;
      ctx.params.querySelectorAll('input[name="alohaMode"]').forEach((r) => {
        r.addEventListener('change', () => { mode = r.value; rebuild(); });
      });
      ctx.params.querySelector('#alohaStations').addEventListener('change', (e) => { stationCount = parseInt(e.target.value, 10); rebuild(); });
      ctx.params.querySelector('#alohaStations').addEventListener('input', (e) => { ctx.params.querySelector('#alohaStationsVal').textContent = e.target.value; });
      ctx.params.querySelector('#alohaP').addEventListener('change', (e) => { p = parseInt(e.target.value, 10) / 100; rebuild(); });
      ctx.params.querySelector('#alohaP').addEventListener('input', (e) => { ctx.params.querySelector('#alohaPVal').textContent = e.target.value + '%'; });
    }

    function rebuild() {
      stop();
      index = -1;
      buildRun();
      renderParams();
      draw();
      ctx.log('New run generated \u2014 ' + totalSlots + ' slots, ' + stationCount + ' stations.');
    }

    function stop() { if (timer) { clearInterval(timer); timer = null; } }

    function advance() {
      if (index >= totalSlots - 1) { stop(); return; }
      index += 1;
      const stations = attempts[index];
      const o = outcomes[index];
      const text = o === 'idle' ? 'Slot ' + index + ': idle, no attempts.'
        : o === 'success' ? 'Slot ' + index + ': Station ' + stations[0] + ' transmitted successfully \u2713'
        : 'Slot ' + index + ': collision between ' + stations.map((s) => 'Station ' + s).join(' and ') + ' \u2717';
      ctx.log(text, o === 'success' ? 'success' : o === 'collision' ? 'warning' : undefined);
      draw();
    }

    return {
      initialize() {
        ctx.canvas.classList.add('net-canvas');
        ctx.canvas.innerHTML = '<div class="aloha-mount"></div>';
        host = ctx.canvas.querySelector('.aloha-mount');
        rebuild();
      },
      start() { if (timer) return; timer = setInterval(() => { if (index >= totalSlots - 1) { stop(); return; } advance(); }, 400); },
      pause() { stop(); },
      step() { stop(); advance(); },
      reset() { rebuild(); },
      destroy() { stop(); }
    };
  });

})(window.NetSim = window.NetSim || {});
