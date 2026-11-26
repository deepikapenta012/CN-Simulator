/* ==========================================================================
   NetSim — simulations/compression.js
   Interactive Data Compression simulation:
     - Run-Length Encoding (RLE) step-by-step visualization
     - Input → Runs → Compressed output pipeline
     - Visual run-block diagram with colour coding
     - Compression ratio bar chart
     - Expansion warning for non-repetitive data
     - Preset samples and custom input
   ========================================================================== */

(function (NetSim) {
  'use strict';

  var PRESETS = {
    good:    { label: 'Good (repeating)',    text: 'AAABBBCCCCDDDD' },
    pixel:   { label: 'Pixel Row',           text: 'RRRRRGGGGBBBBBB' },
    bad:     { label: 'Bad (no repeats)',     text: 'ABCDEFGHIJKLMN' },
    mixed:   { label: 'Mixed',              text: 'AAABCDDDDDEEEF' },
    binary:  { label: 'Binary Data',         text: '0000011110000111' },
    custom:  { label: 'Custom',             text: 'Type here' }
  };

  var RUN_COLORS = ['#1565c0', '#2e7d32', '#e65100', '#6a1b9a', '#c62828', '#00838f', '#ad1457', '#4527a0', '#1b5e20', '#bf360c'];

  /* ---- RLE helpers ---- */
  function computeRuns(text) {
    if (!text) return [];
    var runs = [];
    var i = 0;
    while (i < text.length) {
      var ch = text[i];
      var count = 1;
      while (i + count < text.length && text[i + count] === ch) count++;
      runs.push({ char: ch, count: count, start: i });
      i += count;
    }
    return runs;
  }

  function rleEncode(runs) {
    return runs.map(function (r) { return r.count + r.char; }).join('');
  }

  /* ---- SVG run blocks diagram ---- */
  function renderRunBlocks(runs, currentIdx, text) {
    var W = 580, H = 130, blockH = 40;
    var topY = 15, botY = 80;
    var totalChars = text.length;
    if (totalChars === 0) return '';
    var charW = Math.min(Math.floor((W - 20) / totalChars), 32);
    var startX = 10;

    var svg = '<svg class="comp-blocks-svg" viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="RLE run blocks">';

    // Top row: original characters
    svg += '<text x="' + startX + '" y="12" class="comp-row-label" fill="var(--ink-faint)">Original</text>';
    var pos = startX;
    runs.forEach(function (run, rIdx) {
      var color = RUN_COLORS[rIdx % RUN_COLORS.length];
      var shown = rIdx <= currentIdx;
      for (var j = 0; j < run.count; j++) {
        svg += '<rect x="' + pos + '" y="' + topY + '" width="' + (charW - 1) + '" height="' + blockH + '" rx="3" ' +
               'fill="' + color + '" fill-opacity="' + (shown ? '0.18' : '0.05') + '" stroke="' + color + '" stroke-width="' + (shown ? '2' : '1') + '"/>';
        svg += '<text x="' + (pos + charW / 2 - 0.5) + '" y="' + (topY + blockH / 2 + 5) + '" text-anchor="middle" class="comp-block-char" fill="' + color + '">' + run.char + '</text>';
        pos += charW;
      }
    });

    // Bottom row: compressed output
    svg += '<text x="' + startX + '" y="' + (botY - 3) + '" class="comp-row-label" fill="var(--ink-faint)">Compressed</text>';
    pos = startX;
    runs.forEach(function (run, rIdx) {
      var color = RUN_COLORS[rIdx % RUN_COLORS.length];
      var shown = rIdx <= currentIdx;
      var label = run.count + run.char;
      var cW = Math.max(label.length * (charW * 0.6), charW * 1.2);
      if (shown) {
        svg += '<rect x="' + pos + '" y="' + botY + '" width="' + (cW - 1) + '" height="' + blockH + '" rx="3" ' +
               'fill="' + color + '" fill-opacity="0.18" stroke="' + color + '" stroke-width="2"/>';
        svg += '<text x="' + (pos + cW / 2 - 0.5) + '" y="' + (botY + blockH / 2 + 5) + '" text-anchor="middle" class="comp-block-code" fill="' + color + '">' + label + '</text>';

        // Bracket connecting top to bottom
        var topMid = startX + run.start * charW + (run.count * charW) / 2;
        var botMid = pos + cW / 2;
        svg += '<line x1="' + topMid + '" y1="' + (topY + blockH + 1) + '" x2="' + botMid + '" y2="' + (botY - 1) + '" stroke="' + color + '" stroke-width="1" stroke-dasharray="3 2"/>';
      }
      pos += cW;
    });

    svg += '</svg>';
    return svg;
  }

  /* ---- Compression ratio bar chart ---- */
  function renderRatioChart(origLen, compLen) {
    if (origLen === 0) return '';
    var W = 400, H = 90;
    var maxVal = Math.max(origLen, compLen, 1);
    var pad = 80;

    var svg = '<svg class="comp-ratio-svg" viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="Compression ratio">';

    var w1 = (W - pad - 60) * (origLen / maxVal);
    var w2 = (W - pad - 60) * (compLen / maxVal);
    var ratio = (compLen / origLen * 100).toFixed(0);
    var saved = origLen - compLen;

    svg += '<text x="' + (pad - 5) + '" y="26" text-anchor="end" class="comp-chart-label" fill="#1565c0">Original</text>';
    svg += '<rect x="' + pad + '" y="12" width="' + w1 + '" height="24" rx="4" fill="#1565c0" fill-opacity="0.7"/>';
    svg += '<text x="' + (pad + w1 + 6) + '" y="30" class="comp-chart-val" fill="#1565c0">' + origLen + ' chars</text>';

    var barColor = compLen <= origLen ? '#2e7d32' : '#d32f2f';
    svg += '<text x="' + (pad - 5) + '" y="58" text-anchor="end" class="comp-chart-label" fill="' + barColor + '">RLE</text>';
    svg += '<rect x="' + pad + '" y="44" width="' + w2 + '" height="24" rx="4" fill="' + barColor + '" fill-opacity="0.7"/>';
    svg += '<text x="' + (pad + w2 + 6) + '" y="62" class="comp-chart-val" fill="' + barColor + '">' + compLen + ' chars</text>';

    var msg = saved > 0 ? ('Saved ' + saved + ' chars (' + ratio + '% of original)') :
              saved === 0 ? 'No savings — same size' :
              'EXPANDED by ' + Math.abs(saved) + ' chars! (' + ratio + '% — RLE is bad for non-repetitive data)';
    var msgColor = saved > 0 ? '#2e7d32' : saved === 0 ? 'var(--ink-faint)' : '#d32f2f';
    svg += '<text x="' + (W / 2) + '" y="84" text-anchor="middle" class="comp-chart-note" fill="' + msgColor + '">' + msg + '</text>';

    svg += '</svg>';
    return svg;
  }

  /* ---- Run detail table ---- */
  function renderRunTable(runs, currentIdx) {
    var html = '<div class="comp-run-table">';
    html += '<div class="comp-run-title">Run Breakdown</div>';
    html += '<div class="comp-runs">';
    runs.forEach(function (run, i) {
      var color = RUN_COLORS[i % RUN_COLORS.length];
      var shown = i <= currentIdx;
      html += '<div class="comp-run-item' + (i === currentIdx ? ' is-active' : '') + '" style="border-color:' + color + ';opacity:' + (shown ? '1' : '0.35') + '">';
      html += '<span class="comp-run-char" style="background:' + color + '">' + run.char + '</span>';
      html += '<span class="comp-run-count">×' + run.count + '</span>';
      html += '<span class="comp-run-arrow">→</span>';
      html += '<span class="comp-run-code" style="color:' + color + '">' + run.count + run.char + '</span>';
      html += '</div>';
    });
    html += '</div></div>';
    return html;
  }

  /* ==== Main simulation ==== */
  NetSim.SimRegistry.register('compression', function factory(ctx) {
    var preset = 'good';
    var text = PRESETS.good.text;
    var runs = [];
    var currentIdx = -1;
    var timer = null;
    var host = null;

    function rebuild() {
      stop();
      currentIdx = -1;
      runs = computeRuns(text);
      draw();
      renderParams();
      ctx.log('RLE Compression — "' + text + '" (' + runs.length + ' runs detected)');
    }

    function draw() {
      var encoded = rleEncode(runs);
      var origLen = text.length;
      var compLen = encoded.length;

      var blocksHtml = renderRunBlocks(runs, currentIdx, text);
      var ratioHtml = renderRatioChart(origLen, compLen);
      var tableHtml = renderRunTable(runs, currentIdx);

      // Info box
      var infoHtml = '<div class="comp-info">';
      infoHtml += '<h4 class="comp-info-title">Run-Length Encoding (RLE)</h4>';
      infoHtml += '<ul class="comp-info-props">';
      infoHtml += '<li><strong>Lossless</strong> — original data can be perfectly recovered</li>';
      infoHtml += '<li><strong>Consecutive runs</strong> — replaces repeated characters with count+character</li>';
      infoHtml += '<li><strong>Best case</strong> — highly repetitive data (images with solid regions, fax)</li>';
      infoHtml += '<li><strong>Worst case</strong> — non-repetitive data EXPANDS (each char becomes 2: "1A1B1C…")</li>';
      infoHtml += '<li><strong>Used in</strong> — BMP images, fax (CCITT), PCX format, as a stage in more complex codecs</li>';
      infoHtml += '</ul></div>';

      host.innerHTML = blocksHtml + tableHtml + ratioHtml + infoHtml;

      var processed = Math.min(currentIdx + 1, runs.length);
      var charsProcessed = 0;
      for (var i = 0; i < processed; i++) charsProcessed += runs[i].count;

      ctx.setMetrics([
        { label: 'Input', value: '"' + (text.length > 18 ? text.substring(0, 16) + '…' : text) + '"' },
        { label: 'Original Size', value: origLen + ' chars' },
        { label: 'Compressed Size', value: compLen + ' chars' },
        { label: 'Ratio', value: origLen > 0 ? (compLen / origLen * 100).toFixed(0) + '%' : '—' },
        { label: 'Runs Found', value: processed + ' / ' + runs.length },
        { label: 'Chars Processed', value: charsProcessed + ' / ' + origLen },
        { label: 'Savings', value: (origLen - compLen > 0 ? origLen - compLen + ' chars saved' : origLen - compLen === 0 ? 'None' : Math.abs(origLen - compLen) + ' chars EXPANDED') }
      ]);
    }

    function renderParams() {
      ctx.params.hidden = false;
      var html = '<fieldset class="switch-mode-group" role="radiogroup" aria-label="Preset">';
      html += '<legend class="section-label" style="margin:0 0 0.5rem;border:none;padding:0;">Sample</legend>';
      Object.keys(PRESETS).forEach(function (k) {
        html += '<label class="switch-mode-option ' + (k === preset ? 'is-checked' : '') + '">' +
                '<input type="radio" name="compPreset" value="' + k + '" ' + (k === preset ? 'checked' : '') + '> ' + PRESETS[k].label + '</label>';
      });
      html += '</fieldset>';
      html += '<div class="sim-param-row"><label for="compText">Text</label><input id="compText" type="text" maxlength="24" value="' + text.replace(/"/g, '&quot;') + '"></div>';

      ctx.params.innerHTML = html;
      ctx.params.querySelectorAll('input[name="compPreset"]').forEach(function (r) {
        r.addEventListener('change', function () { preset = r.value; if (preset !== 'custom') { text = PRESETS[preset].text; } rebuild(); });
      });
      var inp = ctx.params.querySelector('#compText');
      if (inp) inp.addEventListener('input', function (e) { text = e.target.value; preset = 'custom'; rebuild(); });
    }

    function stop() { if (timer) { NetSim.SimTiming.clearInterval(timer); timer = null; } }

    function advance() {
      if (currentIdx >= runs.length - 1) { stop(); return; }
      currentIdx++;
      var r = runs[currentIdx];
      var msg = 'Run ' + (currentIdx + 1) + ': "' + r.char + '" × ' + r.count + ' → "' + r.count + r.char + '"';
      if (r.count === 1) msg += ' (no savings — single character)';
      else msg += ' (saved ' + (r.count - 2) + ' chars)';
      ctx.log(msg, r.count > 1 ? 'success' : 'warning');
      draw();
    }

    return {
      initialize: function () { ctx.canvas.classList.add('net-canvas'); ctx.canvas.innerHTML = '<div class="comp-mount"></div>'; host = ctx.canvas.querySelector('.comp-mount'); rebuild(); },
      start: function () { if (timer) return; timer = NetSim.SimTiming.setInterval(function () { if (currentIdx >= runs.length - 1) { stop(); return; } advance(); }, 700); },
      pause: function () { stop(); },
      step: function () { stop(); advance(); },
      reset: function () { rebuild(); },
      destroy: function () { stop(); }
    };
  });

})(window.NetSim = window.NetSim || {});
