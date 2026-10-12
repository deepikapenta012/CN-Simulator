/* Timing-diagram renderer shared by the data-link flow-control simulations. */
(function (NetSim) {
  'use strict';

  function escapeText(value) {
    return String(value).replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
  }

  function render(actions, activeIndex) {
    const visible = actions.slice(0, activeIndex + 1);
    const width = Math.max(420, 115 + visible.length * 76);
    const marks = visible.map((action, i) => {
      const x = 112 + i * 76;
      const isAck = action.type === 'ack';
      const y1 = isAck ? 138 : 58;
      const y2 = isAck ? 58 : 138;
      const color = action.outcome === 'lost' ? 'var(--err)' : isAck ? 'var(--teal)' : action.type === 'timeout' ? 'var(--warn)' : 'var(--accent)';
      if (action.type === 'timeout') return `<g><text x="${x}" y="64" text-anchor="middle" class="td-timeout">⌛</text><text x="${x}" y="83" text-anchor="middle" class="td-label">timeout</text></g>`;
      if (action.type === 'deliver' || action.type === 'ack-arrival') {
        const y = action.type === 'ack-arrival' ? 58 : 138;
        return `<g><circle cx="${x}" cy="${y}" r="5" fill="var(--ok)"/><text x="${x}" y="${y + 20}" text-anchor="middle" class="td-label">${escapeText(action.label || 'delivered')}</text></g>`;
      }
      if (action.type === 'discard') return `<g><path d="M ${x - 5} 132 L ${x + 5} 144 M ${x + 5} 132 L ${x - 5} 144" stroke="var(--err)" stroke-width="2"/><text x="${x}" y="159" text-anchor="middle" class="td-label">${escapeText(action.label)}</text></g>`;
      if (action.outcome === 'lost') return `<g><line x1="${x}" y1="${y1}" x2="${x}" y2="${y2}" stroke="${color}" stroke-dasharray="4 4"/><path d="M ${x - 5} 94 L ${x + 5} 104 M ${x + 5} 94 L ${x - 5} 104" stroke="${color}" stroke-width="2"/><text x="${x}" y="88" text-anchor="middle" class="td-label">${escapeText(action.label)} lost</text></g>`;
      return `<g><line x1="${x}" y1="${y1}" x2="${x}" y2="${y2}" stroke="${color}" stroke-width="2" marker-end="url(#td-arrow)"/><text x="${x + 7}" y="${(y1 + y2) / 2}" class="td-label">${escapeText(action.label)}</text></g>`;
    }).join('');
    const ticks = visible.map((_, i) => {
      const x = 112 + i * 76;
      return `<line x1="${x}" y1="188" x2="${x}" y2="194" class="td-tick"/><text x="${x}" y="209" text-anchor="middle" class="td-label">${i + 1}</text>`;
    }).join('');
    return `<div class="timing-diagram-scroll"><svg class="timing-diagram" style="width:${width}px" viewBox="0 0 ${width} 224" role="img" aria-label="Sender and receiver timing diagram. Time moves from left to right.">
      <defs><marker id="td-arrow" markerWidth="7" markerHeight="7" refX="5" refY="3.5" orient="auto"><path d="M0,0 L0,7 L6,3.5 z" fill="var(--ink-soft)"/></marker></defs>
      <text x="8" y="62" class="td-lane">Sender</text><text x="8" y="142" class="td-lane">Receiver</text>
      <line x1="88" y1="58" x2="${width - 12}" y2="58" class="td-lane-line"/><line x1="88" y1="138" x2="${width - 12}" y2="138" class="td-lane-line"/>
      ${marks}<line x1="88" y1="188" x2="${width - 12}" y2="188" class="td-time-line" marker-end="url(#td-arrow)"/>${ticks}
      <text x="${width - 16}" y="219" text-anchor="end" class="td-label">time →</text>
    </svg></div>`;
  }

  NetSim.Components = NetSim.Components || {};
  NetSim.Components.renderTimingDiagram = render;
})(window.NetSim = window.NetSim || {});
