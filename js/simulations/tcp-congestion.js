/* ==========================================================================
   NetSim — simulations/tcp-congestion.js
   Real cwnd arithmetic, round by round: exponential growth during slow
   start, linear growth (AIMD) during congestion avoidance once ssthresh
   is crossed, and a real halving (or reset to 1) when a configurable
   round suffers a loss — fast retransmit vs. a full timeout.
   ========================================================================== */

(function (NetSim) {
  'use strict';

  const TOTAL_ROUNDS = 16;
  const INITIAL_SSTHRESH = 16;

  NetSim.SimRegistry.register('tcp-congestion', function factory(ctx) {
    let lossRound = 7;
    let lossType = 'fastRetransmit'; // or 'timeout'
    let rounds = [];
    let index = -1;
    let timer = null;
    let host = null;

    function buildRounds() {
      const out = [];
      let cwnd = 1, ssthresh = INITIAL_SSTHRESH, phase = 'slow-start';

      for (let r = 1; r <= TOTAL_ROUNDS; r++) {
        if (r === lossRound) {
          const prevCwnd = cwnd;
          if (lossType === 'timeout') {
            ssthresh = Math.max(2, Math.floor(prevCwnd / 2));
            cwnd = 1;
            phase = 'slow-start';
            out.push({ round: r, cwnd, ssthresh, phase, text: 'Round ' + r + ': segment loss detected by TIMEOUT. ssthresh = ' + ssthresh + ', cwnd resets to 1 \u2014 back to slow start from scratch.', level: 'error' });
          } else {
            ssthresh = Math.max(2, Math.floor(prevCwnd / 2));
            cwnd = ssthresh;
            phase = 'congestion-avoidance';
            out.push({ round: r, cwnd, ssthresh, phase, text: 'Round ' + r + ': 3 duplicate ACKs \u2014 FAST RETRANSMIT. ssthresh = cwnd/2 = ' + ssthresh + ', cwnd drops to ssthresh (' + cwnd + ') and resumes growing linearly.', level: 'warning' });
          }
          continue;
        }

        if (phase === 'slow-start') {
          cwnd = cwnd * 2;
          if (cwnd >= ssthresh) { cwnd = ssthresh; phase = 'congestion-avoidance'; }
          out.push({ round: r, cwnd, ssthresh, phase, text: 'Round ' + r + ' (slow start): cwnd doubles \u2192 ' + cwnd + (cwnd === ssthresh ? ' \u2014 reached ssthresh (' + ssthresh + '), switching to congestion avoidance.' : '.') });
        } else {
          cwnd = cwnd + 1;
          out.push({ round: r, cwnd, ssthresh, phase, text: 'Round ' + r + ' (congestion avoidance): cwnd grows by 1 \u2192 ' + cwnd + '.' });
        }
      }
      return out;
    }

    function draw() {
      const shown = Math.max(0, index + 1);
      const data = rounds.slice(0, shown);
      const maxCwnd = Math.max(INITIAL_SSTHRESH, ...rounds.map((r) => r.cwnd)) + 2;
      const barsHTML = data.map((r) => {
        const h = Math.max(4, (r.cwnd / maxCwnd) * 160);
        const color = r.phase === 'slow-start' ? 'var(--accent)' : 'var(--teal)';
        const isLoss = r.round === lossRound;
        return `<div style="display:flex;flex-direction:column;align-items:center;gap:2px;flex:1;min-width:16px;">
          <span style="font-size:0.6rem;color:var(--ink-faint);">${r.cwnd}</span>
          <div style="width:100%;height:${h}px;background:${isLoss ? 'var(--err)' : color};"></div>
          <span style="font-size:0.58rem;color:var(--ink-faint);">${r.round}</span>
        </div>`;
      }).join('');

      host.innerHTML = `
        <div style="display:flex;align-items:flex-end;gap:2px;height:190px;border-bottom:1px solid var(--line);padding:0 0.5rem;">${barsHTML || '<span class="net-hint">Press Start or Step.</span>'}</div>
        <p class="net-hint" style="text-align:center;margin-top:0.4rem;">rust = slow start &nbsp;\u00b7&nbsp; teal = congestion avoidance &nbsp;\u00b7&nbsp; red = loss round (round ${lossRound})</p>
      `;

      const current = data[data.length - 1];
      ctx.setMetrics([
        { label: 'Round', value: String(shown) },
        { label: 'cwnd', value: current ? String(current.cwnd) + ' MSS' : '1 MSS' },
        { label: 'ssthresh', value: current ? String(current.ssthresh) + ' MSS' : String(INITIAL_SSTHRESH) + ' MSS' },
        { label: 'Phase', value: current ? current.phase : 'slow-start' },
        { label: 'Loss Type', value: lossType === 'timeout' ? 'Timeout (full reset)' : 'Fast Retransmit (halve)' }
      ]);
    }

    function renderParams() {
      ctx.params.hidden = false;
      ctx.params.innerHTML = `
        <div class="sim-param-row"><label for="congLossRound">Loss at Round</label>
          <input type="range" id="congLossRound" min="2" max="${TOTAL_ROUNDS - 1}" step="1" value="${lossRound}">
          <span class="val" id="congLossRoundVal">${lossRound}</span></div>
        <fieldset class="switch-mode-group" role="radiogroup" aria-label="Loss detection">
          <legend class="section-label" style="margin:0.5rem 0;border:none;padding:0;">Loss Detected By</legend>
          <label class="switch-mode-option ${lossType === 'fastRetransmit' ? 'is-checked' : ''}">
            <input type="radio" name="lossType" value="fastRetransmit" ${lossType === 'fastRetransmit' ? 'checked' : ''}> 3 Duplicate ACKs (Fast Retransmit)
          </label>
          <label class="switch-mode-option ${lossType === 'timeout' ? 'is-checked' : ''}">
            <input type="radio" name="lossType" value="timeout" ${lossType === 'timeout' ? 'checked' : ''}> Timeout
          </label>
        </fieldset>
      `;
      ctx.params.querySelector('#congLossRound').addEventListener('change', (e) => { lossRound = parseInt(e.target.value, 10); rebuild(); });
      ctx.params.querySelector('#congLossRound').addEventListener('input', (e) => { ctx.params.querySelector('#congLossRoundVal').textContent = e.target.value; });
      ctx.params.querySelectorAll('input[name="lossType"]').forEach((r) => r.addEventListener('change', () => { lossType = r.value; rebuild(); }));
    }

    function rebuild() {
      stop();
      index = -1;
      rounds = buildRounds();
      renderParams();
      draw();
      ctx.log('Ready \u2014 cwnd starts at 1 MSS, ssthresh at ' + INITIAL_SSTHRESH + '.');
    }

    function stop() { if (timer) { NetSim.SimTiming.clearInterval(timer); timer = null; } }

    function advance() {
      if (index >= rounds.length - 1) { stop(); return; }
      index += 1;
      ctx.log(rounds[index].text, rounds[index].level);
      draw();
    }

    return {
      initialize() {
        ctx.canvas.classList.add('net-canvas');
        ctx.canvas.innerHTML = '<div class="congestion-mount"></div>';
        host = ctx.canvas.querySelector('.congestion-mount');
        rebuild();
      },
      start() { if (timer) return; timer = NetSim.SimTiming.setInterval(() => { if (index >= rounds.length - 1) { stop(); return; } advance(); }, 500); },
      pause() { stop(); },
      step() { stop(); advance(); },
      reset() { rebuild(); },
      destroy() { stop(); }
    };
  });

})(window.NetSim = window.NetSim || {});
