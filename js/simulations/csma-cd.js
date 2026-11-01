/* ==========================================================================
   NetSim — simulations/csma-cd.js
   Two stations contend for a shared bus. When they transmit at the same
   time, both detect the collision immediately, jam, and roll a real
   binary exponential backoff — replayed until the race actually resolves.
   ========================================================================== */

(function (NetSim) {
  'use strict';

  /* ---- CSMA/CD flowchart (SVG) ---- */
  const FC_NODES = [
    { id: 'sense',    label: 'Sense\nchannel',    x: 120, y: 40,  w: 100, h: 38, shape: 'rect' },
    { id: 'idle',     label: 'Channel\nidle?',     x: 120, y: 110, w: 96,  h: 42, shape: 'diamond' },
    { id: 'transmit', label: 'Transmit\nframe',    x: 120, y: 185, w: 100, h: 38, shape: 'rect' },
    { id: 'collide',  label: 'Collision\ndetected?', x: 120, y: 260, w: 96, h: 42, shape: 'diamond' },
    { id: 'jam',      label: 'Send jam\nsignal',   x: 270, y: 260, w: 100, h: 38, shape: 'rect' },
    { id: 'backoff',  label: 'Binary exp.\nbackoff', x: 270, y: 185, w: 104, h: 38, shape: 'rect' },
    { id: 'success',  label: 'Success!',           x: 120, y: 340, w: 100, h: 34, shape: 'round' }
  ];
  const FC_EDGES = [
    { from: 'sense',    to: 'idle',     label: '' },
    { from: 'idle',     to: 'transmit', label: 'Yes' },
    { from: 'idle',     to: 'sense',    label: 'No',  curve: 'right-loop' },
    { from: 'transmit', to: 'collide',  label: '' },
    { from: 'collide',  to: 'jam',      label: 'Yes' },
    { from: 'collide',  to: 'success',  label: 'No' },
    { from: 'jam',      to: 'backoff',  label: '' },
    { from: 'backoff',  to: 'sense',    label: '',    curve: 'top-loop' }
  ];

  function renderFlowchart(activeId) {
    const W = 400, H = 400;
    let svg = '<svg class="csma-flowchart" viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="CSMA/CD flowchart">';
    svg += '<defs><marker id="fc-arrow" markerWidth="7" markerHeight="7" refX="6" refY="3.5" orient="auto"><path d="M0,0 L0,7 L6,3.5 z" fill="var(--ink-soft)"/></marker>';
    svg += '<marker id="fc-arrow-active" markerWidth="7" markerHeight="7" refX="6" refY="3.5" orient="auto"><path d="M0,0 L0,7 L6,3.5 z" fill="var(--accent)"/></marker></defs>';

    // Edges
    FC_EDGES.forEach(function (e) {
      var from = FC_NODES.find(function (n) { return n.id === e.from; });
      var to = FC_NODES.find(function (n) { return n.id === e.to; });
      var active = activeId === e.from || activeId === e.to;
      var stroke = active ? 'var(--accent)' : 'var(--ink-faint)';
      var marker = active ? 'url(#fc-arrow-active)' : 'url(#fc-arrow)';
      var sw = active ? '2.5' : '1.5';
      if (e.curve === 'right-loop') {
        // idle → sense (loop via right side — channel busy, wait)
        var mx = from.x + from.w / 2 + 30;
        svg += '<path d="M' + (from.x + from.w / 2) + ' ' + (from.y) + ' C' + mx + ' ' + from.y + ' ' + mx + ' ' + to.y + ' ' + (to.x + to.w / 2) + ' ' + to.y + '" fill="none" stroke="' + stroke + '" stroke-width="' + sw + '" marker-end="' + marker + '" stroke-dasharray="4 3"/>';
        svg += '<text x="' + (mx + 4) + '" y="' + ((from.y + to.y) / 2 + 4) + '" class="fc-edge-label">' + e.label + '</text>';
      } else if (e.curve === 'top-loop') {
        // backoff → sense (loop up over the top)
        svg += '<path d="M' + (from.x + from.w / 2) + ' ' + from.y + ' C' + (from.x + from.w / 2) + ' ' + (from.y - 60) + ' ' + (to.x + to.w / 2 + 50) + ' ' + to.y + ' ' + (to.x + to.w / 2) + ' ' + to.y + '" fill="none" stroke="' + stroke + '" stroke-width="' + sw + '" marker-end="' + marker + '"/>';
      } else {
        // straight line
        var x1 = from.x + from.w / 2, y1 = from.y + from.h;
        var x2 = to.x + to.w / 2, y2 = to.y;
        // for horizontal edges
        if (Math.abs(from.y - to.y) < 10) {
          x1 = from.x + from.w; y1 = from.y + from.h / 2;
          x2 = to.x; y2 = to.y + to.h / 2;
        }
        svg += '<line x1="' + x1 + '" y1="' + y1 + '" x2="' + x2 + '" y2="' + y2 + '" stroke="' + stroke + '" stroke-width="' + sw + '" marker-end="' + marker + '"/>';
        if (e.label) {
          svg += '<text x="' + ((x1 + x2) / 2 + 6) + '" y="' + ((y1 + y2) / 2 + 2) + '" class="fc-edge-label">' + e.label + '</text>';
        }
      }
    });

    // Nodes
    FC_NODES.forEach(function (n) {
      var active = n.id === activeId;
      var fill = active ? 'var(--accent-soft)' : 'var(--paper-raised)';
      var strokeC = active ? 'var(--accent)' : 'var(--line-strong)';
      var strokeW = active ? '2.5' : '1.5';
      var textFill = active ? 'var(--accent)' : 'var(--ink)';
      var lines = n.label.split('\n');
      if (n.shape === 'diamond') {
        var cx = n.x + n.w / 2, cy = n.y + n.h / 2;
        svg += '<polygon points="' + cx + ',' + n.y + ' ' + (n.x + n.w) + ',' + cy + ' ' + cx + ',' + (n.y + n.h) + ' ' + n.x + ',' + cy + '" fill="' + fill + '" stroke="' + strokeC + '" stroke-width="' + strokeW + '"/>';
      } else if (n.shape === 'round') {
        svg += '<rect x="' + n.x + '" y="' + n.y + '" width="' + n.w + '" height="' + n.h + '" rx="' + (n.h / 2) + '" fill="' + fill + '" stroke="' + strokeC + '" stroke-width="' + strokeW + '"/>';
      } else {
        svg += '<rect x="' + n.x + '" y="' + n.y + '" width="' + n.w + '" height="' + n.h + '" rx="4" fill="' + fill + '" stroke="' + strokeC + '" stroke-width="' + strokeW + '"/>';
      }
      var tx = n.x + n.w / 2, ty = n.y + n.h / 2 + (lines.length > 1 ? -5 : 4);
      lines.forEach(function (line, li) {
        svg += '<text x="' + tx + '" y="' + (ty + li * 13) + '" text-anchor="middle" class="fc-node-label" fill="' + textFill + '">' + line + '</text>';
      });
    });

    svg += '</svg>';
    return svg;
  }

  /** Map a simulation phase to the flowchart node id */
  function phaseToNode(phase) {
    if (phase === 'sense') return 'sense';
    if (phase === 'transmit') return 'transmit';
    if (phase === 'collide' || phase === 'retie') return 'collide';
    if (phase === 'backoff') return 'backoff';
    if (phase === 'success' || phase === 'defer') return 'success';
    return 'sense';
  }

  NetSim.SimRegistry.register('csma-cd', function factory(ctx) {
    let events = [];
    let index = -1;
    let timer = null;
    let host = null;
    let finalStats = {};

    function buildRun() {
      const out = [];
      let attempt = 1;
      let winner = null, loser = null, finalWindow = 0;
      while (attempt <= 6) {
        out.push({ text: 'Both stations listen to the shared Ethernet bus and sense it idle.', phase: 'sense', channel: 'idle' });
        out.push({ text: 'Both stations start transmitting at nearly the same time.', phase: 'transmit', channel: 'busy' });
        out.push({ text: 'Both detect the collision, stop transmitting, and send a jam signal.', level: 'warning', phase: 'collide', channel: 'collision' });
        const windowSize = Math.pow(2, Math.min(attempt, 10));
        finalWindow = windowSize;
        let bA = Math.floor(Math.random() * windowSize);
        let bB = Math.floor(Math.random() * windowSize);
        if (attempt >= 6 && bA === bB) bB = bA === 0 ? 1 : 0;
        out.push({ text: 'Binary exponential backoff, attempt ' + attempt + ': contention window = 0\u2013' + (windowSize - 1) + ' slot times.', phase: 'backoff' });
        out.push({ text: 'Station A picks backoff = ' + bA + ' slots. Station B picks backoff = ' + bB + ' slots.', phase: 'backoff', channel: 'idle', bA, bB, windowSize, attempt });
        if (bA === bB) {
          out.push({ text: 'Both picked the same backoff \u2014 they will collide again.', level: 'warning', phase: 'retie', channel: 'idle', bA, bB });
          attempt += 1;
          continue;
        }
        winner = bA < bB ? 'A' : 'B';
        loser = winner === 'A' ? 'B' : 'A';
        out.push({ text: 'Station ' + winner + '\u2019s backoff reaches zero first \u2014 it senses the medium idle and transmits successfully \u2713', level: 'success', phase: 'success', channel: 'busy', winner, loser, bA, bB });
        out.push({ text: 'Station ' + loser + ' senses the medium busy during its countdown and waits for the next opportunity.', phase: 'defer', channel: 'busy', winner, loser, bA, bB });
        break;
      }
      finalStats = { attempts: attempt, window: finalWindow, winner, loser };
      return out;
    }

    function draw() {
      const step = events[Math.max(0, index)] || {};
      const stateA = stationClass('A', step);
      const stateB = stationClass('B', step);
      const channel = step.channel === 'busy' ? 'BUSY' : step.channel === 'collision' ? 'COLLISION' : 'IDLE';
      const statusFor = (name) => step.phase === 'sense' ? 'SENSING' : step.phase === 'backoff' ? 'BACKOFF' : step.phase === 'collide' || step.phase === 'retie' ? 'COLLISION' : step.winner === name ? 'TRANSMITTING' : step.loser === name ? 'WAITING' : 'READY';
      const node = (name, x, status, klass) => '<g class="mac-topo-station ' + klass + '"><circle cx="' + x + '" cy="90" r="43"/><text class="mac-topo-name" x="' + x + '" y="86">Station ' + name + '</text><text class="mac-topo-state" x="' + x + '" y="104">' + status + '</text></g>';
      const linkA = step.phase === 'transmit' || step.phase === 'collide' ? 'is-active is-collision' : step.phase === 'success' && step.winner === 'A' ? 'is-active' : '';
      const linkB = step.phase === 'transmit' || step.phase === 'collide' ? 'is-active is-collision' : step.phase === 'success' && step.winner === 'B' ? 'is-active' : '';

      const activeNode = index >= 0 ? phaseToNode(step.phase) : null;
      const simSvg = '<svg class="mac-topology-svg" viewBox="0 0 600 240" role="img" aria-label="Ethernet stations connected to a shared bus">' +
        '<line class="mac-topo-link ' + linkA + '" x1="170" y1="90" x2="260" y2="145"/><line class="mac-topo-link ' + linkB + '" x1="430" y1="90" x2="340" y2="145"/>' +
        node('A', 125, statusFor('A'), stateA) + node('B', 475, statusFor('B'), stateB) +
        '<g class="mac-topo-channel ' + (step.channel === 'busy' ? 'is-busy' : step.channel === 'collision' ? 'is-collision' : '') + '"><rect x="220" y="125" width="160" height="68" rx="5"/><text class="mac-topo-channel-name" x="300" y="151">SHARED ETHERNET</text><text class="mac-topo-channel-state" x="300" y="174">' + channel + '</text></g></svg>';

      host.innerHTML = '<div class="csma-split">' +
        '<div class="csma-sim-side">' + simSvg +
          '<p class="mac-event">' + (step.text || 'Press Start or Step to let stations sense the shared bus.') + '</p>' +
        '</div>' +
        '<div class="csma-fc-side">' +
          '<div class="csma-fc-title">CSMA/CD Flowchart</div>' +
          renderFlowchart(activeNode) +
        '</div>' +
      '</div>';

      ctx.setMetrics([
        { label: 'Attempts', value: String(finalStats.attempts) },
        { label: 'Collisions', value: String(finalStats.attempts) },
        { label: 'Final Contention Window', value: '0\u2013' + (finalStats.window - 1) + ' slots' },
        { label: 'Winner', value: finalStats.winner ? 'Station ' + finalStats.winner : '\u2014' },
        { label: 'Outcome', value: index >= events.length - 1 ? 'Resolved' : 'In progress' }
      ]);
    }

    function stationClass(name, step) {
      if (step.phase === 'collide' || step.phase === 'transmit') return 'is-off';
      if (step.phase === 'success' && step.winner === name) return 'is-transmitting';
      if ((step.phase === 'success' || step.phase === 'defer') && step.loser === name) return 'is-waiting';
      return '';
    }

    function rebuild() {
      stop();
      index = -1;
      events = buildRun();
      ctx.params.hidden = true;
      draw();
      ctx.log('Ready \u2014 two stations about to contend for the shared bus.');
    }

    function stop() { if (timer) { NetSim.SimTiming.clearInterval(timer); timer = null; } }

    function advance() {
      if (index >= events.length - 1) { stop(); return; }
      index += 1;
      ctx.log(events[index].text, events[index].level);
      draw();
    }

    return {
      initialize() {
        ctx.canvas.classList.add('net-canvas');
        ctx.canvas.innerHTML = '<div class="cd-mount"></div>';
        host = ctx.canvas.querySelector('.cd-mount');
        rebuild();
      },
      start() { if (timer) return; timer = NetSim.SimTiming.setInterval(() => { if (index >= events.length - 1) { stop(); return; } advance(); }, 700); },
      pause() { stop(); },
      step() { stop(); advance(); },
      reset() { rebuild(); },
      destroy() { stop(); }
    };
  });

})(window.NetSim = window.NetSim || {});
