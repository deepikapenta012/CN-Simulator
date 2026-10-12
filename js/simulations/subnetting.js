/* ==========================================================================
   NetSim — simulations/subnetting.js
   Real subnet math: borrow just enough bits to fit the requested number
   of subnets, then compute every subnet's network address, usable host
   range and broadcast address from actual 32-bit integer arithmetic.
   ========================================================================== */

(function (NetSim) {
  'use strict';

  function ipToInt(ip) {
    const parts = ip.split('.').map(Number);
    if (parts.length !== 4 || parts.some((n) => isNaN(n) || n < 0 || n > 255)) return null;
    return ((parts[0] << 24) | (parts[1] << 16) | (parts[2] << 8) | parts[3]) >>> 0;
  }
  function intToIp(n) {
    return [(n >>> 24) & 255, (n >>> 16) & 255, (n >>> 8) & 255, n & 255].join('.');
  }

  NetSim.SimRegistry.register('subnetting', function factory(ctx) {
    let baseIp = '192.168.1.0';
    let basePrefix = 24;
    let numSubnets = 4;
    let phases = [];
    let index = -1;
    let timer = null;
    let host = null;
    let info = null;

    function compute() {
      const baseInt = ipToInt(baseIp);
      if (baseInt == null) return null;
      const bitsAvailable = 32 - basePrefix;
      const bitsNeeded = Math.max(1, Math.ceil(Math.log2(Math.max(2, numSubnets))));
      if (bitsNeeded > bitsAvailable) return { error: 'Not enough host bits in /' + basePrefix + ' to create ' + numSubnets + ' subnets.' };
      const newPrefix = basePrefix + bitsNeeded;
      const subnetSize = Math.pow(2, 32 - newPrefix);
      const maxPossible = Math.pow(2, bitsNeeded);
      const subnets = [];
      for (let i = 0; i < Math.min(numSubnets, maxPossible); i++) {
        const netInt = (baseInt + i * subnetSize) >>> 0;
        subnets.push({
          network: intToIp(netInt) + '/' + newPrefix,
          firstHost: intToIp(netInt + 1),
          lastHost: intToIp(netInt + subnetSize - 2),
          broadcast: intToIp(netInt + subnetSize - 1)
        });
      }
      return { bitsNeeded, newPrefix, subnetSize, usableHosts: subnetSize - 2, subnets };
    }

    function buildPhases() {
      info = compute();
      if (!info) return [{ text: 'That doesn\u2019t look like a valid base network address.', level: 'error' }];
      if (info.error) return [{ text: info.error, level: 'error' }];
      const p = [];
      p.push({ text: 'Base network: ' + baseIp + '/' + basePrefix + '. Need ' + numSubnets + ' subnet(s).', view: 'base' });
      p.push({ text: 'Bits needed: smallest B where 2^B \u2265 ' + numSubnets + ' \u2192 B = ' + info.bitsNeeded + '. New prefix = /' + basePrefix + ' + ' + info.bitsNeeded + ' = /' + info.newPrefix + '.', view: 'bits' });
      p.push({ text: 'Each subnet holds 2^(32\u2212' + info.newPrefix + ') = ' + info.subnetSize + ' addresses (' + info.usableHosts + ' usable hosts after network + broadcast).', view: 'size' });
      info.subnets.forEach((s, i) => {
        p.push({ text: 'Subnet ' + (i + 1) + ': ' + s.network + ' \u2014 usable hosts ' + s.firstHost + '\u2013' + s.lastHost + ', broadcast ' + s.broadcast, view: 'subnet', idx: i });
      });
      return p;
    }

    function draw() {
      const phase = phases[Math.max(0, index)];
      if (!info || info.error) {
        host.innerHTML = `<p class="net-hint">${phase.text}</p>`;
        ctx.setMetrics([]);
        return;
      }
      const revealedCount = phases.slice(0, index + 1).filter((p) => p.view === 'subnet').length;
      host.innerHTML = `
        <div style="overflow-x:auto;">
          <table class="compare-table">
            <thead><tr><th>#</th><th>Network</th><th>Usable Hosts</th><th>Broadcast</th></tr></thead>
            <tbody>
              ${info.subnets.map((s, i) => i < revealedCount ? `
                <tr class="${i === revealedCount - 1 ? 'highlight' : ''}">
                  <td>${i + 1}</td><td class="mono">${s.network}</td><td class="mono">${s.firstHost}\u2013${s.lastHost}</td><td class="mono">${s.broadcast}</td>
                </tr>
              ` : '').join('')}
            </tbody>
          </table>
        </div>
      `;
      ctx.setMetrics([
        { label: 'Base Network', value: baseIp + '/' + basePrefix },
        { label: 'New Prefix', value: '/' + info.newPrefix },
        { label: 'Bits Borrowed', value: String(info.bitsNeeded) },
        { label: 'Addresses per Subnet', value: String(info.subnetSize) },
        { label: 'Usable Hosts per Subnet', value: String(info.usableHosts) },
        { label: 'Subnets Shown', value: revealedCount + ' / ' + info.subnets.length }
      ]);
    }

    function renderParams() {
      ctx.params.hidden = false;
      ctx.params.innerHTML = `
        <div class="switch-text-row">
          <label for="subBase">Base network</label>
          <input type="text" id="subBase" maxlength="18" value="${baseIp}/${basePrefix}">
        </div>
        <div class="sim-param-row"><label for="subCount">Number of Subnets</label>
          <input type="range" id="subCount" min="2" max="16" step="1" value="${numSubnets}">
          <span class="val" id="subCountVal">${numSubnets}</span></div>
      `;
      ctx.params.querySelector('#subBase').addEventListener('change', (e) => {
        const [ip, prefixStr] = e.target.value.trim().split('/');
        baseIp = ip || '192.168.1.0';
        basePrefix = Math.min(30, Math.max(8, parseInt(prefixStr, 10) || 24));
        rebuild();
      });
      ctx.params.querySelector('#subCount').addEventListener('change', (e) => { numSubnets = parseInt(e.target.value, 10); rebuild(); });
      ctx.params.querySelector('#subCount').addEventListener('input', (e) => { ctx.params.querySelector('#subCountVal').textContent = e.target.value; });
    }

    function rebuild() {
      stop();
      index = -1;
      phases = buildPhases();
      renderParams();
      draw();
      ctx.log('Ready to split ' + baseIp + '/' + basePrefix + ' into ' + numSubnets + ' subnets.');
    }

    function stop() { if (timer) { clearInterval(timer); timer = null; } }

    function advance() {
      if (index >= phases.length - 1) { stop(); return; }
      index += 1;
      ctx.log(phases[index].text, phases[index].level);
      draw();
    }

    return {
      initialize() {
        ctx.canvas.classList.add('net-canvas');
        ctx.canvas.innerHTML = '<div class="subnet-mount"></div>';
        host = ctx.canvas.querySelector('.subnet-mount');
        rebuild();
      },
      start() { if (timer) return; timer = setInterval(() => { if (index >= phases.length - 1) { stop(); return; } advance(); }, 600); },
      pause() { stop(); },
      step() { stop(); advance(); },
      reset() { rebuild(); },
      destroy() { stop(); }
    };
  });

})(window.NetSim = window.NetSim || {});
