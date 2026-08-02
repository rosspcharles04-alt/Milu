/* Speech recognition — "did I actually say the right word?"

   Uses the browser's built-in recogniser (iOS Safari 14.5+). It needs a network
   connection, so everything here degrades quietly: if it's unavailable the
   speaking view still works, just on tone contour alone. */
(function () {
  'use strict';

  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;

  function supported() { return !!SR; }

  /**
   * Listen once and resolve with what was heard.
   * @returns {Promise<{ok:boolean, text:string, alternatives:string[], error?:string}>}
   */
  function listen(opts) {
    opts = opts || {};
    return new Promise(resolve => {
      if (!SR) return resolve({ ok: false, text: '', alternatives: [], error: 'unsupported' });

      const rec = new SR();
      rec.lang = opts.lang || 'zh-CN';
      rec.interimResults = false;
      rec.maxAlternatives = 5;
      rec.continuous = false;

      let settled = false;
      const finish = r => { if (!settled) { settled = true; try { rec.stop(); } catch (e) {} resolve(r); } };

      rec.onresult = e => {
        const res = e.results[0];
        const alts = [];
        for (let i = 0; i < res.length; i++) alts.push(res[i].transcript.trim());
        finish({ ok: true, text: alts[0] || '', alternatives: alts });
      };
      rec.onerror = e => finish({ ok: false, text: '', alternatives: [], error: e.error || 'error' });
      rec.onend = () => finish({ ok: false, text: '', alternatives: [], error: 'no-speech' });

      try { rec.start(); } catch (e) {
        finish({ ok: false, text: '', alternatives: [], error: 'start-failed' });
      }

      if (opts.timeout !== 0) {
        setTimeout(() => finish({ ok: false, text: '', alternatives: [], error: 'timeout' }),
                   opts.timeout || 7000);
      }
    });
  }

  const strip = s => (s || '').replace(/[\s，。！？、,.!?；;：:'"“”‘’]/g, '');

  /**
   * How well does what was heard match what was asked for?
   * Returns 0..1 — 1 is an exact match, partial credit for shared characters.
   */
  function match(target, heard) {
    const t = strip(target), h = strip(heard);
    if (!t || !h) return 0;
    if (t === h) return 1;
    if (h.includes(t) || t.includes(h)) return 0.9;

    // Character overlap, order-insensitive.
    const tc = [...t], hc = [...h];
    let hits = 0;
    const pool = hc.slice();
    tc.forEach(c => {
      const i = pool.indexOf(c);
      if (i >= 0) { hits++; pool.splice(i, 1); }
    });
    return hits / Math.max(tc.length, hc.length);
  }

  /** Best score across all the alternatives the recogniser offered. */
  function bestMatch(target, result) {
    if (!result || !result.ok) return { score: 0, heard: '' };
    let best = { score: 0, heard: result.text };
    (result.alternatives || [result.text]).forEach(a => {
      const s = match(target, a);
      if (s > best.score) best = { score: s, heard: a };
    });
    return best;
  }

  window.Speech = { supported, listen, match, bestMatch, strip };
})();
