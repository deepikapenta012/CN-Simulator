/* ==========================================================================
   NetSim — simulations/stop-and-wait.js
   Sender transmits one frame at a time and waits for its ACK before
   sending the next. Frame loss, ACK loss, and the resulting timeout +
   retransmission are all genuinely rolled per run, not scripted.
   ========================================================================== */

(function (NetSim) {
  'use strict';

  const MAX_ATTEMPTS = 4;

  NetSim.SimRegistry.register('stop-and-wait', function factory(ctx) {
    let totalFrames = 5;
    let frameLoss = 0.2;
    let ackLoss = 0.2;
    let steps = [];
    let index = -1;
    let timer = null;
    let host = null;
    let stats = { framesLost: 0, acksLost: 0, attempts: 0 };

    function buildSteps() {
      const out = [];
      stats = { framesLost: 0, acksLost: 0, attempts: 0 };
      for (let frame = 1; frame <= totalFrames; frame++) {
        let delivered = false;
        for (let attempt = 1; attempt <= MAX_ATTEMPTS && !delivered; attempt++) {
          stats.attempts += 1;
          out.push({ text: 'Frame ' + frame + ' (attempt ' + attempt + '): sender transmits.', visual: 'frame-send', frame });
          const forceSuccess = attempt === MAX_ATTEMPTS;
          if (!forceSuccess && Math.random() < frameLoss) {
            stats.framesLost += 1;
            out.push({ text: 'Frame ' + frame + ' lost in transit.', visual: 'frame-lost', level: 'warning', frame });
            out.push({ text: 'Sender times out waiting for ACK ' + frame + ' \u2014 retransmitting.', visual: 'timeout', level: 'warning', frame });
            continue;
          }
          out.push({ text: 'Frame ' + frame + ' arrives at the receiver.', visual: 'frame-arrive', frame });
          out.push({ text: 'Receiver sends ACK ' + frame + '.', visual: 'ack-send', frame });
          if (!forceSuccess && Math.random() < ackLoss) {
            stats.acksLost += 1;
            out.push({ text: 'ACK ' + frame + ' lost in transit.', visual: 'ack-lost', level: 'warning', frame });
            out.push({ text: 'Sender times out waiting for ACK ' + frame + ' \u2014 retransmitting (receiver will discard the duplicate).', visual: 'timeout', level: 'warning', frame });
            continue;
          }
          out.push({ text: 'ACK ' + frame + ' received \u2014 frame ' + frame + ' delivered successfully \u2713', visual: 'delivered', level: 'success', frame });
          delivered = true;
        }
      }
      out.push({ text: 'All ' + totalFrames + ' frames delivered.', visual: 'done', level: 'success' });
      return out;
    }

    function draw() {
      const actions = steps.slice(0, index + 1).flatMap((event) => {
        if (event.visual === 'frame-send') return [{ type: 'frame', label: 'F' + event.frame }];
        if (event.visual === 'frame-lost') return [{ type: 'frame', label: 'F' + event.frame, outcome: 'lost' }];
        if (event.visual === 'frame-arrive') return [{ type: 'deliver', label: 'F' + event.frame + ' received' }];
        if (event.visual === 'ack-send') return [{ type: 'ack', label: 'ACK' + event.frame }];
        if (event.visual === 'ack-lost') return [{ type: 'ack', label: 'ACK' + event.frame, outcome: 'lost' }];
        if (event.visual === 'timeout') return [{ type: 'timeout', label: 'timeout' }];
        if (event.visual === 'delivered') return [{ type: 'ack-arrival', label: 'ACK' + event.frame + ' received' }];
        return [];
      });
      host.innerHTML = NetSim.Components.renderTimingDiagram(actions, actions.length - 1) + '<p class="timing-caption">Time moves from top to bottom. Frames travel sender → receiver; ACKs return receiver → sender.</p>';

      const efficiency = stats.attempts ? (totalFrames / stats.attempts) * 100 : 100;
      ctx.setMetrics([
        { label: 'Total Frames', value: String(totalFrames) },
        { label: 'Total Attempts', value: String(stats.attempts) },
        { label: 'Frames Lost', value: String(stats.framesLost) },
        { label: 'ACKs Lost', value: String(stats.acksLost) },
        { label: 'Efficiency', value: efficiency.toFixed(0) + '%' }
      ]);
    }

    function renderParams() {
      ctx.params.hidden = false;
      ctx.params.innerHTML = `
        <div class="sim-param-row"><label for="swFrames">Frames to Send</label>
          <input type="range" id="swFrames" min="2" max="8" step="1" value="${totalFrames}">
          <span class="val" id="swFramesVal">${totalFrames}</span></div>
        <div class="sim-param-row"><label for="swFrameLoss">Frame Loss Probability</label>
          <input type="range" id="swFrameLoss" min="0" max="50" step="5" value="${Math.round(frameLoss * 100)}">
          <span class="val" id="swFrameLossVal">${Math.round(frameLoss * 100)}%</span></div>
        <div class="sim-param-row"><label for="swAckLoss">ACK Loss Probability</label>
          <input type="range" id="swAckLoss" min="0" max="50" step="5" value="${Math.round(ackLoss * 100)}">
          <span class="val" id="swAckLossVal">${Math.round(ackLoss * 100)}%</span></div>
      `;
      ctx.params.querySelector('#swFrames').addEventListener('change', (e) => { totalFrames = parseInt(e.target.value, 10); rebuild(); });
      ctx.params.querySelector('#swFrames').addEventListener('input', (e) => { ctx.params.querySelector('#swFramesVal').textContent = e.target.value; });
      ctx.params.querySelector('#swFrameLoss').addEventListener('change', (e) => { frameLoss = parseInt(e.target.value, 10) / 100; rebuild(); });
      ctx.params.querySelector('#swFrameLoss').addEventListener('input', (e) => { ctx.params.querySelector('#swFrameLossVal').textContent = e.target.value + '%'; });
      ctx.params.querySelector('#swAckLoss').addEventListener('change', (e) => { ackLoss = parseInt(e.target.value, 10) / 100; rebuild(); });
      ctx.params.querySelector('#swAckLoss').addEventListener('input', (e) => { ctx.params.querySelector('#swAckLossVal').textContent = e.target.value + '%'; });
    }

    function rebuild() {
      stop();
      index = -1;
      steps = buildSteps();
      renderParams();
      draw();
      ctx.log('Ready to send ' + totalFrames + ' frames, one at a time.');
    }

    function stop() { if (timer) { NetSim.SimTiming.clearInterval(timer); timer = null; } }

    function advance() {
      if (index >= steps.length - 1) { stop(); return; }
      index += 1;
      ctx.log(steps[index].text, steps[index].level);
      draw();
    }

    return {
      initialize() {
        ctx.canvas.classList.add('net-canvas');
        ctx.canvas.innerHTML = '<div class="fw-mount"></div>';
        host = ctx.canvas.querySelector('.fw-mount');
        rebuild();
      },
      start() { if (timer) return; timer = NetSim.SimTiming.setInterval(() => { if (index >= steps.length - 1) { stop(); return; } advance(); }, 650); },
      pause() { stop(); },
      step() { stop(); advance(); },
      reset() { rebuild(); },
      destroy() { stop(); }
    };
  });

})(window.NetSim = window.NetSim || {});
