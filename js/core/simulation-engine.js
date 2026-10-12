/* ==========================================================================
   NetSim — core/simulation-engine.js

   An event-driven engine for the three switching methods. It knows the
   network (core/network.js) and packets (core/packet.js) but nothing
   about the DOM — components/network-canvas.js reads its `state` to
   draw, and simulations/switching.js wires UI controls to its methods.

   simulationState shape (see brief section 22):
     { mode, running, stepIndex, nodes, links, packets, message,
       events, metrics, failedLinks, activePath, entities, done, outcome }

   Every Start/Pause/Step/Reset call operates on this one state object —
   the DOM is only ever a rendering of it, never the source of truth.
   ========================================================================== */

(function (NetSim) {
  'use strict';

  const Network = NetSim.Core.Network;
  const Packet = NetSim.Core.Packet;

  const ROUTER_PROCESSING_MS = 2;

  function fmt(n) { return Math.round(n * 10) / 10; }

  /**
   * Shared delay-breakdown math for all three methods. Used both for the
   * live metrics panel (real hops/packet counts from the current run)
   * and for the theoretical comparison table (same formulas, nominal
   * topology values) — one formula, two callers, nothing hard-coded.
   */
  function formulas(mode, params, hops, numPackets, messageLen) {
    const L = params.linkDelay, S = Math.max(0.1, params.transmissionSpeed);
    const propagationDelay = L * hops;

    if (mode === 'circuit') {
      const transmissionTime = messageLen / S;
      const processingDelay = 0;
      const setupTime = params.circuitSetupTime;
      const totalDelay = setupTime + transmissionTime + propagationDelay + processingDelay;
      return { transmissionTime, propagationDelay, processingDelay, setupTime, totalDelay };
    }

    if (mode === 'message') {
      const transmissionTime = messageLen / S;
      const processingDelay = ROUTER_PROCESSING_MS * Math.max(0, hops - 1);
      const storeForward = hops * transmissionTime;
      const totalDelay = storeForward + propagationDelay + processingDelay;
      return { transmissionTime, propagationDelay, processingDelay, storeForward, totalDelay };
    }

    // packet
    const avgPayload = messageLen / Math.max(1, numPackets);
    const packetTransmissionTime = avgPayload / S;
    const processingDelay = ROUTER_PROCESSING_MS * Math.max(0, hops - 1);
    const avgPacketDelay = propagationDelay + processingDelay + packetTransmissionTime * hops;
    const totalDelay = packetTransmissionTime * hops + propagationDelay + processingDelay +
      Math.max(0, numPackets - 1) * packetTransmissionTime;
    return { packetTransmissionTime, propagationDelay, processingDelay, avgPacketDelay, totalDelay };
  }

  /** Pure — no live run needed. Powers the "Compare Switching Methods" table. */
  function computeTheoreticalMetrics(params) {
    const hops = 4; // both routes through this topology are 4 links long
    const messageLen = Math.max(1, params.message.length);
    const numPackets = Math.max(1, Math.ceil(messageLen / params.packetSize));
    return {
      circuit: formulas('circuit', params, hops, 1, messageLen),
      message: formulas('message', params, hops, 1, messageLen),
      packet: formulas('packet', params, hops, numPackets, messageLen),
      hops,
      numPackets
    };
  }

  function computeLiveMetrics(state, params) {
    const messageLen = Math.max(1, (params.message || '').length);
    const hops = state.activePath ? state.activePath.links.length
      : (state.packets[0] && state.packets[0].route ? state.packets[0].route.links.length : 4);
    const base = { Hops: hops, 'Data Sent': messageLen + ' chars' };

    if (state.mode === 'circuit') {
      const f = formulas('circuit', params, hops, 1, messageLen);
      const delivered = state.outcome === 'delivered';
      return Object.assign({}, base, {
        'Transmission Time': fmt(f.transmissionTime) + ' ms',
        'Propagation Delay': fmt(f.propagationDelay) + ' ms',
        'Processing Delay': fmt(f.processingDelay) + ' ms',
        'Setup Time': fmt(f.setupTime) + ' ms',
        'Total Delay': fmt(f.totalDelay) + ' ms',
        'Circuit Duration': fmt(f.totalDelay) + ' ms',
        'Data Delivered': (delivered ? messageLen : 0) + ' chars',
        'Data Lost': (delivered ? 0 : (state.done ? messageLen : 0)) + ' chars'
      });
    }

    if (state.mode === 'message') {
      const f = formulas('message', params, hops, 1, messageLen);
      const delivered = state.outcome === 'delivered';
      return Object.assign({}, base, {
        'Transmission Time': fmt(f.transmissionTime) + ' ms',
        'Propagation Delay': fmt(f.propagationDelay) + ' ms',
        'Processing Delay': fmt(f.processingDelay) + ' ms',
        'Store-and-Forward Delay': fmt(f.storeForward) + ' ms',
        'Total Delay': fmt(f.totalDelay) + ' ms',
        'Data Delivered': (delivered ? messageLen : 0) + ' chars',
        'Data Lost': (delivered ? 0 : (state.done ? messageLen : 0)) + ' chars'
      });
    }

    // packet
    const numPackets = state.packets.length || Math.ceil(messageLen / params.packetSize);
    const f = formulas('packet', params, hops, numPackets, messageLen);
    const delivered = state.packets.filter((p) => p.state === 'delivered');
    const lost = state.packets.filter((p) => p.state === 'lost');
    const dataDelivered = delivered.reduce((s, p) => s + p.payload.length, 0);
    const dataLost = lost.reduce((s, p) => s + p.payload.length, 0);
    const reassembly = state.message.complete ? 'Complete'
      : (state.done ? 'Incomplete (' + lost.length + ' lost)' : 'Pending');
    return Object.assign({}, base, {
      'Transmission Time': fmt(f.packetTransmissionTime) + ' ms/pkt',
      'Propagation Delay': fmt(f.propagationDelay) + ' ms',
      'Processing Delay': fmt(f.processingDelay) + ' ms',
      'Total Delay': fmt(f.totalDelay) + ' ms',
      'Number of Packets': numPackets,
      'Average Packet Delay': fmt(f.avgPacketDelay) + ' ms',
      'Packet Loss Rate': fmt(numPackets ? (lost.length / numPackets) * 100 : 0) + '%',
      'Reassembly Status': reassembly,
      'Data Delivered': dataDelivered + ' chars',
      'Data Lost': dataLost + ' chars'
    });
  }

  // ---- plan builders --------------------------------------------------

  function createMessageEvent(params) {
    return {
      entity: null,
      run(eng) {
        eng.state.message = { text: params.message, deliveredText: '', complete: false };
        return { text: 'Message created: "' + params.message + '" (' + params.message.length + ' chars)', level: 'normal' };
      }
    };
  }

  function buildCircuitPlan(eng) {
    const params = eng.params;
    const path = Network.computePath(eng.state.links, 'A', 'B', eng.state.failedLinks);
    const events = [createMessageEvent(params)];

    events.push({ entity: null, run: () => ({ text: 'Circuit establishment started', level: 'normal' }) });

    events.push({
      entity: null,
      run(e) {
        if (!path) { e.state.done = true; e.state.outcome = 'failed'; return { text: 'No available path — circuit cannot be established', level: 'error' }; }
        e.state.activePath = path;
        Network.setPathStatus(e.state.links, path.links, 'pending');
        return { text: 'Path selected: ' + path.nodes.join(' → '), level: 'normal' };
      }
    });

    events.push({
      entity: null,
      run(e) {
        if (e.state.done) return { text: 'Circuit establishment aborted', level: 'error' };
        return { text: 'Circuit established', level: 'success' };
      }
    });

    events.push({
      entity: null,
      run(e) {
        if (e.state.done) return { text: 'No circuit to reserve', level: 'error' };
        Network.setPathStatus(e.state.links, e.state.activePath.links, 'reserved');
        return { text: 'Resources reserved', level: 'success' };
      }
    });

    events.push({
      entity: null,
      run(e) {
        if (e.state.done) return { text: 'Data transmission skipped', level: 'error' };
        e.state.entities.push({ id: 'msg', kind: 'message', atNode: 'A', linkId: null });
        return { text: 'Data transmission started', level: 'normal' };
      }
    });

    if (path) {
      path.nodes.slice(1, -1).forEach((node, i) => {
        events.push({
          entity: 'message',
          run(e) {
            if (e.state.done) return { text: 'Skipped (circuit no longer active)', level: 'error' };
            const entity = e.state.entities.find((en) => en.id === 'msg');
            if (entity) { entity.atNode = node; entity.linkId = path.links[i]; }
            e.state.message.currentNode = node;
            return { text: 'Data reached ' + node, level: 'normal' };
          }
        });
      });

      events.push({
        entity: 'message',
        run(e) {
          if (e.state.done) return { text: 'Delivery skipped (circuit no longer active)', level: 'error' };
          const entity = e.state.entities.find((en) => en.id === 'msg');
          if (entity) { entity.atNode = 'B'; entity.linkId = path.links[path.links.length - 1]; }
          e.state.message.complete = true;
          e.state.message.deliveredText = e.state.message.text;
          e.state.outcome = 'delivered';
          return { text: 'Data delivered to destination', level: 'success' };
        }
      });

      events.push({
        entity: null,
        run(e) {
          if (e.state.outcome !== 'delivered') return { text: 'Nothing to terminate', level: 'normal' };
          return { text: 'Terminating circuit...', level: 'normal' };
        }
      });

      events.push({
        entity: null,
        run(e) {
          if (e.state.outcome !== 'delivered') return { text: 'No active circuit', level: 'normal' };
          return { text: 'Circuit terminated', level: 'success' };
        }
      });

      events.push({
        entity: null,
        run(e) {
          if (e.state.activePath) Network.setPathStatus(e.state.links, e.state.activePath.links, 'normal');
          e.state.entities = e.state.entities.filter((en) => en.id !== 'msg');
          e.state.done = true;
          return { text: 'Resources released', level: 'success' };
        }
      });
    }

    return events;
  }

  function buildMessageHopEvents(fromNode, path, startIdx) {
    const events = [];
    const nodes = path.nodes.slice(startIdx);
    for (let i = 0; i < nodes.length - 1; i++) {
      const to = nodes[i + 1];
      const linkId = path.links[startIdx + i];
      events.push({
        entity: 'message',
        run(e) {
          const entity = e.state.entities.find((en) => en.id === 'msg');
          if (entity) { entity.atNode = to; entity.linkId = linkId; }
          e.state.message.currentNode = to;
          return { text: 'Message transmitted to ' + to, level: 'normal' };
        }
      });
      if (to === 'B') {
        events.push({
          entity: 'message',
          run(e) {
            e.state.message.complete = true;
            e.state.message.deliveredText = e.state.message.text;
            e.state.outcome = 'delivered';
            e.state.done = true;
            return { text: 'Message delivered', level: 'success' };
          }
        });
      } else {
        events.push({ entity: 'message', run: () => ({ text: to + ' received complete message', level: 'normal' }) });
        events.push({ entity: 'message', run: () => ({ text: to + ' storing message', level: 'normal' }) });
        events.push({ entity: 'message', run: () => ({ text: to + ' forwarding message', level: 'normal' }) });
      }
    }
    return events;
  }

  function buildMessagePlan(eng) {
    const params = eng.params;
    const path = Network.computePath(eng.state.links, 'A', 'B', eng.state.failedLinks);
    const events = [createMessageEvent(params)];

    if (!path) {
      events.push({ entity: null, run: (e) => { e.state.done = true; e.state.outcome = 'failed'; return { text: 'No available path — message cannot be sent', level: 'error' }; } });
      return events;
    }

    events.push({
      entity: 'message',
      run(e) {
        e.state.message.currentNode = 'A';
        e.state.entities.push({ id: 'msg', kind: 'message', atNode: 'A', linkId: null });
        return { text: 'Message queued for store-and-forward delivery via ' + path.nodes.join(' → '), level: 'normal' };
      }
    });

    events.push(...buildMessageHopEvents('A', path, 0));
    return events;
  }

  function buildPacketPlan(eng) {
    const params = eng.params;
    const failed = eng.state.failedLinks;
    const events = [createMessageEvent(params)];
    const packets = Packet.createPackets(params.message, params.packetSize, 'A', 'B');
    const altPaths = Network.computeAlternatePaths(eng.state.links, 'A', 'B', failed);
    const fallback = Network.computePath(eng.state.links, 'A', 'B', failed);

    events.push({
      entity: null,
      run(e) {
        e.state.packets = packets;
        if (!altPaths.length && !fallback) { e.state.done = true; e.state.outcome = 'failed'; return { text: 'No available path — packets cannot be sent', level: 'error' }; }
        return { text: 'Message divided into ' + packets.length + ' packets (packet size = ' + params.packetSize + ')', level: 'normal' };
      }
    });

    let arrivalCounter = 0;
    const flatEvents = [];

    packets.forEach((packet, idx) => {
      const route = altPaths.length ? altPaths[idx % altPaths.length] : fallback;
      packet.route = route;
      const willLose = route && Math.random() < params.packetLoss;
      const lostAtHop = willLose ? 1 + Math.floor(Math.random() * (route.nodes.length - 1)) : -1;
      const launchOffset = idx;

      if (!route) {
        flatEvents.push({
          tick: launchOffset, entity: packet.id,
          run(e) {
            packet.state = 'lost';
            return { text: '⚠ ' + packet.id + ' lost — no available route', level: 'warning' };
          }
        });
        return;
      }

      flatEvents.push({
        tick: launchOffset, entity: packet.id,
        run(e) {
          packet.state = 'in-flight';
          e.state.entities.push({ id: packet.id, kind: 'packet', atNode: 'A', linkId: null, seq: packet.seq });
          return { text: packet.id + ' sent via ' + route.nodes.join('→'), level: 'normal' };
        }
      });

      for (let hop = 1; hop < route.nodes.length; hop++) {
        const node = route.nodes[hop];
        const linkId = route.links[hop - 1];
        const tick = launchOffset + hop;

        if (willLose && hop === lostAtHop) {
          const prevNode = route.nodes[hop - 1];
          flatEvents.push({
            tick, entity: packet.id,
            run(e) {
              packet.state = 'lost';
              e.state.entities = e.state.entities.filter((en) => en.id !== packet.id);
              return { text: '⚠ ' + packet.id + ' lost between ' + prevNode + ' and ' + node, level: 'warning' };
            }
          });
          break;
        }

        flatEvents.push({
          tick, entity: packet.id,
          run(e) {
            const entity = e.state.entities.find((en) => en.id === packet.id);
            if (entity) { entity.atNode = node; entity.linkId = linkId; }
            packet.currentNode = node;
            if (node === 'B') {
              packet.state = 'delivered';
              packet.arrivalOrder = ++arrivalCounter;
              return { text: packet.id + ' delivered ✓', level: 'success' };
            }
            return { text: packet.id + ' reached ' + node, level: 'normal' };
          }
        });
      }
    });

    flatEvents.sort((a, b) => a.tick - b.tick);
    events.push(...flatEvents);

    events.push({
      entity: null,
      isFinal: true,
      run(e) {
        const result = Packet.reassemble(e.state.packets);
        e.state.message.complete = result.complete;
        e.state.done = true;
        if (result.complete) {
          e.state.message.deliveredText = result.text;
          e.state.outcome = 'delivered';
          return { text: 'Reassembling... "' + result.text + '"', level: 'success' };
        }
        e.state.outcome = 'incomplete';
        const lostIds = e.state.packets.filter((p) => p.state === 'lost').map((p) => p.id).join(', ');
        return { text: 'Message incomplete — missing ' + lostIds, level: 'error' };
      }
    });

    return events;
  }

  function buildPlan(eng) {
    if (eng.state.mode === 'circuit') return buildCircuitPlan(eng);
    if (eng.state.mode === 'message') return buildMessagePlan(eng);
    return buildPacketPlan(eng);
  }

  // ---- engine -----------------------------------------------------------

  function createEngine() {
    const queue = NetSim.Core.EventQueue.createEventQueue();
    let intervalId = null;
    let onEvent = () => {};
    let onChange = () => {};

    const eng = {
      params: {
        mode: 'packet',
        message: 'HELLO NETWORK',
        packetSize: 3,
        linkDelay: 60,
        transmissionSpeed: 2,
        packetLoss: 0.15,
        animationSpeed: 1,
        circuitSetupTime: 150
      },
      state: null,
      queue,

      onEvent(fn) { onEvent = fn; },
      onChange(fn) { onChange = fn; },

      configure(partial) { Object.assign(eng.params, partial); },

      reset() {
        clearTimer();
        const topo = Network.createTopology();
        eng.state = {
          mode: eng.params.mode,
          running: false,
          stepIndex: 0,
          nodes: topo.nodes,
          links: topo.links,
          packets: [],
          message: { text: eng.params.message, deliveredText: '', complete: false },
          events: [],
          metrics: {},
          failedLinks: new Set(),
          activePath: null,
          entities: [],
          done: false,
          outcome: null
        };
        queue.clear();
        queue.pushAll(buildPlan(eng));
        eng.state.metrics = computeLiveMetrics(eng.state, eng.params);
        onChange();
      },

      step() {
        clearTimer();
        advance();
      },

      start() {
        if (eng.state.done || queue.isEmpty()) return;
        eng.state.running = true;
        onChange();
        clearTimer();
        const interval = Math.max(150, 700 / eng.params.animationSpeed);
        intervalId = setInterval(() => {
          if (queue.isEmpty() || eng.state.done) { eng.pause(); return; }
          advance();
        }, interval);
      },

      pause() {
        clearTimer();
        eng.state.running = false;
        onChange();
      },

      failLink(linkId) {
        const link = eng.state.links.find((l) => l.id === linkId);
        if (!link) return;

        if (link.status === 'failed') {
          link.status = 'normal';
          eng.state.failedLinks.delete(linkId);
          logDirect(eng, 'Link ' + linkId.replace('-', '–') + ' restored', 'success');
          return;
        }

        link.status = 'failed';
        eng.state.failedLinks.add(linkId);
        logDirect(eng, 'Link ' + linkId.replace('-', '–') + ' failed', 'warning');

        if (eng.state.done) { onChange(); return; }

        if (eng.state.mode === 'circuit') {
          if (eng.state.activePath && eng.state.activePath.links.includes(linkId)) {
            queue.clear();
            eng.state.entities = eng.state.entities.filter((en) => en.id !== 'msg');
            Network.setPathStatus(eng.state.links, eng.state.activePath.links, 'normal');
            eng.state.done = true;
            eng.state.outcome = 'failed';
            eng.pause();
            logDirect(eng, 'Circuit interrupted — connection lost', 'error');
          }
        } else if (eng.state.mode === 'message') {
          const remaining = queue.toArray();
          const stillPending = remaining.some((e) => e.entity === 'message');
          if (stillPending) {
            const current = eng.state.message.currentNode || 'A';
            const newPath = Network.computePath(eng.state.links, current, 'B', eng.state.failedLinks);
            queue.removeWhere((e) => e.entity === 'message');
            if (!newPath) {
              eng.state.done = true;
              eng.state.outcome = 'failed';
              eng.pause();
              logDirect(eng, 'Message stuck at ' + current + ' — no available route', 'error');
            } else {
              logDirect(eng, 'Rerouting message from ' + current + ' via ' + newPath.nodes.join(' → '), 'normal');
              queue.pushAll(buildMessageHopEvents(current, newPath, 0));
            }
          }
        } else if (eng.state.mode === 'packet') {
          const remaining = queue.toArray();
          const stillNeedsRoute = remaining.filter((e) => e.entity && e.entity.startsWith('P'));
          const affectedIds = new Set(
            stillNeedsRoute
              .map((e) => e.entity)
          );
          const finalEvents = queue.toArray().filter((e) => e.isFinal);
          queue.removeWhere((e) => e.isFinal);
          affectedIds.forEach((pid) => {
            const packet = eng.state.packets.find((p) => p.id === pid);
            if (!packet || !packet.route || !packet.route.links.includes(linkId)) return;
            const currentNode = packet.currentNode || 'A';
            const rerouted = Network.computePath(eng.state.links, currentNode, 'B', eng.state.failedLinks);
            queue.removeWhere((e) => e.entity === pid);
            if (!rerouted) {
              packet.state = 'lost';
              eng.state.entities = eng.state.entities.filter((en) => en.id !== pid);
              logDirect(eng, '⚠ ' + pid + ' lost — no available route from ' + currentNode, 'warning');
            } else {
              packet.route = rerouted;
              logDirect(eng, pid + ' rerouted from ' + currentNode + ' via ' + rerouted.nodes.join('→'), 'normal');
              queue.pushAll(buildPacketHopEventsFrom(eng, packet, rerouted));
            }
          });
          queue.pushAll(finalEvents);
        }

        eng.state.metrics = computeLiveMetrics(eng.state, eng.params);
        onChange();
      },

      destroy() { clearTimer(); }
    };

    function clearTimer() {
      if (intervalId) { clearInterval(intervalId); intervalId = null; }
    }

    function advance() {
      if (queue.isEmpty()) { eng.state.running = false; onChange(); return; }
      const event = queue.shift();
      const result = event.run(eng);
      eng.state.stepIndex += 1;
      eng.state.events.push(result);
      eng.state.metrics = computeLiveMetrics(eng.state, eng.params);
      onEvent(result);
      if (queue.isEmpty()) eng.state.running = false;
      onChange();
    }

    function logDirect(e, text, level) {
      const entry = { text, level };
      e.state.events.push(entry);
      onEvent(entry);
    }

    return eng;
  }

  function buildPacketHopEventsFrom(eng, packet, route) {
    const events = [];
    for (let hop = 1; hop < route.nodes.length; hop++) {
      const node = route.nodes[hop];
      const linkId = route.links[hop - 1];
      events.push({
        entity: packet.id,
        run(e) {
          packet.state = 'in-flight';
          let entity = e.state.entities.find((en) => en.id === packet.id);
          if (!entity) {
            entity = { id: packet.id, kind: 'packet', atNode: packet.currentNode || route.nodes[0], linkId: null, seq: packet.seq };
            e.state.entities.push(entity);
          }
          entity.atNode = node;
          entity.linkId = linkId;
          packet.currentNode = node;
          if (node === 'B') {
            packet.state = 'delivered';
            return { text: packet.id + ' delivered ✓', level: 'success' };
          }
          return { text: packet.id + ' reached ' + node, level: 'normal' };
        }
      });
    }
    return events;
  }

  NetSim.Core = NetSim.Core || {};
  NetSim.Core.SimulationEngine = { createEngine, computeTheoreticalMetrics };

})(window.NetSim = window.NetSim || {});
