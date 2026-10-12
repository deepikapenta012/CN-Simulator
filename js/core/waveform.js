/* ==========================================================================
   NetSim — core/waveform.js
   Pure signal-generation helpers shared by the Physical layer
   simulations (analog signals, digital signals, impairments, Manchester
   encoding, modems). No DOM here — these return SVG <polyline> "points"
   strings from real math, not decorative artwork.
   ========================================================================== */

(function (NetSim) {
  'use strict';

  /**
   * Samples a continuous function v(t) for t in [0,1] into an SVG
   * polyline points string over a width x height box, y=0 centered
   * vertically. `amplitudeScale` keeps the curve inside the box.
   */
  function sampleWaveform(valueFn, width, height, samples, amplitudeScale) {
    samples = samples || 240;
    amplitudeScale = amplitudeScale == null ? 0.42 : amplitudeScale;
    const pts = [];
    for (let i = 0; i <= samples; i++) {
      const t = i / samples;
      const v = Math.max(-1, Math.min(1, valueFn(t)));
      const x = t * width;
      const y = height / 2 - v * height * amplitudeScale;
      pts.push(x.toFixed(1) + ',' + y.toFixed(1));
    }
    return pts.join(' ');
  }

  /** Convenience: a sine wave with the given number of full cycles across the box. */
  function sinePoints(width, height, cycles, phaseRad, amplitudeScale) {
    return sampleWaveform((t) => Math.sin(2 * Math.PI * cycles * t + (phaseRad || 0)), width, height, 240, amplitudeScale);
  }

  /**
   * Builds a piecewise-constant (step) waveform across `bitCount` equal
   * slots. `segmentFn(bitIndex)` returns an ascending array of
   * {frac, value} pairs (frac in [0,1) = where within the bit the level
   * starts, value in [-1,1]); the level holds until the next frac or the
   * end of the bit. Produces clean vertical edges for NRZ / Manchester.
   */
  function stepWaveform(bitCount, width, height, amplitudeScale, segmentFn) {
    amplitudeScale = amplitudeScale == null ? 0.38 : amplitudeScale;
    const pts = [];
    for (let i = 0; i < bitCount; i++) {
      const segs = segmentFn(i);
      for (let s = 0; s < segs.length; s++) {
        const startFrac = segs[s].frac;
        const endFrac = s + 1 < segs.length ? segs[s + 1].frac : 1;
        const v = segs[s].value;
        const xStart = ((i + startFrac) / bitCount) * width;
        const xEnd = ((i + endFrac) / bitCount) * width;
        const y = height / 2 - v * height * amplitudeScale;
        pts.push(xStart.toFixed(1) + ',' + y.toFixed(1));
        pts.push(xEnd.toFixed(1) + ',' + y.toFixed(1));
      }
    }
    return pts.join(' ');
  }

  /** Parses a user string of 0s/1s into an array of bit characters, defaulting if empty/invalid. */
  function parseBits(str, fallback) {
    const cleaned = (str || '').replace(/[^01]/g, '');
    return (cleaned || fallback || '1011001').split('');
  }

  NetSim.Core = NetSim.Core || {};
  NetSim.Core.Waveform = { sampleWaveform, sinePoints, stepWaveform, parseBits };

})(window.NetSim = window.NetSim || {});
