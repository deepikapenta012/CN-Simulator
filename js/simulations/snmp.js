/* ==========================================================================
   NetSim — simulations/snmp.js
   Interactive SNMP Polling & Traps simulation:
     - SVG Manager↔Agent timeline with GET/SET/RESPONSE/TRAP PDUs
     - Operation presets (Polling, SET, TRAP, Walk)
     - Version toggle (v1/v2c/v3)
     - MIB tree visualization
     - PDU breakdown panel
   ========================================================================== */

(function (NetSim) {
  'use strict';

  var OPERATIONS = {
    poll:  { label: 'Polling (GET)',  desc: 'Manager polls agent for system and interface counters' },
    set:   { label: 'SET',           desc: 'Manager changes agent configuration' },
    trap:  { label: 'TRAP',          desc: 'Agent sends unsolicited notifications' },
    walk:  { label: 'Walk (GET-NEXT)', desc: 'Manager traverses a MIB subtree' }
  };

  var VERSIONS = {
    v1:  { label: 'SNMPv1',  security: 'Community string', auth: 'public' },
    v2c: { label: 'SNMPv2c', security: 'Community string', auth: 'public' },
    v3:  { label: 'SNMPv3',  security: 'USM (User Security Model)', auth: 'admin / authPriv' }
  };

  /* ---- Build events ---- */
  function buildEvents(operation, version) {
    var events = [];
    var reqId = Math.floor(Math.random() * 90000) + 10000;
    var ver = VERSIONS[version];
    var community = version === 'v3' ? 'USM: admin (authPriv)' : 'Community: public';

    if (operation === 'poll') {
      events.push({
        dir: 'right', label: 'GET sysUpTime.0',
        text: 'Manager sends a GET request for OID 1.3.6.1.2.1.1.3.0 (sysUpTime). ' + community + '. Request ID ' + reqId + '.',
        tag: 'GET', level: 'info',
        pdu: { type: 'GetRequest', version: ver.label, security: community, reqId: reqId, oid: '1.3.6.1.2.1.1.3.0', name: 'sysUpTime.0', value: null, error: 'noError(0)' }
      });
      events.push({
        dir: 'left', label: 'RESPONSE sysUpTime = 48201',
        text: 'Agent responds with sysUpTime = 48201 (timeticks). The device has been up for ~8 minutes.',
        tag: 'RESPONSE', level: 'success',
        pdu: { type: 'GetResponse', version: ver.label, security: community, reqId: reqId, oid: '1.3.6.1.2.1.1.3.0', name: 'sysUpTime.0', value: '48201 (timeticks)', error: 'noError(0)' }
      });

      reqId++;
      events.push({
        dir: 'right', label: 'GET ifInOctets.2',
        text: 'Manager sends GET for OID 1.3.6.1.2.1.2.2.1.10.2 (ifInOctets on interface 2) to check traffic volume.',
        tag: 'GET', level: 'info',
        pdu: { type: 'GetRequest', version: ver.label, security: community, reqId: reqId, oid: '1.3.6.1.2.1.2.2.1.10.2', name: 'ifInOctets.2', value: null, error: 'noError(0)' }
      });
      events.push({
        dir: 'left', label: 'RESPONSE ifInOctets.2 = 1458923',
        text: 'Agent responds: ifInOctets.2 = 1,458,923 bytes received on interface 2. Manager compares with previous sample to calculate throughput.',
        tag: 'RESPONSE', level: 'success',
        pdu: { type: 'GetResponse', version: ver.label, security: community, reqId: reqId, oid: '1.3.6.1.2.1.2.2.1.10.2', name: 'ifInOctets.2', value: '1458923 (counter32)', error: 'noError(0)' }
      });

      reqId++;
      events.push({
        dir: 'right', label: 'GET sysName.0',
        text: 'Manager polls for the device name (sysName.0).',
        tag: 'GET', level: 'info',
        pdu: { type: 'GetRequest', version: ver.label, security: community, reqId: reqId, oid: '1.3.6.1.2.1.1.5.0', name: 'sysName.0', value: null, error: 'noError(0)' }
      });
      events.push({
        dir: 'left', label: 'RESPONSE sysName = "core-router-1"',
        text: 'Agent responds with the configured device name.',
        tag: 'RESPONSE', level: 'success',
        pdu: { type: 'GetResponse', version: ver.label, security: community, reqId: reqId, oid: '1.3.6.1.2.1.1.5.0', name: 'sysName.0', value: '"core-router-1"', error: 'noError(0)' }
      });

    } else if (operation === 'set') {
      events.push({
        dir: 'right', label: 'GET ifAdminStatus.3',
        text: 'Manager first checks the current admin status of interface 3.',
        tag: 'GET', level: 'info',
        pdu: { type: 'GetRequest', version: ver.label, security: community, reqId: reqId, oid: '1.3.6.1.2.1.2.2.1.7.3', name: 'ifAdminStatus.3', value: null, error: 'noError(0)' }
      });
      events.push({
        dir: 'left', label: 'RESPONSE ifAdminStatus.3 = up(1)',
        text: 'Agent reports: interface 3 is currently administratively UP.',
        tag: 'RESPONSE', level: 'success',
        pdu: { type: 'GetResponse', version: ver.label, security: community, reqId: reqId, oid: '1.3.6.1.2.1.2.2.1.7.3', name: 'ifAdminStatus.3', value: 'up(1)', error: 'noError(0)' }
      });

      reqId++;
      events.push({
        dir: 'right', label: 'SET ifAdminStatus.3 = down(2)',
        text: 'Manager sends a SET request to disable interface 3 (ifAdminStatus = down). ' + (version === 'v3' ? 'SNMPv3 authPriv provides authentication and encryption.' : 'Warning: v1/v2c SET uses only a community string for access control!'),
        tag: 'SET', level: version === 'v3' ? 'info' : 'warning',
        pdu: { type: 'SetRequest', version: ver.label, security: community, reqId: reqId, oid: '1.3.6.1.2.1.2.2.1.7.3', name: 'ifAdminStatus.3', value: 'down(2)', error: 'noError(0)' }
      });
      events.push({
        dir: 'left', label: 'RESPONSE SET OK',
        text: 'Agent confirms the SET was applied. Interface 3 is now administratively down.',
        tag: 'SET OK', level: 'success',
        pdu: { type: 'GetResponse', version: ver.label, security: community, reqId: reqId, oid: '1.3.6.1.2.1.2.2.1.7.3', name: 'ifAdminStatus.3', value: 'down(2)', error: 'noError(0)' }
      });

      events.push({
        dir: 'left-trap', label: 'TRAP linkDown (ifIndex=3)',
        text: 'Agent sends an unsolicited linkDown trap because interface 3 went down. Traps go Agent→Manager without a request!',
        tag: 'TRAP ⚠️', level: 'warning',
        pdu: { type: version === 'v1' ? 'Trap-PDU' : 'SNMPv2-Trap', version: ver.label, security: community, reqId: 0, oid: '1.3.6.1.6.3.1.1.5.3', name: 'linkDown', value: 'ifIndex=3', error: 'n/a' }
      });

    } else if (operation === 'trap') {
      events.push({
        dir: 'left-trap', label: 'TRAP coldStart',
        text: 'Agent sends a coldStart trap — the device has just rebooted. Traps are UNSOLICITED: the agent sends them without being asked, to port 162 on the manager.',
        tag: 'TRAP coldStart', level: 'warning',
        pdu: { type: version === 'v1' ? 'Trap-PDU' : 'SNMPv2-Trap', version: ver.label, security: community, reqId: 0, oid: '1.3.6.1.6.3.1.1.5.1', name: 'coldStart', value: 'sysUpTime=0', error: 'n/a' }
      });

      events.push({
        dir: 'right', label: 'GET sysUpTime.0',
        text: 'Manager responds to the trap by polling sysUpTime to confirm the reboot.',
        tag: 'GET', level: 'info',
        pdu: { type: 'GetRequest', version: ver.label, security: community, reqId: reqId, oid: '1.3.6.1.2.1.1.3.0', name: 'sysUpTime.0', value: null, error: 'noError(0)' }
      });
      events.push({
        dir: 'left', label: 'RESPONSE sysUpTime = 42',
        text: 'Agent confirms: sysUpTime = 42 timeticks (< 1 second) — the device just came up.',
        tag: 'RESPONSE', level: 'success',
        pdu: { type: 'GetResponse', version: ver.label, security: community, reqId: reqId, oid: '1.3.6.1.2.1.1.3.0', name: 'sysUpTime.0', value: '42 (timeticks)', error: 'noError(0)' }
      });

      events.push({
        dir: 'left-trap', label: 'TRAP linkDown (ifIndex=1)',
        text: 'Agent sends a linkDown trap — interface 1 lost its link. The manager receives this on UDP port 162.',
        tag: 'TRAP linkDown', level: 'warning',
        pdu: { type: version === 'v1' ? 'Trap-PDU' : 'SNMPv2-Trap', version: ver.label, security: community, reqId: 0, oid: '1.3.6.1.6.3.1.1.5.3', name: 'linkDown', value: 'ifIndex=1', error: 'n/a' }
      });

      events.push({
        dir: 'left-trap', label: 'TRAP linkUp (ifIndex=1)',
        text: 'Interface 1 comes back up. Agent sends a linkUp trap. No polling needed — the manager is notified immediately.',
        tag: 'TRAP linkUp', level: 'success',
        pdu: { type: version === 'v1' ? 'Trap-PDU' : 'SNMPv2-Trap', version: ver.label, security: community, reqId: 0, oid: '1.3.6.1.6.3.1.1.5.4', name: 'linkUp', value: 'ifIndex=1', error: 'n/a' }
      });

    } else if (operation === 'walk') {
      var walkOids = [
        { oid: '1.3.6.1.2.1.1.1.0', name: 'sysDescr.0', val: '"Cisco IOS v15.6"' },
        { oid: '1.3.6.1.2.1.1.3.0', name: 'sysUpTime.0', val: '48201' },
        { oid: '1.3.6.1.2.1.1.4.0', name: 'sysContact.0', val: '"admin@netsim.edu"' },
        { oid: '1.3.6.1.2.1.1.5.0', name: 'sysName.0', val: '"core-router-1"' },
        { oid: '1.3.6.1.2.1.1.6.0', name: 'sysLocation.0', val: '"Lab Room 204"' }
      ];

      var cmdName = version === 'v2c' || version === 'v3' ? 'GET-BULK' : 'GET-NEXT';
      walkOids.forEach(function (w, i) {
        var prevOid = i === 0 ? '1.3.6.1.2.1.1' : walkOids[i - 1].oid;
        events.push({
          dir: 'right', label: cmdName + ' ' + prevOid,
          text: 'Manager sends ' + cmdName + ' starting at OID ' + prevOid + '. The agent returns the NEXT OID in the MIB tree.',
          tag: cmdName, level: 'info',
          pdu: { type: cmdName === 'GET-BULK' ? 'GetBulkRequest' : 'GetNextRequest', version: ver.label, security: community, reqId: reqId + i, oid: prevOid, name: prevOid, value: null, error: 'noError(0)' }
        });
        events.push({
          dir: 'left', label: w.name + ' = ' + w.val,
          text: 'Agent returns next OID: ' + w.name + ' = ' + w.val + '.',
          tag: 'RESPONSE', level: 'success',
          pdu: { type: 'GetResponse', version: ver.label, security: community, reqId: reqId + i, oid: w.oid, name: w.name, value: w.val, error: 'noError(0)' }
        });
      });

      // End of MIB subtree
      events.push({
        dir: 'right', label: cmdName + ' ' + walkOids[walkOids.length - 1].oid,
        text: 'Manager asks for the next OID after ' + walkOids[walkOids.length - 1].name + '.',
        tag: cmdName, level: 'info',
        pdu: { type: cmdName === 'GET-BULK' ? 'GetBulkRequest' : 'GetNextRequest', version: ver.label, security: community, reqId: reqId + walkOids.length, oid: walkOids[walkOids.length - 1].oid, name: walkOids[walkOids.length - 1].name, value: null, error: 'noError(0)' }
      });
      events.push({
        dir: 'left', label: 'End of MIB subtree',
        text: 'Agent returns an OID outside the system subtree (or endOfMibView in v2c). The walk is complete — 5 objects discovered.',
        tag: 'End of Walk', level: 'info',
        pdu: { type: 'GetResponse', version: ver.label, security: community, reqId: reqId + walkOids.length, oid: '1.3.6.1.2.1.2.1.0', name: 'ifNumber.0', value: 'endOfMibView', error: version === 'v1' ? 'noSuchName(2)' : 'endOfMibView' }
      });
    }

    return events;
  }

  /* ---- SVG Timeline ---- */
  function renderTimeline(events, currentIdx) {
    var W = 600, rowH = 48, topPad = 50;
    var visible = events.slice(0, currentIdx + 1);
    var rows = Math.max(visible.length, 1);
    var H = topPad + rows * rowH + 20;
    var mX = 100, aX = 500;

    var svg = '<svg class="snmp-tl-svg" viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="SNMP timeline">';

    svg += '<text x="' + mX + '" y="22" text-anchor="middle" class="snmp-tl-header" fill="#1565c0">Manager</text>';
    svg += '<text x="' + aX + '" y="22" text-anchor="middle" class="snmp-tl-header" fill="#e65100">Agent</text>';
    svg += '<text x="' + mX + '" y="37" text-anchor="middle" class="snmp-tl-subhdr">NMS (port 162)</text>';
    svg += '<text x="' + aX + '" y="37" text-anchor="middle" class="snmp-tl-subhdr">Router (port 161)</text>';

    svg += '<line x1="' + mX + '" y1="42" x2="' + mX + '" y2="' + (H - 5) + '" stroke="#1565c0" stroke-width="2" stroke-dasharray="4 3"/>';
    svg += '<line x1="' + aX + '" y1="42" x2="' + aX + '" y2="' + (H - 5) + '" stroke="#e65100" stroke-width="2" stroke-dasharray="4 3"/>';

    visible.forEach(function (ev, i) {
      var y = topPad + i * rowH;
      var active = i === currentIdx;
      var sw = active ? '3' : '2';

      if (ev.dir === 'right') {
        svg += '<line x1="' + mX + '" y1="' + y + '" x2="' + aX + '" y2="' + (y + rowH * 0.4) + '" stroke="#1565c0" stroke-width="' + sw + '" marker-end="url(#snmp-arr)"/>';
        svg += '<text x="' + ((mX + aX) / 2) + '" y="' + (y - 3) + '" text-anchor="middle" class="snmp-arrow-label" fill="#1565c0">' + ev.label + '</text>';
      } else if (ev.dir === 'left') {
        svg += '<line x1="' + aX + '" y1="' + y + '" x2="' + mX + '" y2="' + (y + rowH * 0.4) + '" stroke="#2e7d32" stroke-width="' + sw + '" marker-end="url(#snmp-arr)"/>';
        svg += '<text x="' + ((mX + aX) / 2) + '" y="' + (y - 3) + '" text-anchor="middle" class="snmp-arrow-label" fill="#2e7d32">' + ev.label + '</text>';
      } else if (ev.dir === 'left-trap') {
        svg += '<line x1="' + aX + '" y1="' + y + '" x2="' + mX + '" y2="' + (y + rowH * 0.4) + '" stroke="#d32f2f" stroke-width="' + sw + '" stroke-dasharray="6 3" marker-end="url(#snmp-arr)"/>';
        svg += '<text x="' + ((mX + aX) / 2) + '" y="' + (y - 3) + '" text-anchor="middle" class="snmp-arrow-label" fill="#d32f2f">' + ev.label + '</text>';
      }
    });

    svg += '<defs><marker id="snmp-arr" markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto"><path d="M0,1 L0,7 L7,4 z" fill="var(--ink)"/></marker></defs>';
    svg += '</svg>';
    return svg;
  }

  /* ---- PDU breakdown ---- */
  function renderPDU(pdu) {
    if (!pdu) return '';
    var html = '<div class="snmp-pdu-box">';
    html += '<div class="snmp-pdu-title">' + pdu.type + ' PDU</div>';
    html += '<div class="snmp-pdu-fields">';

    var fields = [
      { name: 'Version', val: pdu.version },
      { name: 'Security', val: pdu.security },
      { name: 'PDU Type', val: pdu.type, cls: pdu.type.indexOf('Trap') >= 0 ? 'snmp-pf-trap' : pdu.type.indexOf('Set') >= 0 ? 'snmp-pf-set' : 'snmp-pf-get' },
      { name: 'Request ID', val: pdu.reqId },
      { name: 'Error', val: pdu.error },
      { name: 'OID', val: pdu.oid, cls: 'snmp-pf-oid' },
      { name: 'Name', val: pdu.name }
    ];
    if (pdu.value !== null && pdu.value !== undefined) {
      fields.push({ name: 'Value', val: pdu.value, cls: 'snmp-pf-val' });
    }

    fields.forEach(function (f) {
      html += '<div class="snmp-pf ' + (f.cls || '') + '"><span class="snmp-pf-name">' + f.name + '</span><span class="snmp-pf-val">' + f.val + '</span></div>';
    });
    html += '</div></div>';
    return html;
  }

  /* ---- MIB tree ---- */
  function renderMIBTree() {
    var html = '<div class="snmp-mib">';
    html += '<div class="snmp-mib-title">MIB-2 Tree (OID: 1.3.6.1.2.1)</div>';
    html += '<div class="snmp-mib-tree">';
    html += '<div class="snmp-mib-node snmp-mib-root">iso.org.dod.internet.mgmt.mib-2</div>';
    var branches = [
      { name: 'system (1)', oids: 'sysDescr, sysUpTime, sysContact, sysName, sysLocation' },
      { name: 'interfaces (2)', oids: 'ifNumber, ifIndex, ifDescr, ifType, ifSpeed, ifInOctets' },
      { name: 'ip (4)', oids: 'ipForwarding, ipInReceives, ipOutRequests' },
      { name: 'tcp (6)', oids: 'tcpActiveOpens, tcpInSegs, tcpOutSegs, tcpCurrEstab' }
    ];
    branches.forEach(function (b) {
      html += '<div class="snmp-mib-branch"><span class="snmp-mib-bname">' + b.name + '</span><span class="snmp-mib-boids">' + b.oids + '</span></div>';
    });
    html += '</div></div>';
    return html;
  }

  /* ==== Main simulation ==== */
  NetSim.SimRegistry.register('snmp', function factory(ctx) {
    var operation = 'poll';
    var version = 'v2c';
    var events = [];
    var index = -1;
    var timer = null;
    var host = null;

    function rebuild() {
      stop(); index = -1;
      events = buildEvents(operation, version);
      draw(); renderParams();
      ctx.log('SNMP — ' + OPERATIONS[operation].label + ' (' + VERSIONS[version].label + ')');
    }

    function draw() {
      var ev = index >= 0 && events[index] ? events[index] : null;
      var tlHtml = renderTimeline(events, index);
      var pduHtml = ev && ev.pdu ? renderPDU(ev.pdu) : '';
      var mibHtml = renderMIBTree();

      // Info
      var infoHtml = '<div class="snmp-info"><h4 class="snmp-info-title">SNMP — Simple Network Management Protocol</h4>';
      infoHtml += '<ul class="snmp-info-props">';
      infoHtml += '<li><strong>Manager-Agent model</strong> — NMS polls agents for managed object values</li>';
      infoHtml += '<li><strong>MIB</strong> — Management Information Base: hierarchical tree of OIDs (object identifiers)</li>';
      infoHtml += '<li><strong>GET/SET</strong> — read/write managed objects via UDP port 161</li>';
      infoHtml += '<li><strong>TRAP</strong> — unsolicited agent→manager notification on UDP port 162</li>';
      infoHtml += '<li><strong>v1/v2c</strong> — community string "passwords" (insecure). <strong>v3</strong> — USM authentication + encryption</li>';
      infoHtml += '</ul></div>';

      host.innerHTML = pduHtml + tlHtml + mibHtml + infoHtml;

      var gets = 0, sets = 0, traps = 0, responses = 0;
      for (var i = 0; i <= Math.min(index, events.length - 1); i++) {
        var p = events[i].pdu;
        if (p) {
          if (p.type.indexOf('Get') >= 0 && p.type !== 'GetResponse') gets++;
          else if (p.type.indexOf('Set') >= 0) sets++;
          else if (p.type.indexOf('Trap') >= 0) traps++;
          else if (p.type === 'GetResponse') responses++;
        }
      }

      ctx.setMetrics([
        { label: 'Operation', value: OPERATIONS[operation].label },
        { label: 'Version', value: VERSIONS[version].label },
        { label: 'Step', value: (index + 1) + ' / ' + events.length },
        { label: 'GETs Sent', value: String(gets) },
        { label: 'SETs Sent', value: String(sets) },
        { label: 'Responses', value: String(responses) },
        { label: 'Traps Received', value: String(traps) },
        { label: 'Transport', value: 'UDP :161 (agent) / :162 (traps)' }
      ]);
    }

    function renderParams() {
      ctx.params.hidden = false;
      var html = '';

      html += '<fieldset class="switch-mode-group" role="radiogroup" aria-label="Operation">';
      html += '<legend class="section-label" style="margin:0 0 0.5rem;border:none;padding:0;">Operation</legend>';
      Object.keys(OPERATIONS).forEach(function (k) {
        html += '<label class="switch-mode-option ' + (k === operation ? 'is-checked' : '') + '">' +
                '<input type="radio" name="snmpOp" value="' + k + '" ' + (k === operation ? 'checked' : '') + '> ' + OPERATIONS[k].label + '</label>';
      });
      html += '</fieldset>';

      html += '<fieldset class="switch-mode-group" role="radiogroup" aria-label="Version">';
      html += '<legend class="section-label" style="margin:0 0 0.5rem;border:none;padding:0;">Version</legend>';
      Object.keys(VERSIONS).forEach(function (k) {
        html += '<label class="switch-mode-option ' + (k === version ? 'is-checked' : '') + '">' +
                '<input type="radio" name="snmpVer" value="' + k + '" ' + (k === version ? 'checked' : '') + '> ' + VERSIONS[k].label + '</label>';
      });
      html += '</fieldset>';

      ctx.params.innerHTML = html;
      ctx.params.querySelectorAll('input[name="snmpOp"]').forEach(function (r) { r.addEventListener('change', function () { operation = r.value; rebuild(); }); });
      ctx.params.querySelectorAll('input[name="snmpVer"]').forEach(function (r) { r.addEventListener('change', function () { version = r.value; rebuild(); }); });
    }

    function stop() { if (timer) { NetSim.SimTiming.clearInterval(timer); timer = null; } }
    function advance() { if (index >= events.length - 1) { stop(); return; } index++; ctx.log(events[index].text, events[index].level); draw(); }

    return {
      initialize: function () { ctx.canvas.classList.add('net-canvas'); ctx.canvas.innerHTML = '<div class="snmp-mount"></div>'; host = ctx.canvas.querySelector('.snmp-mount'); rebuild(); },
      start: function () { if (timer) return; timer = NetSim.SimTiming.setInterval(function () { if (index >= events.length - 1) { stop(); return; } advance(); }, 800); },
      pause: function () { stop(); },
      step: function () { stop(); advance(); },
      reset: function () { rebuild(); },
      destroy: function () { stop(); }
    };
  });

})(window.NetSim = window.NetSim || {});
