/* ==========================================================================
   NetSim — simulations/cidr.js   (rebuilt)
   CIDR route aggregation with:
   • SVG binary prefix alignment grid — common bits highlighted teal
   • Visual supernet block diagram showing coverage
   • Exact vs over-coverage indicator
   • Routing table reduction visualisation
   • 4 presets covering exact, overshoot, and scattered scenarios
   • Slider for block count + text input for base
   ========================================================================== */

(function (NetSim) {
  'use strict';

  /* ── helpers ─────────────────────────────────────────────────────────── */
  function ipToInt(ip) {
    var p = ip.split('.');
    if (p.length !== 4) return null;
    var n = 0;
    for (var i = 0; i < 4; i++) {
      if (!/^\d{1,3}$/.test(p[i])) return null;
      var v = parseInt(p[i], 10);
      if (isNaN(v) || v < 0 || v > 255) return null;
      n = (n * 256 + v) >>> 0;
    }
    return n;
  }

  function intToIp(n) {
    return [(n >>> 24) & 255, (n >>> 16) & 255, (n >>> 8) & 255, n & 255].join('.');
  }

  function toBin32(n) {
    var s = (n >>> 0).toString(2);
    while (s.length < 32) s = '0' + s;
    return s;
  }

  function commonPrefix(bins) {
    var len = 0;
    while (len < 32) {
      var ch = bins[0][len];
      var same = true;
      for (var i = 1; i < bins.length; i++) {
        if (bins[i][len] !== ch) { same = false; break; }
      }
      if (!same) break;
      len++;
    }
    return len;
  }

  /* ── presets ─────────────────────────────────────────────────────────── */
  var PRESETS = [
    { label: '192.168.0.0 × 4', base: '192.168.0.0', count: 4, tag: 'Exact /22' },
    { label: '10.1.0.0 × 3',    base: '10.1.0.0',    count: 3, tag: 'Overshoot' },
    { label: '172.16.0.0 × 8',  base: '172.16.0.0',   count: 8, tag: 'Exact /21' },
    { label: '192.0.2.0 × 2',   base: '192.0.2.0',    count: 2, tag: 'Exact /23' }
  ];

  var C_PFX  = '#0097a7';
  var C_HOST = '#90a4ae';
  var C_OVER = '#ef5350';
  var C_OK   = '#66bb6a';

  NetSim.SimRegistry.register('cidr', function factory(ctx) {
    var baseIp     = PRESETS[0].base;
    var blockCount = PRESETS[0].count;
    var preIdx     = 0;
    var phases     = [];
    var index      = -1;
    var timer      = null;
    var mount      = null;
    var info       = null;

    /* ── compute ──────────────────────────────────────────────────────── */
    function compute() {
      var baseInt = ipToInt(baseIp);
      if (baseInt === null) return { error: 'Enter a valid IPv4 address with four octets from 0 to 255.' };
      if (blockCount < 2 || blockCount > 16 || blockCount % 1 !== 0) return { error: 'Choose between 2 and 16 contiguous /24 blocks.' };
      var baseNetworkInt = Math.floor(baseInt / 256) * 256;
      if (baseNetworkInt + blockCount * 256 > 4294967296) return { error: 'The requested /24 blocks extend beyond the IPv4 address space.' };
      var blocks = [];
      var bins   = [];
      for (var i = 0; i < blockCount; i++) {
        var net = baseNetworkInt + i * 256;
        blocks.push({ net: net, label: intToIp(net) + '/24' });
        bins.push(toBin32(net));
      }
      var pfx = commonPrefix(bins);
      var aggNet = pfx === 0 ? 0 : (baseNetworkInt & ((~0 << (32 - pfx)) >>> 0)) >>> 0;
      var aggSize = Math.pow(2, 32 - pfx);
      var covered = aggSize / 256;
      var overBefore = (baseNetworkInt - aggNet) / 256;
      var overAfter = covered - blockCount - overBefore;
      var exact = aggNet === baseNetworkInt && covered === blockCount;
      return { blocks: blocks, bins: bins, pfx: pfx, aggNet: aggNet, aggEnd: aggNet + aggSize - 1,
               agg: intToIp(aggNet) + '/' + pfx, aggSize: aggSize,
               covered: covered, exact: exact, baseNetwork: intToIp(baseNetworkInt), baseNetworkInt: baseNetworkInt,
               inputAddress: baseIp, overBefore: overBefore, overAfter: overAfter };
    }

    function buildPhases() {
      info = compute();
      if (!info || info.error) return [{ t: info ? info.error : 'Invalid base IP address.', lv: 'error', v: 'err' }];
      var p = [];
      p.push({ t: blockCount + ' contiguous /24 blocks starting at ' + info.baseNetwork + '.' + (info.inputAddress !== info.baseNetwork ? ' Host bits in the entered address were cleared to align to the /24 network.' : ''), v: 'list' });
      p.push({ t: 'Binary network addresses — aligning to find the common prefix…', v: 'bin' });
      p.push({ t: 'Common prefix length: ' + info.pfx + ' bits (teal).', v: 'pfx' });
      p.push({ t: 'Aggregate supernet: ' + info.agg + (info.exact
        ? ' — covers exactly ' + blockCount + ' blocks.'
        : ' — spans ' + info.covered + ' /24 blocks (+' + info.overBefore + ' before, +' + info.overAfter + ' after).'),
        v: 'agg', lv: info.exact ? 'success' : 'warning' });
      p.push({ t: 'Routing table: ' + blockCount + ' entries → 1 entry.  Reduction: ' +
        Math.round((1 - 1 / blockCount) * 100) + '%.', v: 'route', lv: 'success' });
      return p;
    }

    /* ── SVG binary grid ──────────────────────────────────────────────── */
    function svgBinGrid() {
      if (!info) return '';
      var cellW = 16, cellH = 18, gap = 1, rowGap = 4, padX = 120, padY = 10;
      var rows = info.blocks.length;
      var W = padX + 32 * (cellW + gap) + 20;
      var H = padY + rows * (cellH + rowGap) + 10;
      var showPfx = index >= 2;

      var html = '<svg class="cidr-svg" viewBox="0 0 ' + W + ' ' + H + '" preserveAspectRatio="xMidYMid meet">';

      for (var r = 0; r < rows; r++) {
        var y = padY + r * (cellH + rowGap);
        /* label */
        html += '<text x="' + (padX - 6) + '" y="' + (y + cellH / 2 + 4) + '" text-anchor="end" font-family="var(--f-mono)" font-size="10" fill="var(--ink)">' + info.blocks[r].label + '</text>';
        /* bits */
        for (var b = 0; b < 32; b++) {
          var x = padX + b * (cellW + gap);
          var bit = info.bins[r][b];
          var inPfx = showPfx && b < info.pfx;
          var fill  = inPfx ? C_PFX + '22' : '#fff';
          var stroke = inPfx ? C_PFX : '#ddd';
          html += '<rect x="' + x + '" y="' + y + '" width="' + cellW + '" height="' + cellH + '" rx="2" fill="' + fill + '" stroke="' + stroke + '" stroke-width="1"/>';
          html += '<text x="' + (x + cellW / 2) + '" y="' + (y + cellH / 2 + 4) + '" text-anchor="middle" font-family="var(--f-mono)" font-size="9" fill="' + (inPfx ? C_PFX : 'var(--ink-faint)') + '">' + bit + '</text>';
        }
      }

      /* prefix boundary line */
      if (showPfx && info.pfx < 32) {
        var lineX = padX + info.pfx * (cellW + gap) - gap / 2;
        html += '<line x1="' + lineX + '" y1="' + (padY - 4) + '" x2="' + lineX + '" y2="' + (padY + rows * (cellH + rowGap)) + '" stroke="' + C_PFX + '" stroke-width="2" stroke-dasharray="4,3"/>';
        html += '<text x="' + lineX + '" y="' + (padY - 6) + '" text-anchor="middle" font-size="9" fill="' + C_PFX + '">/' + info.pfx + '</text>';
      }

      html += '</svg>';
      return html;
    }

    /* ── coverage block diagram ───────────────────────────────────────── */
    function coverageDiagram() {
      if (!info || index < 3) return '';
      var total = info.covered;
      var barW = 600, barH = 32;
      var html = '<div class="cidr-coverage">';
      html += '<svg class="cidr-svg" viewBox="0 0 ' + (barW + 40) + ' 70" preserveAspectRatio="xMidYMid meet">';

      /* full aggregate bar */
      html += '<rect x="20" y="10" width="' + barW + '" height="' + barH + '" rx="4" fill="' + (info.exact ? C_OK : C_OVER) + '22" stroke="' + (info.exact ? C_OK : C_OVER) + '" stroke-width="1.5"/>';
      html += '<text x="' + (20 + barW / 2) + '" y="30" text-anchor="middle" font-size="11" fill="var(--ink)">' + info.agg + '  (' + info.covered + ' /24s)</text>';

      /* actual blocks overlay */
      var usedW = (blockCount / total) * barW;
      var offsetW = (info.overBefore / total) * barW;
      html += '<rect x="' + (20 + offsetW) + '" y="10" width="' + usedW + '" height="' + barH + '" rx="4" fill="' + C_PFX + '33" stroke="' + C_PFX + '" stroke-width="1.5"/>';

      /* labels */
      html += '<text x="' + (20 + offsetW + usedW / 2) + '" y="58" text-anchor="middle" font-size="9" fill="' + C_PFX + '">Your ' + blockCount + ' blocks</text>';
      if (info.overBefore > 0) html += '<text x="20" y="58" font-size="9" fill="' + C_OVER + '">+' + info.overBefore + ' before</text>';
      if (info.overAfter > 0) html += '<text x="620" y="58" text-anchor="end" font-size="9" fill="' + C_OVER + '">+' + info.overAfter + ' after</text>';
      html += '</svg></div>';
      return html;
    }

    function aggregateSummary() {
      if (!info || index < 3) return '';
      var detail = info.exact ? 'This route covers exactly the requested blocks.' :
        'It also covers ' + (info.overBefore + info.overAfter) + ' extra /24 block(s): ' + info.overBefore + ' before and ' + info.overAfter + ' after.';
      return '<section class="cidr-summary"><div><span>Longest common prefix</span><strong>/' + info.pfx + '</strong></div>' +
        '<div><span>Aggregate route</span><strong>' + info.agg + '</strong></div>' +
        '<div><span>Address range covered</span><strong>' + intToIp(info.aggNet) + ' – ' + intToIp(info.aggEnd) + '</strong></div><p>' + detail + '</p></section>';
    }

    /* ── routing reduction ────────────────────────────────────────────── */
    function routeReduction() {
      if (!info || index < 4) return '';
      var html = '<div class="cidr-route-box">';
      html += '<div class="cidr-route-side"><div class="cidr-route-title">Before</div>';
      for (var i = 0; i < info.blocks.length; i++) {
        html += '<div class="cidr-route-entry">' + info.blocks[i].label + '</div>';
      }
      html += '</div>';
      html += '<div class="cidr-route-arrow">→</div>';
      html += '<div class="cidr-route-side"><div class="cidr-route-title">After</div>';
      html += '<div class="cidr-route-entry cidr-route-agg">' + info.agg + '</div>';
      html += '</div></div>';
      return html;
    }

    /* ── draw ──────────────────────────────────────────────────────────── */
    function draw() {
      var phase = phases[Math.max(0, index)];
      if (phase.v === 'err') {
        mount.innerHTML = '<p class="cidr-err">' + phase.t + '</p>';
        ctx.setMetrics([]);
        return;
      }
      mount.innerHTML = aggregateSummary() + svgBinGrid() + coverageDiagram() + routeReduction();

      ctx.setMetrics([
        { label: 'Individual Blocks', value: String(blockCount) },
        { label: 'Common Prefix', value: '/' + info.pfx },
        { label: 'Aggregate', value: info.agg },
        { label: 'Coverage', value: info.exact ? 'Exact' : info.covered + ' /24s (+' + info.overBefore + ' before, +' + info.overAfter + ' after)' },
        { label: 'Routing Entries', value: blockCount + ' → 1' },
        { label: 'Reduction', value: Math.round((1 - 1 / blockCount) * 100) + '%' }
      ]);
    }

    /* ── params ────────────────────────────────────────────────────────── */
    function renderParams() {
      ctx.params.hidden = false;
      var html = '<div class="cidr-presets">';
      for (var i = 0; i < PRESETS.length; i++) {
        html += '<label class="switch-mode-option' + (i === preIdx ? ' is-checked' : '') + '">' +
          '<input type="radio" name="cidrpre" value="' + i + '"' + (i === preIdx ? ' checked' : '') + '> ' +
          '<strong>' + PRESETS[i].label + '</strong><br><span style="font-size:0.72rem;color:var(--ink-faint);">' + PRESETS[i].tag + '</span>' +
          '</label>';
      }
      html += '</div>';
      html += '<div class="cidr-custom">';
      html += '<div class="sim-param-row"><label>First /24 block</label><input type="text" id="cidrBase" maxlength="15" value="' + baseIp + '" placeholder="e.g. 192.168.0.0"></div>';
      html += '<div class="sim-param-row"><label>Block Count</label>' +
        '<input type="range" id="cidrCount" min="2" max="16" step="1" value="' + blockCount + '">' +
        '<span class="val" id="cidrCountVal">' + blockCount + '</span></div>';
      html += '</div>';
      ctx.params.innerHTML = html;

      var radios = ctx.params.querySelectorAll('input[name="cidrpre"]');
      for (var i = 0; i < radios.length; i++) {
        radios[i].addEventListener('change', function (e) {
          preIdx = parseInt(e.target.value, 10);
          baseIp = PRESETS[preIdx].base;
          blockCount = PRESETS[preIdx].count;
          rebuild();
        });
      }
      ctx.params.querySelector('#cidrBase').addEventListener('change', function (e) {
        baseIp = e.target.value.trim() || '192.168.0.0';
        preIdx = -1; rebuild();
      });
      var slider = ctx.params.querySelector('#cidrCount');
      slider.addEventListener('input', function (e) {
        ctx.params.querySelector('#cidrCountVal').textContent = e.target.value;
      });
      slider.addEventListener('change', function (e) {
        blockCount = parseInt(e.target.value, 10);
        preIdx = -1; rebuild();
      });
    }

    /* ── lifecycle ─────────────────────────────────────────────────────── */
    function rebuild() {
      stop(); index = -1;
      phases = buildPhases();
      renderParams(); draw();
      ctx.log('Ready to aggregate ' + blockCount + ' blocks starting at ' + baseIp + '.');
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
        ctx.canvas.innerHTML = '<div class="cidr-mount"></div>';
        mount = ctx.canvas.querySelector('.cidr-mount');
        rebuild();
      },
      start: function () {
        if (timer) return;
        timer = NetSim.SimTiming.setInterval(function () {
          if (index >= phases.length - 1) { stop(); return; }
          advance();
        }, 800);
      },
      pause: function () { stop(); },
      step:  function () { stop(); advance(); },
      reset: function () { rebuild(); },
      destroy: function () { stop(); }
    };
  });

})(window.NetSim = window.NetSim || {});
