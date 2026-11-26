/* ==========================================================================
   NetSim — simulations/igmp.js   (expanded rebuild)
   IGMP multicast group management with:
   • Large SVG LAN diagram: 4 hosts + Router with animated arrows
   • Full join/query/suppress/leave/specific-query lifecycle
   • IGMP version comparison (v1/v2/v3)
   • Group membership state machine diagram
   • Message type breakdown with field details
   • Multicast address info panel
   • Timer visualisation (query interval, max response time)
   • 2 presets: Standard lifecycle vs Leave-and-rejoin
   ========================================================================== */

(function (NetSim) {
  'use strict';

  var GROUP = '239.1.1.10';
  var HOSTS = ['H1', 'H2', 'H3', 'H4'];
  var HOST_IPS = ['192.168.1.10', '192.168.1.20', '192.168.1.30', '192.168.1.40'];
  var ROUTER_IP = '192.168.1.1';

  /* ── IGMP version features ──────────────────────────────────────────── */
  var VERSIONS = [
    { ver: 'v1', join: '✓', leave: '✗ (timeout)', query: 'General only', sourceFilter: '✗' },
    { ver: 'v2', join: '✓', leave: '✓ (explicit)', query: 'General + Group-Specific', sourceFilter: '✗' },
    { ver: 'v3', join: '✓', leave: '✓ (explicit)', query: 'General + Group + Source', sourceFilter: '✓ (SSM)' }
  ];

  var PRESETS = [
    { label: 'Standard Lifecycle', tag: 'Join → Query → Suppress → Leave', key: 'standard' },
    { label: 'Leave & Rejoin',     tag: 'All leave → router prunes → rejoin', key: 'rejoin' }
  ];

  NetSim.SimRegistry.register('igmp', function factory(ctx) {
    var preIdx = 0;
    var events = [];
    var index  = -1;
    var timer  = null;
    var mount  = null;

    /* ── build events ─────────────────────────────────────────────────── */
    function buildStandard() {
      return [
        { t: 'H1 (' + HOST_IPS[0] + ') wants to receive multicast group ' + GROUP + '.', phase: 'want', members: [], arrow: 'none', activeHost: 0 },
        { t: 'H1 sends IGMPv2 Membership Report (Type 0x16) for ' + GROUP + ' to 224.0.0.22.', phase: 'join1', members: ['H1'], arrow: 'h-rtr', activeHost: 0, msgType: 'Membership Report', igmpType: '0x16', lv: 'success' },
        { t: 'Router adds ' + GROUP + ' to its multicast forwarding table.  Traffic now delivered to this segment.', phase: 'forward', members: ['H1'], arrow: 'none' },
        { t: 'H2 (' + HOST_IPS[1] + ') also joins — sends its own Membership Report for ' + GROUP + '.', phase: 'join2', members: ['H1', 'H2'], arrow: 'h-rtr', activeHost: 1, msgType: 'Membership Report', igmpType: '0x16' },
        { t: 'H3 (' + HOST_IPS[2] + ') joins the group too.  Three members now.', phase: 'join3', members: ['H1', 'H2', 'H3'], arrow: 'h-rtr', activeHost: 2, msgType: 'Membership Report', igmpType: '0x16' },
        { t: 'Router sends periodic IGMP Membership Query (Type 0x11) to 224.0.0.1 (all hosts).  Max Response Time = 10 s.', phase: 'query', members: ['H1', 'H2', 'H3'], arrow: 'rtr-all', msgType: 'Membership Query', igmpType: '0x11' },
        { t: 'Each host sets a random timer (0–10 s) before responding.  H3 has the shortest timer.', phase: 'timers', members: ['H1', 'H2', 'H3'], arrow: 'none' },
        { t: 'H3 responds first with a Report for ' + GROUP + '.  H1 and H2 hear it and SUPPRESS their own reports.', phase: 'suppress', members: ['H1', 'H2', 'H3'], arrow: 'h-rtr', activeHost: 2, msgType: 'Report (H1,H2 suppressed)', igmpType: '0x16', lv: 'warning' },
        { t: 'Router sees at least one report → keeps forwarding.  Suppression saved 2 redundant reports.', phase: 'keep', members: ['H1', 'H2', 'H3'], arrow: 'none', lv: 'success' },
        { t: 'H1 leaves the group — sends IGMPv2 Leave Group (Type 0x17) to 224.0.0.2 (all routers).', phase: 'leave1', members: ['H2', 'H3'], arrow: 'h-rtr', activeHost: 0, msgType: 'Leave Group', igmpType: '0x17' },
        { t: 'Router sends a Group-Specific Query for ' + GROUP + ' (is anyone still interested?).', phase: 'gsq', members: ['H2', 'H3'], arrow: 'rtr-all', msgType: 'Group-Specific Query', igmpType: '0x11' },
        { t: 'H2 responds with a Report — still a member.  Router keeps forwarding ' + GROUP + '.', phase: 'still', members: ['H2', 'H3'], arrow: 'h-rtr', activeHost: 1, msgType: 'Membership Report', igmpType: '0x16', lv: 'success' },
        { t: 'Summary: 3 joins, 1 leave, 2 reports suppressed.  Router maintains group until all members leave.', phase: 'done', members: ['H2', 'H3'], arrow: 'none', lv: 'success' }
      ];
    }

    function buildRejoin() {
      return [
        { t: 'H1 and H2 are members of ' + GROUP + '.', phase: 'init', members: ['H1', 'H2'], arrow: 'none' },
        { t: 'H1 sends Leave Group (Type 0x17).', phase: 'leave1', members: ['H2'], arrow: 'h-rtr', activeHost: 0, msgType: 'Leave Group', igmpType: '0x17' },
        { t: 'H2 also sends Leave Group.', phase: 'leave2', members: [], arrow: 'h-rtr', activeHost: 1, msgType: 'Leave Group', igmpType: '0x17' },
        { t: 'Router sends Group-Specific Query.  No responses within timeout.', phase: 'gsq', members: [], arrow: 'rtr-all', msgType: 'Group-Specific Query', igmpType: '0x11' },
        { t: 'No reports received.  Router PRUNES ' + GROUP + ' from the forwarding table.  Traffic stops.', phase: 'prune', members: [], arrow: 'none', lv: 'warning' },
        { t: 'Time passes.  H3 now wants ' + GROUP + ' — sends a Membership Report.', phase: 'rejoin', members: ['H3'], arrow: 'h-rtr', activeHost: 2, msgType: 'Membership Report', igmpType: '0x16', lv: 'success' },
        { t: 'Router re-adds ' + GROUP + '.  Multicast traffic resumes on this segment.', phase: 'resume', members: ['H3'], arrow: 'none', lv: 'success' },
        { t: 'H4 joins too.  Two new members for ' + GROUP + '.', phase: 'join4', members: ['H3', 'H4'], arrow: 'h-rtr', activeHost: 3, msgType: 'Membership Report', igmpType: '0x16' },
        { t: 'The group is active again with different members than before.', phase: 'done', members: ['H3', 'H4'], arrow: 'none', lv: 'success' }
      ];
    }

    function buildEvents() {
      return PRESETS[preIdx].key === 'rejoin' ? buildRejoin() : buildStandard();
    }

    /* ── SVG LAN diagram (large) ──────────────────────────────────────── */
    function svgDiagram() {
      var step = events[Math.max(0, index)] || {};
      var members = step.members || [];
      var W = 720, H = 220;
      var routerX = 360, routerY = 30;
      var hostY = 150;
      var hostXs = [100, 260, 460, 620];

      var html = '<svg class="igmp-svg" viewBox="0 0 ' + W + ' ' + H + '" preserveAspectRatio="xMidYMid meet">';

      /* Router */
      html += '<rect x="' + (routerX - 60) + '" y="' + routerY + '" width="120" height="50" rx="8" fill="#e8f5e9" stroke="#66bb6a" stroke-width="2.5"/>';
      html += '<text x="' + routerX + '" y="' + (routerY + 22) + '" text-anchor="middle" font-size="13" font-weight="700" fill="#2e7d32">Router</text>';
      html += '<text x="' + routerX + '" y="' + (routerY + 38) + '" text-anchor="middle" font-size="9" font-family="var(--f-mono)" fill="#2e7d32">' + ROUTER_IP + '</text>';

      /* LAN bus line */
      html += '<line x1="60" y1="105" x2="680" y2="105" stroke="#bbb" stroke-width="2"/>';
      html += '<text x="' + W / 2 + '" y="100" text-anchor="middle" font-size="9" fill="var(--ink-faint)">Ethernet LAN Segment</text>';
      /* router to bus */
      html += '<line x1="' + routerX + '" y1="' + (routerY + 50) + '" x2="' + routerX + '" y2="105" stroke="#bbb" stroke-width="2"/>';

      /* Hosts */
      for (var i = 0; i < HOSTS.length; i++) {
        var hx = hostXs[i];
        var isMember = members.indexOf(HOSTS[i]) >= 0;
        var isActive = step.activeHost === i;
        var isSuppressed = step.phase === 'suppress' && i < 2; /* H1,H2 suppressed */

        /* bus drop */
        html += '<line x1="' + hx + '" y1="105" x2="' + hx + '" y2="' + (hostY - 2) + '" stroke="#bbb" stroke-width="1.5"/>';

        /* host box */
        var fill = isActive ? '#e3f2fd' : (isMember ? '#e0f7fa' : '#fafafa');
        var stroke = isActive ? '#1976d2' : (isMember ? '#0097a7' : '#bbb');
        html += '<rect x="' + (hx - 45) + '" y="' + hostY + '" width="90" height="52" rx="6" fill="' + fill + '" stroke="' + stroke + '" stroke-width="' + (isActive ? 2.5 : 1.5) + '"/>';
        html += '<text x="' + hx + '" y="' + (hostY + 18) + '" text-anchor="middle" font-size="12" font-weight="700" fill="var(--ink)">' + HOSTS[i] + '</text>';
        html += '<text x="' + hx + '" y="' + (hostY + 30) + '" text-anchor="middle" font-size="8" font-family="var(--f-mono)" fill="var(--ink-faint)">' + HOST_IPS[i] + '</text>';

        /* membership badge */
        var badgeCol = isMember ? '#0097a7' : '#bbb';
        var badgeText = isMember ? '● Member' : '○ Not member';
        html += '<text x="' + hx + '" y="' + (hostY + 44) + '" text-anchor="middle" font-size="8" font-weight="600" fill="' + badgeCol + '">' + badgeText + '</text>';

        /* suppression X */
        if (isSuppressed) {
          html += '<text x="' + hx + '" y="' + (hostY - 8) + '" text-anchor="middle" font-size="11" fill="#ef5350" font-weight="700">SUPPRESSED</text>';
        }
      }

      /* arrows */
      if (step.arrow === 'h-rtr' && step.activeHost !== undefined) {
        var sx = hostXs[step.activeHost];
        var isLeave = step.phase && step.phase.indexOf('leave') >= 0;
        var col = isLeave ? '#ef5350' : '#42a5f5';
        html += '<line x1="' + sx + '" y1="' + (hostY - 2) + '" x2="' + routerX + '" y2="' + (routerY + 52) + '" stroke="' + col + '" stroke-width="2.5" marker-end="url(#igmpArr)"/>';
        if (step.msgType) {
          var mx = (sx + routerX) / 2, my = (hostY + routerY + 50) / 2;
          html += '<rect x="' + (mx - 50) + '" y="' + (my - 9) + '" width="100" height="14" rx="3" fill="' + col + '"/>';
          html += '<text x="' + mx + '" y="' + (my + 1) + '" text-anchor="middle" font-size="7.5" font-weight="700" fill="#fff">' + step.msgType.substring(0, 20) + '</text>';
        }
      } else if (step.arrow === 'rtr-all') {
        for (var i = 0; i < HOSTS.length; i++) {
          html += '<line x1="' + routerX + '" y1="' + (routerY + 52) + '" x2="' + hostXs[i] + '" y2="' + (hostY - 2) + '" stroke="#ffa726" stroke-width="2" stroke-dasharray="5,3" marker-end="url(#igmpArr)"/>';
        }
        html += '<text x="' + routerX + '" y="' + (routerY + 68) + '" text-anchor="middle" font-size="9" fill="#ffa726" font-weight="600">QUERY → all hosts</text>';
      }

      /* group forwarding status */
      var forwarding = members.length > 0;
      html += '<rect x="' + (W - 140) + '" y="8" width="130" height="20" rx="4" fill="' + (forwarding ? '#e8f5e9' : '#ffebee') + '" stroke="' + (forwarding ? '#66bb6a' : '#ef5350') + '" stroke-width="1"/>';
      html += '<text x="' + (W - 75) + '" y="22" text-anchor="middle" font-size="9" font-weight="600" fill="' + (forwarding ? '#2e7d32' : '#c62828') + '">' + (forwarding ? '✓ Forwarding ' + GROUP : '✗ Not forwarding') + '</text>';

      html += '<defs><marker id="igmpArr" markerWidth="8" markerHeight="6" refX="8" refY="3" orient="auto"><path d="M0,0 L8,3 L0,6 Z" fill="#888"/></marker></defs>';
      html += '</svg>';
      return html;
    }

    /* ── message type panel ───────────────────────────────────────────── */
    function msgPanel() {
      var step = events[Math.max(0, index)] || {};
      if (!step.igmpType) return '';
      var msgDescs = {
        '0x16': 'Host declares interest in a multicast group.  Sent to the group address.',
        '0x17': 'Host declares it is leaving.  Sent to 224.0.0.2 (all routers).',
        '0x11': 'Router asks who still wants a group.  General (all groups) or group-specific.'
      };
      var html = '<div class="igmp-panel igmp-msg">';
      html += '<div class="igmp-panel-title">IGMP Message</div>';
      html += '<div class="igmp-msg-grid">';
      html += '<div class="igmp-msg-field"><div class="igmp-msg-label">Type</div><div class="igmp-msg-val">' + step.igmpType + '</div></div>';
      html += '<div class="igmp-msg-field"><div class="igmp-msg-label">Max Resp Time</div><div class="igmp-msg-val">' + (step.igmpType === '0x11' ? '10 s' : 'N/A') + '</div></div>';
      html += '<div class="igmp-msg-field"><div class="igmp-msg-label">Group Address</div><div class="igmp-msg-val">' + GROUP + '</div></div>';
      html += '<div class="igmp-msg-field igmp-msg-span"><div class="igmp-msg-label">Description</div><div class="igmp-msg-desc">' + (msgDescs[step.igmpType] || '') + '</div></div>';
      html += '</div></div>';
      return html;
    }

    /* ── version comparison ────────────────────────────────────────────── */
    function versionTable() {
      if (index < 3) return '';
      var html = '<div class="igmp-panel igmp-ver">';
      html += '<div class="igmp-panel-title">IGMP Version Comparison</div>';
      html += '<table class="igmp-ver-tbl"><thead><tr><th>Feature</th><th>v1</th><th>v2</th><th>v3</th></tr></thead><tbody>';
      var features = ['join', 'leave', 'query', 'sourceFilter'];
      var featureNames = ['Join Report', 'Leave Mechanism', 'Query Types', 'Source Filtering'];
      for (var f = 0; f < features.length; f++) {
        html += '<tr><td>' + featureNames[f] + '</td>';
        for (var v = 0; v < VERSIONS.length; v++) {
          var val = VERSIONS[v][features[f]];
          var isGood = val.indexOf('✓') >= 0;
          html += '<td class="' + (isGood ? 'igmp-ver-good' : '') + '">' + val + '</td>';
        }
        html += '</tr>';
      }
      html += '</tbody></table></div>';
      return html;
    }

    /* ── multicast address info ───────────────────────────────────────── */
    function mcastInfo() {
      if (index < 1) return '';
      var html = '<div class="igmp-panel igmp-mcast">';
      html += '<div class="igmp-panel-title">Multicast Address Info</div>';
      html += '<div class="igmp-mcast-grid">';
      html += '<div class="igmp-mcast-item"><span>Group</span><strong>' + GROUP + '</strong></div>';
      html += '<div class="igmp-mcast-item"><span>Range</span><strong>224.0.0.0 – 239.255.255.255</strong></div>';
      html += '<div class="igmp-mcast-item"><span>Class D</span><strong>First 4 bits = 1110</strong></div>';
      html += '<div class="igmp-mcast-item"><span>MAC Mapping</span><strong>01:00:5E:' + ((parseInt(GROUP.split('.')[1]) & 0x7F)).toString(16) + ':' + parseInt(GROUP.split('.')[2]).toString(16) + ':' + parseInt(GROUP.split('.')[3]).toString(16) + '</strong></div>';
      html += '</div></div>';
      return html;
    }

    /* ── draw ──────────────────────────────────────────────────────────── */
    function draw() {
      mount.innerHTML = svgDiagram() + '<div class="igmp-panels">' + msgPanel() + mcastInfo() + versionTable() + '</div>';

      var step = events[Math.max(0, index)] || {};
      var members = step.members || [];
      var suppressed = 0, joins = 0, leaves = 0;
      for (var i = 0; i <= index; i++) {
        if (events[i].phase === 'suppress') suppressed++;
        if (events[i].phase && events[i].phase.indexOf('join') >= 0) joins++;
        if (events[i].phase && events[i].phase.indexOf('leave') >= 0) leaves++;
      }
      ctx.setMetrics([
        { label: 'Multicast Group', value: GROUP },
        { label: 'Current Members', value: members.length ? members.join(', ') : 'none' },
        { label: 'Total Joins', value: String(joins) },
        { label: 'Total Leaves', value: String(leaves) },
        { label: 'Reports Suppressed', value: String(suppressed) },
        { label: 'Router Forwarding', value: members.length ? 'Yes' : 'No' }
      ]);
    }

    /* ── params ────────────────────────────────────────────────────────── */
    function renderParams() {
      ctx.params.hidden = false;
      var html = '<div class="igmp-presets">';
      for (var i = 0; i < PRESETS.length; i++) {
        html += '<label class="switch-mode-option' + (i === preIdx ? ' is-checked' : '') + '">' +
          '<input type="radio" name="igmppre" value="' + i + '"' + (i === preIdx ? ' checked' : '') + '> ' +
          '<strong>' + PRESETS[i].label + '</strong><br><span style="font-size:0.72rem;color:var(--ink-faint);">' + PRESETS[i].tag + '</span></label>';
      }
      html += '</div>';
      ctx.params.innerHTML = html;

      var radios = ctx.params.querySelectorAll('input[name="igmppre"]');
      for (var i = 0; i < radios.length; i++) {
        radios[i].addEventListener('change', function (e) {
          preIdx = parseInt(e.target.value, 10);
          rebuild();
        });
      }
    }

    function rebuild() {
      stop(); index = -1;
      events = buildEvents();
      renderParams(); draw();
      ctx.log('Ready — ' + PRESETS[preIdx].label + ': hosts and multicast group ' + GROUP + '.');
    }

    function stop() { if (timer) { NetSim.SimTiming.clearInterval(timer); timer = null; } }

    function advance() {
      if (index >= events.length - 1) { stop(); return; }
      index++;
      ctx.log(events[index].t, events[index].lv);
      draw();
    }

    return {
      initialize: function () {
        ctx.canvas.innerHTML = '<div class="igmp-mount"></div>';
        mount = ctx.canvas.querySelector('.igmp-mount');
        rebuild();
      },
      start: function () { if (timer) return; timer = NetSim.SimTiming.setInterval(function () { if (index >= events.length - 1) { stop(); return; } advance(); }, 800); },
      pause: function () { stop(); },
      step:  function () { stop(); advance(); },
      reset: function () { rebuild(); },
      destroy: function () { stop(); }
    };
  });

})(window.NetSim = window.NetSim || {});
