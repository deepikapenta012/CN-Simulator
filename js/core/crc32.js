/* ==========================================================================
   NetSim — core/crc32.js
   The standard IEEE CRC-32 (polynomial 0x04C11DB7, reflected form
   0xEDB88320) used for the Frame Check Sequence of both Ethernet
   (802.3) and Wi-Fi (802.11) frames. Pure functions, no DOM.
   ========================================================================== */

(function (NetSim) {
  'use strict';

  let table = null;

  function buildTable() {
    table = new Uint32Array(256);
    for (let n = 0; n < 256; n++) {
      let c = n;
      for (let k = 0; k < 8; k++) c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
      table[n] = c >>> 0;
    }
  }

  /** CRC-32 of an array of byte values (0-255). Returns an unsigned 32-bit number. */
  function compute(bytes) {
    if (!table) buildTable();
    let crc = 0xFFFFFFFF;
    for (let i = 0; i < bytes.length; i++) crc = table[(crc ^ bytes[i]) & 0xFF] ^ (crc >>> 8);
    return (crc ^ 0xFFFFFFFF) >>> 0;
  }

  function hex32(n) { return (n >>> 0).toString(16).toUpperCase().padStart(8, '0'); }
  function hexByte(b) { return (b & 255).toString(16).toUpperCase().padStart(2, '0'); }

  /** UTF-8 bytes of a string, without relying on TextEncoder being available. */
  function textToBytes(str) {
    const bin = unescape(encodeURIComponent(str));
    const out = [];
    for (let i = 0; i < bin.length; i++) out.push(bin.charCodeAt(i));
    return out;
  }

  /** Parses "AA:BB:CC:DD:EE:FF" (or with dashes) into 6 bytes, or null if invalid. */
  function parseMac(str) {
    const parts = String(str).trim().split(/[:-]/);
    if (parts.length !== 6 || parts.some((p) => !/^[0-9a-fA-F]{2}$/.test(p))) return null;
    return parts.map((p) => parseInt(p, 16));
  }

  function macToString(bytes) { return bytes.map(hexByte).join(':'); }

  NetSim.Core = NetSim.Core || {};
  NetSim.Core.CRC32 = { compute, hex32, hexByte, textToBytes, parseMac, macToString };

})(window.NetSim = window.NetSim || {});
