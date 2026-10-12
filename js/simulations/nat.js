/* ==========================================================================
   NetSim — simulations/nat.js
   Port Address Translation: several internal hosts share one public IP,
   each outbound flow gets a unique public port, and an inbound reply is
   only accepted if it matches an entry already in the table — an
   unsolicited inbound packet has nowhere to go and is dropped.
   ========================================================================== */

(function (NetSim) {
  'use strict';

  const PUBLIC_IP = '203.0.113.5';

  NetSim.SimRegistry.register('nat', function factory(ctx) {
    let table = [];
    let events = [];
    let index = -1;
    let timer = null;
    let host = null;

    function buildEvents() {
      table = [];
      const flows = [
        { internal: '10.0.0.2:5001', dest: '93.184.216.34:443', port: 40001 },
        { internal: '10.0.0.3:5002', dest: '142.250.72.78:443', port: 40002 },
        { internal: '10.0.0.4:5003', dest: '93.184.216.34:80', port: 40003 }
      ];
      const out = [];
      flows.forEach((f) => {
        out.push({
          text: f.internal + ' sends a packet to ' + f.dest + '. NAT router creates a table entry: ' + f.internal + ' \u2194 ' + PUBLIC_IP + ':' + f.port,
          addEntry: f
        });
      });
      out.push({ text: 'Outbound packets now leave with source ' + PUBLIC_IP + ' and their assigned port \u2014 the destination only ever sees the public address.', level: 'success' });
      out.push({ text: 'A reply arrives addressed to ' + PUBLIC_IP + ':40002. NAT looks up port 40002 in its table...', phase: 'inboundGood' });
      out.push({ text: 'Match found \u2014 translated back to 10.0.0.3:5002 and delivered internally.', level: 'success', phase: 'inboundGood' });
      out.push({ text: 'An unsolicited packet arrives addressed to ' + PUBLIC_IP + ':50000 \u2014 no table entry exists for that port.', phase: 'inboundBad', level: 'warning' });
      out.push({ text: 'With no matching entry, NAT has no internal host to deliver it to \u2014 the packet is dropped. This is why NAT incidentally blocks unsolicited inbound connections.', phase: 'inboundBad', level: 'error' });
      return out;
    }

    function draw() {
      const step = events[Math.max(0, index)] || {};
      if (step.addEntry && !table.includes(step.addEntry)) table.push(step.addEntry);

      host.innerHTML = `
        <div class="fw-diagram">
          <div class="fw-node">Internal Hosts</div>
          <div class="fw-packet-track"><span class="fw-arrow" style="font-size:1.2rem;">${step.phase && step.phase.startsWith('inbound') ? '\u2190' : '\u2192'}</span></div>
          <div class="fw-node" style="border-color:var(--teal);color:var(--teal);">NAT Router<br><span style="font-size:0.65rem;">${PUBLIC_IP}</span></div>
          <div class="fw-packet-track"><span class="fw-arrow" style="font-size:1.2rem;">${step.phase && step.phase.startsWith('inbound') ? '\u2190' : '\u2192'}</span></div>
          <div class="fw-node">Internet</div>
        </div>
        <div style="overflow-x:auto;margin-top:0.75rem;">
          <table class="compare-table"><thead><tr><th>Internal</th><th>Public</th><th>Destination</th></tr></thead>
          <tbody>${table.map((f) => `<tr><td class="mono">${f.internal}</td><td class="mono">${PUBLIC_IP}:${f.port}</td><td class="mono">${f.dest}</td></tr>`).join('') || '<tr><td colspan="3" style="color:var(--ink-faint);">No entries yet</td></tr>'}</tbody></table>
        </div>
      `;

      ctx.setMetrics([
        { label: 'Public IP', value: PUBLIC_IP },
        { label: 'NAT Table Entries', value: String(table.length) },
        { label: 'Inbound Accepted', value: String(events.slice(0, index + 1).filter((e) => e.phase === 'inboundGood' && e.level === 'success').length) },
        { label: 'Inbound Dropped', value: String(events.slice(0, index + 1).filter((e) => e.phase === 'inboundBad' && e.level === 'error').length) }
      ]);
    }

    function rebuild() {
      stop();
      index = -1;
      events = buildEvents();
      ctx.params.hidden = true;
      draw();
      ctx.log('Ready \u2014 three internal hosts are about to share one public IP address.');
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
        ctx.canvas.innerHTML = '<div class="nat-mount"></div>';
        host = ctx.canvas.querySelector('.nat-mount');
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
