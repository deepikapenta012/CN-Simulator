/* ==========================================================================
   NetSim — simulations/distance-vector.js   (rebuilt)
   Bellman-Ford distance-vector routing with:
   • SVG 5-router topology with redundant routes and animated link costs
   • Colour-coded distance table — changed cells highlighted
   • Round-by-round convergence animation
   • Link failure + count-to-infinity or split-horizon-with-poison-reverse
   • Toggle checkboxes for failure simulation and poison reverse
   ========================================================================== */

(function (NetSim) {
  'use strict';

  var NODES = ['A', 'B', 'C', 'D', 'E'];
  var NODE_POS = {
    A: { x: 90, y: 220 }, B: { x: 300, y: 220 },
    C: { x: 520, y: 105 }, D: { x: 520, y: 335 }, E: { x: 780, y: 220 }
  };
  var LINK_PAIRS = [
    { a: 'A', b: 'B' }, { a: 'B', b: 'C' }, { a: 'B', b: 'D' },
    { a: 'C', b: 'D' }, { a: 'C', b: 'E' }, { a: 'D', b: 'E' }
  ];

  var INF = Infinity, INF_CAP = 16, MAX_ROUNDS = 40;

  function randomLinks() {
    var out = [];
    for (var i = 0; i < LINK_PAIRS.length; i++) {
      out.push({ a: LINK_PAIRS[i].a, b: LINK_PAIRS[i].b, cost: Math.floor(Math.random() * 7) + 1 });
    }
    return out;
  }

  function neighborsOf(node, links) {
    var out = [];
    for (var i = 0; i < links.length; i++) {
      if (links[i].a === node) out.push({ node: links[i].b, cost: links[i].cost });
      if (links[i].b === node) out.push({ node: links[i].a, cost: links[i].cost });
    }
    return out;
  }

  function initTables() {
    var t = {}, nh = {};
    for (var i = 0; i < NODES.length; i++) {
      t[NODES[i]] = {}; nh[NODES[i]] = {};
      for (var j = 0; j < NODES.length; j++) {
        t[NODES[i]][NODES[j]] = NODES[i] === NODES[j] ? 0 : INF;
        nh[NODES[i]][NODES[j]] = null;
      }
    }
    return { table: t, nextHop: nh };
  }

  function computeRound(links, table, nextHop, poison) {
    var r = initTables();
    for (var ui = 0; ui < NODES.length; ui++) {
      var u = NODES[ui];
      var nbs = neighborsOf(u, links);
      for (var ni = 0; ni < nbs.length; ni++) {
        var v = nbs[ni].node, c = nbs[ni].cost;
        for (var di = 0; di < NODES.length; di++) {
          var d = NODES[di];
          if (d === u) continue;
          var adv = table[v][d];
          if (poison && nextHop[v][d] === u) adv = INF;
          if (adv === INF) continue;
          var cand = c + adv;
          if (cand >= INF_CAP) cand = INF;
          if (cand < r.table[u][d]) { r.table[u][d] = cand; r.nextHop[u][d] = v; }
        }
      }
      r.table[u][u] = 0;
    }
    return r;
  }

  function diffTables(oldT, newT) {
    var ch = [];
    for (var i = 0; i < NODES.length; i++) {
      for (var j = 0; j < NODES.length; j++) {
        if (NODES[i] === NODES[j]) continue;
        if (oldT[NODES[i]][NODES[j]] !== newT[NODES[i]][NODES[j]])
          ch.push({ node: NODES[i], dest: NODES[j], from: oldT[NODES[i]][NODES[j]], to: newT[NODES[i]][NODES[j]] });
      }
    }
    return ch;
  }

  function fd(v) { return v === INF ? '\u221e' : String(v); }

  NetSim.SimRegistry.register('distance-vector', function factory(ctx) {
    var poison = true;
    var simFail = true;
    var rounds = [];
    var index = -1;
    var timer = null;
    var mount = null;
    var curLinks = randomLinks();

    function buildRounds() {
      var out = [];
      var s = initTables();
      out.push({ t: 'Initial: every router knows only itself.  All other distances = \u221e.', table: s.table, nextHop: s.nextHop, links: curLinks, changes: [] });

      var round = 0, converged = false;
      while (round < MAX_ROUNDS && !converged) {
        round++;
        var next = computeRound(curLinks, s.table, s.nextHop, poison);
        var ch = diffTables(s.table, next.table);
        s = next;
        if (ch.length === 0) {
          out.push({ t: 'Converged after ' + (round - 1) + ' round(s) — no changes.', table: s.table, nextHop: s.nextHop, links: curLinks, changes: [], lv: 'success', converged: true });
          converged = true;
        } else {
          var desc = ch.slice(0, 3).map(function (c) { return c.node + '\u2192' + c.dest + ': ' + fd(c.from) + '\u2192' + fd(c.to); }).join('; ');
          out.push({ t: 'Round ' + round + ': ' + ch.length + ' update(s) — ' + desc + (ch.length > 3 ? '; \u2026' : ''), table: s.table, nextHop: s.nextHop, links: curLinks, changes: ch });
        }
      }

      if (simFail) {
        var failLinks = [];
        for (var i = 0; i < curLinks.length; i++) {
          if (!(curLinks[i].a === 'A' && curLinks[i].b === 'B')) failLinks.push(curLinks[i]);
        }
        out.push({ t: 'Link A\u2013B fails!  A is cut off.', table: s.table, nextHop: s.nextHop, links: failLinks, changes: [], lv: 'warning', failed: true });

        round = 0; converged = false;
        while (round < MAX_ROUNDS && !converged) {
          round++;
          var next = computeRound(failLinks, s.table, s.nextHop, poison);
          var ch = diffTables(s.table, next.table);
          s = next;
          if (ch.length === 0) {
            out.push({ t: 'Re-converged after ' + (round - 1) + ' post-failure round(s).', table: s.table, nextHop: s.nextHop, links: failLinks, changes: [], lv: 'success', converged: true });
            converged = true;
          } else {
            var growing = false;
            for (var ci = 0; ci < ch.length; ci++) {
              if (ch[ci].to !== INF && (ch[ci].from === INF || ch[ci].to > ch[ci].from)) growing = true;
            }
            var desc = ch.slice(0, 3).map(function (c) { return c.node + '\u2192' + c.dest + ': ' + fd(c.from) + '\u2192' + fd(c.to); }).join('; ');
            out.push({ t: 'Post-failure round ' + round + ': ' + ch.length + ' update(s) — ' + desc, table: s.table, nextHop: s.nextHop, links: failLinks, changes: ch, lv: growing && !poison ? 'warning' : undefined });
          }
        }
      }
      return out;
    }

    /* ── SVG topology ─────────────────────────────────────────────────── */
    function svgTopology() {
      var r = rounds[Math.max(0, index)];
      var W = 900, H = 440, nodeR = 36;
      var html = '<svg class="dv-svg" viewBox="0 0 ' + W + ' ' + H + '" preserveAspectRatio="xMidYMid meet">';

      /* links */
      for (var i = 0; i < LINK_PAIRS.length; i++) {
        var pair = LINK_PAIRS[i];
        var from = NODE_POS[pair.a], to = NODE_POS[pair.b];
        var dx = to.x - from.x, dy = to.y - from.y;
        var length = Math.sqrt(dx * dx + dy * dy);
        var ux = dx / length, uy = dy / length;
        var x1 = from.x + ux * nodeR, y1 = from.y + uy * nodeR;
        var x2 = to.x - ux * nodeR, y2 = to.y - uy * nodeR;
        var active = false, linkCost = '';
        for (var li = 0; li < r.links.length; li++) {
          if ((r.links[li].a === pair.a && r.links[li].b === pair.b) ||
              (r.links[li].b === pair.a && r.links[li].a === pair.b)) {
            active = true; linkCost = String(r.links[li].cost); break;
          }
        }
        var midX = (x1 + x2) / 2, midY = (y1 + y2) / 2;
        var labelX = midX - uy * 18, labelY = midY + ux * 18;
        if (active) {
          html += '<line x1="' + x1 + '" y1="' + y1 + '" x2="' + x2 + '" y2="' + y2 + '" stroke="#66bb6a" stroke-width="4" stroke-linecap="round"/>';
          html += '<rect x="' + (labelX - 14) + '" y="' + (labelY - 12) + '" width="28" height="22" rx="7" fill="#fff" stroke="#a5d6a7" stroke-width="1.5"/>';
          html += '<text x="' + labelX + '" y="' + (labelY + 4) + '" text-anchor="middle" font-size="13" font-weight="700" fill="#2e7d32">' + linkCost + '</text>';
        } else {
          html += '<line x1="' + x1 + '" y1="' + y1 + '" x2="' + x2 + '" y2="' + y2 + '" stroke="#ef5350" stroke-width="3" stroke-dasharray="8,6"/>';
          html += '<text x="' + labelX + '" y="' + (labelY + 5) + '" text-anchor="middle" font-size="18" font-weight="700" fill="#ef5350">×</text>';
        }
      }

      /* nodes */
      for (var i = 0; i < NODES.length; i++) {
        var pos = NODE_POS[NODES[i]];
        html += '<circle cx="' + pos.x + '" cy="' + pos.y + '" r="' + nodeR + '" fill="#e3f2fd" stroke="#1976d2" stroke-width="3"/>';
        html += '<text x="' + pos.x + '" y="' + (pos.y + 6) + '" text-anchor="middle" font-size="20" font-weight="700" fill="#1565c0">' + NODES[i] + '</text>';
        html += '<text x="' + pos.x + '" y="' + (pos.y + nodeR + 20) + '" text-anchor="middle" font-size="12" font-weight="600" fill="var(--ink-faint)">Router ' + NODES[i] + '</text>';
      }

      html += '</svg>';
      return html;
    }

    /* ── distance table ───────────────────────────────────────────────── */
    function distTable() {
      var r = rounds[Math.max(0, index)];
      var chSet = {};
      for (var i = 0; i < r.changes.length; i++) {
        chSet[r.changes[i].node + '|' + r.changes[i].dest] = true;
      }

      var html = '<div class="dv-tbl-wrap"><table class="dv-tbl">';
      html += '<thead><tr><th>Router</th>';
      for (var j = 0; j < NODES.length; j++) html += '<th>→ ' + NODES[j] + '</th>';
      html += '</tr></thead><tbody>';

      for (var i = 0; i < NODES.length; i++) {
        html += '<tr><td class="dv-tbl-node">' + NODES[i] + '</td>';
        for (var j = 0; j < NODES.length; j++) {
          if (NODES[i] === NODES[j]) {
            html += '<td class="dv-tbl-self">—</td>';
          } else {
            var changed = chSet[NODES[i] + '|' + NODES[j]];
            var dist = fd(r.table[NODES[i]][NODES[j]]);
            var via = r.nextHop[NODES[i]][NODES[j]] || '—';
            html += '<td class="' + (changed ? 'dv-tbl-changed' : '') + '"><span class="dv-tbl-dist">' + dist + '</span><span class="dv-tbl-via">via ' + via + '</span></td>';
          }
        }
        html += '</tr>';
      }
      html += '</tbody></table></div>';
      return html;
    }

    function draw() {
      mount.innerHTML = svgTopology() + distTable();

      var r = rounds[Math.max(0, index)];
      ctx.setMetrics([
        { label: 'Round', value: String(Math.max(0, index)) },
        { label: 'Converged', value: r.converged ? 'Yes' : 'In progress' },
        { label: 'Link Failure', value: simFail ? 'A\u2013B' : 'None' },
        { label: 'Poison Reverse', value: poison ? 'On' : 'Off' },
        { label: 'Changes', value: String(r.changes.length) }
      ]);
    }

    function renderParams() {
      ctx.params.hidden = false;
      var html = '<div class="dv-params">';
      html += '<label class="switch-mode-option' + (simFail ? ' is-checked' : '') + '"><input type="checkbox" id="dvFail"' + (simFail ? ' checked' : '') + '> Simulate A\u2013B link failure</label>';
      html += '<label class="switch-mode-option' + (poison ? ' is-checked' : '') + '" style="margin-top:0.3rem;"><input type="checkbox" id="dvPoison"' + (poison ? ' checked' : '') + '> Split horizon with poisoned reverse</label>';
      html += '<p class="dv-hint">Turn poisoned reverse <strong>off</strong> (with failure enabled) to see the classic <strong>count-to-infinity</strong> problem.</p>';
      html += '</div>';
      ctx.params.innerHTML = html;

      ctx.params.querySelector('#dvFail').addEventListener('change', function (e) { simFail = e.target.checked; rebuild(); });
      ctx.params.querySelector('#dvPoison').addEventListener('change', function (e) { poison = e.target.checked; rebuild(); });
    }

    function rebuild() {
      stop(); index = -1;
      curLinks = randomLinks();
      rounds = buildRounds();
      renderParams(); draw();
      var costsStr = curLinks.map(function (l) { return l.a + '\u2013' + l.b + ':' + l.cost; }).join(', ');
      ctx.log('Ready — 5 routers with redundant routes and link costs [' + costsStr + '].');
    }

    function stop() { if (timer) { NetSim.SimTiming.clearInterval(timer); timer = null; } }

    function advance() {
      if (index >= rounds.length - 1) { stop(); return; }
      index++;
      ctx.log(rounds[index].t, rounds[index].lv);
      draw();
    }

    return {
      initialize: function () {
        ctx.canvas.innerHTML = '<div class="dv-mount"></div>';
        mount = ctx.canvas.querySelector('.dv-mount');
        rebuild();
      },
      start: function () { if (timer) return; timer = NetSim.SimTiming.setInterval(function () { if (index >= rounds.length - 1) { stop(); return; } advance(); }, 700); },
      pause: function () { stop(); },
      step:  function () { stop(); advance(); },
      reset: function () { rebuild(); },
      destroy: function () { stop(); }
    };
  });

})(window.NetSim = window.NetSim || {});
