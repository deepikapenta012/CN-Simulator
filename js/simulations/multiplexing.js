/* ==========================================================================
   NetSim — simulations/multiplexing.js
   Interactive simulation of four multiplexing techniques:
     1) FDM  — Frequency Division Multiplexing
     2) TDM  — Time Division Multiplexing (synchronous)
     3) WDM  — Wavelength Division Multiplexing (fiber)
     4) Statistical / Port-based (Transport layer demux)
   Each mode shows an animated SVG diagram with sources feeding into a
   MUX, traveling through a shared medium, and being separated by a DEMUX.
   ========================================================================== */

(function (NetSim) {
  'use strict';

  /* ---- Shared colors for sources ---- */
  var SRC = [
    { id: 'A', label: 'Source A', color: '#d32f2f', light: '#ffcdd2' },
    { id: 'B', label: 'Source B', color: '#1565c0', light: '#bbdefb' },
    { id: 'C', label: 'Source C', color: '#2e7d32', light: '#c8e6c9' },
    { id: 'D', label: 'Source D', color: '#e65100', light: '#ffe0b2' }
  ];

  /* ==================================================================
     FDM — each source gets a fixed frequency band
     ================================================================== */
  function buildFDM() {
    var bands = [
      { src: 0, fLow: 0,    fHigh: 4,   label: '0–4 kHz' },
      { src: 1, fLow: 4,    fHigh: 8,   label: '4–8 kHz' },
      { src: 2, fLow: 8,    fHigh: 12,  label: '8–12 kHz' },
      { src: 3, fLow: 12,   fHigh: 16,  label: '12–16 kHz' }
    ];
    var steps = [
      { text: 'Four analog voice channels, each needing 4 kHz bandwidth.', active: [], phase: 'intro' },
      { text: 'Source A is assigned the 0–4 kHz band. Its signal is placed at the base frequency.', active: [0], phase: 'assign' },
      { text: 'Source B is modulated up to 4–8 kHz using a carrier at 6 kHz.', active: [1], phase: 'assign' },
      { text: 'Source C is shifted to 8–12 kHz (carrier at 10 kHz).', active: [2], phase: 'assign' },
      { text: 'Source D occupies 12–16 kHz (carrier at 14 kHz).', active: [3], phase: 'assign' },
      { text: 'The MUX combines all four bands onto a single 16 kHz composite signal on the shared medium.', active: [0, 1, 2, 3], phase: 'combined' },
      { text: 'Guard bands (gaps) between channels prevent interference — real systems use them between each pair.', active: [0, 1, 2, 3], phase: 'guard' },
      { text: 'At the receiver, bandpass filters in the DEMUX separate each frequency band back to its original signal.', active: [0, 1, 2, 3], phase: 'demux', level: 'success' }
    ];
    return { steps: steps, bands: bands, type: 'fdm',
      desc: 'FDM divides the available bandwidth into non-overlapping frequency bands. Each source gets its own dedicated band and can transmit continuously. Guard bands prevent adjacent channel interference.',
      characteristics: ['Analog technique', 'Each source: dedicated frequency band', 'Guard bands between channels', 'Used in: AM/FM radio, early telephony, cable TV', 'Total BW = Σ(channel BW) + guard bands'] };
  }

  /* ==================================================================
     TDM — each source gets a fixed time slot
     ================================================================== */
  function buildTDM() {
    // 3 frames of 4 slots each
    var frames = [
      ['A', 'B', 'C', 'D'],
      ['A', 'B', 'C', 'D'],
      ['A', 'B', 'C', 'D']
    ];
    var steps = [
      { text: 'Four digital sources share one high-speed link using synchronous TDM.', active: [], phase: 'intro', frame: -1, slot: -1 },
      { text: 'The link is divided into fixed time frames. Each frame has 4 time slots — one per source.', active: [], phase: 'frame-explain', frame: -1, slot: -1 }
    ];
    frames.forEach(function (frame, fi) {
      frame.forEach(function (src, si) {
        var srcIdx = src.charCodeAt(0) - 65;
        steps.push({
          text: 'Frame ' + (fi + 1) + ', Slot ' + (si + 1) + ': Source ' + src + ' transmits its data.',
          active: [srcIdx], phase: 'slot', frame: fi, slot: si
        });
      });
      steps.push({
        text: 'Frame ' + (fi + 1) + ' complete — all 4 sources have transmitted once.',
        active: [0, 1, 2, 3], phase: 'frame-done', frame: fi, slot: 3
      });
    });
    steps.push({
      text: 'DEMUX separates slots back to individual outputs. Even if a source has no data, its slot is reserved (may waste bandwidth).',
      active: [0, 1, 2, 3], phase: 'demux', level: 'success', frame: 2, slot: 3
    });
    return { steps: steps, frames: frames, type: 'tdm',
      desc: 'Synchronous TDM divides time into fixed frames, each containing N slots (one per source). Every source gets an equal, guaranteed share of bandwidth — but unused slots are wasted.',
      characteristics: ['Digital technique', 'Fixed time slots per source', 'Guaranteed bandwidth (no contention)', 'Unused slots → wasted capacity', 'Used in: T1/E1 lines, SONET/SDH', 'Link rate = N × source rate'] };
  }

  /* ==================================================================
     WDM — each source gets a wavelength (color of light)
     ================================================================== */
  function buildWDM() {
    var wavelengths = [
      { src: 0, nm: 1310, color: '#d32f2f', label: 'λ₁ = 1310 nm' },
      { src: 1, nm: 1490, color: '#1565c0', label: 'λ₂ = 1490 nm' },
      { src: 2, nm: 1550, color: '#2e7d32', label: 'λ₃ = 1550 nm' },
      { src: 3, nm: 1570, color: '#e65100', label: 'λ₄ = 1570 nm' }
    ];
    var steps = [
      { text: 'Four fiber-optic channels, each using a different wavelength (color) of light.', active: [], phase: 'intro' },
      { text: 'Source A transmits on λ₁ = 1310 nm (O-band).', active: [0], phase: 'assign' },
      { text: 'Source B uses λ₂ = 1490 nm (S-band).', active: [1], phase: 'assign' },
      { text: 'Source C uses λ₃ = 1550 nm (C-band) — the most common telecom wavelength.', active: [2], phase: 'assign' },
      { text: 'Source D uses λ₄ = 1570 nm (L-band).', active: [3], phase: 'assign' },
      { text: 'A WDM MUX (prism/grating) combines all wavelengths into a single fiber. They travel simultaneously without interfering.', active: [0, 1, 2, 3], phase: 'combined' },
      { text: 'DWDM (Dense WDM) can carry 80+ channels on a single fiber, each at 100+ Gbps!', active: [0, 1, 2, 3], phase: 'dwdm' },
      { text: 'At the receiver, a DEMUX (diffraction grating or thin-film filter) separates wavelengths back to individual fibers.', active: [0, 1, 2, 3], phase: 'demux', level: 'success' }
    ];
    return { steps: steps, wavelengths: wavelengths, type: 'wdm',
      desc: 'WDM is essentially FDM for fiber optics — each channel uses a different wavelength (color) of infrared light. Multiple signals travel through the same fiber simultaneously at the speed of light.',
      characteristics: ['Optical fiber technique', 'Each channel: a different wavelength of light', 'CWDM: ~18 channels, wider spacing', 'DWDM: 80–160+ channels, 0.8 nm spacing', 'Used in: undersea cables, backbone networks', 'Capacity: N × per-wavelength rate (e.g. 80 × 100 Gbps)'] };
  }

  /* ==================================================================
     Statistical Multiplexing (port-based / transport layer)
     ================================================================== */
  function buildStatistical() {
    var apps = [
      { name: 'Web Browser', port: 51000, proto: 'TCP' },
      { name: 'Video Call',  port: 51001, proto: 'UDP' },
      { name: 'Email',       port: 51002, proto: 'TCP' },
      { name: 'DNS Query',   port: 51003, proto: 'UDP' }
    ];
    var arrivals = [0, 1, 0, 2, 3, 1, 0, 2, 1, 3, 0, 1];
    var steps = [
      { text: 'Four applications share one network interface (IP: 10.0.0.5) going to various servers.', active: [], phase: 'intro', delivered: {} }
    ];
    var delivered = { 0: 0, 1: 0, 2: 0, 3: 0 };
    apps.forEach(function (a, i) {
      steps.push({
        text: a.name + ' opens a socket on source port ' + a.port + ' (' + a.proto + ').',
        active: [i], phase: 'open', delivered: JSON.parse(JSON.stringify(delivered))
      });
    });
    arrivals.forEach(function (appIdx, i) {
      delivered[appIdx]++;
      var a = apps[appIdx];
      steps.push({
        text: 'Segment ' + (i + 1) + ' from port ' + a.port + ' → demuxed to ' + a.name + '. ' +
              '(Key: srcIP:' + a.port + ', proto:' + a.proto + ')',
        active: [appIdx], phase: 'deliver', delivered: JSON.parse(JSON.stringify(delivered)),
        level: 'success'
      });
    });
    steps.push({
      text: 'All segments delivered — bandwidth was shared dynamically, allocated only when each app had data (no wasted slots).',
      active: [0, 1, 2, 3], phase: 'done', delivered: delivered, level: 'success'
    });
    return { steps: steps, apps: apps, type: 'stat',
      desc: 'Statistical multiplexing (used by IP networks) allocates bandwidth on demand. The transport layer uses port numbers to demux segments to the correct application socket. No fixed allocation — efficient but can cause congestion.',
      characteristics: ['Packet-switched / digital', 'Bandwidth allocated on-demand', 'Demux key: (srcIP, srcPort, dstIP, dstPort, proto)', 'No wasted capacity (unlike TDM)', 'Risk: congestion if demand exceeds capacity', 'Used in: all IP/Ethernet networks'] };
  }

  /* ==== Mode registry ==== */
  var MODES = {
    fdm:  { label: 'FDM (Frequency)',   build: buildFDM },
    tdm:  { label: 'TDM (Time)',        build: buildTDM },
    wdm:  { label: 'WDM (Wavelength)',  build: buildWDM },
    stat: { label: 'Statistical (Ports)', build: buildStatistical }
  };
  var MODE_KEYS = ['fdm', 'tdm', 'wdm', 'stat'];

  /* ==== SVG diagrams ==== */

  /* -- Generic MUX/DEMUX pipeline diagram -- */
  function renderPipelineSVG(mode, step, stepIdx) {
    var W = 700, H = 280;
    var svg = '<svg class="mux-pipeline-svg" viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="Multiplexing diagram">';

    var srcX = 30, muxX = 180, medX = 300, medW = 140, demuxX = 480, outX = 620;
    var srcSpacing = 55;
    var srcStartY = 40;
    var midY = H / 2;

    // Draw 4 sources on the left
    SRC.forEach(function (s, i) {
      var y = srcStartY + i * srcSpacing;
      var active = step.active.indexOf(i) >= 0;
      var opacity = stepIdx < 0 ? '0.4' : active ? '1' : '0.3';

      // Source box
      svg += '<g opacity="' + opacity + '">';
      svg += '<rect x="' + srcX + '" y="' + (y - 14) + '" width="70" height="28" rx="4" ' +
             'fill="' + s.light + '" stroke="' + s.color + '" stroke-width="' + (active ? '2' : '1') + '"/>';
      svg += '<text x="' + (srcX + 35) + '" y="' + (y + 3) + '" text-anchor="middle" ' +
             'class="mux-src-label" fill="' + s.color + '">' + s.label + '</text>';

      // Line to MUX
      svg += '<line x1="' + (srcX + 70) + '" y1="' + y + '" x2="' + muxX + '" y2="' + midY + '" ' +
             'stroke="' + s.color + '" stroke-width="' + (active ? '2.5' : '1') + '" stroke-dasharray="' + (active ? 'none' : '4 3') + '"/>';
      svg += '</g>';
    });

    // MUX trapezoid
    svg += '<polygon points="' + muxX + ',' + (midY - 55) + ' ' + (muxX + 50) + ',' + (midY - 25) + ' ' +
           (muxX + 50) + ',' + (midY + 25) + ' ' + muxX + ',' + (midY + 55) + '" ' +
           'fill="var(--paper-raised)" stroke="var(--ink)" stroke-width="2"/>';
    svg += '<text x="' + (muxX + 25) + '" y="' + (midY + 5) + '" text-anchor="middle" class="mux-box-label">MUX</text>';

    // Shared medium
    var combActive = step.active.length > 1 || step.phase === 'combined' || step.phase === 'demux' || step.phase === 'guard' || step.phase === 'dwdm' || step.phase === 'done' || step.phase === 'frame-done';
    var medStroke = combActive ? 'var(--accent)' : 'var(--line-strong)';
    var medSW = combActive ? '3' : '2';
    svg += '<rect x="' + medX + '" y="' + (midY - 18) + '" width="' + medW + '" height="36" rx="6" ' +
           'fill="var(--paper)" stroke="' + medStroke + '" stroke-width="' + medSW + '"/>';

    // Label inside medium
    var medLabel = mode === 'fdm' ? 'Composite Signal' : mode === 'tdm' ? 'TDM Frame' : mode === 'wdm' ? 'Single Fiber' : 'IP Link';
    svg += '<text x="' + (medX + medW / 2) + '" y="' + (midY + 4) + '" text-anchor="middle" class="mux-med-label">' + medLabel + '</text>';

    // Colored stripes inside medium to show combined signals
    if (combActive) {
      var stripeH = 5;
      step.active.forEach(function (si, j) {
        var sy = midY - 14 + j * (stripeH + 2);
        svg += '<rect x="' + (medX + 4) + '" y="' + sy + '" width="' + (medW - 8) + '" height="' + stripeH + '" rx="2" ' +
               'fill="' + SRC[si].color + '" fill-opacity="0.5"/>';
      });
    }

    // Lines from MUX to medium and medium to DEMUX
    svg += '<line x1="' + (muxX + 50) + '" y1="' + midY + '" x2="' + medX + '" y2="' + midY + '" ' +
           'stroke="var(--ink)" stroke-width="2" marker-end="url(#mux-arrow)"/>';
    svg += '<line x1="' + (medX + medW) + '" y1="' + midY + '" x2="' + demuxX + '" y2="' + midY + '" ' +
           'stroke="var(--ink)" stroke-width="2" marker-end="url(#mux-arrow)"/>';

    // DEMUX trapezoid (mirror)
    svg += '<polygon points="' + demuxX + ',' + (midY - 25) + ' ' + (demuxX + 50) + ',' + (midY - 55) + ' ' +
           (demuxX + 50) + ',' + (midY + 55) + ' ' + demuxX + ',' + (midY + 25) + '" ' +
           'fill="var(--paper-raised)" stroke="var(--ink)" stroke-width="2"/>';
    svg += '<text x="' + (demuxX + 25) + '" y="' + (midY + 5) + '" text-anchor="middle" class="mux-box-label">DEMUX</text>';

    // Output lines from DEMUX to destinations
    SRC.forEach(function (s, i) {
      var y = srcStartY + i * srcSpacing;
      var active = step.active.indexOf(i) >= 0 && (step.phase === 'demux' || step.phase === 'done' || step.phase === 'deliver');
      var opacity = active ? '1' : '0.3';

      svg += '<g opacity="' + opacity + '">';
      svg += '<line x1="' + (demuxX + 50) + '" y1="' + midY + '" x2="' + outX + '" y2="' + y + '" ' +
             'stroke="' + s.color + '" stroke-width="' + (active ? '2.5' : '1') + '"/>';
      svg += '<text x="' + (outX + 5) + '" y="' + (y + 4) + '" class="mux-out-label" fill="' + s.color + '">Out ' + s.id + '</text>';
      svg += '</g>';
    });

    // Arrow marker
    svg += '<defs><marker id="mux-arrow" markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto">' +
           '<path d="M0,1 L0,7 L7,4 z" fill="var(--ink)"/></marker></defs>';

    svg += '</svg>';
    return svg;
  }

  /* -- FDM frequency spectrum bar -- */
  function renderFDMSpectrum(bands, activeList) {
    var W = 600, H = 80;
    var svg = '<svg class="mux-spectrum-svg" viewBox="0 0 ' + W + ' ' + H + '">';
    var bandW = (W - 60) / bands.length;

    svg += '<text x="10" y="14" class="mux-spec-title">Frequency Spectrum</text>';

    bands.forEach(function (b, i) {
      var x = 30 + i * bandW;
      var active = activeList.indexOf(b.src) >= 0;
      var s = SRC[b.src];
      svg += '<rect x="' + (x + 2) + '" y="22" width="' + (bandW - 8) + '" height="35" rx="3" ' +
             'fill="' + s.color + '" fill-opacity="' + (active ? '0.55' : '0.15') + '" ' +
             'stroke="' + s.color + '" stroke-width="' + (active ? '2' : '1') + '"/>';
      svg += '<text x="' + (x + bandW / 2 - 2) + '" y="44" text-anchor="middle" class="mux-band-label" fill="' + s.color + '">' + s.id + '</text>';
      svg += '<text x="' + (x + bandW / 2 - 2) + '" y="72" text-anchor="middle" class="mux-band-freq">' + b.label + '</text>';

      // Guard band
      if (i < bands.length - 1) {
        svg += '<rect x="' + (x + bandW - 6) + '" y="22" width="8" height="35" fill="var(--paper)" stroke="var(--line)" stroke-width="0.5" stroke-dasharray="2 2"/>';
      }
    });

    svg += '</svg>';
    return svg;
  }

  /* -- TDM frame grid -- */
  function renderTDMFrames(frames, currentFrame, currentSlot) {
    var html = '<div class="mux-tdm-frames">';
    frames.forEach(function (frame, fi) {
      html += '<div class="mux-tdm-frame">';
      html += '<span class="mux-tdm-flabel">Frame ' + (fi + 1) + '</span>';
      frame.forEach(function (src, si) {
        var srcIdx = src.charCodeAt(0) - 65;
        var s = SRC[srcIdx];
        var active = fi < currentFrame || (fi === currentFrame && si <= currentSlot);
        var current = fi === currentFrame && si === currentSlot;
        html += '<span class="mux-tdm-slot' + (active ? ' is-filled' : '') + (current ? ' is-current' : '') + '" ' +
                'style="' + (active ? 'background:' + s.light + ';border-color:' + s.color + ';color:' + s.color : '') + '">' +
                src + '</span>';
      });
      html += '</div>';
    });
    html += '</div>';
    return html;
  }

  /* -- Statistical MUX delivery table -- */
  function renderStatTable(apps, delivered) {
    var html = '<div class="mux-stat-table">';
    apps.forEach(function (a, i) {
      var s = SRC[i];
      var cnt = delivered[i] || 0;
      html += '<div class="mux-stat-row">';
      html += '<span class="mux-stat-swatch" style="background:' + s.color + '"></span>';
      html += '<span class="mux-stat-app">' + a.name + '</span>';
      html += '<span class="mux-stat-port">:' + a.port + ' (' + a.proto + ')</span>';
      html += '<span class="mux-stat-cnt">' + cnt + ' seg</span>';
      html += '</div>';
    });
    html += '</div>';
    return html;
  }

  /* ==== Main simulation ==== */
  NetSim.SimRegistry.register('multiplexing', function factory(ctx) {
    var mode = 'fdm';
    var sim = null;
    var index = -1;
    var timer = null;
    var host = null;
    var extraHost = null;

    function rebuild() {
      stop();
      index = -1;
      sim = MODES[mode].build();
      draw();
      renderParams();
      ctx.log('Multiplexing mode: ' + MODES[mode].label + '. ' + sim.desc.split('.')[0] + '.');
    }

    function draw() {
      var step = index >= 0 && sim.steps[index] ? sim.steps[index] : { active: [], phase: 'intro' };

      // Pipeline SVG
      var svgHtml = renderPipelineSVG(sim.type, step, index);

      // Description box
      var info = '<div class="mux-info-box">';
      info += '<p class="mux-info-desc">' + sim.desc + '</p>';
      info += '<ul class="mux-info-chars">';
      sim.characteristics.forEach(function (c) { info += '<li>' + c + '</li>'; });
      info += '</ul></div>';

      host.innerHTML = svgHtml + info;

      // Extra visuals per mode
      var extra = '';
      if (sim.type === 'fdm' && sim.bands) {
        extra = renderFDMSpectrum(sim.bands, step.active);
      } else if (sim.type === 'tdm' && sim.frames) {
        var cf = step.frame !== undefined ? step.frame : -1;
        var cs = step.slot !== undefined ? step.slot : -1;
        extra = renderTDMFrames(sim.frames, cf, cs);
      } else if (sim.type === 'stat' && sim.apps) {
        extra = renderStatTable(sim.apps, step.delivered || {});
      }
      extraHost.innerHTML = extra;

      // Metrics
      var metrics = [{ label: 'Technique', value: MODES[mode].label }];
      if (sim.type === 'fdm') {
        metrics.push({ label: 'Channels', value: '4' });
        metrics.push({ label: 'Per-channel BW', value: '4 kHz' });
        metrics.push({ label: 'Total BW', value: '16 kHz + guard bands' });
        metrics.push({ label: 'Sharing', value: 'Frequency domain' });
      } else if (sim.type === 'tdm') {
        metrics.push({ label: 'Sources', value: '4' });
        metrics.push({ label: 'Slots/frame', value: '4' });
        metrics.push({ label: 'Frames shown', value: '3' });
        metrics.push({ label: 'Sharing', value: 'Time domain' });
        metrics.push({ label: 'Waste', value: 'Empty slots if source idle' });
      } else if (sim.type === 'wdm') {
        metrics.push({ label: 'Wavelengths', value: '4' });
        metrics.push({ label: 'Medium', value: 'Single-mode fiber' });
        metrics.push({ label: 'DWDM capacity', value: '80–160+ channels' });
        metrics.push({ label: 'Sharing', value: 'Wavelength (optical frequency)' });
      } else {
        var total = 0;
        if (step.delivered) Object.keys(step.delivered).forEach(function (k) { total += step.delivered[k]; });
        metrics.push({ label: 'Applications', value: '4' });
        metrics.push({ label: 'Segments delivered', value: String(total) });
        metrics.push({ label: 'Demux key', value: 'srcIP:port + proto' });
        metrics.push({ label: 'Sharing', value: 'On-demand (statistical)' });
      }
      metrics.push({ label: 'Step', value: (index + 1) + ' / ' + sim.steps.length });
      ctx.setMetrics(metrics);
    }

    function renderParams() {
      ctx.params.hidden = false;
      ctx.params.innerHTML =
        '<fieldset class="switch-mode-group" role="radiogroup" aria-label="Multiplexing Type">' +
        '<legend class="section-label" style="margin:0 0 0.5rem;border:none;padding:0;">Multiplexing Technique</legend>' +
        MODE_KEYS.map(function (k) {
          return '<label class="switch-mode-option ' + (k === mode ? 'is-checked' : '') + '">' +
            '<input type="radio" name="muxMode" value="' + k + '" ' + (k === mode ? 'checked' : '') + '> ' +
            MODES[k].label + '</label>';
        }).join('') +
        '</fieldset>';
      ctx.params.querySelectorAll('input[name="muxMode"]').forEach(function (r) {
        r.addEventListener('change', function () { mode = r.value; rebuild(); });
      });
    }

    function stop() { if (timer) { NetSim.SimTiming.clearInterval(timer); timer = null; } }

    function advance() {
      if (index >= sim.steps.length - 1) { stop(); return; }
      index++;
      var s = sim.steps[index];
      ctx.log(s.text, s.level);
      draw();
    }

    return {
      initialize: function () {
        ctx.canvas.classList.add('net-canvas');
        ctx.canvas.innerHTML = '<div class="mux-mount"></div><div class="mux-extra-mount"></div>';
        host = ctx.canvas.querySelector('.mux-mount');
        extraHost = ctx.canvas.querySelector('.mux-extra-mount');
        rebuild();
      },
      start: function () {
        if (timer) return;
        timer = NetSim.SimTiming.setInterval(function () {
          if (index >= sim.steps.length - 1) { stop(); return; }
          advance();
        }, 700);
      },
      pause: function () { stop(); },
      step: function () { stop(); advance(); },
      reset: function () { rebuild(); },
      destroy: function () { stop(); }
    };
  });

})(window.NetSim = window.NetSim || {});
