/* ==========================================================================
   NetSim — core/packet.js
   Packet-switching's data unit. Pure data + two pure functions — no DOM,
   no timing, so it's trivial to unit-reason about and reuse from the
   comparison-mode metric calculations.
   ========================================================================== */

(function (NetSim) {
  'use strict';

  /**
   * Splits `message` into packets of `packetSize` characters each.
   * numberOfPackets = ceil(messageLength / packetSize) — never hard-coded.
   */
  function createPackets(message, packetSize, src, dst) {
    const size = Math.max(1, packetSize | 0);
    const total = Math.max(1, Math.ceil(message.length / size));
    const packets = [];
    for (let i = 0; i < total; i++) {
      const payload = message.slice(i * size, i * size + size);
      packets.push({
        id: 'P' + (i + 1),
        seq: i + 1,
        total,
        payload,
        src,
        dst,
        currentNode: src,
        route: null,        // filled in by the engine when the packet is sent
        state: 'pending',   // pending | in-flight | delivered | lost
        arrivalOrder: null
      });
    }
    return packets;
  }

  /**
   * Reassembles whatever packets arrived, in sequence order. Missing
   * sequence numbers are left as a gap marker so the caller can tell the
   * message apart from a coincidentally-identical shorter string.
   */
  function reassemble(packets) {
    const byOrder = packets.slice().sort((a, b) => a.seq - b.seq);
    const complete = byOrder.every((p) => p.state === 'delivered');
    const text = byOrder.map((p) => (p.state === 'delivered' ? p.payload : '\u2591'.repeat(p.payload.length))).join('');
    return { complete, text };
  }

  NetSim.Core = NetSim.Core || {};
  NetSim.Core.Packet = { createPackets, reassemble };

})(window.NetSim = window.NetSim || {});
