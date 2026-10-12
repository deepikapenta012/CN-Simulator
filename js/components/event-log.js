/* ==========================================================================
   NetSim — components/event-log.js
   A small append-only log panel each simulation can write to.
   ========================================================================== */

(function (NetSim) {
  'use strict';

  function eventLogHTML() {
    return `
      <div class="sim-log">
        <div class="sim-log-head">Event log</div>
        <div class="sim-log-body" id="simLogBody">
          <div class="sim-log-empty">No events yet — press Start or Step.</div>
        </div>
      </div>
    `;
  }

  /**
   * Returns a log(message, level) function bound to the log body inside
   * `scopeEl`. `level` is optional: 'success' | 'warning' | 'error'
   * (default is a plain/normal entry).
   */
  function createLogger(scopeEl, max) {
    const body = scopeEl.querySelector('#simLogBody');
    const limit = max || 40;
    let started = false;

    return function log(message, level) {
      if (!body) return;
      if (!started) {
        body.innerHTML = '';
        started = true;
      }
      const entry = document.createElement('div');
      entry.className = 'entry' + (level ? ' ' + level : '');
      const time = new Date().toLocaleTimeString([], { hour12: false });
      entry.textContent = '[' + time + '] ' + message;
      body.appendChild(entry);
      while (body.children.length > limit) body.removeChild(body.firstChild);
      body.scrollTop = body.scrollHeight;
    };
  }

  NetSim.Components = NetSim.Components || {};
  NetSim.Components.eventLogHTML = eventLogHTML;
  NetSim.Components.createLogger = createLogger;

})(window.NetSim = window.NetSim || {});
