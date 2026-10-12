/* ==========================================================================
   NetSim — simulations/ethernet-frame.js
   Builds a real IEEE 802.3 / Ethernet frame field by field from user
   input: actual bytes, the 46-byte minimum-payload padding rule, and a
   genuine CRC-32 Frame Check Sequence. An optional single-bit
   corruption shows the receiver's recomputed FCS failing to match.
   ========================================================================== */

(function (NetSim) {
  'use strict';

  const CRC = NetSim.Core.CRC32;

  const ETHERTYPES = {
    ipv4: { label: 'IPv4 (0x0800)', value: 0x0800 },
    arp: { label: 'ARP (0x0806)', value: 0x0806 },
    ipv6: { label: 'IPv6 (0x86DD)', value: 0x86DD },
    length: { label: 'IEEE 802.3 length field', value: null }
  };

  const FIELDS = [
    { key: 'preamble', label: 'Preamble', bytes: '7 B', cls: 'ff-sync' },
    { key: 'sfd', label: 'SFD', bytes: '1 B', cls: 'ff-sync' },
    { key: 'dest', label: 'Dest MAC', bytes: '6 B', cls: 'ff-addr' },
    { key: 'src', label: 'Src MAC', bytes: '6 B', cls: 'ff-addr' },
    { key: 'type', label: 'Type / Length', bytes: '2 B', cls: 'ff-ctrl' },
    { key: 'payload', label: 'Payload', bytes: '46\u20131500 B', cls: 'ff-data' },
    { key: 'fcs', label: 'FCS', bytes: '4 B', cls: 'ff-fcs' }
  ];

  function escapeHtml(s) {
    return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  NetSim.SimRegistry.register('ethernet-frame', function factory(ctx) {
    let destMac = '3C:22:FB:9A:BC:DE';
    let srcMac = 'A4:C3:F0:12:34:56';
    let etherType = 'ipv4';
    let payloadText = 'Hello, Network!';
    let corrupt = false;
    let phases = [];
    let index = -1;
    let timer = null;
    let host = null;
    let frame = null;

    function compute() {
      const dest = CRC.parseMac(destMac);
      const src = CRC.parseMac(srcMac);
      const payloadBytes = CRC.textToBytes(payloadText);
      const padLen = Math.max(0, 46 - payloadBytes.length);
      const padded = payloadBytes.concat(new Array(padLen).fill(0));
      const typeVal = etherType === 'length' ? payloadBytes.length : ETHERTYPES[etherType].value;
      const typeBytes = [(typeVal >> 8) & 255, typeVal & 255];
      const body = dest.concat(src, typeBytes, padded); // dest MAC .. end of (padded) payload
      const fcs = CRC.compute(body);

      const received = body.slice();
      let flipped = null;
      if (corrupt) {
        const byteIdx = Math.floor(Math.random() * body.length);
        const bit = Math.floor(Math.random() * 8);
        received[byteIdx] ^= (1 << bit);
        const field = byteIdx < 6 ? 'dest' : byteIdx < 12 ? 'src' : byteIdx < 14 ? 'type' : 'payload';
        flipped = { byteIdx, bit, field };
      }
      const fcsRecomputed = CRC.compute(received);

      return {
        dest, src, typeVal, typeBytes, payloadBytes, padLen, padded, body, fcs,
        flipped, fcsRecomputed, fcsOk: fcsRecomputed === fcs,
        total: body.length + 4,
        header: 14
      };
    }

    function fieldValue(key) {
      switch (key) {
        case 'preamble': return 'AA AA AA AA AA AA AA';
        case 'sfd': return 'AB';
        case 'dest': return CRC.macToString(frame.dest);
        case 'src': return CRC.macToString(frame.src);
        case 'type': return '0x' + CRC.hexByte(frame.typeBytes[0]) + CRC.hexByte(frame.typeBytes[1]);
        case 'payload': {
          const shown = payloadText.length > 16 ? payloadText.slice(0, 16) + '\u2026' : payloadText;
          return escapeHtml(shown) + (frame.padLen ? ' +' + frame.padLen + ' pad' : '');
        }
        case 'fcs': return '0x' + CRC.hex32(frame.fcs);
        default: return '';
      }
    }

    function buildPhases() {
      frame = compute();
      const p = [];
      p.push({ key: 'preamble', text: 'Preamble: 7 bytes of alternating 10101010 \u2014 lets the receiver\u2019s clock lock on to the sender\u2019s bit timing.' });
      p.push({ key: 'sfd', text: 'Start Frame Delimiter: 10101011. The final two 1-bits tell the receiver "the real frame starts right now."' });
      p.push({ key: 'dest', text: 'Destination MAC: ' + CRC.macToString(frame.dest) + ' \u2014 the first thing a NIC checks to decide whether the frame is for it.' });
      p.push({ key: 'src', text: 'Source MAC: ' + CRC.macToString(frame.src) + '.' });
      if (etherType === 'length') {
        p.push({ key: 'type', text: 'Length field: ' + frame.typeVal + ' (the payload\u2019s byte count). Values \u2264 1500 mean "length" in IEEE 802.3; values \u2265 1536 (0x0600) mean "EtherType" in Ethernet II.' });
      } else {
        p.push({ key: 'type', text: 'EtherType: 0x' + CRC.hexByte(frame.typeBytes[0]) + CRC.hexByte(frame.typeBytes[1]) + ' \u2014 says which upper-layer protocol the payload belongs to (' + ETHERTYPES[etherType].label + ').' });
      }
      if (frame.padLen > 0) {
        p.push({ key: 'payload', text: 'Payload: ' + frame.payloadBytes.length + ' byte(s) \u2014 below the 46-byte minimum, so ' + frame.padLen + ' zero byte(s) of padding are added.', level: 'warning' });
      } else {
        p.push({ key: 'payload', text: 'Payload: ' + frame.payloadBytes.length + ' bytes \u2014 meets the 46-byte minimum, no padding needed.' });
      }
      p.push({ key: 'fcs', text: 'FCS: CRC-32 computed over dest MAC through payload = 0x' + CRC.hex32(frame.fcs) + '.', level: 'success' });
      const valid = frame.total >= 64 && frame.total <= 1518;
      p.push({
        key: 'summary',
        text: 'Frame size (dest MAC through FCS) = 14 header + ' + frame.padded.length + ' payload + 4 FCS = ' + frame.total + ' bytes \u2014 ' + (valid ? 'inside the legal 64\u20131518 byte range \u2713' : 'OUTSIDE the legal 64\u20131518 byte range \u2717') + '. On the wire, add 8 bytes of preamble + SFD.',
        level: valid ? 'success' : 'error'
      });
      if (corrupt && frame.flipped) {
        p.push({ key: 'rx', text: 'In transit, one bit flips (bit ' + frame.flipped.bit + ' of byte ' + frame.flipped.byteIdx + ', inside the ' + frame.flipped.field + ' field).', level: 'warning' });
      } else {
        p.push({ key: 'rx', text: 'The frame arrives intact.' });
      }
      p.push({
        key: 'check',
        text: 'Receiver recomputes the CRC-32 over the received bytes: 0x' + CRC.hex32(frame.fcsRecomputed) + ' vs. transmitted FCS 0x' + CRC.hex32(frame.fcs) + ' \u2192 ' + (frame.fcsOk ? 'match \u2014 frame accepted \u2713' : 'MISMATCH \u2014 frame silently discarded; Ethernet itself never retransmits, higher layers (e.g. TCP) recover.'),
        level: frame.fcsOk ? 'success' : 'error'
      });
      return p;
    }

    function draw() {
      const revealed = new Set(phases.slice(0, index + 1).map((p) => p.key));
      const active = phases[Math.max(0, index)] ? phases[Math.max(0, index)].key : null;
      const flippedField = index >= phases.findIndex((p) => p.key === 'rx') && frame.flipped ? frame.flipped.field : null;

      const fields = FIELDS.map((f) => {
        const isRevealed = revealed.has(f.key);
        const classes = ['frame-field', f.cls];
        if (!isRevealed) classes.push('is-hidden');
        if (active === f.key) classes.push('is-active');
        if (flippedField === f.key) classes.push('is-bad');
        const size = f.key === 'payload' ? (frame.padded.length + ' B') : f.bytes;
        return `<div class="${classes.join(' ')}">
          <span class="ff-name">${f.label}</span>
          <span class="ff-val">${isRevealed ? fieldValue(f.key) : '\u2014'}</span>
          <span class="ff-size">${size}</span>
        </div>`;
      }).join('');

      const rxIdx = phases.findIndex((p) => p.key === 'check');
      const checked = index >= rxIdx;
      host.innerHTML = `
        <div class="frame-row">${fields}</div>
        ${checked ? `<p class="net-hint" style="margin-top:0.8rem;">Receiver FCS check: <strong style="color:${frame.fcsOk ? 'var(--ok)' : 'var(--err)'};">${frame.fcsOk ? 'PASS' : 'FAIL'}</strong></p>` : ''}
      `;

      ctx.setMetrics([
        { label: 'Header (Dest+Src+Type)', value: frame.header + ' bytes' },
        { label: 'Payload (after padding)', value: frame.padded.length + ' bytes' + (frame.padLen ? ' (' + frame.padLen + ' padded)' : '') },
        { label: 'FCS (CRC-32)', value: '0x' + CRC.hex32(frame.fcs) },
        { label: 'Frame Size', value: frame.total + ' bytes' },
        { label: 'Legal Range (64\u20131518)', value: frame.total >= 64 && frame.total <= 1518 ? 'Yes' : 'No' },
        { label: 'Receiver FCS Check', value: checked ? (frame.fcsOk ? 'Pass' : 'Fail \u2014 discarded') : '\u2014' }
      ]);
    }

    function renderParams() {
      ctx.params.hidden = false;
      ctx.params.innerHTML = `
        <div class="switch-text-row">
          <label for="ethDest">Destination MAC</label>
          <input type="text" id="ethDest" maxlength="17" value="${escapeHtml(destMac)}">
        </div>
        <div class="switch-text-row">
          <label for="ethSrc">Source MAC</label>
          <input type="text" id="ethSrc" maxlength="17" value="${escapeHtml(srcMac)}">
        </div>
        <div class="switch-text-row">
          <label for="ethType">Type / Length field</label>
          <select id="ethType">
            ${Object.keys(ETHERTYPES).map((k) => `<option value="${k}" ${k === etherType ? 'selected' : ''}>${ETHERTYPES[k].label}</option>`).join('')}
          </select>
        </div>
        <div class="switch-text-row">
          <label for="ethPayload">Payload text</label>
          <input type="text" id="ethPayload" maxlength="100" value="${escapeHtml(payloadText)}">
        </div>
        <label class="switch-mode-option ${corrupt ? 'is-checked' : ''}">
          <input type="checkbox" id="ethCorrupt" ${corrupt ? 'checked' : ''}>
          Flip one random bit in transit
        </label>
      `;
      const macHandler = (id, setter, label) => {
        ctx.params.querySelector(id).addEventListener('change', (e) => {
          if (CRC.parseMac(e.target.value)) setter(CRC.macToString(CRC.parseMac(e.target.value)));
          else ctx.log(label + ' must look like AA:BB:CC:DD:EE:FF \u2014 keeping the previous value.', 'warning');
          rebuild();
        });
      };
      macHandler('#ethDest', (v) => { destMac = v; }, 'Destination MAC');
      macHandler('#ethSrc', (v) => { srcMac = v; }, 'Source MAC');
      ctx.params.querySelector('#ethType').addEventListener('change', (e) => { etherType = e.target.value; rebuild(); });
      ctx.params.querySelector('#ethPayload').addEventListener('change', (e) => { payloadText = e.target.value || 'Hello, Network!'; rebuild(); });
      ctx.params.querySelector('#ethCorrupt').addEventListener('change', (e) => { corrupt = e.target.checked; rebuild(); });
    }

    function rebuild() {
      stop();
      index = -1;
      phases = buildPhases();
      renderParams();
      draw();
      ctx.log('Ready to build an Ethernet frame field by field.');
    }

    function stop() { if (timer) { NetSim.SimTiming.clearInterval(timer); timer = null; } }

    function advance() {
      if (index >= phases.length - 1) { stop(); return; }
      index += 1;
      ctx.log(phases[index].text, phases[index].level);
      draw();
    }

    return {
      initialize() {
        ctx.canvas.classList.add('net-canvas');
        ctx.canvas.innerHTML = '<div class="eth-mount"></div>';
        host = ctx.canvas.querySelector('.eth-mount');
        rebuild();
      },
      start() { if (timer) return; timer = NetSim.SimTiming.setInterval(() => { if (index >= phases.length - 1) { stop(); return; } advance(); }, 750); },
      pause() { stop(); },
      step() { stop(); advance(); },
      reset() { rebuild(); },
      destroy() { stop(); }
    };
  });

})(window.NetSim = window.NetSim || {});
