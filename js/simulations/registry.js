/* ==========================================================================
   NetSim — simulations/registry.js

   Each simulation module registers a factory under its id. The factory
   receives a mount context and must return an object implementing the
   lifecycle described in the brief:

     initialize()  — build initial DOM/canvas state, do not start running
     start()       — begin/resume the running simulation
     pause()       — halt without losing state
     step()        — advance exactly one discrete step
     reset()       — return to the initial state
     destroy()     — tear down listeners/timers when navigating away

   Simulation logic must stay separate from page chrome — the factory is
   only ever given a canvas element, a param panel element, and small
   log/metrics helpers. It does not know about routing or the OSI data.
   ========================================================================== */

(function (NetSim) {
  'use strict';

  const registry = new Map();
  const staticContent = new Map();

  function register(id, factory) {
    registry.set(id, factory);
  }

  function has(id) {
    return registry.has(id);
  }

  function create(id, mountCtx) {
    const factory = registry.get(id);
    if (!factory) return null;
    return factory(mountCtx);
  }

  function registerStaticContent(id, renderContent) {
    staticContent.set(id, renderContent);
  }

  function hasStaticContent(id) {
    return staticContent.has(id);
  }

  function getStaticContent(id) {
    const renderer = staticContent.get(id);
    return renderer ? renderer() : '';
  }

  /**
   * Convenience for modules that only want to prove out the lifecycle
   * wiring before real simulation logic is written (see brief section 13:
   * "Create the architecture so each simulation can be added
   * independently" / "Do not implement every simulation now").
   */
  function registerScaffold(id, title) {
    register(id, function factory(ctx) {
      let stepCount = 0;
      return {
        initialize() {
          ctx.canvas.innerHTML =
            '<div class="placeholder-box">' +
            '<strong>' + title + '</strong>' +
            'Simulation architecture is wired up — the interactive logic ' +
            'for this simulation has not been implemented yet.' +
            '</div>';
          ctx.log('initialize() called — scaffold ready.');
        },
        start() { ctx.log('start() — no running logic implemented yet.'); },
        pause() { ctx.log('pause() called.'); },
        step() {
          stepCount += 1;
          ctx.log('step() called — step ' + stepCount + ' (placeholder).');
        },
        reset() {
          stepCount = 0;
          ctx.log('reset() — state cleared.');
        },
        destroy() { /* no timers/listeners yet to release */ }
      };
    });
  }

  NetSim.SimRegistry = { register, has, create, registerScaffold, registerStaticContent, hasStaticContent, getStaticContent };

})(window.NetSim = window.NetSim || {});
