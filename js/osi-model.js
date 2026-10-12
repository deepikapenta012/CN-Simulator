/* ==========================================================================
   NetSim — osi-model.js
   Static data describing the 7 OSI layers and the syllabus mapped onto them,
   plus the cross-layer Concept Explorer entries (section 5 of the brief).
   Simulation "status" is 'placeholder' for everything not yet implemented —
   the brief asks us to scaffold cards now and wire in real logic later.
   ========================================================================== */

(function (NetSim) {
  'use strict';

  const LAYERS = [
    {
      id: 'application',
      number: 7,
      name: 'Application',
      dataUnit: 'Data',
      responsibility: 'Provides network services directly to end-user software — the layer users and programs actually talk to.',
      protocols: ['DNS', 'HTTP', 'FTP', 'SMTP', 'SNMP'],
      simulationGroups: [
        { title: 'Name and Service Discovery', simulationIds: ['dns'] },
        { title: 'Web Communication', simulationIds: ['http'] },
        { title: 'File Transfer', simulationIds: ['ftp'] },
        { title: 'Email Delivery', simulationIds: ['smtp'] },
        { title: 'Network Management', simulationIds: ['snmp'] }
      ],
      simulations: [
        { id: 'dns', name: 'DNS Resolution', tag: 'name lookup', desc: 'Walk through recursive resolution from a hostname down to an IP address.', status: 'placeholder' },
        { id: 'http', name: 'HTTP Request/Response', tag: 'application', desc: 'Trace a request and response cycle between client and server.', status: 'placeholder' },
        { id: 'ftp', name: 'FTP Transfer', tag: 'file transfer', desc: 'Control and data channel handshake for a file transfer session.', status: 'placeholder' },
        { id: 'smtp', name: 'SMTP Delivery', tag: 'mail', desc: 'Step through mail submission between client and mail server.', status: 'placeholder' },
        { id: 'snmp', name: 'SNMP Polling', tag: 'management', desc: 'Manager-agent polling for device status and traps.', status: 'placeholder' }
      ]
    },
    {
      id: 'presentation',
      number: 6,
      name: 'Presentation',
      dataUnit: 'Data',
      responsibility: 'Translates, encrypts and compresses data so the application layer receives it in a usable, agreed-upon format.',
      protocols: ['TLS/SSL', 'JPEG', 'ASCII/Unicode'],
      simulationGroups: [
        { title: 'Data Representation', simulationIds: ['encoding'] },
        { title: 'Encryption and Decryption', simulationIds: ['encryption'] },
        { title: 'Data Compression', simulationIds: ['compression'] }
      ],
      simulations: [
        { id: 'encoding', name: 'Character Encoding', tag: 'representation', desc: 'Compare how text is represented across ASCII, UTF-8 and UTF-16.', status: 'placeholder' },
        { id: 'encryption', name: 'Encryption / Decryption', tag: 'security', desc: 'Visualize a symmetric cipher turning plaintext into ciphertext.', status: 'placeholder' },
        { id: 'compression', name: 'Compression Basics', tag: 'efficiency', desc: 'See run-length or Huffman-style compression shrink a payload.', status: 'placeholder' }
      ]
    },
    {
      id: 'session',
      number: 5,
      name: 'Session',
      dataUnit: 'Data',
      responsibility: 'Establishes, manages and tears down the dialog between two communicating applications.',
      protocols: ['NetBIOS', 'RPC', 'PPTP'],
      simulationGroups: [
        { title: 'Session Setup', simulationIds: ['session-establish'] },
        { title: 'Dialog and Checkpoint Management', simulationIds: ['session-manage'] },
        { title: 'Session Teardown', simulationIds: ['session-terminate'] }
      ],
      simulations: [
        { id: 'session-establish', name: 'Session Establishment', tag: 'setup', desc: 'Step through opening a session between two endpoints.', status: 'available' },
        { id: 'session-manage', name: 'Session Management', tag: 'dialog control', desc: 'Track checkpoints and synchronization within an active session.', status: 'available' },
        { id: 'session-terminate', name: 'Session Termination', tag: 'teardown', desc: 'Graceful vs abrupt session close, and what each side sees.', status: 'available' }
      ]
    },
    {
      id: 'transport',
      number: 4,
      name: 'Transport',
      dataUnit: 'Segment',
      responsibility: 'Delivers data between processes end-to-end, handling segmentation, reliability, flow and congestion control.',
      protocols: ['TCP', 'UDP', 'QUIC'],
      simulationGroups: [
        { title: 'Process-to-Process Delivery', simulationIds: ['udp', 'multiplexing'] },
        { title: 'Connection Management', simulationIds: ['tcp'] },
        { title: 'Reliability and Recovery', simulationIds: ['tcp-timers'] },
        { title: 'Flow Control', simulationIds: ['tcp-window'] },
        { title: 'Congestion Control', simulationIds: ['tcp-congestion'] },
        { title: 'Traffic Prioritization', simulationIds: ['qos'] }
      ],
      simulations: [
        { id: 'udp', name: 'UDP Transmission', tag: 'connectionless', desc: 'Fire-and-forget datagrams with no delivery guarantee.', status: 'available' },
        { id: 'tcp', name: 'TCP Handshake', tag: 'connection-oriented', desc: 'The three-way handshake and connection teardown.', status: 'available' },
        { id: 'tcp-window', name: 'TCP Window Management', tag: 'flow control', desc: 'The receiver-advertised window shrinking to zero and reopening.', status: 'available' },
        { id: 'tcp-congestion', name: 'TCP Congestion Control', tag: 'congestion control', desc: 'Slow start, congestion avoidance and a simulated packet loss event.', status: 'available' },
        { id: 'tcp-timers', name: 'TCP Timers', tag: 'reliability', desc: 'Retransmission timeout behavior under delayed ACKs.', status: 'available' },
        { id: 'qos', name: 'Quality of Service', tag: 'prioritization', desc: 'How traffic classes get different treatment under load.', status: 'available' },
        { id: 'multiplexing', name: 'Multiplexing', tag: 'ports', desc: 'Multiple streams sharing one connection via port numbers.', status: 'available' }
      ]
    },
    {
      id: 'network',
      number: 3,
      name: 'Network',
      dataUnit: 'Packet',
      responsibility: 'Handles logical addressing and routing so packets can travel across multiple networks to their destination.',
      protocols: ['IP', 'ICMP', 'OSPF', 'BGP'],
      simulationGroups: [
        { title: 'Packet Forwarding and Switching', simulationIds: ['switching-concepts', 'datagram'] },
        { title: 'Routing Algorithms and Protocols', simulationIds: ['distance-vector', 'link-state', 'ospf', 'bgp'] },
        { title: 'IP Addressing and Subnetting', simulationIds: ['ipv4', 'ipv6', 'subnetting', 'cidr'] },
        { title: 'Address Translation and Configuration', simulationIds: ['nat', 'dhcp'] },
        { title: 'Neighbor and Address Resolution', simulationIds: ['arp', 'rarp'] },
        { title: 'Diagnostics and Multicast', simulationIds: ['icmp', 'igmp'] }
      ],
      simulations: [
        { id: 'switching-concepts', name: 'Switching Simulation', tag: 'circuit · message · packet', desc: 'Run circuit, message and packet switching through the same network and compare how each delivers data.', status: 'available' },
        { id: 'datagram', name: 'Datagram Approach', tag: 'connectionless routing', desc: 'Independent, per-packet routing decisions.', status: 'available' },
        { id: 'distance-vector', name: 'Distance Vector Routing', tag: 'routing', desc: 'Neighbors exchanging distance tables until routes converge, plus the count-to-infinity problem.', status: 'available' },
        { id: 'link-state', name: 'Link State Routing', tag: 'routing', desc: 'Flooding topology info and computing shortest paths.', status: 'available' },
        { id: 'ospf', name: 'OSPF', tag: 'interior gateway', desc: 'Area-based link-state routing within an autonomous system.', status: 'available' },
        { id: 'bgp', name: 'BGP', tag: 'exterior gateway', desc: 'Path-vector routing between autonomous systems.', status: 'available' },
        { id: 'ipv4', name: 'IPv4 Addressing', tag: 'addressing', desc: 'Structure of a 32-bit address and its classes.', status: 'available' },
        { id: 'ipv6', name: 'IPv6 Addressing', tag: 'addressing', desc: 'The 128-bit address space and abbreviation rules.', status: 'available' },
        { id: 'subnetting', name: 'Subnetting', tag: 'addressing', desc: 'Splitting a network into smaller address blocks.', status: 'available' },
        { id: 'cidr', name: 'CIDR', tag: 'addressing', desc: 'Classless prefixes and route aggregation.', status: 'available' },
        { id: 'nat', name: 'NAT', tag: 'translation', desc: 'Private-to-public address translation for outbound traffic.', status: 'available' },
        { id: 'arp', name: 'ARP', tag: 'resolution', desc: 'Resolving an IP address to a MAC address on the local link.', status: 'available' },
        { id: 'rarp', name: 'RARP', tag: 'resolution', desc: 'Resolving a MAC address back to an IP address.', status: 'available' },
        { id: 'icmp', name: 'ICMP', tag: 'diagnostics', desc: 'Error reporting and diagnostics such as ping and traceroute.', status: 'available' },
        { id: 'igmp', name: 'IGMP', tag: 'multicast', desc: 'Hosts reporting multicast group membership to routers.', status: 'available' },
        { id: 'dhcp', name: 'DHCP', tag: 'configuration', desc: 'Automatic IP address assignment via discover/offer/request/ack.', status: 'available' }
      ]
    },
    {
      id: 'datalink',
      number: 2,
      name: 'Data Link',
      dataUnit: 'Frame',
      responsibility: 'Provides reliable node-to-node delivery, framing, error control and access to the shared medium.',
      protocols: ['Ethernet', 'PPP', '802.11'],
      simulationGroups: [
        { title: 'Error Control', simulationIds: ['crc', 'hamming'] },
        { title: 'Flow Control and Reliable Delivery', simulationIds: ['stop-and-wait', 'sliding-window', 'go-back-n', 'selective-repeat'] },
        { title: 'Medium Access Control', simulationIds: ['aloha', 'csma-cd', 'csma-ca'] },
        { title: 'Frame Structure', simulationIds: ['ethernet-frame', 'wifi-frame'] }
      ],
      simulations: [
        { id: 'crc', name: 'CRC', tag: 'error detection', desc: 'Cyclic redundancy check catching transmission errors.', status: 'available' },
        { id: 'hamming', name: 'Hamming Code', tag: 'error correction', desc: 'Single-bit error correction using parity bits.', status: 'available' },
        { id: 'stop-and-wait', name: 'Stop-and-Wait', tag: 'flow control', desc: 'Sender waits for an ACK before sending the next frame.', status: 'available' },
        { id: 'sliding-window', name: 'Sliding Window', tag: 'flow control', desc: 'Multiple frames in flight bounded by a window size.', status: 'available' },
        { id: 'go-back-n', name: 'Go-Back-N ARQ', tag: 'flow control', desc: 'Resend from the first unacknowledged frame on loss.', status: 'available' },
        { id: 'selective-repeat', name: 'Selective Repeat ARQ', tag: 'flow control', desc: 'Resend only the frames that were actually lost.', status: 'available' },
        { id: 'aloha', name: 'ALOHA', tag: 'medium access', desc: 'Pure and slotted ALOHA contention and collisions.', status: 'available' },
        { id: 'csma-cd', name: 'CSMA/CD', tag: 'medium access', desc: 'Carrier sense, collision detection and backoff on shared wire.', status: 'available' },
        { id: 'csma-ca', name: 'CSMA/CA', tag: 'medium access', desc: 'Collision avoidance used on wireless links.', status: 'available' },
        { id: 'ethernet-frame', name: 'Ethernet Frame (IEEE 802.3)', tag: 'frame format', desc: 'Build an Ethernet frame field by field, with a real CRC-32 frame check sequence.', status: 'available' },
        { id: 'wifi-frame', name: 'Wi-Fi Frame (IEEE 802.11)', tag: 'frame format', desc: 'Build an 802.11 data frame: Frame Control flags, three addresses, sequence control and FCS.', status: 'available' }
      ]
    },
    {
      id: 'physical',
      number: 1,
      name: 'Physical',
      dataUnit: 'Bits',
      responsibility: 'Transmits raw bits over a physical medium — voltages, light pulses or radio waves.',
      protocols: ['RS-232', 'DSL', 'Bluetooth'],
      simulationGroups: [
        { title: 'Signal Representation', simulationIds: ['analog-signals', 'digital-signals'] },
        { title: 'Line Coding', simulationIds: ['unipolar', 'polar', 'polar-nrzi', 'polar-rz', 'manchester'] },
        { title: 'Transmission Media', simulationIds: ['transmission-media'] },
        { title: 'Signal Quality and Impairments', simulationIds: ['impairments'] }
      ],
      simulations: [
        { id: 'analog-signals', name: 'Analog Signals', tag: 'signaling', desc: 'Continuous waveforms carrying information — amplitude, frequency and phase.', status: 'available' },
        { id: 'digital-signals', name: 'Digital Signals', tag: 'signaling', desc: 'Discrete voltage levels representing bits, and how bit rate shapes the signal.', status: 'available' },
        { id: 'unipolar', name: 'Unipolar NRZ Encoding', tag: 'line coding', desc: 'Encode 1 as a positive voltage and 0 as zero voltage, with each level held for the full bit period.', status: 'available' },
        { id: 'polar', name: 'Polar NRZ-L Encoding', tag: 'line coding', desc: 'Encode bits using two polarities: 1 as a positive voltage and 0 as a negative voltage.', status: 'available' },
        { id: 'polar-nrzi', name: 'Polar NRZ-I Encoding', tag: 'line coding', desc: 'Represent a 1 with a voltage transition at the start of its bit interval and a 0 with no transition.', status: 'available' },
        { id: 'polar-rz', name: 'Polar RZ Encoding', tag: 'line coding', desc: 'Use a positive or negative pulse for each bit, returning the signal to zero during the second half of the bit interval.', status: 'available' },
        { id: 'transmission-media', name: 'Transmission Media', tag: 'medium', desc: 'Copper, fiber and wireless media compared as a signal travels and attenuates.', status: 'available' },
        { id: 'impairments', name: 'Transmission Impairments', tag: 'medium', desc: 'Attenuation, noise and distortion along a link, and their effect on SNR.', status: 'available' },
        { id: 'manchester', name: 'Manchester Encoding', tag: 'line coding', desc: 'Self-clocking line encoding via mid-bit transitions.', status: 'available' }
      ]
    }
  ];

  const CONCEPTS = [
    {
      id: 'circuit-switching',
      name: 'Circuit Switching',
      desc: 'A dedicated path is reserved for the whole session, as in traditional telephony.',
      layers: ['Physical', 'Network']
    },
    {
      id: 'message-switching',
      name: 'Message Switching',
      desc: 'Whole messages are stored and forwarded hop-by-hop with no dedicated path.',
      layers: ['Network']
    },
    {
      id: 'packet-switching',
      name: 'Packet Switching',
      desc: 'Data is split into packets that may take independent paths to the destination.',
      layers: ['Network', 'Data Link']
    },
    {
      id: 'topologies',
      name: 'Network Topologies',
      desc: 'The physical or logical arrangement of nodes — bus, star, ring, mesh, tree.',
      layers: ['Physical']
    },
    {
      id: 'network-types',
      name: 'Network Types',
      desc: 'Scale-based classification: PAN, LAN, MAN, WAN.',
      layers: ['Cross-cutting']
    },
    {
      id: 'protocols-standards',
      name: 'Protocols & Standards',
      desc: 'How rules for communication get defined and standardized by bodies like IEEE and IETF.',
      layers: ['Cross-cutting']
    },
    {
      id: 'osi-vs-tcpip',
      name: 'OSI vs TCP/IP',
      desc: 'Comparing the 7-layer teaching model against the 4-layer model the internet actually runs on.',
      layers: ['Cross-cutting']
    },
    {
      id: 'encapsulation-concept',
      name: 'Encapsulation / Decapsulation',
      desc: 'How each layer wraps the layer above it in its own header on the way down, and unwraps on the way up.',
      layers: ['All layers']
    },
    {
      id: 'network-security',
      name: 'Network Security',
      desc: 'Threats and defenses that span multiple layers, from link-layer spoofing to application-layer attacks.',
      layers: ['Cross-cutting']
    }
  ];

  function getLayers() {
    return LAYERS;
  }

  function getLayerById(id) {
    return LAYERS.find((l) => l.id === id) || null;
  }

  function getSimulation(layerId, simId) {
    const layer = getLayerById(layerId);
    if (!layer) return null;
    return layer.simulations.find((s) => s.id === simId) || null;
  }

  function getConceptById(id) {
    return CONCEPTS.find((c) => c.id === id) || null;
  }

  function getConcepts() {
    return CONCEPTS;
  }

  NetSim.OSIData = {
    getLayers,
    getLayerById,
    getSimulation,
    getConcepts,
    getConceptById
  };

})(window.NetSim = window.NetSim || {});
