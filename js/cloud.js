/* Shared leaderboard, local-first.

   Learning never touches the network. This only pushes a small summary row
   (name, streak, words known, accuracy) to a Firebase Realtime Database and
   reads back the other rows under the same family code. Talking to Firebase
   over its REST API means there is no SDK to bundle and nothing to break when
   the phone is offline — a failed request just leaves the board stale. */
(function () {
  'use strict';

  const CACHE_KEY = 'milu.v1.board';
  let cached = null;

  function dbUrl() {
    const u = (window.MILU_CONFIG && window.MILU_CONFIG.firebaseDbUrl || '').trim();
    return u.replace(/\/+$/, '');
  }

  function enabled() {
    return !!dbUrl() && !!code();
  }

  function configured() { return !!dbUrl(); }

  function code() {
    return (Store.S.settings.familyCode || '').trim().toUpperCase();
  }

  function endpoint(path) {
    return `${dbUrl()}/boards/${encodeURIComponent(code())}${path}.json`;
  }

  function init() {
    try { cached = JSON.parse(localStorage.getItem(CACHE_KEY) || 'null'); } catch (e) { cached = null; }
  }

  /** The row describing this device's learner. */
  function summary() {
    const c = SRS.counts();
    const days = Store.S.stats.days || {};
    let reviews = 0, correct = 0;
    Object.values(days).forEach(d => { reviews += d.reviews || 0; correct += d.correct || 0; });
    return {
      name: (Store.S.profile.name || 'Anon').slice(0, 24),
      streak: Store.liveStreak(),
      known: c.known,
      started: c.started,
      reviews,
      accuracy: reviews ? Math.round(correct / reviews * 100) : 0,
      updated: Date.now(),
    };
  }

  /** Send this device's summary up. Silently does nothing when not set up. */
  async function push() {
    if (!enabled()) return { ok: false, reason: 'off' };
    try {
      const r = await fetch(endpoint('/' + Store.S.profile.id), {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(summary()),
      });
      if (!r.ok) throw new Error('HTTP ' + r.status);
      return { ok: true };
    } catch (e) {
      return { ok: false, reason: e.message };
    }
  }

  /** Read the whole board. Falls back to the last copy we saw when offline. */
  async function fetchBoard() {
    if (!enabled()) return { ok: false, reason: 'off', rows: [] };
    try {
      const r = await fetch(endpoint(''), { cache: 'no-store' });
      if (!r.ok) throw new Error('HTTP ' + r.status);
      const data = (await r.json()) || {};
      const rows = Object.entries(data).map(([id, v]) => Object.assign({ id }, v))
        .filter(v => v && v.name)
        .sort((a, b) => (b.streak - a.streak) || (b.known - a.known));
      cached = { rows, at: Date.now() };
      try { localStorage.setItem(CACHE_KEY, JSON.stringify(cached)); } catch (e) {}
      return { ok: true, rows, at: cached.at };
    } catch (e) {
      return {
        ok: false,
        reason: e.message,
        rows: cached ? cached.rows : [],
        at: cached ? cached.at : 0,
        stale: true,
      };
    }
  }

  /** Remove this device's row — used when leaving a family code. */
  async function leave() {
    if (!enabled()) return;
    try {
      await fetch(endpoint('/' + Store.S.profile.id), { method: 'DELETE' });
    } catch (e) { /* best effort */ }
  }

  window.Cloud = { init, enabled, configured, code, push, fetchBoard, leave, summary };
})();
