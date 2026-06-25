/*
 * cloud.js — OPTIONAL login + bench sync via Supabase.
 *
 * Static-site friendly: this file loads the Supabase JS library from a CDN and
 * talks to Supabase directly from the browser. The URL + publishable key below
 * are public by design — your data is protected by Row-Level Security, so each
 * signed-in user can only read/write their own row.
 *
 * Signed out: the app is local-only (nothing leaves the device).
 * Signed in: your bench syncs to Supabase so it follows you across devices.
 */
(function () {
  "use strict";
  const SUPABASE_URL = 'https://ohqokgotuyxodempqhho.supabase.co';
  const SUPABASE_KEY = 'sb_publishable_VhuUqL2uAEyc4aGZELSynA_Ffq6IVTa';
  const LIB = 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2';

  let db = null, user = null, libOk = false, lastSync = null;
  const userSubs = [], syncSubs = [];
  const notifyUser = () => userSubs.forEach(fn => { try { fn(user); } catch (e) {} });
  const notifySync = () => syncSubs.forEach(fn => { try { fn(); } catch (e) {} });

  function loadLib() {
    return new Promise(res => {
      if (window.supabase) return res(true);
      const s = document.createElement('script');
      s.src = LIB; s.onload = () => res(true); s.onerror = () => res(false);
      document.head.appendChild(s);
    });
  }

  const ready = loadLib().then(ok => {
    libOk = ok && !!window.supabase;
    if (!libOk) return;
    db = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
    db.auth.onAuthStateChange((_event, session) => {
      user = session ? session.user : null;
      notifyUser();
      if (user && lastSync !== user.id) { lastSync = user.id; syncOnLogin(); }
      if (!user) lastSync = null;
    });
  });

  // ---- merge: catalogue items dedupe by content, your own ('you') by id ----
  function keyOf(x, kind) {
    if (x.src === 'you') return 'id:' + x.id;
    return kind === 'rim'
      ? `r|${x.mfg}|${x.model}|${x.iso}`
      : `h|${x.mfg}|${x.model}|${x.position}|${x.oln}`;
  }
  function mergeList(a, b, kind) {
    const seen = new Set(), out = [];
    for (const x of [...a, ...b]) { const k = keyOf(x, kind); if (seen.has(k)) continue; seen.add(k); out.push(x); }
    return out;
  }
  const merge = (local, remote) => ({
    rims: mergeList(remote.rims || [], local.rims || [], 'rim'),
    hubs: mergeList(remote.hubs || [], local.hubs || [], 'hub'),
  });

  let syncing = false;
  async function syncOnLogin() {
    if (!db || !user || syncing) return;
    syncing = true;
    try {
      const { data } = await db.from('benches').select('data').eq('user_id', user.id).maybeSingle();
      const remote = (data && data.data) ? data.data : { rims: [], hubs: [] };
      const merged = merge(window.Bench.load(), remote);
      window.Bench.save(merged);   // updates local (and fires schedulePush)
      await push(merged);          // make sure the merge is up on the server
      notifySync();
    } catch (e) { /* offline, or table not created yet */ }
    syncing = false;
  }
  async function push(bench) {
    if (!db || !user) return;
    await db.from('benches').upsert({ user_id: user.id, data: bench, updated_at: new Date().toISOString() });
  }

  // debounced push whenever the local bench changes (only while signed in)
  let t = null;
  ready.then(() => {
    if (window.Bench && window.Bench.onChange)
      window.Bench.onChange(() => { if (user) { clearTimeout(t); t = setTimeout(() => push(window.Bench.load()), 600); } });
  });

  window.Cloud = {
    ready,
    available: () => libOk,
    user: () => user,
    onUser(cb) { userSubs.push(cb); cb(user); },
    onSync(cb) { syncSubs.push(cb); },
    async signInEmail(email) {
      await ready; if (!db) throw new Error('Sign-in is unavailable (could not reach Supabase).');
      const { error } = await db.auth.signInWithOtp({ email, options: { emailRedirectTo: location.origin + location.pathname } });
      if (error) throw error;
    },
    async signOut() { await ready; if (db) await db.auth.signOut(); user = null; lastSync = null; notifyUser(); },
  };
})();
