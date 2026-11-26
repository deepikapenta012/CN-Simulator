/* ==========================================================================
   NetSim — simulations/subnetting.js   (rebuilt)
   Interactive subnetting calculator with:
   • SVG 32-bit address strip — original mask, borrowed bits, host bits
   • Visual subnet map (colour-coded blocks)
   • Per-subnet detail cards (network, first/last host, broadcast)
   • Address utilisation bar
   • 4 presets + custom base/prefix/count controls
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

  function maskStr(bits) {
    var m = [];
    for (var i = 0; i < 4; i++) {
      var b = Math.min(8, Math.max(0, bits));
      m.push(b === 8 ? 255 : b > 0 ? 256 - Math.pow(2, 8 - b) : 0);
      bits -= 8;
    }
    return m.join('.');
  }

  /* ── presets ─────────────────────────────────────────────────────────── */
  var PRESETS = [
    { label: '192.168.1.0/24 ÷ 4', base: '192.168.1.0', pfx: 24, num: 4, tag: 'Borrow 2 bits → /26 subnets' },
    { label: '10.0.0.0/8 ÷ 4',      base: '10.0.0.0',    pfx: 8,  num: 4, tag: 'Borrow 2 bits → /10 subnets' },
    { label: '172.16.0.0/16 ÷ 8',   base: '172.16.0.0',  pfx: 16, num: 8, tag: 'Borrow 3 bits → /19 subnets' },
    { label: '192.168.10.0/24 ÷ 2',  base: '192.168.10.0', pfx: 24, num: 2, tag: 'Simple bisection' }
  ];

  var COLS = ['#42a5f5', '#66bb6a', '#ffa726', '#ab47bc', '#ef5350', '#26c6da', '#ec407a', '#8d6e63',
              '#5c6bc0', '#9ccc65', '#ffca28', '#78909c', '#7e57c2', '#29b6f6', '#d4e157', '#ff7043'];

  NetSim.SimRegistry.register('subnetting', function factory(ctx) {
    var baseIp     = PRESETS[0].base;
    var basePrefix = PRESETS[0].pfx;
    var numSubnets = PRESETS[0].num;
    var preIdx     = 0;
    var phases     = [];
    var index      = -1;
    var timer      = null;
    var mount      = null;
    var info       = null;

    /* ── compute ──────────────────────────────────────────────────────── */
    function compute() {
      var baseInt = ipToInt(baseIp);
      if (baseInt === null) return { error: 'Invalid base IP address.' };
      if (basePrefix < 0 || basePrefix > 30 || basePrefix % 1 !== 0) return { error: 'Choose a CIDR prefix from /0 through /30.' };
      var avail = 32 - basePrefix;
      var needed = 0;
      while (Math.pow(2, needed) < Math.max(2, numSubnets)) needed++;
      if (needed > avail) return { error: 'Not enough host bits in /' + basePrefix + ' to carve ' + numSubnets + ' subnets (' + avail + ' available, need ' + needed + ').' };
      var newPfx = basePrefix + needed;
      var subSize = Math.pow(2, 32 - newPfx);
      var maxPoss = Math.pow(2, needed);
      var totalAddrs = Math.pow(2, 32 - basePrefix);
      var baseNetwork = Math.floor(baseInt / totalAddrs) * totalAddrs;
      var subs = [];
      for (var i = 0; i < Math.min(numSubnets, maxPoss); i++) {
        var net = baseNetwork + i * subSize;
        subs.push({
          network:   intToIp(net) + '/' + newPfx,
          netAddr:   intToIp(net),
          first:     intToIp(newPfx >= 31 ? net : net + 1),
          last:      intToIp(newPfx >= 31 ? net + subSize - 1 : net + subSize - 2),
          broadcast: newPfx === 31 ? 'None (/31 point-to-point)' : newPfx === 32 ? 'None (/32 host route)' : intToIp(net + subSize - 1),
          col: COLS[i % COLS.length]
        });
      }
      return { needed: needed, newPfx: newPfx, subSize: subSize, baseNetwork: intToIp(baseNetwork),
               usable: newPfx === 31 ? 2 : newPfx === 32 ? 1 : subSize - 2, subs: subs, maxPoss: maxPoss,
               totalAddrs: totalAddrs, inputAddress: baseIp };
    }

    function buildPhases() {
      info = compute();
      if (info.error) return [{ t: info.error, lv: 'error', v: 'err' }];
      var p = [];
      p.push({ t: 'CIDR block ' + info.baseNetwork + '/' + basePrefix + ' contains ' + info.totalAddrs + ' addresses. Need ' + numSubnets + ' equal-size subnets.' + (info.inputAddress !== info.baseNetwork ? ' Host bits in ' + info.inputAddress + ' are cleared to find the network boundary.' : ''), v: 'base' });
      p.push({ t: 'Borrow ' + info.needed + ' bit(s) from the host portion:  /' + basePrefix + ' + ' + info.needed + ' = /' + info.newPfx + '.', v: 'borrow' });
      p.push({ t: 'Each /' + info.newPfx + ' subnet has mask ' + maskStr(info.newPfx) + ', ' + info.subSize + ' total addresses, and ' + info.usable + ' usable hosts.', v: 'size' });
      for (var i = 0; i < info.subs.length; i++) {
        var s = info.subs[i];
        p.push({ t: 'Subnet ' + (i + 1) + ': ' + s.network + '  hosts ' + s.first + ' – ' + s.last + '  bcast ' + s.broadcast, v: 'sub', idx: i });
      }
      p.push({ t: 'All ' + numSubnets + ' subnets carved.  ' + (info.maxPoss > numSubnets ? (info.maxPoss - numSubnets) + ' more possible with /' + info.newPfx + '.' : 'No wasted subnet slots.'), v: 'done', lv: 'success' });
      return p;
    }

    /* ── SVG bit strip ────────────────────────────────────────────────── */
    function svgBitStrip() {
      if (!info || info.error) return '';
      var cellW = 18, cellH = 26, gap = 1, pad = 10;
      var W = pad * 2 + 32 * (cellW + gap);
      var H = 65;
      var showBorrow = index >= 1;

      var html = '<svg class="sub-svg" viewBox="0 0 ' + W + ' ' + H + '" preserveAspectRatio="xMidYMid meet">';

      for (var b = 0; b < 32; b++) {
        var x = pad + b * (cellW + gap);
        var fill, stroke, label;
        if (b < basePrefix) {
          fill = '#0097a722'; stroke = '#0097a7'; label = 'N';
        } else if (showBorrow && b < info.newPfx) {
          fill = '#f9a82533'; stroke = '#f9a825'; label = 'S';
        } else {
          fill = '#fff'; stroke = '#ccc'; label = 'H';
        }
        html += '<rect x="' + x + '" y="6" width="' + cellW + '" height="' + cellH + '" rx="3" fill="' + fill + '" stroke="' + stroke + '" stroke-width="1.2"/>';
        html += '<text x="' + (x + cellW / 2) + '" y="24" text-anchor="middle" font-size="10" font-family="var(--f-mono)" fill="var(--ink)">' + label + '</text>';
      }

      /* legend */
      var items = [
        { col: '#0097a7', lab: 'Network (' + basePrefix + ')' },
        { col: '#f9a825', lab: 'Subnet (' + info.needed + ')' },
        { col: '#ccc', lab: 'Host (' + (32 - info.newPfx) + ')' }
      ];
      var lx = pad;
      for (var i = 0; i < items.length; i++) {
        html += '<rect x="' + lx + '" y="42" width="10" height="10" rx="2" fill="' + items[i].col + '44" stroke="' + items[i].col + '" stroke-width="1"/>';
        html += '<text x="' + (lx + 14) + '" y="51" font-size="9" fill="var(--ink)">' + items[i].lab + '</text>';
        lx += 14 + items[i].lab.length * 5.5 + 16;
      }

      html += '</svg>';
      return html;
    }

    /* ── subnet map (coloured blocks) ─────────────────────────────────── */
    function subnetMap() {
      if (!info || info.error || index < 2) return '';
      var revealed = 0;
      for (var i = 0; i <= index && i < phases.length; i++) {
        if (phases[i].v === 'sub') revealed++;
      }
      if (revealed === 0) return '';

      var W = 640, blockH = 24, gap = 3, pad = 10;
      var H = pad * 2 + revealed * (blockH + gap);
      var html = '<svg class="sub-svg" viewBox="0 0 ' + W + ' ' + H + '" preserveAspectRatio="xMidYMid meet">';

      for (var i = 0; i < revealed; i++) {
        var s = info.subs[i];
        var y = pad + i * (blockH + gap);
        var w = W - 2 * pad;
        html += '<rect x="' + pad + '" y="' + y + '" width="' + w + '" height="' + blockH + '" rx="4" fill="' + s.col + '33" stroke="' + s.col + '" stroke-width="1.5"/>';
        var txt = 'Subnet ' + (i + 1) + ': ' + s.network;
        html += '<text x="' + (pad + 8) + '" y="' + (y + blockH / 2 + 4) + '" font-size="10" font-family="var(--f-mono)" fill="var(--ink)">' + txt + '</text>';
      }

      html += '</svg>';
      return html;
    }

    function subnetDetails() {
      if (!info || info.error || index < 2) return '';
      var revealed = 0;
      for (var i = 0; i <= index && i < phases.length; i++) if (phases[i].v === 'sub') revealed++;
      if (!revealed) return '';
      var html = '<div class="sub-details">';
      for (var i = 0; i < revealed; i++) {
        var s = info.subs[i];
        html += '<article class="sub-detail" style="--sub-color:' + s.col + '"><h3>Subnet ' + (i + 1) + ' <code>' + s.network + '</code></h3>' +
          '<dl><div><dt>Network</dt><dd>' + s.netAddr + '</dd></div><div><dt>Usable hosts</dt><dd>' + s.first + ' – ' + s.last + '</dd></div><div><dt>Broadcast</dt><dd>' + s.broadcast + '</dd></div></dl></article>';
      }
      html += '</div>';
      return html;
    }

    /* ── utilisation bar ──────────────────────────────────────────────── */
    function utilBar() {
      if (!info || info.error || index < phases.length - 1) return '';
      var used = numSubnets * info.subSize;
      var total = info.totalAddrs;
      var pct = Math.round((used / total) * 100);
      var html = '<div class="sub-util">';
      html += '<div class="sub-util-label">Address utilisation: ' + used + ' / ' + total + ' (' + pct + '%)</div>';
      html += '<div class="sub-util-track"><div class="sub-util-fill" style="width:' + pct + '%;"></div></div>';
      html += '</div>';
      return html;
    }

    /* ── draw ──────────────────────────────────────────────────────────── */
    function draw() {
      var phase = phases[Math.max(0, index)];
      if (phase.v === 'err') {
        mount.innerHTML = '<p class="sub-err">' + phase.t + '</p>';
        ctx.setMetrics([]);
        return;
      }
      mount.innerHTML = svgBitStrip() + subnetMap() + subnetDetails() + utilBar();

      var revealed = 0;
      for (var i = 0; i <= index && i < phases.length; i++) {
        if (phases[i].v === 'sub') revealed++;
      }
      ctx.setMetrics([
        { label: 'Base Network', value: info.baseNetwork + '/' + basePrefix },
        { label: 'New Prefix', value: '/' + info.newPfx },
        { label: 'Bits Borrowed', value: String(info.needed) },
        { label: 'Subnet Mask', value: maskStr(info.newPfx) },
        { label: 'Addresses / Subnet', value: String(info.subSize) },
        { label: 'Usable Hosts', value: String(info.usable) },
        { label: 'Subnets Shown', value: revealed + ' / ' + info.subs.length }
      ]);
    }

    /* ── params ────────────────────────────────────────────────────────── */
    function renderParams() {
      ctx.params.hidden = false;
      var html = '<div class="sub-presets">';
      for (var i = 0; i < PRESETS.length; i++) {
        html += '<label class="switch-mode-option' + (i === preIdx ? ' is-checked' : '') + '">' +
          '<input type="radio" name="subpre" value="' + i + '"' + (i === preIdx ? ' checked' : '') + '> ' +
          '<strong>' + PRESETS[i].label + '</strong><br><span style="font-size:0.72rem;color:var(--ink-faint);">' + PRESETS[i].tag + '</span>' +
          '</label>';
      }
      html += '</div>';
      html += '<div class="sub-custom">';
      html += '<div class="sim-param-row"><label>Base network / prefix</label><input type="text" id="subBase" maxlength="18" value="' + baseIp + '/' + basePrefix + '" placeholder="e.g. 192.168.1.0/24"></div>';
      html += '<div class="sim-param-row"><label>Subnets Needed</label>' +
        '<input type="range" id="subCount" min="2" max="16" step="1" value="' + numSubnets + '">' +
        '<span class="val" id="subCountVal">' + numSubnets + '</span></div>';
      html += '</div>';
      ctx.params.innerHTML = html;

      var radios = ctx.params.querySelectorAll('input[name="subpre"]');
      for (var i = 0; i < radios.length; i++) {
        radios[i].addEventListener('change', function (e) {
          preIdx = parseInt(e.target.value, 10);
          baseIp = PRESETS[preIdx].base;
          basePrefix = PRESETS[preIdx].pfx;
          numSubnets = PRESETS[preIdx].num;
          rebuild();
        });
      }
      ctx.params.querySelector('#subBase').addEventListener('change', function (e) {
        var parts = e.target.value.trim().split('/');
        baseIp = parts[0] || '192.168.1.0';
        basePrefix = parts.length === 2 && /^\d{1,2}$/.test(parts[1]) ? Number(parts[1]) : parts.length === 1 ? 24 : -1;
        preIdx = -1; rebuild();
      });
      var slider = ctx.params.querySelector('#subCount');
      slider.addEventListener('input', function (e) {
        ctx.params.querySelector('#subCountVal').textContent = e.target.value;
      });
      slider.addEventListener('change', function (e) {
        numSubnets = parseInt(e.target.value, 10);
        preIdx = -1; rebuild();
      });
    }

    /* ── lifecycle ─────────────────────────────────────────────────────── */
    function rebuild() {
      stop(); index = -1;
      phases = buildPhases();
      renderParams(); draw();
      ctx.log('Ready to split ' + baseIp + '/' + basePrefix + ' into ' + numSubnets + ' subnets.');
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
        ctx.canvas.innerHTML = '<div class="sub-mount"></div>';
        mount = ctx.canvas.querySelector('.sub-mount');
        rebuild();
      },
      start: function () {
        if (timer) return;
        timer = NetSim.SimTiming.setInterval(function () {
          if (index >= phases.length - 1) { stop(); return; }
          advance();
        }, 700);
      },
      pause: function () { stop(); },
      step:  function () { stop(); advance(); },
      reset: function () { rebuild(); },
      destroy: function () { stop(); }
    };
  });

})(window.NetSim = window.NetSim || {});
