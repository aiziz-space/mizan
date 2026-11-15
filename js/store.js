/* ميزان — persistence: localStorage state (+ safe migration), IndexedDB photos, backup files. */
(function (root) {
  'use strict';
  const M = (root.M = root.M || {});
  const C = M.Calc;
  const KEY = 'mizan.v1';              // unchanged key: v1 data is read in place and migrated
  const BACKUP_KEY = 'mizan.v1.backup'; // raw copy of the data as it was before the last migration

  const blank = () => C.migrate({ version: 2, profile: null, settings: { exerciseRatio: 0.5 }, meals: [], days: {} }, C.dateKey(new Date())).data;

  function load() {
    const today = C.dateKey(new Date());
    let raw = null;
    try { raw = localStorage.getItem(KEY); } catch { /* private mode */ }
    if (!raw) return { S: blank(), migrated: false };
    let parsed;
    try { parsed = JSON.parse(raw); } catch { return { S: blank(), migrated: false, corrupt: true }; }
    const { data, changed, from } = C.migrate(parsed, today);
    if (changed) {
      try { localStorage.setItem(BACKUP_KEY, JSON.stringify({ savedAt: new Date().toISOString(), fromVersion: from, raw })); } catch { /* quota */ }
      try { localStorage.setItem(KEY, JSON.stringify(data)); } catch { /* quota */ }
    }
    return { S: data, migrated: changed, from };
  }
  function save(S) {
    try { localStorage.setItem(KEY, JSON.stringify(S)); return true; } catch { return false; }
  }
  function wipe() {
    try { localStorage.removeItem(KEY); } catch { /* ignore */ }
  }

  /* ---------- IndexedDB photos ---------- */
  const DB_NAME = 'mizan-photos', STORE = 'photos';
  let dbp = null;
  function db() {
    if (dbp) return dbp;
    dbp = new Promise((res, rej) => {
      if (!('indexedDB' in root)) return rej(new Error('no idb'));
      const r = indexedDB.open(DB_NAME, 1);
      r.onupgradeneeded = () => { const s = r.result.createObjectStore(STORE, { keyPath: 'id' }); s.createIndex('date', 'date'); };
      r.onsuccess = () => res(r.result);
      r.onerror = () => rej(r.error);
    });
    return dbp;
  }
  const tx = async (mode, fn) => {
    const d = await db();
    return new Promise((res, rej) => {
      const t = d.transaction(STORE, mode), s = t.objectStore(STORE);
      const out = fn(s);
      t.oncomplete = () => res(out && 'result' in out ? out.result : out);
      t.onerror = () => rej(t.error);
    });
  };
  const Photos = {
    add: (p) => tx('readwrite', (s) => s.put(p)),
    del: (id) => tx('readwrite', (s) => s.delete(id)),
    clear: () => tx('readwrite', (s) => s.clear()),
    all: async () => { const r = await tx('readonly', (s) => s.getAll()); return (r || []).sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : a.id < b.id ? -1 : 1)); },
    count: async () => { try { return await tx('readonly', (s) => s.count()); } catch { return 0; } }
  };

  // Downscale an image File to a JPEG Blob (max side px)
  function downscale(file, max = 1280, q = 0.82) {
    return new Promise((res, rej) => {
      const url = URL.createObjectURL(file);
      const img = new Image();
      img.onload = () => {
        const k = Math.min(1, max / Math.max(img.naturalWidth, img.naturalHeight));
        const w = Math.round(img.naturalWidth * k), h = Math.round(img.naturalHeight * k);
        const c = document.createElement('canvas'); c.width = w; c.height = h;
        c.getContext('2d').drawImage(img, 0, 0, w, h);
        URL.revokeObjectURL(url);
        c.toBlob((b) => (b ? res(b) : rej(new Error('encode'))), 'image/jpeg', q);
      };
      img.onerror = () => { URL.revokeObjectURL(url); rej(new Error('decode')); };
      img.src = url;
    });
  }
  const blobToDataURL = (b) => new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(r.result); r.onerror = rej; r.readAsDataURL(b); });
  const dataURLToBlob = async (u) => (await fetch(u)).blob();

  /* ---------- Backup ---------- */
  async function exportJSON(S, withPhotos) {
    const out = { app: 'mizan', version: 2, exportedAt: new Date().toISOString(), data: S };
    if (withPhotos) {
      const ps = await Photos.all();
      out.photos = await Promise.all(ps.map(async (p) => ({ id: p.id, date: p.date, note: p.note || '', dataUrl: await blobToDataURL(p.blob) })));
    }
    return JSON.stringify(out);
  }
  // Returns {data, photos[]} or throws
  function parseBackup(text) {
    const j = JSON.parse(text);
    const d = j && j.data ? j.data : j;
    if (!d || typeof d !== 'object' || !d.profile || typeof d.days !== 'object' || !Array.isArray(d.meals)) throw new Error('invalid');
    const { data } = C.migrate(d, C.dateKey(new Date()));
    return { data, photos: Array.isArray(j.photos) ? j.photos : [] };
  }
  async function importPhotos(list) {
    let n = 0;
    for (const p of list) {
      if (!p || !p.dataUrl || !p.date) continue;
      await Photos.add({ id: p.id || 'ph_' + Math.random().toString(36).slice(2), date: p.date, note: p.note || '', blob: await dataURLToBlob(p.dataUrl) });
      n++;
    }
    return n;
  }

  M.Store = { KEY, BACKUP_KEY, load, save, wipe, Photos, downscale, exportJSON, parseBackup, importPhotos };
})(typeof window !== 'undefined' ? window : globalThis);
