/* Stroke-order rendering and tracing, on top of hanzi-writer.

   Stroke data is bundled locally (data/strokes.json) so this works offline —
   hanzi-writer's default loader would go to a CDN, which we override. */
(function () {
  'use strict';

  let ready = null;

  function load() {
    if (!ready) ready = Store.strokes();
    return ready;
  }

  function hasChar(ch) {
    return !!(Store.S.strokes && Store.S.strokes[ch]);
  }

  const BASE = {
    width: 200,
    height: 200,
    padding: 12,
    strokeColor: '#3B2A21',
    radicalColor: '#E89049',
    outlineColor: '#EADACB',
    drawingColor: '#E89049',
    highlightColor: '#56BE96',
    delayBetweenStrokes: 190,
    strokeAnimationSpeed: 1.1,
    showOutline: true,
    showCharacter: true,
  };

  function palette() {
    const dark = document.documentElement.dataset.theme === 'dark';
    return dark
      ? { strokeColor: '#F6E9DE', outlineColor: '#4A3A30' }
      : { strokeColor: '#3B2A21', outlineColor: '#EADACB' };
  }

  /**
   * Create a writer bound to an element.
   * @param {HTMLElement} el   container (sized by CSS)
   * @param {string} ch        the character
   * @param {object} opts      extra hanzi-writer options
   */
  async function create(el, ch, opts) {
    const data = await load();
    if (!data[ch]) return null;
    el.innerHTML = '';
    const size = Math.min(el.clientWidth || 200, el.clientHeight || 200) || 200;

    return HanziWriter.create(el, ch, Object.assign({}, BASE, palette(), {
      width: size,
      height: size,
      padding: Math.round(size * 0.06),
      charDataLoader: (c, onLoad) => onLoad(data[c]),
    }, opts || {}));
  }

  /** A static, non-interactive rendering — used for grids and previews. */
  async function still(el, ch, size) {
    const w = await create(el, ch, {
      width: size, height: size, padding: Math.round(size * 0.06),
      showOutline: false,
    });
    return w;
  }

  function strokeCount(ch) {
    const d = Store.S.strokes;
    return d && d[ch] ? d[ch].strokes.length : 0;
  }

  /** Break a character into its known components, if we have a note for it. */
  function breakdown(ch) {
    return Store.S.radicals[ch] || null;
  }

  /* ---- per-character writing progress ------------------------------------ */

  function charStat(ch) {
    const C = Store.S.chars;
    if (!C[ch]) C[ch] = { traced: 0, mistakes: 0, best: null };
    return C[ch];
  }

  function recordTrace(ch, mistakes) {
    const s = charStat(ch);
    s.traced++;
    s.mistakes += mistakes;
    if (s.best === null || mistakes < s.best) s.best = mistakes;
    Store.saveChars();
    return s;
  }

  /** Every character in the vocabulary, with how well it's known. */
  function allChars() {
    const seen = new Map();
    Store.S.vocab.forEach(w => {
      (w.chars || []).forEach(ch => {
        if (!seen.has(ch)) seen.set(ch, { ch, words: [], order: w.order });
        seen.get(ch).words.push(w);
      });
    });
    return [...seen.values()].sort((a, b) => a.order - b.order);
  }

  window.Hanzi = {
    load, hasChar, create, still, strokeCount, breakdown,
    charStat, recordTrace, allChars,
  };
})();
