/* Timing-diagram renderer shared by the data-link flow-control simulations. */
(function (NetSim) {
  'use strict';

  function escapeText(value) {
    return String(value).replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
  }

  function render(actions, activeIndex) {
    const visible = actions.slice(0, activeIndex + 1);
    const width = 520;
    const height = Math.max(180, 90 + visible.length * 58);
    const marks = visible.map((action, i) => {
      const y = 72 + i * 58;
      const isAck = action.type === 'ack';
      const x1 = isAck ? 390 : 120;
      const x2 = isAck ? 120 : 390;
      const y2 = y + 34;
      const color = action.outcome === 'lost' ? 'var(--err)' : isAck ? 'var(--teal)' : action.type === 'timeout' ? 'var(--warn)' : 'var(--accent)';
      if (action.type === 'timeout') return `<g><text x="120" y="${y + 5}" text-anchor="middle" class="td-timeout">⌛ timeout</text></g>`;
      if (action.type === 'deliver' || action.type === 'ack-arrival') {
        const x = action.type === 'ack-arrival' ? 120 : 390;
        return `<g><circle cx="${x}" cy="${y}" r="5" fill="var(--ok)"/><text x="${x + 10}" y="${y + 4}" class="td-label">${escapeText(action.label || 'delivered')}</text></g>`;
      }
      if (action.type === 'discard') return `<g><path d="M 384 ${y - 6} L 396 ${y + 6} M 396 ${y - 6} L 384 ${y + 6}" stroke="var(--err)" stroke-width="2"/><text x="402" y="${y + 4}" class="td-label">${escapeText(action.label)}</text></g>`;
      if (action.outcome === 'lost') {
        const midX = (x1 + x2) / 2;
        return `<g><line x1="${x1}" y1="${y}" x2="${x2}" y2="${y2}" stroke="${color}" stroke-dasharray="4 4"/><path d="M ${midX - 5} ${y + 12} L ${midX + 5} ${y + 22} M ${midX + 5} ${y + 12} L ${midX - 5} ${y + 22}" stroke="${color}" stroke-width="2"/><text x="${midX}" y="${y - 4}" text-anchor="middle" class="td-label">${escapeText(action.label)} lost</text></g>`;
      }
      return `<g><line x1="${x1}" y1="${y}" x2="${x2}" y2="${y2}" stroke="${color}" stroke-width="2" marker-end="url(#td-arrow)"/><text x="${(x1 + x2) / 2}" y="${y + 12}" text-anchor="middle" class="td-label">${escapeText(action.label)}</text></g>`;
    }).join('');
    const ticks = visible.map((_, i) => {
      const y = 72 + i * 58;
      return `<line x1="484" y1="${y}" x2="496" y2="${y}" class="td-tick"/><text x="505" y="${y + 4}" class="td-label">${i + 1}</text>`;
    }).join('');
    return `<div class="timing-diagram-scroll"><svg class="timing-diagram" style="width:${width}px;height:${height}px" viewBox="0 0 ${width} ${height}" role="img" aria-label="Sender and receiver timing diagram. Time moves from top to bottom.">
      <defs><marker id="td-arrow" markerWidth="7" markerHeight="7" refX="5" refY="3.5" orient="auto"><path d="M0,0 L0,7 L6,3.5 z" fill="var(--ink-soft)"/></marker></defs>
      <text x="120" y="24" text-anchor="middle" class="td-lane">Sender</text><text x="390" y="24" text-anchor="middle" class="td-lane">Receiver</text>
      <line x1="120" y1="38" x2="120" y2="${height - 18}" class="td-lane-line"/><line x1="390" y1="38" x2="390" y2="${height - 18}" class="td-lane-line"/>
      ${marks}<line x1="490" y1="38" x2="490" y2="${height - 8}" class="td-time-line" marker-end="url(#td-arrow)"/>${ticks}
      <text x="503" y="${height - 2}" class="td-label">time ↓</text>
    </svg></div>`;
  }

  NetSim.Components = NetSim.Components || {};
  NetSim.Components.renderTimingDiagram = render;
})(window.NetSim = window.NetSim || {});
