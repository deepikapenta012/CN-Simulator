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
    attenuation: ['Attenuation is the reduction in signal strength as energy is lost through a transmission medium.', 'It determines how far a signal can travel before it needs amplification, regeneration, or a different medium.', 'Quantifying loss helps engineers plan link budgets and repeater spacing.', 'Loss varies with frequency, distance, connectors, and medium. Use link-budget measurements and add repeaters or choose lower-loss media for longer paths.'],
    noise: ['Noise is unwanted energy added to a signal, making the transmitted information harder to distinguish.', 'Signal-to-noise ratio helps estimate channel quality and the reliable data rate.', 'Noise analysis helps set modulation, coding, and receiver requirements.', 'Noise cannot always be removed and this random model is simplified. Shielding, filtering, stronger error-correction codes, or more signal power can improve reception.'],
    distortion: ['Distortion changes a signal’s shape when its frequency components experience different gain or delay.', 'It can cause symbols to overlap and become harder for a receiver to decode.', 'Understanding waveform changes guides equalizer and channel design.', 'Severe distortion causes inter-symbol interference. Equalization, shorter links, or a better-controlled channel can reduce it.'],
    'nyquist-capacity': ['The Nyquist formula estimates the maximum bit rate of a band-limited noiseless channel: C = 2B log₂(M), where B is bandwidth and M is the number of signal levels.', 'It relates bandwidth and signaling levels to a theoretical bit-rate limit when noise is ignored.', 'It helps compare modulation choices and bandwidth requirements.', 'It assumes a noiseless channel and ideal signaling. Real channels also have noise, so use Shannon capacity to account for SNR and leave implementation margin.'],
    'shannon-capacity': ['The Shannon formula estimates the maximum reliable data rate of a noisy channel: C = B log₂(1 + SNR), using linear SNR.', 'It shows how bandwidth and signal quality jointly limit reliable communication.', 'It gives a fundamental capacity limit for noisy channels.', 'It assumes an ideal coding scheme and does not include overhead or implementation limits. Use the result as a theoretical ceiling, not an expected throughput.'],
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
    'transmission-media': ['Transmission media carry signals between network devices. Guided media constrain signals to copper or fiber; unguided media use wireless electromagnetic waves.', 'The medium affects achievable capacity, reach, installation cost, mobility, and susceptibility to interference.', 'Fiber offers high capacity and long reach, copper is practical and economical for many LANs, and wireless supports mobility or hard-to-cable locations.', 'Every medium has trade-offs and actual performance depends on equipment and environment. Compare capacity, distance, interference, cost, and deployment needs before choosing.'],
    unipolar: ['Unipolar NRZ maps 1 to a positive voltage and 0 to zero voltage, holding each level for one bit period.', 'It provides a simple way to represent a bit stream as electrical signal levels.', 'Simple encoding and decoding with only one non-zero polarity.', 'Long runs of zeros provide no timing transitions and the signal can have a DC component. Polar or Manchester coding improves synchronization and DC balance.'],
    polar: ['Polar NRZ-L maps 1 and 0 to opposite voltage polarities and holds each level for one bit period.', 'It provides a two-level physical representation of digital data.', 'Uses both voltage polarities and is simple to implement.', 'Long runs can still lack transitions for clock recovery. Manchester or clocked/scrambled line codes provide more timing information.'],
    'polar-nrzi': ['Polar NRZ-I represents a 1 with a transition at the start of its bit interval and a 0 with no transition.', 'Differential encoding can make meaning depend on a change in signal level rather than its absolute polarity.', 'A polarity reversal communicates a 1 and can be less sensitive to polarity inversion.', 'Long runs of zeros contain no transitions and can challenge clock recovery. Scrambling or a transition-rich code such as Manchester can help.'],
    'polar-rz': ['Polar RZ sends a positive pulse for 1 and a negative pulse for 0, returning to zero midway through each bit.', 'The return-to-zero interval provides transitions that help receivers recover timing.', 'Provides clear bit boundaries and supports clock synchronization.', 'Uses more bandwidth and signal transitions than NRZ. NRZ or more efficient clocked codes reduce bandwidth when timing permits.']
  };

  const ERROR_CONTROL_ALGORITHMS = {
    crc: {
      sender: ['Take the input data bits.', 'Append degree(G) zero bits.', 'Divide by the generator using XOR; append the remainder to form the frame.'],
      receiver: ['Read the received frame.', 'Divide the entire frame by the same generator.', 'Remainder 0: accept as error-free; nonzero remainder: detect corruption and request recovery.']
    },
    hamming: {
      sender: ['Place the four data bits at positions 3, 5, 6, and 7.', 'Calculate even parity bits for positions 1, 2, and 4.', 'Transmit the resulting 7-bit codeword.'],
      receiver: ['Recalculate parity checks c1, c2, and c4.', 'Combine them as syndrome c4c2c1 to get the error position.', 'Flip the indicated bit to correct a single-bit error; syndrome 000 means no error found.']
    }
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
    const staticContent = NetSim.SimRegistry.hasStaticContent(sim.id);
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

      ${ERROR_CONTROL_ALGORITHMS[sim.id] ? `<section class="error-control-algorithms" aria-label="Sender and receiver algorithms">
        <article><h2>Sender side algorithm</h2><ol>${ERROR_CONTROL_ALGORITHMS[sim.id].sender.map((step) => `<li>${step}</li>`).join('')}</ol></article>
        <article><h2>Receiver side algorithm</h2><ol>${ERROR_CONTROL_ALGORITHMS[sim.id].receiver.map((step) => `<li>${step}</li>`).join('')}</ol></article>
      </section>` : ''}

      ${staticContent
        ? `<section class="sim-static-content"><h2 class="section-label">Transmission Media Types</h2>${NetSim.SimRegistry.getStaticContent(sim.id)}</section>`
        : `<section class="sim-interactive" id="simulationWorkspace">
      <div class="sim-workspace-head">
        <h2 class="section-label">Simulation</h2>
        <button type="button" class="btn secondary sim-fullscreen-toggle" id="simFullscreen" aria-pressed="false">Full screen</button>
      </div>
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
      </section>`}

      ${staticContent ? '' : `<div class="sim-how">
        <h2 class="section-label">How it works</h2>
        <p>${sim.desc} This page follows NetSim's common simulation template — the
        same Start, Pause, Step and Reset controls, event log and metrics panel are
        used across every simulation so the interaction pattern stays consistent
        as new simulations are added.</p>
      </div>`}
      ${staticContent ? '' : `<div class="sim-learning-details">
        <section class="sim-how">
          <h2 class="section-label">Advantages</h2>
          <ul class="sim-learning-points"><li>${notes[2]}</li></ul>
        </section>
        <section class="sim-how">
          <h2 class="section-label">Disadvantages and solutions or alternatives</h2>
          <ul class="sim-learning-points"><li>${notes[3]}</li></ul>
        </section>
      </div>`}
    `;

    if (staticContent) {
      container._simDestroy = () => {};
      return;
    }

    const canvas = container.querySelector('#simCanvas');
    const paramsEl = container.querySelector('#simParams');
    const workspace = container.querySelector('#simulationWorkspace');
    const fullscreenButton = container.querySelector('#simFullscreen');
    const log = NetSim.Components.createLogger(container);

    function syncFullscreenButton() {
      const active = document.fullscreenElement === workspace || workspace.classList.contains('is-expanded');
      fullscreenButton.textContent = active ? 'Exit full screen' : 'Full screen';
      fullscreenButton.setAttribute('aria-pressed', String(active));
    }

    function onFullscreenChange() {
      workspace.classList.toggle('is-expanded', document.fullscreenElement !== workspace && workspace.classList.contains('is-expanded'));
      syncFullscreenButton();
    }

    fullscreenButton.addEventListener('click', async () => {
      try {
        if (document.fullscreenElement === workspace || workspace.classList.contains('is-expanded')) {
          if (document.fullscreenElement === workspace && document.exitFullscreen) await document.exitFullscreen();
          workspace.classList.remove('is-expanded');
        } else if (workspace.requestFullscreen) {
          await workspace.requestFullscreen();
        } else {
          workspace.classList.add('is-expanded');
        }
      } catch (error) {
        workspace.classList.add('is-expanded');
      }
      syncFullscreenButton();
    });
    document.addEventListener('fullscreenchange', onFullscreenChange);

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

    // expose destroy so the router can clean up on navigation away
    container._simDestroy = () => {
      document.removeEventListener('fullscreenchange', onFullscreenChange);
      if (document.fullscreenElement === workspace && document.exitFullscreen) document.exitFullscreen();
      workspace.classList.remove('is-expanded');
      lifecycle.destroy();
    };
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
