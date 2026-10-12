/* ==========================================================================
   NetSim — simulations/ipv4.js
   Real binary conversion and classful analysis of a user-entered IPv4
   address — class, default mask, and the network/host bit split.
   ========================================================================== */

(function (NetSim) {
  'use strict';

  function toOctets(ip) {
    const parts = ip.split('.').map((n) => parseInt(n, 10));
    if (parts.length !== 4 || parts.some((n) => isNaN(n) || n < 0 || n > 255)) return null;
    return parts;
  }

  function toBinary(n) { return n.toString(2).padStart(8, '0'); }

  function classify(octets) {
    const first = octets[0];
    const bin = toBinary(first);
    if (bin[0] === '0') return { cls: 'A', maskBits: 8, range: '0\u2013127' };
    if (bin.slice(0, 2) === '10') return { cls: 'B', maskBits: 16, range: '128\u2013191' };
    if (bin.slice(0, 3) === '110') return { cls: 'C', maskBits: 24, range: '192\u2013223' };
    if (bin.slice(0, 4) === '1110') return { cls: 'D (multicast)', maskBits: null, range: '224\u2013239' };
    return { cls: 'E (experimental)', maskBits: null, range: '240\u2013255' };
  }

  NetSim.SimRegistry.register('ipv4', function factory(ctx) {
    let ipStr = '192.168.1.10';
    let phases = [];
    let index = -1;
    let timer = null;
    let host = null;
    let info = null;

    function compute() {
      const octets = toOctets(ipStr);
      if (!octets) return null;
      const binOctets = octets.map(toBinary);
      const classInfo = classify(octets);
      return { octets, binOctets, classInfo };
    }

    function buildPhases() {
      info = compute();
      if (!info) return [{ text: 'That doesn\u2019t look like a valid IPv4 address \u2014 use four numbers 0\u2013255 separated by dots.', level: 'error', view: 'invalid' }];
      const { octets, classInfo } = info;
      const p = [];
      p.push({ text: 'Address: ' + octets.join('.'), view: 'decimal' });
      p.push({ text: 'In binary: ' + info.binOctets.join('.'), view: 'binary' });
      p.push({ text: 'First octet is ' + octets[0] + ' (binary ' + info.binOctets[0] + '), in range ' + classInfo.range + ' \u2192 Class ' + classInfo.cls + '.', view: 'class' });
      if (classInfo.maskBits) {
        p.push({ text: 'Class ' + classInfo.cls + ' default mask: /' + classInfo.maskBits + ' (' + '1'.repeat(classInfo.maskBits).padEnd(32, '0').match(/.{8}/g).map((b) => parseInt(b, 2)).join('.') + ')', view: 'mask' });
        p.push({ text: 'Network portion: first ' + classInfo.maskBits + ' bits. Host portion: remaining ' + (32 - classInfo.maskBits) + ' bits.', view: 'split', level: 'success' });
      } else {
        p.push({ text: 'Class ' + classInfo.cls + ' addresses are not divided into network/host portions by a classful mask \u2014 Class D is used for multicast groups, Class E is reserved.', view: 'split', level: 'success' });
      }
      return p;
    }

    function draw() {
      const phase = phases[Math.max(0, index)];
      let body = '';
      if (phase.view === 'invalid') {
        body = `<p class="net-hint">${phase.text}</p>`;
      } else {
        const showBinary = index >= 1;
        const maskBits = info.classInfo.maskBits;
        body = `<div class="bitgrid">` + info.octets.map((oct, i) => {
          const bin = info.binOctets[i];
          if (!showBinary) return `<span class="bitbox">${oct}</span>`;
          return bin.split('').map((bit, biti) => {
            const globalBitIndex = i * 8 + biti;
            const isNetwork = maskBits && index >= 3 && globalBitIndex < maskBits;
            const isHost = maskBits && index >= 3 && globalBitIndex >= maskBits;
            return `<span class="bitbox ${isNetwork ? 'is-parity' : ''} ${isHost ? 'is-active' : ''}" style="width:1.5rem;height:1.8rem;font-size:0.8rem;">${bit}</span>`;
          }).join('') + '<span style="width:0.4rem;"></span>';
        }).join('') + `</div>`;
        if (index >= 3 && maskBits) {
          body += `<p class="net-hint">teal border = network bits &nbsp;\u00b7&nbsp; amber fill = host bits</p>`;
        }
      }
      host.innerHTML = `<div class="crc-stage">${body}</div>`;

      if (info) {
        ctx.setMetrics([
          { label: 'Address', value: info.octets.join('.') },
          { label: 'Class', value: info.classInfo.cls },
          { label: 'Default Mask', value: info.classInfo.maskBits ? '/' + info.classInfo.maskBits : 'n/a' },
          { label: 'Network Bits', value: info.classInfo.maskBits ? String(info.classInfo.maskBits) : 'n/a' },
          { label: 'Host Bits', value: info.classInfo.maskBits ? String(32 - info.classInfo.maskBits) : 'n/a' }
        ]);
      }
    }

    function renderParams() {
      ctx.params.hidden = false;
      ctx.params.innerHTML = `
        <div class="switch-text-row">
          <label for="ipv4Input">IPv4 address</label>
          <input type="text" id="ipv4Input" maxlength="15" value="${ipStr}">
        </div>
      `;
      ctx.params.querySelector('#ipv4Input').addEventListener('change', (e) => {
        ipStr = e.target.value.trim() || '192.168.1.10';
        rebuild();
      });
    }

    function rebuild() {
      stop();
      index = -1;
      phases = buildPhases();
      renderParams();
      draw();
      ctx.log('Ready to analyze ' + ipStr + '.');
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
        ctx.canvas.innerHTML = '<div class="ipv4-mount"></div>';
        host = ctx.canvas.querySelector('.ipv4-mount');
        rebuild();
      },
      start() { if (timer) return; timer = NetSim.SimTiming.setInterval(() => { if (index >= phases.length - 1) { stop(); return; } advance(); }, 800); },
      pause() { stop(); },
      step() { stop(); advance(); },
      reset() { rebuild(); },
      destroy() { stop(); }
    };
  });

})(window.NetSim = window.NetSim || {});
