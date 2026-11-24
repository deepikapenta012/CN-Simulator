(function (NetSim) {
  'use strict';

  const runs = {
    hidden: {
      title: 'Hidden station problem',
      description: 'A and C cannot hear one another, so both sense an idle channel and transmit to B. Their frames overlap at B and collide.',
      events: [
        ['A and C are both ready to send a frame to receiver B.', 'idle'],
        ['A and C are outside each other’s sensing range. Each hears an idle channel.', 'sense'],
        ['A starts sending to B. C cannot hear A, so C still senses idle.', 'first'],
        ['C starts sending to B while A is still transmitting.', 'both'],
        ['The signals overlap at B: neither frame can be decoded. CSMA carrier sensing did not prevent this collision.', 'collision']
      ],
      nodes: [['A', 70, 140], ['B', 300, 140], ['C', 530, 140]],
      links: [[70, 140, 300, 140], [530, 140, 300, 140]],
      coverage: [[70, 140, 210], [530, 140, 210]],
      transmissions: [[70, 140, 300, 140], [530, 140, 300, 140]]
    },
    exposed: {
      title: 'Exposed station problem',
      description: 'C hears A and defers, even though C’s transmission to D would not interfere with A’s transmission to B. The channel is safe to reuse but goes unused.',
      events: [
        ['A sends a frame to B while C has a frame queued for D.', 'idle'],
        ['C can hear A, so carrier sensing reports the channel busy at C.', 'sense'],
        ['C defers its transmission to D because A is active.', 'defer'],
        ['A → B and C → D could happen at the same time: the receivers are far enough apart to avoid interference.', 'parallel'],
        ['C remains silent unnecessarily. This is the exposed station problem: safe spatial reuse is lost.', 'waste']
      ],
      nodes: [['A', 70, 140], ['B', 210, 140], ['C', 390, 140], ['D', 530, 140]],
      links: [[70, 140, 210, 140], [390, 140, 530, 140]],
      coverage: [[70, 140, 330]],
      transmissions: [[70, 140, 210, 140], [390, 140, 530, 140]]
    }
  };

  NetSim.SimRegistry.register('csma-failures', function (ctx) {
    let host, mode = 'hidden', index = -1;
    function draw() {
      const run = runs[mode];
      const event = run.events[index];
      const active = event ? event[1] : '';
      const circle = (x, y, r) => '<circle class="csf-range" cx="' + x + '" cy="' + y + '" r="' + r + '"/>';
      const station = (name, x, y) => {
        const talking = active === name || (active === 'both' || active === 'collision') && (mode === 'hidden' && (name === 'A' || name === 'C') || mode === 'exposed' && name === 'A') || active === 'parallel' && (name === 'A' || name === 'C');
        const deferred = active === 'defer' && name === 'C' || (active === 'defer' || active === 'waste') && mode === 'exposed' && name === 'C';
        return '<g class="csf-station ' + (talking ? 'is-talking' : deferred ? 'is-deferred' : '') + '"><circle cx="' + x + '" cy="' + y + '" r="25"/><text x="' + x + '" y="' + (y + 5) + '">' + name + '</text></g>';
      };
      const link = (l, n) => {
        const activeLink = mode === 'hidden' ? active === 'first' && n === 0 || (active === 'both' || active === 'collision') : n === 0 && (active === 'sense' || active === 'defer' || active === 'waste' || active === 'parallel') || n === 1 && active === 'parallel';
        const collision = mode === 'hidden' && (active === 'both' || active === 'collision');
        const x1 = l[0] + (l[2] > l[0] ? 26 : -26), x2 = l[2] + (l[0] > l[2] ? 26 : -26);
        const id = 'csf-path-' + n;
        let out = '<line id="' + id + '" class="csf-link ' + (collision ? 'is-collision' : activeLink ? 'is-active' : '') + '" x1="' + x1 + '" y1="' + l[1] + '" x2="' + x2 + '" y2="' + l[3] + '" marker-end="url(#csf-arrow)"/>';
        out += '<text class="csf-link-label" x="' + ((l[0] + l[2]) / 2) + '" y="' + (l[1] - 14) + '">' + (mode === 'hidden' ? n === 0 ? 'A → B' : 'C → B' : n === 0 ? 'A → B' : 'C → D') + '</text>';
        if (activeLink) out += '<circle class="csf-packet ' + (collision ? 'is-collision' : '') + '" r="6"><animateMotion dur="1.2s" repeatCount="indefinite"><mpath href="#' + id + '"/></animateMotion></circle>';
        return out;
      };
      let svg = '<svg class="csf-diagram" viewBox="0 0 600 280" role="img" aria-label="' + run.title + ' network diagram"><defs><marker id="csf-arrow" markerWidth="8" markerHeight="8" refX="6" refY="4" orient="auto"><path d="M0 0 L8 4 L0 8 z"/></marker></defs>';
      run.coverage.forEach(c => { svg += circle(c[0], c[1], c[2]); });
      run.links.forEach((l, n) => { svg += link(l, n); });
      if (mode === 'hidden') svg += '<text class="csf-note" x="300" y="245">Dashed circles: carrier-sense range · A and C cannot hear each other</text>';
      else svg += '<text class="csf-note" x="300" y="245">A’s sensing range reaches C; D is outside A’s range</text>';
      run.nodes.forEach(n => { svg += station(n[0], n[1], n[2]); });
      if (active === 'both' || active === 'collision') svg += '<text class="csf-impact" x="300" y="62">COLLISION AT B</text>';
      if (active === 'defer' || active === 'waste') svg += '<text class="csf-impact csf-deferred-label" x="390" y="62">C DEFERRED</text>';
      if (active === 'parallel') svg += '<text class="csf-impact" x="300" y="62">SAFE SPATIAL REUSE</text>';
      svg += '</svg>';
      host.innerHTML = '<div class="csf-toolbar"><button class="btn btn--small ' + (mode === 'hidden' ? 'btn--primary' : 'btn--secondary') + '" data-case="hidden">Hidden station</button><button class="btn btn--small ' + (mode === 'exposed' ? 'btn--primary' : 'btn--secondary') + '" data-case="exposed">Exposed station</button></div><h3>' + run.title + '</h3><p class="csf-description">' + run.description + '</p>' + svg + '<p class="mac-event">' + (event ? event[0] : 'Press Step or Start to see the failure unfold.') + '</p>';
      host.querySelectorAll('[data-case]').forEach(button => button.addEventListener('click', () => { mode = button.dataset.case; index = -1; draw(); }));
    }
    function advance() { if (index < runs[mode].events.length - 1) index++; draw(); if (index >= 0) ctx.log(runs[mode].events[index][0]); }
    return {
      initialize() { ctx.canvas.classList.add('net-canvas'); ctx.canvas.innerHTML = '<div class="csf-mount"></div>'; host = ctx.canvas.querySelector('.csf-mount'); draw(); },
      start() { if (this.timer) return; this.timer = NetSim.SimTiming.setInterval(() => { if (index >= runs[mode].events.length - 1) { NetSim.SimTiming.clearInterval(this.timer); this.timer = null; return; } advance(); }, 1100); },
      pause() { if (this.timer) NetSim.SimTiming.clearInterval(this.timer); this.timer = null; },
      step() { this.pause(); advance(); },
      reset() { this.pause(); index = -1; draw(); },
      destroy() { this.pause(); }
    };
  });
})(window.NetSim = window.NetSim || {});
