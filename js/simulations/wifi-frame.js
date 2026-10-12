/* ==========================================================================
   NetSim — simulations/wifi-frame.js
   Builds a real IEEE 802.11 data frame: the 16-bit Frame Control word
   from actual flag bits, the three MAC addresses whose roles change
   with the To DS / From DS direction, Sequence Control, optional QoS
   Control, and a genuine CRC-32 FCS over header + body. The point to
   notice versus Ethernet: a much bigger header, and a mandatory ACK.
   ========================================================================== */

(function (NetSim) {
  'use strict';

  const CRC = NetSim.Core.CRC32;

  const STA = 'A4:C3:F0:12:34:56';
  const AP = '00:1A:2B:3C:4D:5E';
  const HOST = '3C:22:FB:9A:BC:DE';
  const CCMP_HEADER = [0x01, 0x00, 0x00, 0x20, 0x00, 0x00, 0x00, 0x00]; // illustrative 8-byte CCMP header

  function escapeHtml(s) {
    return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }
  function hexBytes(bytes) { return bytes.map(CRC.hexByte).join(' '); }

  NetSim.SimRegistry.register('wifi-frame', function factory(ctx) {
    let direction = 'toAP'; // 'toAP' = STA -> AP (To DS=1) | 'fromAP' = AP -> STA (From DS=1)
    let qos = false;
    let protectedFlag = false;
    let retry = false;
    let payloadText = 'Hello, Network!';
    let phases = [];
    let index = -1;
    let timer = null;
    let host = null;
    let frame = null;

    function compute() {
      const toDS = direction === 'toAP';
      const fromDS = direction === 'fromAP';
      const subtype = qos ? 8 : 0;

      const b0 = (0 & 3) | (2 << 2) | ((subtype & 15) << 4);                 // version | type=Data | subtype
      const b1 = (toDS ? 1 : 0) | (fromDS ? 2 : 0) | (retry ? 8 : 0) | (protectedFlag ? 64 : 0);
      const fcBytes = [b0 & 255, b1 & 255];
      const fcFields = [
        { name: 'Version', bits: '00' },
        { name: 'Type', bits: '10', note: 'Data' },
        { name: 'Subtype', bits: subtype.toString(2).padStart(4, '0'), note: qos ? 'QoS Data' : 'Data' },
        { name: 'To DS', bits: toDS ? '1' : '0', set: toDS },
        { name: 'From DS', bits: fromDS ? '1' : '0', set: fromDS },
        { name: 'More Frag', bits: '0' },
        { name: 'Retry', bits: retry ? '1' : '0', set: retry },
        { name: 'Pwr Mgmt', bits: '0' },
        { name: 'More Data', bits: '0' },
        { name: 'Protected', bits: protectedFlag ? '1' : '0', set: protectedFlag },
        { name: 'Order', bits: '0' }
      ];

      const durBytes = [0x2C, 0x00];                                          // 44 microseconds, little-endian
      const addrs = direction === 'toAP' ? [AP, STA, HOST] : [STA, AP, HOST];
      const [a1, a2, a3] = addrs.map(CRC.parseMac);
      const seqBytes = [0x20, 0x4D];                                          // seq 1234, frag 0: (1234 << 4) little-endian
      const qosBytes = qos ? [0x00, 0x00] : [];

      const payloadBytes = CRC.textToBytes(payloadText);
      const bodyBytes = protectedFlag ? CCMP_HEADER.concat(payloadBytes, new Array(8).fill(0)) : payloadBytes;

      const header = fcBytes.concat(durBytes, a1, a2, a3, seqBytes, qosBytes);
      const macFrame = header.concat(bodyBytes);
      const fcs = CRC.compute(macFrame);

      return { toDS, fromDS, fcBytes, fcFields, durBytes, a1, a2, a3, addrs, seqBytes, qosBytes, payloadBytes, bodyBytes, header, fcs, total: macFrame.length + 4 };
    }

    function fieldDefs() {
      const defs = [
        { key: 'fc', label: 'Frame Control', size: '2 B', cls: 'ff-ctrl' },
        { key: 'dur', label: 'Duration / ID', size: '2 B', cls: 'ff-ctrl' },
        { key: 'a1', label: 'Address 1', size: '6 B', cls: 'ff-addr' },
        { key: 'a2', label: 'Address 2', size: '6 B', cls: 'ff-addr' },
        { key: 'a3', label: 'Address 3', size: '6 B', cls: 'ff-addr' },
        { key: 'seq', label: 'Seq Control', size: '2 B', cls: 'ff-ctrl' }
      ];
      if (qos) defs.push({ key: 'qos', label: 'QoS Control', size: '2 B', cls: 'ff-ctrl' });
      defs.push({ key: 'body', label: 'Frame Body', size: frame.bodyBytes.length + ' B', cls: 'ff-data' });
      defs.push({ key: 'fcs', label: 'FCS', size: '4 B', cls: 'ff-fcs' });
      return defs;
    }

    function fieldValue(key) {
      switch (key) {
        case 'fc': return hexBytes(frame.fcBytes);
        case 'dur': return hexBytes(frame.durBytes) + ' (44 \u00b5s)';
        case 'a1': return CRC.macToString(frame.a1);
        case 'a2': return CRC.macToString(frame.a2);
        case 'a3': return CRC.macToString(frame.a3);
        case 'seq': return hexBytes(frame.seqBytes) + ' (#1234)';
        case 'qos': return hexBytes(frame.qosBytes) + ' (TID 0)';
        case 'body': {
          const shown = payloadText.length > 14 ? payloadText.slice(0, 14) + '\u2026' : payloadText;
          return escapeHtml(shown) + (protectedFlag ? ' +16 CCMP' : '');
        }
        case 'fcs': return '0x' + CRC.hex32(frame.fcs);
        default: return '';
      }
    }

    function buildPhases() {
      frame = compute();
      const p = [];
      p.push({
        key: 'fc',
        text: 'Frame Control (' + hexBytes(frame.fcBytes) + '): type = Data, subtype = ' + (qos ? 'QoS Data' : 'Data') + ', To DS = ' + (frame.toDS ? 1 : 0) + ', From DS = ' + (frame.fromDS ? 1 : 0) +
          (retry ? ', Retry = 1 (this is a retransmission)' : '') + (protectedFlag ? ', Protected = 1 (body is encrypted)' : '') + '.'
      });
      p.push({ key: 'dur', text: 'Duration/ID: 44 \u00b5s \u2014 tells every other station how long to stay quiet (the NAV) so the receiver\u2019s ACK can follow without a collision.' });
      if (direction === 'toAP') {
        p.push({ key: 'a1', text: 'Address 1 (receiver): the AP\u2019s BSSID ' + AP + ' \u2014 the device that must receive and ACK this frame.' });
        p.push({ key: 'a2', text: 'Address 2 (transmitter): the sending station ' + STA + '.' });
        p.push({ key: 'a3', text: 'Address 3 (destination): ' + HOST + ' \u2014 the wired host the AP should forward to. Wi-Fi needs a third address because the next hop and the final destination differ.' });
      } else {
        p.push({ key: 'a1', text: 'Address 1 (receiver and destination): the station ' + STA + '.' });
        p.push({ key: 'a2', text: 'Address 2 (transmitter): the AP\u2019s BSSID ' + AP + '.' });
        p.push({ key: 'a3', text: 'Address 3 (original source): ' + HOST + ' \u2014 the wired host that actually sent this; the AP is only relaying it.' });
      }
      p.push({ key: 'seq', text: 'Sequence Control: sequence number 1234, fragment 0 \u2014 lets the receiver drop duplicates, which matter because a lost ACK causes a retransmission.' });
      if (qos) p.push({ key: 'qos', text: 'QoS Control: traffic identifier (TID) 0 = best effort \u2014 lets the AP prioritise voice and video over background traffic.' });
      p.push({
        key: 'body',
        text: protectedFlag
          ? 'Frame Body: ' + frame.payloadBytes.length + ' payload bytes plus 16 bytes of CCMP overhead (8-byte header + 8-byte MIC). The encryption itself isn\u2019t simulated \u2014 the payload is shown as plaintext.'
          : 'Frame Body: ' + frame.payloadBytes.length + ' payload bytes.'
      });
      p.push({ key: 'fcs', text: 'FCS: CRC-32 over the MAC header and body = 0x' + CRC.hex32(frame.fcs) + '.', level: 'success' });
      p.push({
        key: 'summary',
        text: 'Frame size = ' + frame.header.length + ' header + ' + frame.bodyBytes.length + ' body + 4 FCS = ' + frame.total + ' bytes. (Ethernet\u2019s header is only 14 bytes; 802.11 needs ' + frame.header.length + ' for the extra address and control fields.) The receiver checks the FCS and answers with a 14-byte ACK after a SIFS gap \u2014 no ACK, and the sender retransmits with Retry = 1.',
        level: 'success'
      });
      return p;
    }

    function draw() {
      const revealed = new Set(phases.slice(0, index + 1).map((p) => p.key));
      const active = phases[Math.max(0, index)] ? phases[Math.max(0, index)].key : null;

      const fields = fieldDefs().map((f) => {
        const isRevealed = revealed.has(f.key);
        const classes = ['frame-field', f.cls];
        if (!isRevealed) classes.push('is-hidden');
        if (active === f.key) classes.push('is-active');
        return `<div class="${classes.join(' ')}">
          <span class="ff-name">${f.label}</span>
          <span class="ff-val">${isRevealed ? fieldValue(f.key) : '\u2014'}</span>
          <span class="ff-size">${f.size}</span>
        </div>`;
      }).join('');

      const fcStrip = revealed.has('fc') ? `
        <p class="net-hint" style="margin:0.9rem 0 0.4rem;">Frame Control, bit by bit</p>
        <div class="fc-strip">
          ${frame.fcFields.map((f) => `
            <div class="fc-bit ${f.set ? 'is-set' : ''}">
              <span class="fc-name">${f.name}</span>
              <span class="fc-bits">${f.bits}</span>
              ${f.note ? `<span class="fc-note">${f.note}</span>` : ''}
            </div>
          `).join('')}
        </div>` : '';

      host.innerHTML = `<div class="frame-row">${fields}</div>${fcStrip}`;

      ctx.setMetrics([
        { label: 'Frame Type', value: qos ? 'QoS Data' : 'Data' },
        { label: 'Direction', value: direction === 'toAP' ? 'Station \u2192 AP (To DS = 1)' : 'AP \u2192 Station (From DS = 1)' },
        { label: 'MAC Header', value: frame.header.length + ' bytes (Ethernet: 14)' },
        { label: 'Frame Body', value: frame.bodyBytes.length + ' bytes' + (protectedFlag ? ' (incl. 16 CCMP)' : '') },
        { label: 'FCS (CRC-32)', value: '0x' + CRC.hex32(frame.fcs) },
        { label: 'Total Frame Size', value: frame.total + ' bytes' },
        { label: 'ACK Required', value: 'Yes \u2014 14-byte ACK after SIFS' }
      ]);
    }

    function renderParams() {
      ctx.params.hidden = false;
      ctx.params.innerHTML = `
        <div class="switch-tabs" role="tablist" aria-label="Frame direction">
          <button type="button" class="switch-tab ${direction === 'toAP' ? 'is-active' : ''}" data-dir="toAP" role="tab">Station \u2192 AP</button>
          <button type="button" class="switch-tab ${direction === 'fromAP' ? 'is-active' : ''}" data-dir="fromAP" role="tab">AP \u2192 Station</button>
        </div>
        <div class="switch-text-row">
          <label for="wifiPayload">Payload text</label>
          <input type="text" id="wifiPayload" maxlength="100" value="${escapeHtml(payloadText)}">
        </div>
        <label class="switch-mode-option ${qos ? 'is-checked' : ''}">
          <input type="checkbox" id="wifiQos" ${qos ? 'checked' : ''}> QoS Data frame (adds QoS Control)
        </label>
        <label class="switch-mode-option ${protectedFlag ? 'is-checked' : ''}" style="margin-top:0.4rem;">
          <input type="checkbox" id="wifiProt" ${protectedFlag ? 'checked' : ''}> Protected (WPA2/3 \u2014 adds 16 bytes of CCMP overhead)
        </label>
        <label class="switch-mode-option ${retry ? 'is-checked' : ''}" style="margin-top:0.4rem;">
          <input type="checkbox" id="wifiRetry" ${retry ? 'checked' : ''}> Retry bit (this is a retransmission)
        </label>
      `;
      ctx.params.querySelectorAll('.switch-tab').forEach((tab) => {
        tab.addEventListener('click', () => { if (tab.dataset.dir === direction) return; direction = tab.dataset.dir; rebuild(); });
      });
      ctx.params.querySelector('#wifiPayload').addEventListener('change', (e) => { payloadText = e.target.value || 'Hello, Network!'; rebuild(); });
      ctx.params.querySelector('#wifiQos').addEventListener('change', (e) => { qos = e.target.checked; rebuild(); });
      ctx.params.querySelector('#wifiProt').addEventListener('change', (e) => { protectedFlag = e.target.checked; rebuild(); });
      ctx.params.querySelector('#wifiRetry').addEventListener('change', (e) => { retry = e.target.checked; rebuild(); });
    }

    function rebuild() {
      stop();
      index = -1;
      phases = buildPhases();
      renderParams();
      draw();
      ctx.log('Ready to build an 802.11 data frame field by field.');
    }

    function stop() { if (timer) { clearInterval(timer); timer = null; } }

    function advance() {
      if (index >= phases.length - 1) { stop(); return; }
      index += 1;
      ctx.log(phases[index].text, phases[index].level);
      draw();
    }

    return {
      initialize() {
        ctx.canvas.classList.add('net-canvas');
        ctx.canvas.innerHTML = '<div class="wifi-mount"></div>';
        host = ctx.canvas.querySelector('.wifi-mount');
        rebuild();
      },
      start() { if (timer) return; timer = setInterval(() => { if (index >= phases.length - 1) { stop(); return; } advance(); }, 750); },
      pause() { stop(); },
      step() { stop(); advance(); },
      reset() { rebuild(); },
      destroy() { stop(); }
    };
  });

})(window.NetSim = window.NetSim || {});
