/* ==========================================================================
   NetSim — simulations/encoding.js
   Interactive Character Encoding simulation:
     - Live byte-grid showing each character's encoded bytes
     - UTF-8 vs UTF-16 side-by-side comparison
     - Code-point breakdown with binary representation
     - Byte-count bar chart
     - Editable input text with preset samples
   ========================================================================== */

(function (NetSim) {
  'use strict';

  var PRESETS = {
    ascii:   { label: 'ASCII Only',     text: 'Hello, network!' },
    latin:   { label: 'Latin Extended',  text: 'café résumé naïve' },
    emoji:   { label: 'Emoji & CJK',    text: '🌐 网络 ネット 🔒' },
    mixed:   { label: 'Mixed Script',   text: 'Hello 世界! 🎉 Ölü' },
    custom:  { label: 'Custom',         text: 'Type here...' }
  };

  /* ---- Encoding helpers ---- */
  function toUTF8(text) {
    return Array.from(new TextEncoder().encode(text));
  }

  function toUTF16(text) {
    var units = [];
    for (var i = 0; i < text.length; i++) {
      var code = text.charCodeAt(i);
      units.push((code >> 8) & 0xFF);
      units.push(code & 0xFF);
    }
    return units;
  }

  function getCodePoints(text) {
    var pts = [];
    for (var i = 0; i < text.length; ) {
      var cp = text.codePointAt(i);
      pts.push(cp);
      i += cp > 0xFFFF ? 2 : 1;
    }
    return pts;
  }

  function utf8BytesForCodePoint(cp) {
    if (cp <= 0x7F) return 1;
    if (cp <= 0x7FF) return 2;
    if (cp <= 0xFFFF) return 3;
    return 4;
  }

  function utf16UnitsForCodePoint(cp) {
    return cp > 0xFFFF ? 2 : 1;
  }

  /* ---- Render byte grid for one encoding ---- */
  function renderByteGrid(text, encoding) {
    var codePoints = getCodePoints(text);
    var colors = ['#1565c0', '#2e7d32', '#e65100', '#6a1b9a', '#c62828', '#00838f', '#ad1457', '#4527a0'];

    var html = '<div class="enc-grid">';
    html += '<div class="enc-grid-title">' + (encoding === 'utf-8' ? 'UTF-8' : 'UTF-16BE') + (encoding === 'utf-8' ? ' Encoding' : ' Code Units (big-endian bytes, no BOM)') + '</div>';
    html += '<table class="enc-grid-table"><thead><tr>';
    html += '<th>Char</th><th>Code Point</th><th>Bytes</th><th>Hex</th><th>Binary</th>';
    html += '</tr></thead><tbody>';

    var totalBytes = 0;
    codePoints.forEach(function (cp, idx) {
      var ch = String.fromCodePoint(cp);
      var color = colors[idx % colors.length];
      var bytes, byteCount;

      if (encoding === 'utf-8') {
        byteCount = utf8BytesForCodePoint(cp);
        // Get the actual UTF-8 bytes for this character
        bytes = Array.from(new TextEncoder().encode(ch));
      } else {
        byteCount = utf16UnitsForCodePoint(cp) * 2;
        bytes = [];
        if (cp > 0xFFFF) {
          var hi = 0xD800 + ((cp - 0x10000) >> 10);
          var lo = 0xDC00 + ((cp - 0x10000) & 0x3FF);
          bytes.push((hi >> 8) & 0xFF, hi & 0xFF, (lo >> 8) & 0xFF, lo & 0xFF);
        } else {
          bytes.push((cp >> 8) & 0xFF, cp & 0xFF);
        }
      }
      totalBytes += byteCount;

      var hexStr = bytes.map(function (b) { return b.toString(16).toUpperCase().padStart(2, '0'); }).join(' ');
      var binStr = bytes.map(function (b) { return b.toString(2).padStart(8, '0'); }).join(' ');

      html += '<tr>';
      html += '<td><span class="enc-char" style="border-color:' + color + '">' + (ch === ' ' ? '␣' : ch.replace(/</g, '&lt;')) + '</span></td>';
      html += '<td class="enc-cp">U+' + cp.toString(16).toUpperCase().padStart(4, '0') + '</td>';
      html += '<td class="enc-bc" style="color:' + color + '">' + byteCount + '</td>';
      html += '<td class="enc-hex">';
      bytes.forEach(function (b) {
        html += '<span class="enc-byte" style="background:' + color + '">' + b.toString(16).toUpperCase().padStart(2, '0') + '</span>';
      });
      html += '</td>';
      html += '<td class="enc-bin">' + binStr + '</td>';
      html += '</tr>';
    });

    html += '</tbody></table>';
    html += '<div class="enc-grid-total">Total: ' + totalBytes + ' bytes for ' + codePoints.length + ' character' + (codePoints.length !== 1 ? 's' : '') + '</div>';
    html += '</div>';
    return { html: html, totalBytes: totalBytes, charCount: codePoints.length };
  }

  /* ---- SVG byte-count comparison bar chart ---- */
  function renderBarChart(utf8Bytes, utf16Bytes) {
    var maxVal = Math.max(utf8Bytes, utf16Bytes, 1);
    var W = 560, H = 110, barH = 28, pad = 90;

    var svg = '<svg class="enc-chart-svg" viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="Byte count comparison">';

    var w8 = (W - pad - 60) * (utf8Bytes / maxVal);
    var w16 = (W - pad - 60) * (utf16Bytes / maxVal);

    svg += '<text x="' + (pad - 5) + '" y="28" text-anchor="end" class="enc-chart-label" fill="#1565c0">UTF-8</text>';
    svg += '<rect x="' + pad + '" y="12" width="' + w8 + '" height="' + barH + '" rx="4" fill="#1565c0" fill-opacity="0.75"/>';
    svg += '<text x="' + (pad + w8 + 6) + '" y="32" class="enc-chart-val" fill="#1565c0">' + utf8Bytes + 'B</text>';

    svg += '<text x="' + (pad - 5) + '" y="68" text-anchor="end" class="enc-chart-label" fill="#e65100">UTF-16BE</text>';
    svg += '<rect x="' + pad + '" y="52" width="' + w16 + '" height="' + barH + '" rx="4" fill="#e65100" fill-opacity="0.75"/>';
    svg += '<text x="' + (pad + w16 + 6) + '" y="72" class="enc-chart-val" fill="#e65100">' + utf16Bytes + 'B</text>';

    var ratio = utf16Bytes > 0 ? (utf8Bytes / utf16Bytes * 100).toFixed(0) : '—';
    svg += '<text x="' + (W / 2) + '" y="104" text-anchor="middle" class="enc-chart-note">UTF-8 is ' + ratio + '% of UTF-16BE size (BOM excluded)</text>';

    svg += '</svg>';
    return svg;
  }

  /* ---- Encoding rules info ---- */
  function renderRules() {
    var html = '<div class="enc-rules">';
    html += '<div class="enc-rules-col"><h4 class="enc-rules-title">UTF-8 — Variable Length (1–4 bytes)</h4>';
    html += '<table class="enc-rules-table"><tr><th>Range</th><th>Bytes</th><th>Bit Pattern</th></tr>';
    html += '<tr><td>U+0000–007F</td><td>1</td><td><code>0xxxxxxx</code></td></tr>';
    html += '<tr><td>U+0080–07FF</td><td>2</td><td><code>110xxxxx 10xxxxxx</code></td></tr>';
    html += '<tr><td>U+0800–D7FF, E000–FFFF</td><td>3</td><td><code>1110xxxx 10xxxxxx 10xxxxxx</code></td></tr>';
    html += '<tr><td>U+10000–10FFFF</td><td>4</td><td><code>11110xxx 10xxxxxx 10xxxxxx 10xxxxxx</code></td></tr>';
    html += '</table></div>';
    html += '<div class="enc-rules-col"><h4 class="enc-rules-title">UTF-16 — 2 or 4 bytes</h4>';
    html += '<table class="enc-rules-table"><tr><th>Range</th><th>Units</th><th>Mechanism</th></tr>';
    html += '<tr><td>U+0000–D7FF, E000–FFFF</td><td>1 (2B)</td><td>Direct code unit</td></tr>';
    html += '<tr><td>U+10000–10FFFF</td><td>2 (4B)</td><td>Surrogate pair (D800–DBFF, DC00–DFFF)</td></tr>';
    html += '</table><p class="enc-rules-note">Comparison uses UTF-16 big-endian bytes and excludes a byte-order mark (BOM). Real files can use UTF-16LE or UTF-16BE.</p></div>';
    html += '</div>';
    return html;
  }

  /* ==== Main simulation ==== */
  NetSim.SimRegistry.register('encoding', function factory(ctx) {
    var preset = 'ascii';
    var text = PRESETS.ascii.text;
    var encoding = 'utf-8';
    var index = -1;
    var timer = null;
    var host = null;
    var codePoints = [];
    var currentHighlight = -1;

    function renderSummary(utf8Bytes, utf16Bytes) {
      var delta = Math.abs(utf8Bytes - utf16Bytes);
      var result = utf8Bytes === utf16Bytes ? 'Both encodings use the same number of bytes for this text.' :
        (utf8Bytes < utf16Bytes ? 'UTF-8 uses ' + delta + ' fewer bytes for this text.' : 'UTF-16BE uses ' + delta + ' fewer bytes for this text.');
      return '<div class="enc-summary"><div class="enc-summary-card enc-summary-utf8"><span>UTF-8</span><strong>' + utf8Bytes + ' bytes</strong></div>' +
        '<div class="enc-summary-card enc-summary-utf16"><span>UTF-16BE</span><strong>' + utf16Bytes + ' bytes</strong></div>' +
        '<p class="enc-summary-note">' + result + ' Both represent the same Unicode text; the byte counts depend on the characters.</p></div>';
    }

    function rebuild() {
      stop();
      index = -1;
      currentHighlight = -1;
      codePoints = getCodePoints(text);
      draw();
      renderParams();
      ctx.log('Character Encoding — "' + (text.length > 30 ? text.substring(0, 28) + '…' : text) + '" (' + codePoints.length + ' code points)');
    }

    function draw() {
      var utf8 = renderByteGrid(text, 'utf-8');
      var utf16 = renderByteGrid(text, 'utf-16');
      var chartHtml = renderBarChart(utf8.totalBytes, utf16.totalBytes);
      var rulesHtml = renderRules();

      // Highlight current row if stepping
      var highlight = currentHighlight >= 0 ? currentHighlight : -1;

      host.innerHTML = renderSummary(utf8.totalBytes, utf16.totalBytes) + chartHtml + '<div class="enc-grids-row">' + utf8.html + utf16.html + '</div>' + rulesHtml;

      // Highlight current character row
      if (highlight >= 0) {
        var rows = host.querySelectorAll('.enc-grid-table tbody tr');
        rows.forEach(function (row, i) {
          if (i === highlight) {
            row.style.background = 'rgba(21,101,192,0.08)';
            row.style.fontWeight = '700';
          }
        });
      }

      ctx.setMetrics([
        { label: 'Text', value: text.length > 20 ? text.substring(0, 18) + '…' : text },
        { label: 'Code Points', value: String(codePoints.length) },
        { label: 'UTF-8 Size', value: utf8.totalBytes + ' bytes' },
        { label: 'UTF-16BE Size', value: utf16.totalBytes + ' bytes' },
        { label: 'Ratio', value: utf16.totalBytes > 0 ? (utf8.totalBytes / utf16.totalBytes * 100).toFixed(0) + '%' : '—' },
        { label: 'Current Char', value: currentHighlight >= 0 ? '"' + String.fromCodePoint(codePoints[currentHighlight]) + '" U+' + codePoints[currentHighlight].toString(16).toUpperCase().padStart(4, '0') : '—' }
      ]);
    }

    function renderParams() {
      ctx.params.hidden = false;
      var html = '<fieldset class="switch-mode-group" role="radiogroup" aria-label="Preset">';
      html += '<legend class="section-label" style="margin:0 0 0.5rem;border:none;padding:0;">Sample Text</legend>';
      Object.keys(PRESETS).forEach(function (k) {
        html += '<label class="switch-mode-option ' + (k === preset ? 'is-checked' : '') + '">' +
                '<input type="radio" name="encPreset" value="' + k + '" ' + (k === preset ? 'checked' : '') + '> ' + PRESETS[k].label + '</label>';
      });
      html += '</fieldset>';
      html += '<div class="sim-param-row"><label for="encText">Text to encode</label><input id="encText" type="text" maxlength="30" value="' + text.replace(/"/g, '&quot;') + '"></div>';

      ctx.params.innerHTML = html;
      ctx.params.querySelectorAll('input[name="encPreset"]').forEach(function (r) {
        r.addEventListener('change', function () {
          preset = r.value;
          if (preset !== 'custom') { text = PRESETS[preset].text; }
          rebuild();
        });
      });
      var inp = ctx.params.querySelector('#encText');
      if (inp) {
        inp.addEventListener('input', function (e) {
          text = e.target.value;
          preset = 'custom';
          stop();
          currentHighlight = -1;
          codePoints = getCodePoints(text);
          ctx.params.querySelectorAll('input[name="encPreset"]').forEach(function (radio) {
            radio.checked = radio.value === 'custom';
            radio.closest('.switch-mode-option').classList.toggle('is-checked', radio.checked);
          });
          draw();
        });
      }
    }

    function stop() { if (timer) { NetSim.SimTiming.clearInterval(timer); timer = null; } }

    function advance() {
      if (currentHighlight >= codePoints.length - 1) { stop(); return; }
      currentHighlight++;
      var cp = codePoints[currentHighlight];
      var ch = String.fromCodePoint(cp);
      var u8 = utf8BytesForCodePoint(cp);
      var u16 = utf16UnitsForCodePoint(cp) * 2;
      ctx.log('"' + ch + '" → U+' + cp.toString(16).toUpperCase().padStart(4, '0') + ' — UTF-8: ' + u8 + ' byte(s), UTF-16: ' + u16 + ' byte(s)', 'success');
      draw();
    }

    return {
      initialize: function () {
        ctx.canvas.classList.add('net-canvas');
        ctx.canvas.innerHTML = '<div class="enc-mount"></div>';
        host = ctx.canvas.querySelector('.enc-mount');
        rebuild();
      },
      start: function () { if (timer) return; timer = NetSim.SimTiming.setInterval(function () { if (currentHighlight >= codePoints.length - 1) { stop(); return; } advance(); }, 700); },
      pause: function () { stop(); },
      step: function () { stop(); advance(); },
      reset: function () { rebuild(); },
      destroy: function () { stop(); }
    };
  });

})(window.NetSim = window.NetSim || {});
