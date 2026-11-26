/* ==========================================================================
   NetSim — simulations/ipv6.js   (rebuilt)
   Interactive IPv6 address analyser with:
   • SVG 128-bit group strip (8 × 16-bit hextets), colour-coded
   • Step-by-step compression pipeline: full → strip → collapse → final
   • Side-by-side before/after comparison
   • Address type badge (global unicast, link-local, multicast, loopback, etc.)
   • Scope & prefix breakdown table
   • 5 preset addresses + custom input
   ========================================================================== */

(function (NetSim) {
  'use strict';

  /* ── helpers ─────────────────────────────────────────────────────────── */
  function parseFull(str) {
    var groups;
    if (str.indexOf('::') >= 0) {
      if (str.indexOf('::') !== str.lastIndexOf('::')) return null;
      var halves = str.split('::');
      var left = halves[0] ? halves[0].split(':') : [];
      var right = halves[1] ? halves[1].split(':') : [];
      var missing = 8 - left.length - right.length;
      if (missing < 1) return null;
      groups = left.concat(new Array(missing).fill('0'), right);
    } else {
      groups = str.split(':');
    }
    if (groups.length !== 8) return null;
    for (var i = 0; i < 8; i++) {
      if (!/^[0-9a-fA-F]{1,4}$/.test(groups[i])) return null;
    }
    var out = [];
    for (var i = 0; i < 8; i++) {
      var g = groups[i].toLowerCase();
      while (g.length < 4) g = '0' + g;
      out.push(g);
    }
    return out;
  }

  function stripLeading(groups) {
    var out = [];
    for (var i = 0; i < groups.length; i++) {
      out.push(groups[i].replace(/^0+(?=.)/, ''));
    }
    return out;
  }

  function findLongestRun(groups) {
    var bestS = -1, bestL = 0, curS = -1, curL = 0;
    for (var i = 0; i < groups.length; i++) {
      if (groups[i] === '0') {
        if (curS === -1) curS = i;
        curL++;
        if (curL > bestL) { bestL = curL; bestS = curS; }
      } else { curS = -1; curL = 0; }
    }
    return bestL > 1 ? { s: bestS, l: bestL } : null;
  }

  function compress(stripped) {
    var run = findLongestRun(stripped);
    if (!run) return stripped.join(':');
    var before = [];
    for (var i = 0; i < run.s; i++) before.push(stripped[i]);
    var after = [];
    for (var i = run.s + run.l; i < stripped.length; i++) after.push(stripped[i]);
    return before.join(':') + '::' + after.join(':');
  }

  function addrType(full) {
    var first = full[0];
    if (first === '0000' && full[1] === '0000' && full[2] === '0000' && full[3] === '0000' &&
        full[4] === '0000' && full[5] === '0000' && full[6] === '0000') {
      if (full[7] === '0001') return { type: 'Loopback (::1)', scope: 'Node', col: '#ef5350' };
      if (full[7] === '0000') return { type: 'Unspecified (::)', scope: 'N/A', col: '#90a4ae' };
    }
    var firstValue = parseInt(first, 16);
    if (firstValue >= 0xfe80 && firstValue <= 0xfebf) return { type: 'Link-Local', scope: 'Link', col: '#42a5f5' };
    if (first.substring(0, 2) === 'fc' || first.substring(0, 2) === 'fd')
      return { type: 'Unique Local (ULA)', scope: 'Organisation', col: '#66bb6a' };
    if (first.substring(0, 2) === 'ff') return { type: 'Multicast', scope: 'Variable', col: '#ab47bc' };
    if (first === '2001' && full[1] === '0db8') return { type: 'Documentation (2001:db8::/32)', scope: 'N/A', col: '#ffa726' };
    return { type: 'Global Unicast', scope: 'Global', col: '#0097a7' };
  }

  /* ── presets ─────────────────────────────────────────────────────────── */
  var PRESETS = [
    { label: '2001:0db8:0000:0000:0000:ff00:0042:8329', tag: 'Documentation' },
    { label: 'fe80:0000:0000:0000:0202:b3ff:fe1e:8329', tag: 'Link-Local' },
    { label: '2001:0db8:85a3:0000:0000:8a2e:0370:7334', tag: 'Global Unicast' },
    { label: 'ff02:0000:0000:0000:0000:0000:0000:0001', tag: 'Multicast All-Nodes' },
    { label: '0000:0000:0000:0000:0000:0000:0000:0001', tag: 'Loopback' }
  ];

  var C_ZERO = '#ef5350';
  var C_NORM = '#0097a7';

  NetSim.SimRegistry.register('ipv6', function factory(ctx) {
    var addrStr = PRESETS[0].label;
    var prefix = 64;
    var preIdx  = 0;
    var phases  = [];
    var index   = -1;
    var timer   = null;
    var mount   = null;
    var info    = null;

    /* ── analysis ──────────────────────────────────────────────────────── */
    function analyse() {
      var full = parseFull(addrStr);
      if (!full || prefix < 0 || prefix > 128 || prefix % 1 !== 0) return null;
      var stripped = stripLeading(full);
      var compressed = compress(stripped);
      var run = findLongestRun(stripped);
      var at = addrType(full);
      var bits = full.join('').split('').map(function (hex) { return parseInt(hex, 16).toString(2).padStart(4, '0'); }).join('');
      var networkBits = bits.slice(0, prefix).padEnd(128, '0');
      var network = [];
      for (var i = 0; i < 8; i++) network.push(parseInt(networkBits.slice(i * 16, (i + 1) * 16), 2).toString(16).padStart(4, '0'));
      return { full: full, stripped: stripped, compressed: compressed, run: run, at: at, prefix: prefix,
        network: network.join(':') + '/' + prefix };
    }

    function buildPhases() {
      info = analyse();
      if (!info) return [{ t: 'Invalid full IPv6 address — enter 8 groups of 1–4 hex digits separated by colons.', lv: 'error', v: 'err' }];
      var p = [];
      p.push({ t: 'Full 128-bit address (8 × 16-bit groups): ' + info.full.join(':'), v: 'full' });
      p.push({ t: 'Prefix /' + info.prefix + ' identifies the network; ' + (128 - info.prefix) + ' remaining bits identify the interface.', v: 'prefix' });
      p.push({ t: 'Network prefix: ' + info.network + '.', v: 'network' });
      p.push({ t: 'Step 1 — Strip leading zeros in each group: ' + info.stripped.join(':'), v: 'strip' });
      if (info.run) {
        p.push({ t: 'Step 2 — Longest run of all-zero groups: position ' + info.run.s + '–' + (info.run.s + info.run.l - 1) + ' (' + info.run.l + ' groups).', v: 'run' });
        p.push({ t: 'Step 3 — Replace that run with "::"  →  ' + info.compressed, v: 'comp', lv: 'success' });
      } else {
        p.push({ t: 'Step 2 — No consecutive all-zero groups longer than 1 to collapse.', v: 'run', lv: 'warning' });
        p.push({ t: 'Compressed form (leading-zero stripping only): ' + info.compressed, v: 'comp', lv: 'success' });
      }
      p.push({ t: 'Address type: ' + info.at.type + '  |  Scope: ' + info.at.scope, v: 'type', lv: 'success' });
      return p;
    }

    /* ── SVG group strip ──────────────────────────────────────────────── */
    function svgGroups() {
      if (!info) return '';
      var gw = 76, gh = 40, gap = 6, pad = 10;
      var totalW = 8 * gw + 7 * gap + 2 * pad;
      var H = 68;
      var html = '<svg class="ip6-svg" viewBox="0 0 ' + totalW + ' ' + H + '" preserveAspectRatio="xMidYMid meet">';

      var showStripped = index >= 3;
      var showRun      = index >= 4;
      var groups = showStripped ? info.stripped : info.full;

      for (var i = 0; i < 8; i++) {
        var x = pad + i * (gw + gap);
        var isZero = info.stripped[i] === '0';
        var inRun  = showRun && info.run && i >= info.run.s && i < info.run.s + info.run.l;
        var fill   = inRun ? C_ZERO + '22' : (isZero && showStripped ? '#fff3e0' : '#e0f7fa');
        var stroke = inRun ? C_ZERO : C_NORM;
        html += '<rect x="' + x + '" y="4" width="' + gw + '" height="' + gh + '" rx="4" fill="' + fill + '" stroke="' + stroke + '" stroke-width="' + (inRun ? 2 : 1) + '"/>';
        html += '<text x="' + (x + gw / 2) + '" y="29" text-anchor="middle" font-family="var(--f-mono)" font-size="12" fill="var(--ink)">' + groups[i] + '</text>';
        /* group index label */
        html += '<text x="' + (x + gw / 2) + '" y="58" text-anchor="middle" font-size="9" fill="var(--ink-faint)">G' + (i + 1) + '</text>';
      }

      html += '</svg>';
      return html;
    }

    /* ── comparison box ───────────────────────────────────────────────── */
    function compBox() {
      if (!info || index < 5) return '';
      var html = '<div class="ip6-compare">';
      html += '<div class="ip6-cmp-row"><span class="ip6-cmp-lbl">Full</span><span class="ip6-cmp-val">' + info.full.join(':') + '</span></div>';
      html += '<div class="ip6-cmp-row"><span class="ip6-cmp-lbl">Compressed</span><span class="ip6-cmp-val ip6-cmp-hl">' + info.compressed + '</span></div>';
      html += '<div class="ip6-cmp-row"><span class="ip6-cmp-lbl">Network</span><span class="ip6-cmp-val">' + info.network + '</span></div>';
      html += '<div class="ip6-cmp-row"><span class="ip6-cmp-lbl">Savings</span><span class="ip6-cmp-val">' + (info.full.join(':').length - info.compressed.length) + ' characters shorter</span></div>';
      html += '</div>';
      return html;
    }

    /* ── type badge ───────────────────────────────────────────────────── */
    function typeBadge() {
      if (!info || index < 6) return '';
      return '<div class="ip6-type-badge" style="border-color:' + info.at.col + ';color:' + info.at.col + ';">' +
        '<strong>' + info.at.type + '</strong> &nbsp;·&nbsp; Scope: ' + info.at.scope +
        '</div>';
    }

    /* ── draw ──────────────────────────────────────────────────────────── */
    function draw() {
      var phase = phases[Math.max(0, index)];
      var html = '';
      if (phase.v === 'err') {
        html = '<p class="ip6-err">' + phase.t + '</p>';
      } else {
        html = svgGroups() + compBox() + typeBadge();
      }
      mount.innerHTML = html;

      if (info) {
        ctx.setMetrics([
          { label: 'Full Address', value: info.full.join(':') },
          { label: 'Compressed', value: info.compressed },
          { label: 'Prefix', value: '/' + info.prefix },
          { label: 'Network', value: info.network },
          { label: 'Groups Collapsed', value: info.run ? String(info.run.l) : '0' },
          { label: 'Char Savings', value: String(info.full.join(':').length - info.compressed.length) },
          { label: 'Type', value: info.at.type },
          { label: 'Total Bits', value: '128' }
        ]);
      }
    }

    /* ── params ────────────────────────────────────────────────────────── */
    function renderParams() {
      ctx.params.hidden = false;
      var html = '<div class="ip6-presets">';
      for (var i = 0; i < PRESETS.length; i++) {
        html += '<label class="switch-mode-option' + (i === preIdx ? ' is-checked' : '') + '">' +
          '<input type="radio" name="ip6pre" value="' + i + '"' + (i === preIdx ? ' checked' : '') + '> ' +
          '<strong style="font-size:0.72rem;">' + PRESETS[i].label + '</strong><br><span style="font-size:0.68rem;color:var(--ink-faint);">' + PRESETS[i].tag + '</span>' +
          '</label>';
      }
      html += '</div>';
      html += '<div class="ip6-custom"><label>IPv6 / prefix</label>' +
        '<input type="text" id="ip6Input" maxlength="43" value="' + addrStr + '/' + prefix + '" placeholder="e.g. 2001:db8::1/64"></div>';
      ctx.params.innerHTML = html;

      var radios = ctx.params.querySelectorAll('input[name="ip6pre"]');
      for (var i = 0; i < radios.length; i++) {
        radios[i].addEventListener('change', function (e) {
          preIdx = parseInt(e.target.value, 10);
          addrStr = PRESETS[preIdx].label;
          rebuild();
        });
      }
      ctx.params.querySelector('#ip6Input').addEventListener('change', function (e) {
        var value = e.target.value.trim() || PRESETS[0].label + '/64';
        var parts = value.split('/');
        addrStr = parts[0];
        if (parts.length === 2 && /^\d{1,3}$/.test(parts[1])) prefix = Number(parts[1]);
        else if (parts.length !== 1) prefix = -1;
        preIdx = -1;
        rebuild();
      });
    }

    /* ── lifecycle ─────────────────────────────────────────────────────── */
    function rebuild() {
      stop(); index = -1;
      phases = buildPhases();
      renderParams(); draw();
      ctx.log('Ready to compress ' + addrStr + '.');
    }

    function stop() { if (timer) { NetSim.SimTiming.clearInterval(timer); timer = null; } }

    function advance() {
      if (index >= phases.length - 1) { stop(); return; }
      index++;
      ctx.log(phases[index].t, phases[index].lv);
      draw();
    }

    return {
      initialize: function () {
        ctx.canvas.innerHTML = '<div class="ip6-mount"></div>';
        mount = ctx.canvas.querySelector('.ip6-mount');
        rebuild();
      },
      start: function () {
        if (timer) return;
        timer = NetSim.SimTiming.setInterval(function () {
          if (index >= phases.length - 1) { stop(); return; }
          advance();
        }, 900);
      },
      pause: function () { stop(); },
      step:  function () { stop(); advance(); },
      reset: function () { rebuild(); },
      destroy: function () { stop(); }
    };
  });

})(window.NetSim = window.NetSim || {});
