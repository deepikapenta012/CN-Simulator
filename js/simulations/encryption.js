/* ==========================================================================
   NetSim — simulations/encryption.js
   Interactive Encryption/Decryption simulation:
     - Live XOR cipher visualization with byte-by-byte stepping
     - Plaintext → Key → Ciphertext pipeline SVG
     - Byte-level XOR table showing the operation
     - Decrypt toggle to show reversibility
     - Key pattern cycling visualization
   ========================================================================== */

(function (NetSim) {
  'use strict';

  var PRESETS = {
    basic:   { label: 'Basic',         text: 'Hello!',           key: 'KEY' },
    netsim:  { label: 'NetSim',        text: 'Network Security', key: 'NETSIM' },
    secret:  { label: 'Secret Message', text: 'Meet at noon.',   key: 'CIPHER' },
    custom:  { label: 'Custom',        text: 'Your text',        key: 'SECRET' }
  };

  /* ---- XOR helpers ---- */
  function textToBytes(str) {
    return Array.from(new TextEncoder().encode(str));
  }

  function xorEncrypt(plainBytes, keyBytes) {
    return plainBytes.map(function (b, i) { return b ^ keyBytes[i % keyBytes.length]; });
  }

  function toHex(b) { return b.toString(16).toUpperCase().padStart(2, '0'); }
  function toBin(b) { return b.toString(2).padStart(8, '0'); }

  /* ---- Pipeline SVG ---- */
  function renderPipeline(mode) {
    var W = 500, H = 70;
    var svg = '<svg class="crypt-pipe-svg" viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="Encryption pipeline">';

    var stages = mode === 'encrypt'
      ? [{ label: 'Plaintext', color: '#1565c0', x: 60 }, { label: 'XOR ⊕ Key', color: '#e65100', x: 250 }, { label: 'Ciphertext', color: '#d32f2f', x: 440 }]
      : [{ label: 'Ciphertext', color: '#d32f2f', x: 60 }, { label: 'XOR ⊕ Key', color: '#e65100', x: 250 }, { label: 'Plaintext', color: '#1565c0', x: 440 }];

    stages.forEach(function (s, i) {
      svg += '<rect x="' + (s.x - 55) + '" y="15" width="110" height="36" rx="6" fill="' + s.color + '" fill-opacity="0.10" stroke="' + s.color + '" stroke-width="2"/>';
      svg += '<text x="' + s.x + '" y="38" text-anchor="middle" class="crypt-pipe-label" fill="' + s.color + '">' + s.label + '</text>';
      if (i < stages.length - 1) {
        var nextX = stages[i + 1].x;
        svg += '<line x1="' + (s.x + 55) + '" y1="33" x2="' + (nextX - 55) + '" y2="33" stroke="var(--ink-faint)" stroke-width="2" marker-end="url(#crypt-arr)"/>';
      }
    });

    svg += '<defs><marker id="crypt-arr" markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto"><path d="M0,1 L0,7 L7,4 z" fill="var(--ink-faint)"/></marker></defs>';
    svg += '</svg>';
    return svg;
  }

  /* ---- XOR table ---- */
  function renderXORTable(plainBytes, keyBytes, cipherBytes, currentIdx) {
    var html = '<div class="crypt-xor-table">';
    html += '<div class="crypt-xor-title">Byte-by-byte XOR Operation</div>';
    html += '<div class="crypt-xor-scroll"><table class="crypt-xor-tbl"><thead><tr>';
    html += '<th>#</th><th>Char</th><th>Plain (hex)</th><th>⊕</th><th>Key (hex)</th><th>=</th><th>Cipher (hex)</th><th>Plain (bin)</th><th>Key (bin)</th><th>Cipher (bin)</th>';
    html += '</tr></thead><tbody>';

    var colors = ['#1565c0', '#2e7d32', '#e65100', '#6a1b9a', '#c62828', '#00838f'];

    for (var i = 0; i < plainBytes.length; i++) {
      var shown = i <= currentIdx;
      var active = i === currentIdx;
      var kByte = keyBytes[i % keyBytes.length];
      var kChar = String.fromCharCode(kByte);
      var pChar = plainBytes[i] >= 32 && plainBytes[i] < 127 ? String.fromCharCode(plainBytes[i]) : '·';
      var keyColor = colors[i % keyBytes.length % colors.length];

      html += '<tr class="' + (active ? 'crypt-row-active' : '') + '" style="opacity:' + (shown ? '1' : '0.3') + '">';
      html += '<td>' + i + '</td>';
      html += '<td class="crypt-cell-char">' + pChar + '</td>';
      html += '<td class="crypt-cell-hex" style="color:#1565c0">' + toHex(plainBytes[i]) + '</td>';
      html += '<td class="crypt-cell-op">⊕</td>';
      html += '<td class="crypt-cell-hex" style="color:' + keyColor + '">' + toHex(kByte) + ' <small>(' + kChar + ')</small></td>';
      html += '<td class="crypt-cell-op">=</td>';
      html += '<td class="crypt-cell-hex" style="color:#d32f2f">' + (shown ? toHex(cipherBytes[i]) : '??') + '</td>';
      html += '<td class="crypt-cell-bin">' + toBin(plainBytes[i]) + '</td>';
      html += '<td class="crypt-cell-bin" style="color:' + keyColor + '">' + toBin(kByte) + '</td>';
      html += '<td class="crypt-cell-bin" style="color:#d32f2f">' + (shown ? toBin(cipherBytes[i]) : '????????') + '</td>';
      html += '</tr>';
    }

    html += '</tbody></table></div></div>';
    return html;
  }

  /* ---- Key cycling strip ---- */
  function renderKeyCycle(keyBytes, plainLen, currentIdx) {
    var html = '<div class="crypt-key-strip">';
    html += '<span class="crypt-key-title">Key cycling:</span>';
    for (var i = 0; i < plainLen; i++) {
      var kIdx = i % keyBytes.length;
      var active = i === currentIdx;
      var shown = i <= currentIdx;
      var ch = String.fromCharCode(keyBytes[kIdx]);
      html += '<span class="crypt-key-byte' + (active ? ' is-active' : '') + '" style="opacity:' + (shown ? '1' : '0.4') + '">' + ch + '</span>';
    }
    html += '</div>';
    return html;
  }

  /* ---- Result display ---- */
  function renderResult(cipherBytes, currentIdx, mode) {
    var shown = cipherBytes.slice(0, currentIdx + 1);
    var hexStr = shown.map(function (b) { return toHex(b); }).join(' ');
    var pending = cipherBytes.length - shown.length;

    var html = '<div class="crypt-result">';
    html += '<div class="crypt-result-title">' + (mode === 'encrypt' ? '🔒 Ciphertext' : '🔓 Recovered Plaintext') + '</div>';
    html += '<div class="crypt-result-hex">' + hexStr + (pending > 0 ? ' <span class="crypt-pending">+' + pending + ' more</span>' : '') + '</div>';
    if (mode === 'decrypt' && currentIdx >= 0) {
      var recoveredChars = shown.map(function (b) { return b >= 32 && b < 127 ? String.fromCharCode(b) : '·'; }).join('');
      html += '<div class="crypt-result-text">"' + recoveredChars + '"</div>';
    }
    html += '</div>';
    return html;
  }

  /* ==== Main simulation ==== */
  NetSim.SimRegistry.register('encryption', function factory(ctx) {
    var preset = 'basic';
    var text = PRESETS.basic.text;
    var key = PRESETS.basic.key;
    var mode = 'encrypt';
    var plainBytes = [];
    var keyBytes = [];
    var cipherBytes = [];
    var currentIdx = -1;
    var timer = null;
    var host = null;

    function rebuild() {
      stop();
      currentIdx = -1;
      plainBytes = textToBytes(text);
      keyBytes = textToBytes(key || 'K');
      cipherBytes = xorEncrypt(plainBytes, keyBytes);
      draw();
      renderParams();
      ctx.log('Encryption — "' + text + '" with key "' + key + '" (' + mode + ' mode)');
    }

    function draw() {
      var inputBytes = mode === 'encrypt' ? plainBytes : cipherBytes;
      var outputBytes = mode === 'encrypt' ? cipherBytes : xorEncrypt(cipherBytes, keyBytes);

      var pipeHtml = renderPipeline(mode);
      var keyCycleHtml = renderKeyCycle(keyBytes, inputBytes.length, currentIdx);
      var xorHtml = renderXORTable(inputBytes, keyBytes, outputBytes, currentIdx);
      var resultHtml = renderResult(outputBytes, currentIdx, mode);

      // Reversibility note
      var noteHtml = '<div class="crypt-note">';
      noteHtml += '<strong>🔑 Key insight:</strong> XOR is its own inverse! Applying the same key to ciphertext recovers the plaintext: ';
      noteHtml += '<code>P ⊕ K = C</code> and <code>C ⊕ K = P</code>. ';
      noteHtml += 'This repeating-key XOR is a teaching cipher — real encryption uses AES, ChaCha20, etc.';
      noteHtml += '</div>';

      host.innerHTML = pipeHtml + keyCycleHtml + resultHtml + xorHtml + noteHtml;

      var processed = Math.max(0, currentIdx + 1);
      ctx.setMetrics([
        { label: 'Mode', value: mode === 'encrypt' ? 'Encrypt 🔒' : 'Decrypt 🔓' },
        { label: 'Plaintext', value: '"' + text + '"' },
        { label: 'Key', value: '"' + key + '" (' + keyBytes.length + ' bytes)' },
        { label: 'Progress', value: processed + ' / ' + inputBytes.length + ' bytes' },
        { label: 'Cipher', value: mode === 'encrypt' ? 'Repeating-key XOR' : 'XOR decrypt (same key)' },
        { label: 'Key cycles', value: inputBytes.length > 0 ? Math.ceil(inputBytes.length / keyBytes.length) + '×' : '—' }
      ]);
    }

    function renderParams() {
      ctx.params.hidden = false;
      var html = '<fieldset class="switch-mode-group" role="radiogroup" aria-label="Preset">';
      html += '<legend class="section-label" style="margin:0 0 0.5rem;border:none;padding:0;">Sample</legend>';
      Object.keys(PRESETS).forEach(function (k) {
        html += '<label class="switch-mode-option ' + (k === preset ? 'is-checked' : '') + '">' +
                '<input type="radio" name="cryptPreset" value="' + k + '" ' + (k === preset ? 'checked' : '') + '> ' + PRESETS[k].label + '</label>';
      });
      html += '</fieldset>';

      html += '<fieldset class="switch-mode-group" role="radiogroup" aria-label="Mode">';
      html += '<legend class="section-label" style="margin:0 0 0.5rem;border:none;padding:0;">Mode</legend>';
      html += '<label class="switch-mode-option ' + (mode === 'encrypt' ? 'is-checked' : '') + '"><input type="radio" name="cryptMode" value="encrypt" ' + (mode === 'encrypt' ? 'checked' : '') + '> Encrypt 🔒</label>';
      html += '<label class="switch-mode-option ' + (mode === 'decrypt' ? 'is-checked' : '') + '"><input type="radio" name="cryptMode" value="decrypt" ' + (mode === 'decrypt' ? 'checked' : '') + '> Decrypt 🔓</label>';
      html += '</fieldset>';

      html += '<div class="sim-param-row"><label for="cryptText">Plaintext</label><input id="cryptText" type="text" maxlength="30" value="' + text.replace(/"/g, '&quot;') + '"></div>';
      html += '<div class="sim-param-row"><label for="cryptKey">Key</label><input id="cryptKey" type="text" maxlength="12" value="' + key.replace(/"/g, '&quot;') + '"></div>';

      ctx.params.innerHTML = html;
      ctx.params.querySelectorAll('input[name="cryptPreset"]').forEach(function (r) {
        r.addEventListener('change', function () { preset = r.value; if (preset !== 'custom') { text = PRESETS[preset].text; key = PRESETS[preset].key; } rebuild(); });
      });
      ctx.params.querySelectorAll('input[name="cryptMode"]').forEach(function (r) {
        r.addEventListener('change', function () { mode = r.value; rebuild(); });
      });
      var tInp = ctx.params.querySelector('#cryptText');
      var kInp = ctx.params.querySelector('#cryptKey');
      if (tInp) tInp.addEventListener('input', function (e) { text = e.target.value; preset = 'custom'; rebuild(); });
      if (kInp) kInp.addEventListener('input', function (e) { key = e.target.value; preset = 'custom'; rebuild(); });
    }

    function stop() { if (timer) { NetSim.SimTiming.clearInterval(timer); timer = null; } }

    function advance() {
      var totalBytes = plainBytes.length;
      if (currentIdx >= totalBytes - 1) { stop(); return; }
      currentIdx++;
      var pB = plainBytes[currentIdx];
      var kB = keyBytes[currentIdx % keyBytes.length];
      var cB = cipherBytes[currentIdx];
      ctx.log('Byte ' + currentIdx + ': ' + toHex(pB) + ' ⊕ ' + toHex(kB) + ' (' + String.fromCharCode(kB) + ') = ' + toHex(cB), 'success');
      draw();
    }

    return {
      initialize: function () { ctx.canvas.classList.add('net-canvas'); ctx.canvas.innerHTML = '<div class="crypt-mount"></div>'; host = ctx.canvas.querySelector('.crypt-mount'); rebuild(); },
      start: function () { if (timer) return; timer = NetSim.SimTiming.setInterval(function () { if (currentIdx >= plainBytes.length - 1) { stop(); return; } advance(); }, 500); },
      pause: function () { stop(); },
      step: function () { stop(); advance(); },
      reset: function () { rebuild(); },
      destroy: function () { stop(); }
    };
  });

})(window.NetSim = window.NetSim || {});
