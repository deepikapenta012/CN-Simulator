/* Static learning content for the Physical Layer transmission-media page. */
(function (NetSim) {
  'use strict';

  const COMPARISON = [
    ['Twisted pair (UTP)', 'Moderate to high; depends on category and length', 'Typically up to about 100 m per Ethernet run', 'More susceptible to EMI and crosstalk', 'Low cost, flexible, easy to install', 'LAN cabling, telephony'],
    ['Twisted pair (STP)', 'Moderate to high; depends on category and length', 'Typically up to about 100 m per Ethernet run', 'Lower EMI when shield is correctly grounded', 'Better noise protection than UTP', 'Noisy environments, industrial wiring'],
    ['Coaxial cable', 'High; depends on cable and system', 'From hundreds of metres to longer engineered links', 'Good shielding; less EMI pickup than unshielded pair', 'Robust and well shielded', 'Cable broadband, RF distribution'],
    ['Fiber · single-mode', 'Very high; supports long-haul rates', 'Long distance, often tens of kilometres between regeneration points', 'Immune to electromagnetic interference', 'High reach and capacity; low attenuation', 'Telecom backbones, data-centre interconnects'],
    ['Fiber · multimode', 'High to very high over shorter links', 'Typically hundreds of metres, depending on fiber and rate', 'Immune to electromagnetic interference', 'Lower-cost optics for short high-speed links', 'Data centres, campus backbones'],
    ['Radio waves', 'Varies with frequency, spectrum, and technology', 'Room-scale to regional coverage', 'Shared spectrum; affected by obstacles and interference', 'Can cover broad areas and pass through some obstacles', 'Wi-Fi, cellular, broadcast'],
    ['Terrestrial microwave', 'High; depends on channel width and equipment', 'Line-of-sight links over kilometres', 'Weather and obstruction can affect links', 'Fast deployment between fixed sites without cable', 'Backhaul, point-to-point links'],
    ['Satellite microwave', 'Varies by satellite and service', 'Very wide or near-global coverage', 'Weather affects some bands; GEO adds latency', 'Reaches remote areas beyond terrestrial infrastructure', 'Broadcast, maritime, remote broadband'],
    ['Infrared', 'Moderate to high over short distances', 'Room-scale; often line-of-sight', 'Blocked by walls; ambient light can interfere', 'Does not usually penetrate walls, limiting spill into adjacent rooms', 'Remote controls, short-range device links']
  ];

  function renderContent() {
    return `
      <div class="media-map" aria-label="Mind map of transmission media types">
        <div class="media-map-root">Transmission Media</div>
        <div class="media-map-branches">
          <section class="media-branch" aria-labelledby="guidedTitle">
            <h3 class="media-branch-title" id="guidedTitle">Guided / Wired</h3>
            <div class="media-map-families">
              <div class="media-map-family">
                <strong class="media-family-title">Twisted Pair</strong>
                <div class="media-map-subtypes"><span>Unshielded (UTP)</span><span>Shielded (STP)</span></div>
              </div>
              <div class="media-map-family">
                <strong class="media-family-title">Coaxial Cable</strong>
                <div class="media-map-subtypes"><span>Central conductor + shielding</span></div>
              </div>
              <div class="media-map-family">
                <strong class="media-family-title">Optical Fiber</strong>
                <div class="media-map-subtypes"><span>Single-mode</span><span>Multimode</span></div>
              </div>
            </div>
          </section>
          <section class="media-branch" aria-labelledby="unguidedTitle">
            <h3 class="media-branch-title" id="unguidedTitle">Unguided / Wireless</h3>
            <div class="media-map-families">
              <div class="media-map-family">
                <strong class="media-family-title">Radio Waves</strong>
                <div class="media-map-subtypes"><span>Wi-Fi</span><span>Cellular</span><span>Broadcast</span></div>
              </div>
              <div class="media-map-family">
                <strong class="media-family-title">Microwave</strong>
                <div class="media-map-subtypes"><span>Terrestrial · line-of-sight</span><span>Satellite · wide-area relay</span></div>
              </div>
              <div class="media-map-family">
                <strong class="media-family-title">Infrared</strong>
                <div class="media-map-subtypes"><span>Short-range · often line-of-sight</span></div>
              </div>
            </div>
          </section>
        </div>
      </div>
      <h3 class="media-comparison-title">Transmission Media Comparison</h3>
      <div class="compare-table-wrap media-table-wrap">
        <table class="compare-table media-comparison-table">
          <thead><tr><th>Medium</th><th>Typical capacity</th><th>Typical reach</th><th>Interference / limits</th><th>Strength</th><th>Common uses</th></tr></thead>
          <tbody>${COMPARISON.map((row) => `<tr>${row.map((cell) => `<td>${cell}</td>`).join('')}</tr>`).join('')}</tbody>
        </table>
      </div>
      <p class="media-table-note">Capacity and reach vary with the standard, equipment, installation, and environment. Values here are broad comparisons, not guarantees.</p>
    `;
  }

  NetSim.SimRegistry.registerStaticContent('transmission-media', renderContent);
})(window.NetSim = window.NetSim || {});
