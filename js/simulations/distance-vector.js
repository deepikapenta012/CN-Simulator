/* ==========================================================================
   NetSim — simulations/distance-vector.js
   Real distributed Bellman-Ford (RIP-style) distance-vector routing on a
   5-router line: A-B-C-D-E. Runs synchronous rounds until every router's
   table converges, then — if enabled — fails the A-B link and re-runs,
   with a toggle to show the classic count-to-infinity problem versus the
   split-horizon-with-poisoned-reverse fix for it.
   ========================================================================== */

(function (NetSim) {
  'use strict';

  const NODES = ['A', 'B', 'C', 'D', 'E'];
  const BASE_LINKS = [
    { a: 'A', b: 'B', cost: 1 },
    { a: 'B', b: 'C', cost: 1 },
    { a: 'C', b: 'D', cost: 1 },
    { a: 'D', b: 'E', cost: 1 }
  ];
  const INFINITY_CAP = 16; // RIP-style "infinity" — stops counting up forever
  const MAX_ROUNDS = 40;

  function neighborsOf(node, links) {
    const out = [];
    links.forEach((l) => {
      if (l.a === node) out.push({ node: l.b, cost: l.cost });
      if (l.b === node) out.push({ node: l.a, cost: l.cost });
    });
    return out;
  }

  function initTable() {
    const table = {}, nextHop = {};
    NODES.forEach((u) => {
      table[u] = {}; nextHop[u] = {};
      NODES.forEach((d) => { table[u][d] = u === d ? 0 : Infinity; nextHop[u][d] = null; });
    });
    return { table, nextHop };
  }

  function cloneTables(table, nextHop) {
    const t2 = {}, n2 = {};
    NODES.forEach((u) => { t2[u] = Object.assign({}, table[u]); n2[u] = Object.assign({}, nextHop[u]); });
    return { table: t2, nextHop: n2 };
  }

  /** One synchronous round of distributed Bellman-Ford, optionally with
   *  split-horizon-with-poisoned-reverse applied per advertising direction. */
  function computeRound(links, table, nextHop, poisonReverse) {
    const result = initTable();
    NODES.forEach((u) => {
      neighborsOf(u, links).forEach(({ node: v, cost: c }) => {
        NODES.forEach((d) => {
          if (d === u) return;
          let advertised = table[v][d];
          if (poisonReverse && nextHop[v][d] === u) advertised = Infinity;
          if (advertised === Infinity) return;
          let candidate = c + advertised;
          if (candidate >= INFINITY_CAP) candidate = Infinity;
          if (candidate < result.table[u][d]) { result.table[u][d] = candidate; result.nextHop[u][d] = v; }
        });
      });
      result.table[u][u] = 0;
    });
    return result;
  }

  function diffTables(oldT, newT) {
    const changes = [];
    NODES.forEach((u) => {
      NODES.forEach((d) => {
        if (u === d) return;
        if (oldT[u][d] !== newT[u][d]) changes.push({ node: u, dest: d, from: oldT[u][d], to: newT[u][d] });
      });
    });
    return changes;
  }

  function fmtDist(v) { return v === Infinity ? '\u221e' : String(v); }

  NetSim.SimRegistry.register('distance-vector', function factory(ctx) {
    let poisonReverse = true;
    let simulateFailure = true;
    let rounds = [];
    let index = -1;
    let timer = null;
    let host = null;

    function buildRounds() {
      const out = [];
      let { table, nextHop } = initTable();
      out.push({ text: 'Initial state: every router only knows itself. Everything else is unreachable (\u221e).', table, nextHop, links: BASE_LINKS, changes: [] });

      let round = 0, converged = false;
      while (round < MAX_ROUNDS && !converged) {
        round += 1;
        const next = computeRound(BASE_LINKS, table, nextHop, poisonReverse);
        const changes = diffTables(table, next.table);
        table = next.table; nextHop = next.nextHop;
        if (changes.length === 0) {
          out.push({ text: 'No changes \u2014 the network has converged after ' + (round - 1) + ' round(s).', table, nextHop, links: BASE_LINKS, changes: [], level: 'success', converged: true });
          converged = true;
        } else {
          out.push({
            text: 'Round ' + round + ': ' + changes.length + ' update(s) \u2014 ' + changes.slice(0, 3).map((c) => c.node + '\u2192' + c.dest + ': ' + fmtDist(c.from) + ' \u2192 ' + fmtDist(c.to) + ' via ' + nextHop[c.node][c.dest]).join('; ') + (changes.length > 3 ? '; ...' : ''),
            table, nextHop, links: BASE_LINKS, changes
          });
        }
      }

      if (simulateFailure) {
        const failedLinks = BASE_LINKS.filter((l) => !(l.a === 'A' && l.b === 'B'));
        out.push({ text: 'Link A\u2013B fails. A is cut off from the rest of the network.', table, nextHop, links: failedLinks, changes: [], level: 'warning', linkFailed: true });

        round = 0; converged = false;
        let lastTable = table, lastNextHop = nextHop;
        while (round < MAX_ROUNDS && !converged) {
          round += 1;
          const next = computeRound(failedLinks, lastTable, lastNextHop, poisonReverse);
          const changes = diffTables(lastTable, next.table);
          lastTable = next.table; lastNextHop = next.nextHop;
          if (changes.length === 0) {
            out.push({ text: 'No further changes \u2014 re-converged after ' + (round - 1) + ' round(s) post-failure.', table: lastTable, nextHop: lastNextHop, links: failedLinks, changes: [], level: 'success', converged: true });
            converged = true;
          } else {
            const growing = changes.some((c) => c.to !== Infinity && (c.from === Infinity || c.to > c.from));
            out.push({
              text: 'Round ' + round + ' (post-failure): ' + changes.length + ' update(s) \u2014 ' + changes.slice(0, 3).map((c) => c.node + '\u2192' + c.dest + ': ' + fmtDist(c.from) + ' \u2192 ' + fmtDist(c.to)).join('; ') + (changes.length > 3 ? '; ...' : ''),
              table: lastTable, nextHop: lastNextHop, links: failedLinks, changes,
              level: growing && !poisonReverse ? 'warning' : undefined
            });
          }
        }
      }

      return out;
    }

    function draw() {
      const r = rounds[Math.max(0, index)];
      const changedSet = new Set(r.changes.map((c) => c.node + '|' + c.dest));

      const lineHTML = NODES.map((n, i) => {
        const nextN = NODES[i + 1];
        const linkActive = nextN && r.links.some((l) => (l.a === n && l.b === nextN) || (l.a === nextN && l.b === n));
        const connector = nextN ? `<span style="flex:1;height:2px;background:${linkActive ? 'var(--line-strong)' : 'var(--err)'};${linkActive ? '' : 'background-image:repeating-linear-gradient(90deg,var(--err) 0 4px,transparent 4px 8px);'}display:inline-block;"></span>` : '';
        return `<span class="packet-chip pending" style="min-width:2.2rem;">${n}</span>${connector}`;
      }).join('');

      const tableRows = NODES.map((u) => `
        <tr>
          <th style="text-align:left;font-family:var(--f-mono);padding:0.3rem 0.5rem;border-bottom:1px solid var(--line);">${u}</th>
          ${NODES.map((d) => {
            if (u === d) return '<td style="text-align:center;padding:0.3rem 0.5rem;border-bottom:1px solid var(--line);color:var(--ink-faint);">\u2014</td>';
            const changed = changedSet.has(u + '|' + d);
            const dist = fmtDist(r.table[u][d]);
            const via = r.nextHop[u][d] || '\u2014';
            return `<td style="text-align:center;padding:0.3rem 0.5rem;border-bottom:1px solid var(--line);${changed ? 'background:var(--accent-soft);color:var(--accent);font-weight:700;' : ''}">${dist}<br><span style="font-size:0.65rem;color:${changed ? 'var(--accent)' : 'var(--ink-faint)'};">via ${via}</span></td>`;
          }).join('')}
        </tr>
      `).join('');

      host.innerHTML = `
        <div style="display:flex;align-items:center;gap:2px;margin-bottom:1rem;">${lineHTML}</div>
        <div style="overflow-x:auto;">
          <table style="width:100%;border-collapse:collapse;font-size:0.82rem;">
            <thead><tr><th style="text-align:left;padding:0.3rem 0.5rem;border-bottom:2px solid var(--ink);font-family:var(--f-display);">Router</th>
              ${NODES.map((d) => `<th style="padding:0.3rem 0.5rem;border-bottom:2px solid var(--ink);font-family:var(--f-display);">Dist to ${d}</th>`).join('')}
            </tr></thead>
            <tbody>${tableRows}</tbody>
          </table>
        </div>
        <p class="net-hint" style="margin-top:0.6rem;">Highlighted cells changed this round. "via" shows the next hop for that route.</p>
      `;

      ctx.setMetrics([
        { label: 'Round', value: String(Math.max(0, index)) },
        { label: 'Converged', value: r.converged ? 'Yes' : 'In progress' },
        { label: 'Link Failure Simulated', value: simulateFailure ? 'Yes (A\u2013B)' : 'No' },
        { label: 'Split Horizon / Poison Reverse', value: poisonReverse ? 'On' : 'Off' },
        { label: 'Changes This Round', value: String(r.changes.length) }
      ]);
    }

    function renderParams() {
      ctx.params.hidden = false;
      ctx.params.innerHTML = `
        <label class="switch-mode-option ${simulateFailure ? 'is-checked' : ''}">
          <input type="checkbox" id="dvFail" ${simulateFailure ? 'checked' : ''}>
          Simulate the A\u2013B link failing after convergence
        </label>
        <label class="switch-mode-option ${poisonReverse ? 'is-checked' : ''}" style="margin-top:0.4rem;">
          <input type="checkbox" id="dvPoison" ${poisonReverse ? 'checked' : ''}>
          Split horizon with poisoned reverse
        </label>
        <p style="font-size:0.78rem;color:var(--ink-faint);margin-top:0.5rem;">Turn poisoned reverse off (with the failure
        enabled) to see the classic <strong>count-to-infinity</strong> problem: B, C, D and E slowly bounce their distance
        to A upward, each one trusting a neighbor whose route secretly depended on the very link that just failed.</p>
      `;
      ctx.params.querySelector('#dvFail').addEventListener('change', (e) => { simulateFailure = e.target.checked; rebuild(); });
      ctx.params.querySelector('#dvPoison').addEventListener('change', (e) => { poisonReverse = e.target.checked; rebuild(); });
    }

    function rebuild() {
      stop();
      index = -1;
      rounds = buildRounds();
      renderParams();
      draw();
      ctx.log('Ready \u2014 5 routers (A\u2013B\u2013C\u2013D\u2013E) about to exchange distance vectors.');
    }

    function stop() { if (timer) { clearInterval(timer); timer = null; } }

    function advance() {
      if (index >= rounds.length - 1) { stop(); return; }
      index += 1;
      ctx.log(rounds[index].text, rounds[index].level);
      draw();
    }

    return {
      initialize() {
        ctx.canvas.classList.add('net-canvas');
        ctx.canvas.innerHTML = '<div class="dv-mount"></div>';
        host = ctx.canvas.querySelector('.dv-mount');
        rebuild();
      },
      start() { if (timer) return; timer = setInterval(() => { if (index >= rounds.length - 1) { stop(); return; } advance(); }, 700); },
      pause() { stop(); },
      step() { stop(); advance(); },
      reset() { rebuild(); },
      destroy() { stop(); }
    };
  });

})(window.NetSim = window.NetSim || {});
