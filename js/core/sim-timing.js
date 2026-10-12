/* Shared playback timing for interactive simulations. */
(function (NetSim) {
  'use strict';

  const nativeSetInterval = window.setInterval.bind(window);
  const nativeClearInterval = window.clearInterval.bind(window);
  const timers = new Set();
  let speed = 1;

  function schedule(timer) {
    const delay = Math.max(10, timer.delay / speed);
    timer.nativeId = nativeSetInterval(timer.callback, delay);
  }

  function setIntervalScaled(callback, delay) {
    const timer = { callback, delay: Math.max(10, Number(delay) || 10), nativeId: null };
    timers.add(timer);
    schedule(timer);
    return timer;
  }

  function clearIntervalScaled(timer) {
    if (timers.has(timer)) {
      nativeClearInterval(timer.nativeId);
      timers.delete(timer);
    } else {
      nativeClearInterval(timer);
    }
  }

  function setSpeed(value) {
    const nextSpeed = Math.max(0.5, Math.min(2.5, Number(value) || 1));
    if (nextSpeed === speed) return;
    speed = nextSpeed;
    timers.forEach((timer) => {
      nativeClearInterval(timer.nativeId);
      schedule(timer);
    });
  }

  function getSpeed() { return speed; }

  NetSim.SimTiming = { setInterval: setIntervalScaled, clearInterval: clearIntervalScaled, setSpeed, getSpeed };
})(window.NetSim = window.NetSim || {});
