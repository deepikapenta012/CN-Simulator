/* ==========================================================================
   NetSim — simulations/icmp.js
   Two tabs on the same shared topology (A-R1-R2/R3-R4-B):
   - Ping: Echo Request / Echo Reply round trip.
   - Traceroute: real TTL-expiry hop discovery — each probe's TTL limits
     how far it gets before an intermediate router sends back a genuine
     ICMP Time Exceeded message, one more hop revealed each round.
   ========================================================================== */

(function (NetSim) {
  'use strict';

  NetSim.SimRegistry.register('icmp', function factory(ctx) {
    let mode = 'ping';
    let network = null;
    let path = null;
    let state = null;
    let steps = [];
    let index = -1;
    let timer = null;

    function buildTopologyState() {
      const topo = NetSim.Core.Network.createTopology();
      path = NetSim.Core.Network.computePath(topo.links, 'A', 'B', new Set());
      return { mode: 'icmp', links: topo.links, entities: [], done: false };
    }

    function buildPingSteps() {
      const hops = path.links.length;
      const rtt = hops * 22;
      return [
        { text: 'A sends an ICMP Echo Request toward B.', atNode: 'A', dir: 'out' },
        { text: 'The request travels ' + hops + ' hop(s): ' + path.nodes.join(' \u2192 ') + '.', atNode: 'B', dir: 'out' },
        { text: 'B replies with an ICMP Echo Reply.', atNode: 'B', dir: 'back' },
        { text: 'A receives the reply. Round-trip time \u2248 ' + rtt + ' ms.', atNode: 'A', dir: 'back', level: 'success', rtt }
      ];
    }

    function buildTracerouteSteps() {
      const out = [];
      const totalHops = path.nodes.length - 1;
      for (let ttl = 1; ttl <= totalHops; ttl++) {
        out.push({ text: 'Sending a probe with TTL = ' + ttl + '.', atNode: 'A', linkId: null, ttl });
        for (let hop = 1; hop <= ttl; hop++) {
          out.push({ text: 'Probe reaches ' + path.nodes[hop] + ' (TTL now ' + (ttl - hop) + ').', atNode: path.nodes[hop], linkId: path.links[hop - 1], ttl });
        }
        const lastNode = path.nodes[ttl];
        if (ttl === totalHops) {
          out.push({ text: 'TTL was enough to reach the destination \u2014 B replies with an Echo Reply. Traceroute complete \u2713', level: 'success', atNode: 'B', done: true });
        } else {
          out.push({ text: 'TTL expired at ' + lastNode + ' \u2014 it sends an ICMP Time Exceeded message back to A. Hop ' + ttl + ' = ' + lastNode, level: 'warning', atNode: lastNode, hopFound: { n: ttl, node: lastNode } });
        }
      }
      return out;
    }

    function rebuild() {
      stop();
      index = -1;
      state = buildTopologyState();
      steps = mode === 'ping' ? buildPingSteps() : buildTracerouteSteps();
      network.sync(state, { animationSpeed: 1 });
      renderParams();
      paintMetrics();
      ctx.log('Ready \u2014 ' + (mode === 'ping' ? 'pinging B from A.' : 'tracing the route from A to B.'));
    }

    function renderParams() {
      ctx.params.hidden = false;
      ctx.params.innerHTML = `
        <div class="switch-tabs" role="tablist" aria-label="ICMP mode">
          <button type="button" class="switch-tab ${mode === 'ping' ? 'is-active' : ''}" data-mode="ping" role="tab">Ping</button>
          <button type="button" class="switch-tab ${mode === 'traceroute' ? 'is-active' : ''}" data-mode="traceroute" role="tab">Traceroute</button>
        </div>
      `;
      ctx.params.querySelectorAll('.switch-tab').forEach((tab) => {
        tab.addEventListener('click', () => {
          if (tab.dataset.mode === mode) return;
          mode = tab.dataset.mode;
          rebuild();
        });
      });
    }

    function paintMetrics() {
      if (mode === 'ping') {
        const done = index >= steps.length - 1;
        ctx.setMetrics([
          { label: 'Mode', value: 'Ping (Echo Request/Reply)' },
          { label: 'Hops', value: String(path.links.length) },
          { label: 'Path', value: path.nodes.join(' \u2192 ') },
          { label: 'RTT', value: done ? steps[steps.length - 1].rtt + ' ms' : '\u2014' }
        ]);
      } else {
        const found = steps.slice(0, index + 1).map((s) => s.hopFound).filter(Boolean);
        ctx.setMetrics([
          { label: 'Mode', value: 'Traceroute (TTL expiry)' },
          { label: 'Total Hops', value: String(path.nodes.length - 1) },
          { label: 'Hops Discovered', value: found.length + ' / ' + (path.nodes.length - 1) },
          { label: 'Route So Far', value: found.length ? 'A \u2192 ' + found.map((f) => f.node).join(' \u2192 ') : 'A' }
        ]);
      }
    }

    function stop() { if (timer) { clearInterval(timer); timer = null; } }

    function advance() {
      if (index >= steps.length - 1) { stop(); return; }
      index += 1;
      const s = steps[index];
      state.entities = s.atNode ? [{ id: 'probe', kind: 'packet', atNode: s.atNode, linkId: s.linkId || null, seq: mode === 'traceroute' ? s.ttl : 1 }] : [];
      network.sync(state, { animationSpeed: 1 });
      ctx.log(s.text, s.level);
      paintMetrics();
    }

    return {
      initialize() {
        ctx.canvas.classList.add('net-canvas');
        ctx.canvas.innerHTML = '<div class="net-mount"></div>';
        network = NetSim.Components.NetworkCanvas.mount(ctx.canvas.querySelector('.net-mount'), {});
        rebuild();
      },
      start() { if (timer) return; timer = setInterval(() => { if (index >= steps.length - 1) { stop(); return; } advance(); }, 700); },
      pause() { stop(); },
      step() { stop(); advance(); },
      reset() { rebuild(); },
      destroy() { stop(); }
    };
  });

})(window.NetSim = window.NetSim || {});
