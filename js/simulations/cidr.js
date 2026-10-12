/* ==========================================================================
   NetSim — simulations/cidr.js
   Real route aggregation: find the longest common binary prefix across
   several /24 blocks, derive the supernet, and check whether it covers
   exactly those blocks or spills over into extra address space.
   ========================================================================== */

(function (NetSim) {
  'use strict';

  function ipToInt(ip) {
    const p = ip.split('.').map(Number);
    return ((p[0] << 24) | (p[1] << 16) | (p[2] << 8) | p[3]) >>> 0;
  }
  function intToIp(n) {
    return [(n >>> 24) & 255, (n >>> 16) & 255, (n >>> 8) & 255, n & 255].join('.');
  }
  function toBin32(n) { return (n >>> 0).toString(2).padStart(32, '0'); }

  function commonPrefixLen(bins) {
    let len = 0;
    while (len < 32 && bins.every((b) => b[len] === bins[0][len])) len++;
    return len;
  }

  NetSim.SimRegistry.register('cidr', function factory(ctx) {
    let baseIp = '192.168.0.0';
    let blockCount = 4;
    let phases = [];
    let index = -1;
    let timer = null;
    let host = null;
    let info = null;

    function compute() {
      const baseInt = ipToInt(baseIp);
      const blocks = [];
      for (let i = 0; i < blockCount; i++) blocks.push({ net: (baseInt + i * 256) >>> 0, label: intToIp((baseInt + i * 256) >>> 0) + '/24' });
      const bins = blocks.map((b) => toBin32(b.net));
      const prefixLen = commonPrefixLen(bins);
      const aggNetInt = (baseInt & (prefixLen === 0 ? 0 : (~0 << (32 - prefixLen)) >>> 0)) >>> 0;
      const aggSize = Math.pow(2, 32 - prefixLen);
      const coveredBlocks = aggSize / 256;
      const exact = aggNetInt === baseInt && coveredBlocks === blockCount;
      return { blocks, prefixLen, aggregate: intToIp(aggNetInt) + '/' + prefixLen, coveredBlocks, exact };
    }

    function buildPhases() {
      info = compute();
      const p = [];
      p.push({ text: blockCount + ' contiguous /24 blocks starting at ' + baseIp + ':', view: 'blocks' });
      p.push({ text: 'Finding the longest common binary prefix across all ' + blockCount + ' network addresses...', view: 'binary' });
      p.push({ text: 'Common prefix length: ' + info.prefixLen + ' bits.', view: 'prefix' });
      p.push({
        text: 'Aggregate (supernet): ' + info.aggregate + (info.exact
          ? ' \u2014 covers exactly these ' + blockCount + ' blocks, no extra addresses.'
          : ' \u2014 this prefix actually spans ' + info.coveredBlocks + ' /24 blocks, more than the ' + blockCount + ' requested, so it covers extra address space.'),
        view: 'result', level: info.exact ? 'success' : 'warning'
      });
      p.push({ text: 'Routing table impact: ' + blockCount + ' entries \u2192 1 entry for the same reachability.', view: 'impact', level: 'success' });
      return p;
    }

    function draw() {
      const phase = phases[Math.max(0, index)];
      const showBinary = index >= 1;
      const bins = info.blocks.map((b) => toBin32(b.net));
      const prefixLen = index >= 2 ? info.prefixLen : 0;

      const rows = info.blocks.map((b, bi) => `
        <div style="display:flex;align-items:center;gap:0.5rem;margin-bottom:3px;">
          <span style="font-family:var(--f-mono);font-size:0.78rem;width:7rem;flex:none;">${b.label}</span>
          ${showBinary ? `<span style="font-family:var(--f-mono);font-size:0.72rem;letter-spacing:1px;">${bins[bi].split('').map((bit, i) => `<span style="${i < prefixLen ? 'color:var(--accent);font-weight:700;' : 'color:var(--ink-faint);'}">${bit}</span>`).join('')}</span>` : ''}
        </div>
      `).join('');

      host.innerHTML = `<div class="crc-stage">${rows}${index >= 3 ? `<p class="net-hint" style="margin-top:0.6rem;">\u2192 <strong>${info.aggregate}</strong></p>` : ''}</div>`;

      ctx.setMetrics([
        { label: 'Individual Blocks', value: String(blockCount) },
        { label: 'Common Prefix', value: '/' + info.prefixLen },
        { label: 'Aggregate', value: info.aggregate },
        { label: 'Exact Coverage', value: info.exact ? 'Yes' : 'No \u2014 covers ' + info.coveredBlocks + ' blocks' },
        { label: 'Routing Entries', value: blockCount + ' \u2192 1' }
      ]);
    }

    function renderParams() {
      ctx.params.hidden = false;
      ctx.params.innerHTML = `
        <div class="switch-text-row">
          <label for="cidrBase">First /24 block</label>
          <input type="text" id="cidrBase" maxlength="15" value="${baseIp}">
        </div>
        <div class="sim-param-row"><label for="cidrCount">Number of Blocks</label>
          <input type="range" id="cidrCount" min="2" max="8" step="1" value="${blockCount}">
          <span class="val" id="cidrCountVal">${blockCount}</span></div>
        <p style="font-size:0.78rem;color:var(--ink-faint);margin-top:0.4rem;">Try 4 blocks (clean /22) vs 3 blocks
        (not a power of two \u2014 watch the aggregate overshoot).</p>
      `;
      ctx.params.querySelector('#cidrBase').addEventListener('change', (e) => { baseIp = e.target.value.trim() || '192.168.0.0'; rebuild(); });
      ctx.params.querySelector('#cidrCount').addEventListener('change', (e) => { blockCount = parseInt(e.target.value, 10); rebuild(); });
      ctx.params.querySelector('#cidrCount').addEventListener('input', (e) => { ctx.params.querySelector('#cidrCountVal').textContent = e.target.value; });
    }

    function rebuild() {
      stop();
      index = -1;
      phases = buildPhases();
      renderParams();
      draw();
      ctx.log('Ready to aggregate ' + blockCount + ' blocks starting at ' + baseIp + '.');
    }

    function stop() { if (timer) { NetSim.SimTiming.clearInterval(timer); timer = null; } }

    function advance() {
      if (index >= phases.length - 1) { stop(); return; }
      index += 1;
      ctx.log(phases[index].text, phases[index].level);
      draw();
    }

    return {
      initialize() {
        ctx.canvas.classList.add('net-canvas');
        ctx.canvas.innerHTML = '<div class="cidr-mount"></div>';
        host = ctx.canvas.querySelector('.cidr-mount');
        rebuild();
      },
      start() { if (timer) return; timer = NetSim.SimTiming.setInterval(() => { if (index >= phases.length - 1) { stop(); return; } advance(); }, 800); },
      pause() { stop(); },
      step() { stop(); advance(); },
      reset() { rebuild(); },
      destroy() { stop(); }
    };
  });

})(window.NetSim = window.NetSim || {});
