/*
 * bench.js — a personal "workbench" of rims and hubs.
 *
 * IMPORTANT: the bench lives in this browser's localStorage only. It is stored
 * on this one device, is not synced, and is not backed up anywhere. Exporting
 * the JSON is the only way to move it or keep a copy.
 */
(function () {
  "use strict";
  const KEY = 'spokes.bench';
  const NOTE = 'Your bench is saved only in this browser, on this device — it is not synced or backed up. Export the JSON to keep a copy or move it to another device.';

  function load() {
    try { const b = JSON.parse(localStorage.getItem(KEY)); if (b && Array.isArray(b.rims) && Array.isArray(b.hubs)) return b; } catch (e) {}
    return { rims: [], hubs: [] };
  }
  function save(b) { try { localStorage.setItem(KEY, JSON.stringify(b)); } catch (e) {} }
  function genId() { return 'b' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6); }

  function addRim(rim) { const b = load(); rim = Object.assign({}, rim); if (!rim.id) rim.id = genId(); if (!rim.src) rim.src = 'you'; b.rims.push(rim); save(b); return rim; }
  function addHub(hub) { const b = load(); hub = Object.assign({}, hub); if (!hub.id) hub.id = genId(); if (!hub.src) hub.src = 'you'; b.hubs.push(hub); save(b); return hub; }
  function updateRim(id, patch) { const b = load(); const r = b.rims.find(x => x.id === id); if (r) { Object.assign(r, patch); save(b); } }
  function updateHub(id, patch) { const b = load(); const h = b.hubs.find(x => x.id === id); if (h) { Object.assign(h, patch); save(b); } }
  function removeRim(id) { const b = load(); b.rims = b.rims.filter(x => x.id !== id); save(b); }
  function removeHub(id) { const b = load(); b.hubs = b.hubs.filter(x => x.id !== id); save(b); }

  // dedupe so the same catalogue part isn't added twice
  function hasRim(r) { return load().rims.some(x => x.mfg === r.mfg && x.model === r.model && x.iso === r.iso); }
  function hasHub(h) { return load().hubs.some(x => x.mfg === h.mfg && x.model === h.model && x.position === h.position && x.oln === h.oln); }

  function exportJSON() { return JSON.stringify(load(), null, 2); }
  function importJSON(str, mode) {        // mode: 'replace' (default) | 'merge'
    const incoming = JSON.parse(str);
    if (!incoming || !Array.isArray(incoming.rims) || !Array.isArray(incoming.hubs))
      throw new Error('Expected JSON like { "rims": [ … ], "hubs": [ … ] }');
    const b = (mode === 'merge') ? load() : { rims: [], hubs: [] };
    incoming.rims.forEach(r => { if (!r.id) r.id = genId(); b.rims.push(r); });
    incoming.hubs.forEach(h => { if (!h.id) h.id = genId(); b.hubs.push(h); });
    save(b);
    return b;
  }

  window.Bench = { KEY, NOTE, load, save, genId, addRim, addHub, updateRim, updateHub, removeRim, removeHub, hasRim, hasHub, exportJSON, importJSON };
})();
