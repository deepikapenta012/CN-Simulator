/* ==========================================================================
   NetSim — components/simulation-page.js
   The common structure every simulation page follows (section 9 of the
   brief): canvas, controls, parameters, event log, metrics, explanation.
   ========================================================================== */

(function (NetSim) {
  'use strict';

  const LEARNING_NOTES = {
    crc: ['CRC appends a polynomial remainder as a frame check sequence.', 'It lets receivers detect accidental frame corruption.', 'It detects many common burst errors with little overhead.', 'CRC cannot repair errors or prevent tampering. Retransmission, error-correcting codes, or cryptographic authentication address those needs.'],
    hamming: ['Hamming code adds parity bits that let a receiver locate a single-bit error.', 'It corrects likely link errors without waiting for retransmission.', 'Fast single-bit correction with modest redundancy.', 'Basic Hamming code has limited correction strength. Extended Hamming or stronger codes fit noisier channels.'],
    'stop-and-wait': ['The sender transmits one frame and waits for its acknowledgement before sending the next.', 'It provides simple flow control and recovery.', 'Easy to implement and reason about.', 'The link sits idle during round-trip waits. Sliding-window protocols improve utilization.'],
    'go-back-n': ['Cumulative acknowledgements track progress; after loss, the sender repeats from the first missing frame.', 'It provides reliable delivery with a simple receiver.', 'Simple buffering and acknowledgement behavior.', 'Later frames may be resent unnecessarily. Selective Repeat is more efficient when losses are common.'],
    'selective-repeat': ['The receiver buffers valid out-of-order frames and the sender retries only missing frames.', 'It avoids resending data that arrived successfully.', 'Efficient on links with delay or loss.', 'Needs more buffering and sequence tracking; Go-Back-N is simpler on reliable links.'],
    aloha: ['Stations transmit when ready; overlapping transmissions collide. Slotted ALOHA aligns attempts to time slots.', 'It demonstrates contention on a shared channel.', 'Very simple and decentralized.', 'Collisions waste capacity under load. Carrier sensing, scheduling, or reservation models work better as demand grows.'],
    'csma-cd': ['Stations listen before sending, detect collisions, then back off and retry.', 'It coordinates access to shared half-duplex Ethernet.', 'Sensing reduces collisions compared with random access.', 'Modern switched full-duplex Ethernet avoids collisions and does not use CSMA/CD.'],
    'csma-ca': ['Wireless stations sense the channel and use backoff, acknowledgements, and sometimes RTS/CTS to reduce collisions.', 'Wireless radios generally cannot detect collisions while transmitting.', 'Designed for wireless contention and hidden-station conditions.', 'Contention still costs capacity. Newer Wi-Fi adds scheduling and multi-user coordination.'],
    'ethernet-frame': ['Builds an Ethernet frame from synchronization, addresses, type/length, payload, and FCS fields.', 'Framing marks local-link data boundaries and supports delivery and error detection.', 'Widely interoperable and efficiently handled by hardware.', 'FCS detects but does not repair errors, and Ethernet is link-local. Higher layers handle recovery and routing.'],
    'wifi-frame': ['Builds an 802.11 frame with control flags, addresses, sequence information, payload, and FCS.', 'Wireless links need frame control and addressing for stations and access points.', 'Supports wireless mobility and link-level delivery controls.', 'FCS is not security. WPA2/WPA3 protects traffic; newer Wi-Fi improves channel coordination.'],
    'analog-signals': ['Represents information with a continuously varying waveform such as amplitude, frequency, or phase.', 'Useful for naturally continuous measurements and radio/audio systems.', 'Can represent fine changes and work with analog equipment.', 'Noise accumulates and is difficult to separate from the signal. Digital regeneration and error correction improve robustness.'],
    'digital-signals': ['Represents bits using discrete signal levels or transitions on a link.', 'Digital receivers can decide bit values and use regeneration and error checks.', 'Works naturally with computing and can be regenerated along a path.', 'Noise, timing, and bandwidth still limit rates. Line coding, equalization, and error correction help.'],
    'transmission-media': ['Compares copper, fiber, and wireless as paths that carry signals.', 'Media choice affects capacity, distance, cost, mobility, and interference.', 'Each medium can be matched to its use: fiber for long high-capacity links, radio for mobility, copper for accessible wiring.', 'There is no universal best medium. Compare distance, environment, capacity, and installation cost.'],
    impairments: ['Models attenuation, noise, and distortion changing a signal during transmission.', 'Link designers use these effects to estimate range and error risk.', 'Makes causes of degraded signal quality visible.', 'Real channels vary more than a simple model. Measurements, shielding, repeaters, and error correction address specific impairments.'],
    manchester: ['Each bit has a mid-bit transition, which also provides timing information.', 'The receiver can recover synchronization from the signal itself.', 'Self-clocking and predictable transitions.', 'Uses more bandwidth than many alternatives. Modern links use more efficient coding and clock recovery.'],
    udp: ['Sends independent datagrams without a connection handshake or delivery guarantee.', 'Useful when low setup delay matters or the application handles reliability itself.', 'Small overhead and low-latency delivery.', 'Packets can be lost, duplicated, or reordered. Add application recovery or use TCP/QUIC for reliable streams.'],
    tcp: ['Shows TCP connection setup and close using handshake messages.', 'The handshake synchronizes state before reliable data transfer.', 'Reliable, ordered byte-stream delivery.', 'Setup adds latency and streams lack message boundaries. QUIC can reduce setup delay and provide streams.'],
    nat: ['Rewrites address and often port fields so private hosts can share public IPv4 addresses.', 'Conserves scarce public IPv4 addresses.', 'Many devices can share a smaller public address pool.', 'Breaks direct reachability and complicates some protocols. IPv6 or explicit application gateways can avoid or manage this.'],
    dhcp: ['Assigns IP settings using discover, offer, request, and acknowledgement messages.', 'Automates address and network configuration for clients.', 'Centralized and reduces manual configuration errors.', 'Rogue or unavailable servers disrupt clients. Trusted server controls and redundancy mitigate this.'],
    'distance-vector': ['Routers exchange destination costs with neighbors and update routes iteratively.', 'Shares routing knowledge without a complete network map at each router.', 'Simple and distributed.', 'Can converge slowly or form loops. Split horizon, poison reverse, and link-state routing address these issues.'],
    'link-state': ['Routers flood link information, build a topology map, and calculate shortest paths.', 'A topology view supports consistent route calculation.', 'Fast convergence and flexible metrics.', 'Uses more memory and processing. Hierarchical areas limit overhead; distance-vector can be simpler for small networks.'],
    bgp: ['Compares advertised prefixes and path attributes to choose routes between autonomous systems.', 'Applies routing policy at Internet scale between independent networks.', 'Scales globally and supports policy-based choices.', 'Policy errors can have wide effects. Route filtering, RPKI validation, and review reduce risk.'],
    ipv4: ['Uses 32-bit addresses and prefixes to identify interfaces and route packets.', 'Provides addressing for delivery across interconnected networks.', 'Mature and widely supported.', 'Address supply is limited and often relies on NAT. IPv6 provides a much larger address space.'],
    ipv6: ['Uses 128-bit addresses and prefixes to identify interfaces and route packets.', 'Supports growth beyond IPv4 address availability.', 'Vast address space and modern protocol design.', 'Transition adds operational complexity. Planned dual-stack migration supports interoperability.'],
    unipolar: ['Unipolar NRZ maps 1 to a positive voltage and 0 to zero voltage, holding each level for one bit period.', 'It provides a simple way to represent a bit stream as electrical signal levels.', 'Simple encoding and decoding with only one non-zero polarity.', 'Long runs of zeros provide no timing transitions and the signal can have a DC component. Polar or Manchester coding improves synchronization and DC balance.'],
    polar: ['Polar NRZ-L maps 1 and 0 to opposite voltage polarities and holds each level for one bit period.', 'It provides a two-level physical representation of digital data.', 'Uses both voltage polarities and is simple to implement.', 'Long runs can still lack transitions for clock recovery. Manchester or clocked/scrambled line codes provide more timing information.'],
    'polar-nrzi': ['Polar NRZ-I represents a 1 with a transition at the start of its bit interval and a 0 with no transition.', 'Differential encoding can make meaning depend on a change in signal level rather than its absolute polarity.', 'A polarity reversal communicates a 1 and can be less sensitive to polarity inversion.', 'Long runs of zeros contain no transitions and can challenge clock recovery. Scrambling or a transition-rich code such as Manchester can help.'],
    'polar-rz': ['Polar RZ sends a positive pulse for 1 and a negative pulse for 0, returning to zero midway through each bit.', 'The return-to-zero interval provides transitions that help receivers recover timing.', 'Provides clear bit boundaries and supports clock synchronization.', 'Uses more bandwidth and signal transitions than NRZ. NRZ or more efficient clocked codes reduce bandwidth when timing permits.']
  };

  function learningNotes(sim, layer) {
    return LEARNING_NOTES[sim.id] || [
      sim.desc + ' The simulation makes its key entities, messages, and state changes visible step by step.',
      'This topic is used to understand how ' + sim.tag + ' supports communication at the ' + layer.name + ' layer.',
      'A model makes the sequence repeatable and easier to inspect or compare.',
      'The model simplifies real implementations and omits operational details. Use standards-based implementations and measurements for deployment; consider a more scalable or robust protocol when this approach does not meet requirements.'
    ];
  }

  function renderSimulationPage(container, layerId, simId) {
    const layer = NetSim.OSIData.getLayerById(layerId);
    const sim = layer ? NetSim.OSIData.getSimulation(layerId, simId) : null;

    if (!layer || !sim) {
      container.innerHTML = `
        <div class="placeholder-box">
          <strong>Simulation not found</strong>
          <a href="#/osi">Return to the OSI model</a>
        </div>
      `;
      return;
    }

    const notes = learningNotes(sim, layer);
    container.innerHTML = `
      <div class="sim-page-head">
        <div class="layer-eyebrow"><a href="#/layer/${layer.id}">← ${layer.name} layer</a></div>
        <h1>${sim.name}</h1>
        <p class="sim-tagline">${sim.tag} · Layer ${layer.number}, ${layer.name}</p>
      </div>

      <section class="sim-how sim-learning-intro">
        <h2 class="section-label">Explanation</h2>
        <p>${notes[0]}</p>
        <h3>Why it is used</h3>
        <p>${notes[1]}</p>
      </section>

      <h2 class="section-label">Simulation</h2>
      <div class="sim-layout">
        <div>
          <div class="sim-canvas" id="simCanvas"></div>
          ${NetSim.Components.controlsHTML()}
          <div class="sim-params" id="simParams" hidden></div>
        </div>
        <div class="sim-side">
          ${NetSim.Components.eventLogHTML()}
          ${NetSim.Components.metricsHTML([])}
        </div>
      </div>

      <div class="sim-how">
        <h2 class="section-label">How it works</h2>
        <p>${sim.desc} This page follows NetSim's common simulation template — the
        same Start, Pause, Step and Reset controls, event log and metrics panel are
        used across every simulation so the interaction pattern stays consistent
        as new simulations are added.</p>
      </div>
      <div class="sim-learning-details">
        <section class="sim-how">
          <h2 class="section-label">Advantages</h2>
          <p>${notes[2]}</p>
        </section>
        <section class="sim-how">
          <h2 class="section-label">Disadvantages and solutions or alternatives</h2>
          <p>${notes[3]}</p>
        </section>
      </div>
    `;

    const canvas = container.querySelector('#simCanvas');
    const paramsEl = container.querySelector('#simParams');
    const log = NetSim.Components.createLogger(container);

    let lifecycle;

    if (NetSim.SimRegistry.has(sim.id)) {
      lifecycle = NetSim.SimRegistry.create(sim.id, {
        canvas,
        params: paramsEl,
        log,
        setMetrics: (items) => NetSim.Components.updateMetrics(container, items)
      });
    } else {
      lifecycle = genericPlaceholderLifecycle(canvas, log, sim);
    }

    NetSim.Components.wireControls(container, lifecycle);
    lifecycle.initialize();

    NetSim.State.logVisit(sim.name, '#/sim/' + layerId + '/' + simId);

    // expose destroy so the router can clean up on navigation away
    container._simDestroy = lifecycle.destroy;
  }

  function genericPlaceholderLifecycle(canvas, log, sim) {
    return {
      initialize() {
        canvas.innerHTML = `
          <div class="placeholder-box">
            <strong>${sim.name} — coming soon</strong>
            This simulation is scaffolded but not yet implemented. The layer page,
            routing and the common simulation template are ready for it.
          </div>
        `;
        log('initialize() — placeholder simulation mounted.');
      },
      start() { log('start() — nothing to run yet.'); },
      pause() { log('pause() called.'); },
      step() { log('step() called.'); },
      reset() { log('reset() called.'); },
      destroy() {}
    };
  }

  NetSim.Components = NetSim.Components || {};
  NetSim.Components.renderSimulationPage = renderSimulationPage;

})(window.NetSim = window.NetSim || {});
