/* ==========================================================================
   NetSim — simulations/datagram.js
   Connectionless routing: every packet makes its own independent routing
   decision. A mid-stream congestion event changes the best path, and
   later packets adapt immediately — no connection to renegotiate,
   unlike circuit switching.
   ========================================================================== */

(function (NetSim) {
  'use strict';

  NetSim.SimRegistry.register('datagram', function factory(ctx) {
    let network = null;
    let state = null;
    let steps = [];
    let index = -1;
    let timer = null;

    function buildSteps() {
      const topo = NetSim.Core.Network.createTopology();
      const pathA = NetSim.Core.Network.computePath(topo.links, 'A', 'B', new Set());
      const pathB = NetSim.Core.Network.computePath(topo.links, 'A', 'B', new Set(['R1-R2', 'R2-R4']));

      const out = [];
      for (let i = 1; i <= 2; i++) {
        pathA.nodes.slice(1).forEach((n, hopIdx) => {
          out.push({ text: 'P' + i + ' (independent routing decision): reaches ' + n + '.', atNode: n, linkId: pathA.links[hopIdx], path: pathA, seq: i });
        });
        out.push({ text: 'P' + i + ' delivered via ' + pathA.nodes.join('\u2192') + '.', level: 'success', atNode: null, seq: i });
      }
      out.push({ text: 'The R1\u2013R2 link becomes congested. There is no connection to tear down \u2014 routers simply update their forwarding tables.', level: 'warning', atNode: null, congest: true });
      for (let i = 3; i <= 5; i++) {
        pathB.nodes.slice(1).forEach((n, hopIdx) => {
          out.push({ text: 'P' + i + ' (independent routing decision): reaches ' + n + '.', atNode: n, linkId: pathB.links[hopIdx], path: pathB, seq: i, congested: true });
        });
        out.push({ text: 'P' + i + ' delivered via ' + pathB.nodes.join('\u2192') + ' \u2014 automatically routed around the congestion.', level: 'success', atNode: null, seq: i, congested: true });
      }
      out.push({ text: 'Five packets from the same message took two different paths, each decided independently \u2014 the defining trait of datagram (connectionless) routing.', level: 'success', atNode: null, final: true });
      return out;
    }

    function draw() {
      const s = steps[Math.max(0, index)] || {};
      const congested = steps.slice(0, index + 1).some((e) => e.congest);
      state.links.forEach((l) => { l.status = (congested && l.id === 'R1-R2') ? 'failed' : 'normal'; });
      state.entities = s.atNode ? [{ id: 'pkt', kind: 'packet', atNode: s.atNode, linkId: s.linkId, seq: s.seq }] : [];
      network.sync(state, { animationSpeed: 1 });

      const pathsUsed = new Set(steps.slice(0, index + 1).filter((e) => e.level === 'success' && e.seq).map((e) => e.path ? e.path.nodes.join('\u2192') : (e.congested ? 'A\u2192R1\u2192R3\u2192R4\u2192B' : 'A\u2192R1\u2192R2\u2192R4\u2192B')));
      ctx.setMetrics([
        { label: 'Packets Sent', value: String(new Set(steps.slice(0, index + 1).map((e) => e.seq).filter(Boolean)).size) },
        { label: 'Distinct Paths Used', value: String(pathsUsed.size) },
        { label: 'Connection Setup Needed', value: 'No' },
        { label: 'Routing Decision', value: 'Made independently, per packet' }
      ]);
    }

    function rebuild() {
      stop();
      index = -1;
      const topo = NetSim.Core.Network.createTopology();
      state = { mode: 'datagram', links: topo.links, entities: [], done: false };
      steps = buildSteps();
      ctx.params.hidden = true;
      network.sync(state, { animationSpeed: 1 });
      draw();
      ctx.log('Ready \u2014 5 independent packets about to travel from A to B.');
    }

    function stop() { if (timer) { NetSim.SimTiming.clearInterval(timer); timer = null; } }

    function advance() {
      if (index >= steps.length - 1) { stop(); return; }
      index += 1;
      ctx.log(steps[index].text, steps[index].level);
      draw();
    }

    return {
      initialize() {
        ctx.canvas.classList.add('net-canvas');
        ctx.canvas.innerHTML = '<div class="net-mount"></div>';
        network = NetSim.Components.NetworkCanvas.mount(ctx.canvas.querySelector('.net-mount'), {});
        rebuild();
      },
      start() { if (timer) return; timer = NetSim.SimTiming.setInterval(() => { if (index >= steps.length - 1) { stop(); return; } advance(); }, 500); },
      pause() { stop(); },
      step() { stop(); advance(); },
      reset() { rebuild(); },
      destroy() { stop(); }
    };
  });

})(window.NetSim = window.NetSim || {});
