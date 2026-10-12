/* ==========================================================================
   NetSim — app.js
   Entry point: wires the mobile nav toggle and starts the router.
   ========================================================================== */

(function (NetSim) {
  'use strict';

  function initNavToggle() {
    const toggle = document.getElementById('navToggle');
    const menu = document.getElementById('navMenu');
    toggle.addEventListener('click', () => {
      const open = menu.classList.toggle('open');
      toggle.setAttribute('aria-expanded', String(open));
    });
    menu.addEventListener('click', (e) => {
      if (e.target.tagName === 'A') {
        menu.classList.remove('open');
        toggle.setAttribute('aria-expanded', 'false');
      }
    });
  }

  function init() {
    initNavToggle();
    window.addEventListener('hashchange', NetSim.Router.render);
    NetSim.Router.render();
  }

  document.addEventListener('DOMContentLoaded', init);

})(window.NetSim = window.NetSim || {});
