/* ==========================================================================
   NetSim — simulations/dns.js
   Scaffold only — registers the id against the shared lifecycle so the
   layer/simulation page can mount it. Replace registerScaffold with a
   real factory (initialize/start/pause/step/reset/destroy) when this
   simulation is implemented.
   ========================================================================== */

(function (NetSim) {
  'use strict';
  NetSim.SimRegistry.registerScaffold('dns', 'DNS Resolution');
})(window.NetSim = window.NetSim || {});
