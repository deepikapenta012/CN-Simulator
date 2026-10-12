/* ==========================================================================
   NetSim — simulations/igmp.js
   Hosts join a multicast group with a Membership Report; the router
   queries periodically, and — the detail most summaries skip — other
   members suppress their own report once they hear someone else's for
   the same group, so the router doesn't get flooded with duplicates.
   ========================================================================== */

(function (NetSim) {
  'use strict';

  NetSim.SimRegistry.register('igmp', function factory(ctx) {
    const group = '230.0.0.1';
    let events = [];
    let index = -1;
    let timer = null;
    let host = null;

    function buildEvents() {
      return [
        { text: 'H1 wants to join multicast group ' + group + ' and sends a Membership Report.', phase: 'joinH1', members: ['H1'] },
        { text: 'The router adds ' + group + ' to its forwarding table and starts delivering multicast traffic for it onto this LAN.', phase: 'forward', level: 'success', members: ['H1'] },
        { text: 'H2 also wants ' + group + ' and sends its own Membership Report.', phase: 'joinH2', members: ['H1', 'H2'] },
        { text: 'The router periodically sends a Membership Query to confirm who still wants each group.', phase: 'query', members: ['H1', 'H2'] },
        { text: 'H1 starts to respond, but H2 happens to respond first for the same group \u2014 H1 hears it and suppresses its own report (no need for both).', phase: 'suppress', members: ['H1', 'H2'] },
        { text: 'The router sees at least one report for ' + group + ' and keeps forwarding.', phase: 'keep', level: 'success', members: ['H1', 'H2'] },
        { text: 'H1 leaves the group and sends a Leave Group message.', phase: 'leave', members: ['H2'] },
        { text: 'The router sends a group-specific query for ' + group + ' to check if anyone else still wants it.', phase: 'specific', members: ['H2'] },
        { text: 'H2 responds \u2014 it is still a member, so the router keeps forwarding ' + group + '.', phase: 'stillthere', level: 'success', members: ['H2'] }
      ];
    }

    function draw() {
      const step = events[Math.max(0, index)] || { members: [] };
      const members = step.members || [];
      const hosts = ['H1', 'H2', 'H3'];
      host.innerHTML = `
        <div style="display:flex;justify-content:center;gap:0.6rem;margin-bottom:1rem;">
          ${hosts.map((h) => `<span class="packet-chip ${members.includes(h) ? 'delivered' : 'pending'}">${h}${members.includes(h) ? ' \u2713' : ''}</span>`).join('')}
        </div>
        <div class="fw-diagram">
          <div class="fw-node">Hosts</div>
          <div class="fw-packet-track"><span class="fw-arrow" style="font-size:1.2rem;">${step.phase === 'query' || step.phase === 'specific' ? '\u2190' : '\u2192'}</span></div>
          <div class="fw-node" style="border-color:var(--teal);color:var(--teal);">Router</div>
        </div>
        <p class="net-hint" style="margin-top:0.75rem;">Group ${group} \u2014 current members: ${members.length ? members.join(', ') : 'none'}</p>
      `;
      ctx.setMetrics([
        { label: 'Multicast Group', value: group },
        { label: 'Current Members', value: members.length ? members.join(', ') : 'none' },
        { label: 'Reports Suppressed', value: String(events.slice(0, index + 1).filter((e) => e.phase === 'suppress').length) },
        { label: 'Router Forwarding', value: members.length ? 'Yes' : 'No' }
      ]);
    }

    function rebuild() {
      stop();
      index = -1;
      events = buildEvents();
      ctx.params.hidden = true;
      draw();
      ctx.log('Ready \u2014 hosts on the LAN are about to join a multicast group.');
    }

    function stop() { if (timer) { clearInterval(timer); timer = null; } }

    function advance() {
      if (index >= events.length - 1) { stop(); return; }
      index += 1;
      ctx.log(events[index].text, events[index].level);
      draw();
    }

    return {
      initialize() {
        ctx.canvas.classList.add('net-canvas');
        ctx.canvas.innerHTML = '<div class="igmp-mount"></div>';
        host = ctx.canvas.querySelector('.igmp-mount');
        rebuild();
      },
      start() { if (timer) return; timer = setInterval(() => { if (index >= events.length - 1) { stop(); return; } advance(); }, 750); },
      pause() { stop(); },
      step() { stop(); advance(); },
      reset() { rebuild(); },
      destroy() { stop(); }
    };
  });

})(window.NetSim = window.NetSim || {});
