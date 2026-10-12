/* ==========================================================================
   NetSim — core/network.js
   The shared network topology used by switching-style simulations:

                          R2
                        /    \
   PC A ─────── R1 ───          ─── R4 ───── PC B
                        \    /
                          R3

   Exposes a fresh, mutable copy of nodes/links (so each simulation run
   gets its own state) plus a small deterministic path-finding helper.
   This module knows nothing about the DOM or about switching methods —
   it only models the network.
   ========================================================================== */

(function (NetSim) {
  'use strict';

  const NODE_DEFS = [
    { id: 'A',  label: 'PC A', kind: 'host',   x: 40,  y: 150 },
    { id: 'R1', label: 'R1',   kind: 'router', x: 190, y: 150 },
    { id: 'R2', label: 'R2',   kind: 'router', x: 360, y: 65 },
    { id: 'R3', label: 'R3',   kind: 'router', x: 360, y: 235 },
    { id: 'R4', label: 'R4',   kind: 'router', x: 530, y: 150 },
    { id: 'B',  label: 'PC B', kind: 'host',   x: 680, y: 150 }
  ];

  // from, to, base cost (used to break ties deterministically)
  const LINK_DEFS = [
    { id: 'A-R1',  from: 'A',  to: 'R1', cost: 1 },
    { id: 'R1-R2', from: 'R1', to: 'R2', cost: 1 },
    { id: 'R1-R3', from: 'R1', to: 'R3', cost: 1 },
    { id: 'R2-R4', from: 'R2', to: 'R4', cost: 1 },
    { id: 'R3-R4', from: 'R3', to: 'R4', cost: 1 },
    { id: 'R4-B',  from: 'R4', to: 'B',  cost: 1 }
  ];

  /** Returns a brand new, independent copy of the topology (nodes + links). */
  function createTopology() {
    const nodes = NODE_DEFS.map((n) => Object.assign({}, n));
    const links = LINK_DEFS.map((l) => Object.assign({}, l, { status: 'normal' }));
    return { nodes, links };
  }

  function findLink(links, a, b) {
    return links.find((l) => (l.from === a && l.to === b) || (l.from === b && l.to === a)) || null;
  }

  function neighborsOf(links, nodeId, failedLinkIds) {
    const out = [];
    links.forEach((l) => {
      if (failedLinkIds.has(l.id)) return;
      if (l.from === nodeId) out.push({ nodeId: l.to, link: l });
      if (l.to === nodeId) out.push({ nodeId: l.from, link: l });
    });
    return out;
  }

  /**
   * Deterministic shortest-path (Dijkstra over unit/low costs) from `from`
   * to `to`, skipping any link whose id is in `failedLinkIds`.
   * Returns { nodes: [id,...], links: [id,...] } or null if unreachable.
   */
  function computePath(links, from, to, failedLinkIds) {
    failedLinkIds = failedLinkIds || new Set();
    const dist = new Map([[from, 0]]);
    const prev = new Map();
    const visited = new Set();
    const queue = new Set([from]);

    while (queue.size) {
      let current = null;
      queue.forEach((id) => {
        if (current === null || dist.get(id) < dist.get(current)) current = id;
      });
      queue.delete(current);
      if (visited.has(current)) continue;
      visited.add(current);
      if (current === to) break;

      neighborsOf(links, current, failedLinkIds).forEach(({ nodeId, link }) => {
        if (visited.has(nodeId)) return;
        const nd = dist.get(current) + link.cost;
        if (!dist.has(nodeId) || nd < dist.get(nodeId)) {
          dist.set(nodeId, nd);
          prev.set(nodeId, { nodeId: current, link });
          queue.add(nodeId);
        }
      });
    }

    if (!dist.has(to)) return null;

    const nodePath = [to];
    const linkPath = [];
    let cursor = to;
    while (cursor !== from) {
      const step = prev.get(cursor);
      if (!step) return null;
      linkPath.unshift(step.link.id);
      nodePath.unshift(step.nodeId);
      cursor = step.nodeId;
    }
    return { nodes: nodePath, links: linkPath };
  }

  /**
   * Our topology has exactly two node-disjoint middle routes (via R2 and
   * via R3). This returns both, when available, so callers can spread
   * independent packets across them without a full routing protocol.
   */
  function computeAlternatePaths(links, from, to, failedLinkIds) {
    failedLinkIds = failedLinkIds || new Set();
    const viaR2 = computePath(links, from, to, new Set([...failedLinkIds, 'R1-R3', 'R3-R4']));
    const viaR3 = computePath(links, from, to, new Set([...failedLinkIds, 'R1-R2', 'R2-R4']));
    return [viaR2, viaR3].filter(Boolean);
  }

  function setLinkStatus(links, linkId, status) {
    const link = links.find((l) => l.id === linkId);
    if (link) link.status = status;
  }

  function setPathStatus(links, linkIds, status) {
    linkIds.forEach((id) => setLinkStatus(links, id, status));
  }

  NetSim.Core = NetSim.Core || {};
  NetSim.Core.Network = {
    createTopology,
    findLink,
    computePath,
    computeAlternatePaths,
    setLinkStatus,
    setPathStatus
  };

})(window.NetSim = window.NetSim || {});
