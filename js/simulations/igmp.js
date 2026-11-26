/* ==========================================================================
   NetSim — simulations/igmp.js   (rebuilt)
   IGMP multicast group management with:
   • SVG LAN diagram: 3 hosts + Router, with join/leave/query arrows
   • Group membership strip (who's in, who's out)
   • Report suppression visualisation
   • IGMP message type breakdown
   • Timeline of join → query → suppress → leave → specific-query
   ========================================================================== */

(function (NetSim) {
  'use strict';

  var GROUP = '230.0.0.1';
  var HOSTS_LIST = ['H1', 'H2', 'H3'];

  NetSim.SimRegistry.register('igmp', function factory(ctx) {
    var events = [];
    var index  = -1;
    var timer  = null;
    var mount  = null;

    function buildEvents() {
      return [
        { t: 'H1 wants to receive multicast group ' + GROUP + '.  Sends IGMP Membership Report (Type 0x16).', phase: 'join1', members: ['H1'], arrow: 'h1-rtr', msgType: 'Membership Report', lv: 'success' },
        { t: 'Router adds ' + GROUP + ' to its forwarding table.  Multicast traffic now delivered to this LAN.', phase: 'forward', members: ['H1'], arrow: 'none' },
        { t: 'H2 also joins ' + GROUP + ' — sends its own Membership Report.', phase: 'join2', members: ['H1', 'H2'], arrow: 'h2-rtr', msgType: 'Membership Report' },
        { t: 'Router sends periodic IGMP Membership Query (Type 0x11) to 224.0.0.1 (all hosts).', phase: 'query', members: ['H1', 'H2'], arrow: 'rtr-all', msgType: 'Membership Query' },
        { t: 'H2 responds first with a Report for ' + GROUP + '.  H1 hears H2\'s report and SUPPRESSES its own — no need for both.', phase: 'suppress', members: ['H1', 'H2'], arrow: 'h2-rtr', msgType: 'Report (H1 suppressed)', lv: 'warning' },
        { t: 'Router sees at least one report → keeps forwarding ' + GROUP + '.', phase: 'keep', members: ['H1', 'H2'], arrow: 'none', lv: 'success' },
        { t: 'H1 leaves the group.  Sends IGMP Leave Group message (Type 0x17).', phase: 'leave', members: ['H2'], arrow: 'h1-rtr', msgType: 'Leave Group' },
        { t: 'Router sends a Group-Specific Query for ' + GROUP + ' to check if anyone else is still interested.', phase: 'specific', members: ['H2'], arrow: 'rtr-all', msgType: 'Group-Specific Query' },
        { t: 'H2 responds — still a member.  Router keeps forwarding ' + GROUP + '.', phase: 'still', members: ['H2'], arrow: 'h2-rtr', msgType: 'Membership Report', lv: 'success' }
      ];
    }

    /* ── SVG LAN diagram ──────────────────────────────────────────────── */
    function svgDiagram() {
      var step = events[Math.max(0, index)] || {};
      var members = step.members || [];
      var W = 680, H = 150;
      var html = '<svg class="igmp-svg" viewBox="0 0 ' + W + ' ' + H + '" preserveAspectRatio="xMidYMid meet">';

      /* Router */
      html += '<rect x="280" y="10" width="100" height="40" rx="6" fill="#e8f5e9" stroke="#66bb6a" stroke-width="2"/>';
      html += '<text x="330" y="35" text-anchor="middle" font-size="11" font-weight="700" fill="#2e7d32">Router</text>';

      /* Hosts */
      var hostX = [100, 320, 540];
      for (var i = 0; i < 3; i++) {
        var isMember = members.indexOf(HOSTS_LIST[i]) >= 0;
        var hx = hostX[i], hy = 90;
        html += '<rect x="' + (hx - 40) + '" y="' + hy + '" width="80" height="36" rx="6" fill="' + (isMember ? '#e3f2fd' : '#fafafa') + '" stroke="' + (isMember ? '#1976d2' : '#bbb') + '" stroke-width="' + (isMember ? 2 : 1) + '"/>';
        html += '<text x="' + hx + '" y="' + (hy + 16) + '" text-anchor="middle" font-size="11" font-weight="600" fill="var(--ink)">' + HOSTS_LIST[i] + '</text>';
        html += '<text x="' + hx + '" y="' + (hy + 28) + '" text-anchor="middle" font-size="8" fill="' + (isMember ? '#1976d2' : 'var(--ink-faint)') + '">' + (isMember ? '● Member' : '○ Not member') + '</text>';
        /* line to router */
        html += '<line x1="' + hx + '" y1="' + hy + '" x2="330" y2="50" stroke="#ddd" stroke-width="1"/>';
      }

      /* arrows */
      var arrowMap = {
        'h1-rtr': [hostX[0], 90, 330, 52],
        'h2-rtr': [hostX[1], 90, 330, 52],
        'rtr-all': [330, 52, 330, 70]
      };
      if (step.arrow && step.arrow !== 'none' && arrowMap[step.arrow]) {
        var a = arrowMap[step.arrow];
        if (step.arrow === 'rtr-all') {
          /* broadcast fan-out from router to all hosts */
          for (var i = 0; i < 3; i++) {
            html += '<line x1="330" y1="52" x2="' + hostX[i] + '" y2="88" stroke="#ffa726" stroke-width="2" stroke-dasharray="5,3" marker-end="url(#igmpArr)"/>';
          }
        } else {
          var col = step.phase === 'leave' ? '#ef5350' : '#42a5f5';
          html += '<line x1="' + a[0] + '" y1="' + a[1] + '" x2="' + a[2] + '" y2="' + a[3] + '" stroke="' + col + '" stroke-width="2" marker-end="url(#igmpArr)"/>';
        }
      }

      /* suppression indicator */
      if (step.phase === 'suppress') {
        html += '<text x="' + hostX[0] + '" y="85" text-anchor="middle" font-size="9" fill="#ef5350" font-weight="700">SUPPRESSED</text>';
      }

      html += '<defs><marker id="igmpArr" markerWidth="8" markerHeight="6" refX="8" refY="3" orient="auto"><path d="M0,0 L8,3 L0,6 Z" fill="#888"/></marker></defs>';
      html += '</svg>';
      return html;
    }

    /* ── message type panel ───────────────────────────────────────────── */
    function msgPanel() {
      var step = events[Math.max(0, index)] || {};
      if (!step.msgType) return '';
      var typeMap = {
        'Membership Report': { type: '0x16 (22)', desc: 'Host declares interest in a multicast group.' },
        'Membership Query': { type: '0x11 (17)', desc: 'Router asks "who still wants this group?"' },
        'Leave Group': { type: '0x17 (23)', desc: 'Host declares it is leaving the group.' },
        'Group-Specific Query': { type: '0x11 (17)', desc: 'Router checks if anyone still wants a specific group.' },
        'Report (H1 suppressed)': { type: '0x16 (22)', desc: 'H2 reports; H1 suppresses its own (duplicate avoidance).' }
      };
      var info = typeMap[step.msgType] || { type: '?', desc: '' };
      var html = '<div class="igmp-msg">';
      html += '<div class="igmp-msg-title">' + step.msgType + '</div>';
      html += '<div class="igmp-msg-row"><span>Type</span><strong>' + info.type + '</strong></div>';
      html += '<div class="igmp-msg-row"><span>Group</span><strong>' + GROUP + '</strong></div>';
      html += '<div class="igmp-msg-desc">' + info.desc + '</div>';
      html += '</div>';
      return html;
    }

    /* ── draw ──────────────────────────────────────────────────────────── */
    function draw() {
      mount.innerHTML = svgDiagram() + msgPanel();

      var step = events[Math.max(0, index)] || {};
      var members = step.members || [];
      var suppressed = 0;
      for (var i = 0; i <= index; i++) { if (events[i].phase === 'suppress') suppressed++; }
      ctx.setMetrics([
        { label: 'Multicast Group', value: GROUP },
        { label: 'Current Members', value: members.length ? members.join(', ') : 'none' },
        { label: 'Reports Suppressed', value: String(suppressed) },
        { label: 'Router Forwarding', value: members.length ? 'Yes' : 'No' }
      ]);
    }

    function rebuild() {
      stop(); index = -1;
      events = buildEvents();
      ctx.params.hidden = true;
      draw();
      ctx.log('Ready — hosts joining multicast group ' + GROUP + '.');
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
