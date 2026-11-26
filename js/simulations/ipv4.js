/* ==========================================================================
   NetSim — simulations/ipv4.js   (rebuilt)
   Interactive IPv4 address analyser with:
   • SVG 32-bit address strip — each bit a clickable cell, colour-coded
     network (teal) vs host (amber) portions
   • Octet-level breakdown cards (decimal, binary, hex)
   • Classful class badge + range bar
   • Address properties panel (private, loopback, broadcast, etc.)
   • 6 preset addresses across all classes
   • Custom text input
   ========================================================================== */

(function (NetSim) {
  'use strict';

  /* ── helpers ─────────────────────────────────────────────────────────── */
  function toOctets(ip) {
    var parts = ip.split('.');
    if (parts.length !== 4) return null;
    var out = [];
    for (var i = 0; i < 4; i++) {
      if (!/^\d{1,3}$/.test(parts[i])) return null;
      var n = parseInt(parts[i], 10);
      if (isNaN(n) || n < 0 || n > 255) return null;
      out.push(n);
    }
    return out;
  }

  function toBin(n) {
    var s = n.toString(2);
    while (s.length < 8) s = '0' + s;
    return s;
  }

  function toHex(n) {
    var s = n.toString(16).toUpperCase();
    return s.length < 2 ? '0' + s : s;
  }

  function ipToInt(octets) {
    return octets[0] * 16777216 + octets[1] * 65536 + octets[2] * 256 + octets[3];
  }

  function intToIp(value) {
    return [Math.floor(value / 16777216), Math.floor(value / 65536) % 256, Math.floor(value / 256) % 256, value % 256].join('.');
  }

  function classify(first) {
    if (first < 128)  return { cls: 'A', mask: 8,  range: '0 – 127',   net: 'N.H.H.H' };
    if (first < 192)  return { cls: 'B', mask: 16, range: '128 – 191', net: 'N.N.H.H' };
    if (first < 224)  return { cls: 'C', mask: 24, range: '192 – 223', net: 'N.N.N.H' };
    if (first < 240)  return { cls: 'D', mask: null, range: '224 – 239', net: 'Multicast' };
    return { cls: 'E', mask: null, range: '240 – 255', net: 'Reserved' };
  }

  function maskStr(bits) {
    if (!bits) return 'N/A';
    var m = [];
    for (var i = 0; i < 4; i++) {
      if (bits >= 8) { m.push(255); bits -= 8; }
      else if (bits > 0) { m.push(256 - Math.pow(2, 8 - bits)); bits = 0; }
      else { m.push(0); }
    }
    return m.join('.');
  }

  function ipProps(octets) {
    var tags = [];
    var a = octets[0], b = octets[1];
    if (a === 10) tags.push('Private (10.0.0.0/8)');
    else if (a === 172 && b >= 16 && b <= 31) tags.push('Private (172.16.0.0/12)');
    else if (a === 192 && b === 168) tags.push('Private (192.168.0.0/16)');
    if (a === 127) tags.push('Loopback');
    if (a === 169 && b === 254) tags.push('Link-Local (APIPA)');
    if (octets[0] === 255 && octets[1] === 255 && octets[2] === 255 && octets[3] === 255) tags.push('Limited Broadcast');
    if (a === 0 && b === 0 && octets[2] === 0 && octets[3] === 0) tags.push('Default Route / Unspecified');
    if (a >= 224 && a <= 239) tags.push('Multicast');
    if (tags.length === 0) tags.push('Public / Routable');
    return tags;
  }

  /* ── presets ─────────────────────────────────────────────────────────── */
  var PRESETS = [
    { label: '192.168.1.10',   ip: '192.168.1.10',  tag: 'Class C / Private' },
    { label: '10.0.0.1',       ip: '10.0.0.1',      tag: 'Class A / Private' },
    { label: '172.16.5.100',   ip: '172.16.5.100',   tag: 'Class B / Private' },
    { label: '8.8.8.8',        ip: '8.8.8.8',        tag: 'Google DNS / Public' },
    { label: '224.0.0.1',      ip: '224.0.0.1',      tag: 'Multicast' },
    { label: '127.0.0.1',      ip: '127.0.0.1',      tag: 'Loopback' }
  ];

  /* ── colours ────────────────────────────────────────────────────────── */
  var C_NET  = '#0097a7';   /* teal  — network bits */
  var C_HOST = '#f9a825';   /* amber — host bits    */
  var C_FAINT = '#90a4ae';

  NetSim.SimRegistry.register('ipv4', function factory(ctx) {
    var ipStr  = PRESETS[0].ip;
    var prefix = 24;
    var preIdx = 0;
    var phases = [];
    var index  = -1;
    var timer  = null;
    var mount  = null;

    /* ── analysis ──────────────────────────────────────────────────────── */
    var info = null;

    function analyse() {
      var octets = toOctets(ipStr);
      if (!octets || prefix < 0 || prefix > 32 || prefix % 1 !== 0) return null;
      var bins = [];
      var hexs = [];
      for (var i = 0; i < 4; i++) { bins.push(toBin(octets[i])); hexs.push(toHex(octets[i])); }
      var ci = classify(octets[0]);
      var blockSize = Math.pow(2, 32 - prefix);
      var address = ipToInt(octets);
      var network = Math.floor(address / blockSize) * blockSize;
      var broadcast = network + blockSize - 1;
      var usable = prefix <= 30 ? Math.max(0, blockSize - 2) : prefix === 31 ? 2 : 1;
      return { octets: octets, bins: bins, hexs: hexs, ci: ci, props: ipProps(octets), prefix: prefix,
        mask: intToIp(4294967296 - blockSize), network: intToIp(network), broadcast: intToIp(broadcast),
        firstHost: prefix <= 30 ? intToIp(network + 1) : intToIp(network),
        lastHost: prefix <= 30 ? intToIp(broadcast - 1) : intToIp(broadcast), usable: usable };
    }

    /* ── phases ────────────────────────────────────────────────────────── */
    function buildPhases() {
      info = analyse();
      if (!info) return [{ t: 'Invalid IPv4 address — use four numbers 0–255 separated by dots.', lv: 'error', v: 'err' }];
      var ci = info.ci;
      var p = [];
      p.push({ t: 'Dotted-decimal address: ' + info.octets.join('.'), v: 'dec' });
      p.push({ t: 'Binary representation: ' + info.bins.join('.'), v: 'bin' });
      p.push({ t: 'CIDR prefix /' + info.prefix + ' means the first ' + info.prefix + ' bits identify the network; ' + (32 - info.prefix) + ' bits remain for hosts.', v: 'mask' });
      p.push({ t: 'Subnet mask: ' + info.mask + '. Network address: ' + info.network + '/' + info.prefix + '.', v: 'network' });
      p.push({ t: 'Broadcast: ' + info.broadcast + '. Usable addresses: ' + info.firstHost + ' – ' + info.lastHost + ' (' + info.usable + ' total).', v: 'host', lv: 'success' });
      p.push({ t: 'Historical classful range: Class ' + ci.cls + ' (' + ci.range + '); modern networks use the configured CIDR prefix instead.', v: 'cls' });
      p.push({ t: 'Properties: ' + info.props.join(', ') + '.', v: 'props', lv: 'success' });
      return p;
    }

    /* ── SVG 32-bit strip ─────────────────────────────────────────────── */
    function svgBitStrip() {
      if (!info) return '';
      var W = 740, cellW = 20, cellH = 28, gap = 2, oGap = 8;
      var totalW = 32 * (cellW + gap) + 3 * oGap;
      var svgW = Math.min(W, totalW + 20);
      var vb = '0 0 ' + (totalW + 20) + ' 80';
      var html = '<svg class="ip4-svg" viewBox="' + vb + '" preserveAspectRatio="xMidYMid meet">';

      var maskBits = info.prefix;
      var showSplit = index >= 2 && maskBits > 0;
      var x = 10;
      for (var o = 0; o < 4; o++) {
        for (var b = 0; b < 8; b++) {
          var gi = o * 8 + b;
          var bit = info.bins[o][b];
          var fill = '#fff';
          var stroke = C_FAINT;
          if (showSplit && gi < maskBits)  { fill = C_NET + '22'; stroke = C_NET; }
          if (showSplit && gi >= maskBits) { fill = C_HOST + '22'; stroke = C_HOST; }
          html += '<rect x="' + x + '" y="10" width="' + cellW + '" height="' + cellH + '" rx="3" fill="' + fill + '" stroke="' + stroke + '" stroke-width="1.5"/>';
          html += '<text x="' + (x + cellW / 2) + '" y="29" text-anchor="middle" font-family="var(--f-mono)" font-size="11" fill="var(--ink)">' + bit + '</text>';
          x += cellW + gap;
        }
        if (o < 3) {
          html += '<text x="' + (x + oGap / 2) + '" y="30" text-anchor="middle" font-size="14" fill="var(--ink-faint)">.</text>';
          x += oGap;
        }
      }

      /* legend */
      if (showSplit) {
        html += '<rect x="10" y="52" width="12" height="12" rx="2" fill="' + C_NET + '33" stroke="' + C_NET + '" stroke-width="1"/>';
        html += '<text x="26" y="62" font-size="10" fill="var(--ink)">Network (' + maskBits + ' bits)</text>';
        html += '<rect x="140" y="52" width="12" height="12" rx="2" fill="' + C_HOST + '33" stroke="' + C_HOST + '" stroke-width="1"/>';
        html += '<text x="156" y="62" font-size="10" fill="var(--ink)">Host (' + (32 - maskBits) + ' bits)</text>';
      }

      html += '</svg>';
      return html;
    }

    /* ── octet cards ──────────────────────────────────────────────────── */
    function octetCards() {
      if (!info) return '';
      var html = '<div class="ip4-octet-row">';
      for (var i = 0; i < 4; i++) {
        var hi = i === 0 && index >= 2 ? ' ip4-octet-hl' : '';
        html += '<div class="ip4-octet-card' + hi + '">' +
          '<div class="ip4-octet-dec">' + info.octets[i] + '</div>' +
          '<div class="ip4-octet-bin">' + info.bins[i] + '</div>' +
          '<div class="ip4-octet-hex">0x' + info.hexs[i] + '</div>' +
          '</div>';
      }
      html += '</div>';
      return html;
    }

    /* ── class range bar ──────────────────────────────────────────────── */
    function classBar() {
      if (!info) return '';
      var classes = [
        { c: 'A', lo: 0,   hi: 127, col: '#42a5f5' },
        { c: 'B', lo: 128, hi: 191, col: '#66bb6a' },
        { c: 'C', lo: 192, hi: 223, col: '#ffa726' },
        { c: 'D', lo: 224, hi: 239, col: '#ab47bc' },
        { c: 'E', lo: 240, hi: 255, col: '#ef5350' }
      ];
      var W = 700, H = 36, barH = 18, barY = 2;
      var html = '<svg class="ip4-svg" viewBox="0 0 ' + W + ' ' + H + '" preserveAspectRatio="xMidYMid meet">';
      for (var i = 0; i < classes.length; i++) {
        var cl = classes[i];
        var x1 = (cl.lo / 256) * W;
        var w  = ((cl.hi - cl.lo + 1) / 256) * W;
        var active = info.ci.cls.charAt(0) === cl.c;
        html += '<rect x="' + x1 + '" y="' + barY + '" width="' + w + '" height="' + barH + '" rx="3" fill="' + cl.col + (active ? '' : '44') + '" stroke="' + cl.col + '" stroke-width="' + (active ? 2 : 0.5) + '"/>';
        html += '<text x="' + (x1 + w / 2) + '" y="' + (barY + barH / 2 + 4) + '" text-anchor="middle" font-size="10" font-weight="' + (active ? '700' : '400') + '" fill="' + (active ? '#fff' : 'var(--ink-faint)') + '">' + cl.c + '</text>';
      }
      /* pointer for first octet */
      var ptrX = (info.octets[0] / 256) * W;
      html += '<polygon points="' + (ptrX - 4) + ',' + (barY + barH + 2) + ' ' + (ptrX + 4) + ',' + (barY + barH + 2) + ' ' + ptrX + ',' + (barY + barH - 2) + '" fill="var(--accent)"/>';
      html += '<text x="' + ptrX + '" y="' + (barY + barH + 14) + '" text-anchor="middle" font-size="9" fill="var(--accent)">' + info.octets[0] + '</text>';
      html += '</svg>';
      return html;
    }

    /* ── properties badge strip ───────────────────────────────────────── */
    function propBadges() {
      if (!info) return '';
      var html = '<div class="ip4-props">';
      for (var i = 0; i < info.props.length; i++) {
        html += '<span class="ip4-prop-badge">' + info.props[i] + '</span>';
      }
      html += '</div>';
      return html;
    }

    /* ── info box ─────────────────────────────────────────────────────── */
    function infoBox() {
      var ci = info ? info.ci : null;
      if (!ci) return '';
      var rows = [
        ['CIDR Network', info.network + '/' + info.prefix],
        ['Subnet Mask', info.mask],
        ['Broadcast', info.broadcast],
        ['Usable Hosts', String(info.usable)],
        ['Historical Class', ci.cls + ' (' + ci.range + ')'],
        ['Structure', info.prefix + ' network bits / ' + (32 - info.prefix) + ' host bits']
      ];
      var html = '<div class="ip4-info"><table class="ip4-info-tbl">';
      for (var i = 0; i < rows.length; i++) {
        html += '<tr><td class="ip4-info-lbl">' + rows[i][0] + '</td><td class="ip4-info-val">' + rows[i][1] + '</td></tr>';
      }
      html += '</table></div>';
      return html;
    }

    /* ── draw ──────────────────────────────────────────────────────────── */
    function draw() {
      var phase = phases[Math.max(0, index)];
      var html = '';
      if (phase.v === 'err') {
        html = '<p class="ip4-err">' + phase.t + '</p>';
      } else {
        html = svgBitStrip() + octetCards();
        if (index >= 2) html += classBar();
        if (index >= 3) html += infoBox();
        if (index >= 6) html += propBadges();
      }
      mount.innerHTML = html;

      if (info) {
        ctx.setMetrics([
          { label: 'Address', value: info.octets.join('.') },
          { label: 'Class', value: info.ci.cls },
          { label: 'Prefix', value: '/' + info.prefix },
          { label: 'Network', value: info.network },
          { label: 'Broadcast', value: info.broadcast },
          { label: 'Usable Hosts', value: String(info.usable) },
          { label: 'Type', value: info.props[0] }
        ]);
      }
    }

    /* ── params ────────────────────────────────────────────────────────── */
    function renderParams() {
      ctx.params.hidden = false;
      var html = '<div class="ip4-presets">';
      for (var i = 0; i < PRESETS.length; i++) {
        html += '<label class="switch-mode-option' + (i === preIdx ? ' is-checked' : '') + '">' +
          '<input type="radio" name="ip4pre" value="' + i + '"' + (i === preIdx ? ' checked' : '') + '> ' +
          '<strong>' + PRESETS[i].label + '</strong><br><span style="font-size:0.72rem;color:var(--ink-faint);">' + PRESETS[i].tag + '</span>' +
          '</label>';
      }
      html += '</div>';
      html += '<div class="ip4-custom"><label>IPv4 / prefix</label>' +
        '<input type="text" id="ip4Input" maxlength="18" value="' + ipStr + '/' + prefix + '" placeholder="e.g. 192.0.2.10/24"></div>';
      ctx.params.innerHTML = html;

      var radios = ctx.params.querySelectorAll('input[name="ip4pre"]');
      for (var i = 0; i < radios.length; i++) {
        radios[i].addEventListener('change', function (e) {
          preIdx = parseInt(e.target.value, 10);
          ipStr = PRESETS[preIdx].ip;
          rebuild();
        });
      }
      ctx.params.querySelector('#ip4Input').addEventListener('change', function (e) {
        var value = e.target.value.trim() || PRESETS[0].ip + '/24';
        var parts = value.split('/');
        ipStr = parts[0];
        if (parts.length === 2 && /^\d{1,2}$/.test(parts[1])) prefix = Number(parts[1]);
        else if (parts.length !== 1) prefix = -1;
        preIdx = -1;
        rebuild();
      });
    }

    /* ── lifecycle ─────────────────────────────────────────────────────── */
    function rebuild() {
      stop();
      index = -1;
      phases = buildPhases();
      renderParams();
      draw();
      ctx.log('Ready to analyse ' + ipStr + '.');
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
        ctx.canvas.innerHTML = '<div class="ip4-mount"></div>';
        mount = ctx.canvas.querySelector('.ip4-mount');
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
