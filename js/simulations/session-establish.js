/* ==========================================================================
   NetSim — simulations/session-establish.js
   Opening a session: the client presents credentials, the server
   authenticates them and proposes session parameters (dialog mode,
   synchronization points), the client accepts, and only then is a
   session ID assigned. Bad credentials end the attempt before any
   session exists.
   ========================================================================== */

(function (NetSim) {
  'use strict';

  NetSim.SimRegistry.register('session-establish', function factory(ctx) {
    let validCredentials = true;
    let dialogMode = 'full-duplex';
    let events = [];
    let index = -1;
    let timer = null;
    let host = null;
    const SESSION_ID = '0x4F2A';

    function buildEvents() {
      const out = [
        { text: 'Client sends a session request to the server, including its credentials.', dir: 'c2s', phase: 'request' },
        { text: 'Server checks the credentials against its user database.', phase: 'auth' }
      ];
      if (!validCredentials) {
        out.push({ text: 'Credentials rejected \u2014 the username/password do not match.', level: 'error', phase: 'reject' });
        out.push({ text: 'Server sends a session refusal. No session ID is assigned and no session resources are allocated.', dir: 's2c', level: 'error', phase: 'refuse' });
        out.push({ text: 'Client receives the refusal \u2014 the session was never established.', level: 'error', phase: 'refused' });
        return out;
      }
      out.push({ text: 'Credentials accepted.', level: 'success', phase: 'accept' });
      out.push({ text: 'Server proposes session parameters: dialog mode = ' + dialogMode + ', synchronization points enabled, inactivity timeout = 300 s.', dir: 's2c', phase: 'propose' });
      out.push({ text: 'Client accepts the proposed parameters.', dir: 'c2s', phase: 'agree' });
      out.push({ text: 'Server assigns Session ID ' + SESSION_ID + ' and confirms.', dir: 's2c', level: 'success', phase: 'assign' });
      out.push({ text: 'Session established \u2014 both sides can now exchange data inside it.', level: 'success', phase: 'established' });
      return out;
    }

    function draw() {
      const step = events[Math.max(0, index)] || {};
      const arrow = step.dir === 'c2s' ? '\u2192' : step.dir === 's2c' ? '\u2190' : '\u2194';
      host.innerHTML = `
        <div class="fw-diagram">
          <div class="fw-node">Client</div>
          <div class="fw-packet-track"><span class="fw-packet" style="font-size:0.72rem;">${step.phase ? step.phase : 'idle'} ${arrow}</span></div>
          <div class="fw-node" style="border-color:var(--teal);color:var(--teal);">Server</div>
        </div>
      `;
      const done = index >= events.length - 1;
      const status = !validCredentials && index >= 2 ? 'Refused' : done ? 'Established' : 'Negotiating...';
      ctx.setMetrics([
        { label: 'Session State', value: index < 0 ? 'Not started' : status },
        { label: 'Credentials', value: validCredentials ? 'Valid' : 'Invalid' },
        { label: 'Dialog Mode', value: validCredentials ? dialogMode : '\u2014' },
        { label: 'Session ID', value: validCredentials && index >= events.findIndex((e) => e.phase === 'assign') && index >= 0 ? SESSION_ID : '\u2014' },
        { label: 'Messages Exchanged', value: String(Math.max(0, index + 1)) }
      ]);
    }

    function renderParams() {
      ctx.params.hidden = false;
      ctx.params.innerHTML = `
        <label class="switch-mode-option ${validCredentials ? 'is-checked' : ''}">
          <input type="checkbox" id="sessCreds" ${validCredentials ? 'checked' : ''}>
          Client presents valid credentials
        </label>
        <fieldset class="switch-mode-group" role="radiogroup" aria-label="Dialog mode" style="margin-top:0.6rem;">
          <legend class="section-label" style="margin:0 0 0.5rem;border:none;padding:0;">Proposed dialog mode</legend>
          <label class="switch-mode-option ${dialogMode === 'full-duplex' ? 'is-checked' : ''}">
            <input type="radio" name="sessDialog" value="full-duplex" ${dialogMode === 'full-duplex' ? 'checked' : ''}> Full-duplex (both send at once)
          </label>
          <label class="switch-mode-option ${dialogMode === 'half-duplex' ? 'is-checked' : ''}">
            <input type="radio" name="sessDialog" value="half-duplex" ${dialogMode === 'half-duplex' ? 'checked' : ''}> Half-duplex (take turns)
          </label>
        </fieldset>
      `;
      ctx.params.querySelector('#sessCreds').addEventListener('change', (e) => { validCredentials = e.target.checked; rebuild(); });
      ctx.params.querySelectorAll('input[name="sessDialog"]').forEach((r) => r.addEventListener('change', () => { dialogMode = r.value; rebuild(); }));
    }

    function rebuild() {
      stop();
      index = -1;
      events = buildEvents();
      renderParams();
      draw();
      ctx.log('Ready \u2014 client about to request a session.');
    }

    function stop() { if (timer) { clearInterval(timer); timer = null; } }

    function advance() {
      if (index >= events.length - 1) { stop(); return; }
      index += 1;
      ctx.log(events[index].text, events[index].level);
      draw();
    }

    return {
      initialize() {
        ctx.canvas.classList.add('net-canvas');
        ctx.canvas.innerHTML = '<div class="sess-mount"></div>';
        host = ctx.canvas.querySelector('.sess-mount');
        rebuild();
      },
      start() { if (timer) return; timer = setInterval(() => { if (index >= events.length - 1) { stop(); return; } advance(); }, 750); },
      pause() { stop(); },
      step() { stop(); advance(); },
      reset() { rebuild(); },
      destroy() { stop(); }
    };
  });

})(window.NetSim = window.NetSim || {});
