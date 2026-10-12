/* ==========================================================================
   NetSim — simulations/ipv6.js
   Real IPv6 compression rules applied step by step: strip leading zeros
   within each group, then collapse the single longest run of all-zero
   groups into "::".
   ========================================================================== */

(function (NetSim) {
  'use strict';

  function parseFull(str) {
    const groups = str.split(':');
    if (groups.length !== 8) return null;
    if (groups.some((g) => !/^[0-9a-fA-F]{1,4}$/.test(g))) return null;
    return groups.map((g) => g.toLowerCase().padStart(4, '0'));
  }

  function stripLeadingZeros(groups) {
    return groups.map((g) => g.replace(/^0+(?=.)/, ''));
  }

  function findLongestZeroRun(groups) {
    let bestStart = -1, bestLen = 0, curStart = -1, curLen = 0;
    groups.forEach((g, i) => {
      if (g === '0') {
        if (curStart === -1) curStart = i;
        curLen++;
        if (curLen > bestLen) { bestLen = curLen; bestStart = curStart; }
      } else {
        curStart = -1; curLen = 0;
      }
    });
    return bestLen > 1 ? { start: bestStart, len: bestLen } : null;
  }

  function compress(groupsStripped) {
    const run = findLongestZeroRun(groupsStripped);
    if (!run) return groupsStripped.join(':');
    const before = groupsStripped.slice(0, run.start).join(':');
    const after = groupsStripped.slice(run.start + run.len).join(':');
    return before + '::' + after;
  }

  NetSim.SimRegistry.register('ipv6', function factory(ctx) {
    let addrStr = '2001:0db8:0000:0000:0000:ff00:0042:8329';
    let phases = [];
    let index = -1;
    let timer = null;
    let host = null;
    let info = null;

    function buildPhases() {
      const full = parseFull(addrStr);
      if (!full) {
        info = null;
        return [{ text: 'That doesn\u2019t look like a full IPv6 address \u2014 enter 8 groups of up to 4 hex digits, separated by colons.', level: 'error' }];
      }
      const stripped = stripLeadingZeros(full);
      const compressed = compress(stripped);
      info = { full, stripped, compressed };
      return [
        { text: 'Full 128-bit address, 8 groups of 16 bits each: ' + full.join(':'), view: 'full' },
        { text: 'Strip leading zeros within each group (0db8 \u2192 db8, 0000 \u2192 0, 0042 \u2192 42): ' + stripped.join(':'), view: 'stripped' },
        { text: 'Find the longest run of consecutive all-zero groups and replace it with "::" (only once, and only if it\u2019s more than one group):', view: 'findrun' },
        { text: 'Compressed form: ' + compressed, view: 'compressed', level: 'success' },
        { text: 'Expanding "' + compressed + '" back out reproduces the exact same full address \u2014 the compression is lossless.', view: 'roundtrip', level: 'success' }
      ];
    }

    function draw() {
      const phase = phases[Math.max(0, index)];
      let body = '';
      if (!info) {
        body = `<p class="net-hint">${phase.text}</p>`;
      } else if (phase.view === 'full' || !phase.view) {
        body = `<div class="bitgrid">${info.full.map((g) => `<span class="bitbox" style="width:auto;padding:0 0.5rem;">${g}</span>`).join('')}</div>`;
      } else if (phase.view === 'stripped') {
        body = `<div class="bitgrid">${info.stripped.map((g) => `<span class="bitbox is-active" style="width:auto;padding:0 0.5rem;">${g}</span>`).join('')}</div>`;
      } else {
        const run = findLongestZeroRun(info.stripped);
        body = `<div class="bitgrid">${info.stripped.map((g, i) => {
          const inRun = run && i >= run.start && i < run.start + run.len;
          return `<span class="bitbox ${inRun ? 'is-error' : 'is-active'}" style="width:auto;padding:0 0.5rem;">${g}</span>`;
        }).join('')}</div>
        <p class="net-hint" style="margin-top:0.5rem;">\u2192 <strong>${info.compressed}</strong></p>`;
      }
      host.innerHTML = `<div class="crc-stage">${body}</div>`;

      if (info) {
        ctx.setMetrics([
          { label: 'Full Address', value: info.full.join(':') },
          { label: 'Compressed', value: info.compressed },
          { label: 'Groups Collapsed', value: String((findLongestZeroRun(info.stripped) || { len: 0 }).len) },
          { label: 'Total Bits', value: '128' }
        ]);
      }
    }

    function renderParams() {
      ctx.params.hidden = false;
      ctx.params.innerHTML = `
        <div class="switch-text-row">
          <label for="ipv6Input">Full IPv6 address (8 groups)</label>
          <input type="text" id="ipv6Input" maxlength="40" value="${addrStr}">
        </div>
        <p style="font-size:0.78rem;color:var(--ink-faint);margin-top:0.4rem;">Try 2001:0db8:0000:0000:0000:ff00:0042:8329
        or fe80:0000:0000:0000:0202:b3ff:fe1e:8329</p>
      `;
      ctx.params.querySelector('#ipv6Input').addEventListener('change', (e) => {
        addrStr = e.target.value.trim() || '2001:0db8:0000:0000:0000:ff00:0042:8329';
        rebuild();
      });
    }

    function rebuild() {
      stop();
      index = -1;
      phases = buildPhases();
      renderParams();
      draw();
      ctx.log('Ready to compress ' + addrStr + '.');
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
        ctx.canvas.innerHTML = '<div class="ipv6-mount"></div>';
        host = ctx.canvas.querySelector('.ipv6-mount');
        rebuild();
      },
      start() { if (timer) return; timer = setInterval(() => { if (index >= phases.length - 1) { stop(); return; } advance(); }, 900); },
      pause() { stop(); },
      step() { stop(); advance(); },
      reset() { rebuild(); },
      destroy() { stop(); }
    };
  });

})(window.NetSim = window.NetSim || {});
