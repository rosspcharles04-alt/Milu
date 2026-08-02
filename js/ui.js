/* Shared rendering helpers. */
(function () {
  'use strict';

  const esc = s => String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');

  /* ---- icons ------------------------------------------------------------- */
  const ICONS = {
    home:   '<path d="M3 10.5 12 3l9 7.5V21a1 1 0 0 1-1 1h-5v-7H9v7H4a1 1 0 0 1-1-1z"/>',
    book:   '<path d="M4 4h6a3 3 0 0 1 3 3v13a2.5 2.5 0 0 0-2.5-2H4zm16 0h-6a3 3 0 0 0-3 3v13a2.5 2.5 0 0 1 2.5-2H20z"/>',
    target: '<path d="M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20m0 4a6 6 0 1 1 0 12 6 6 0 0 1 0-12m0 4a2 2 0 1 0 0 4 2 2 0 0 0 0-4"/>',
    brush:  '<path d="M4 20c3 0 4-2 4-4l-2-2c-2 0-4 1-4 4zM9.5 13.5 18 5a2.1 2.1 0 0 1 3 3l-8.5 8.5z"/>',
    deer:   '<path d="M12 22a6 6 0 0 1-6-6c0-3 2-5 6-5s6 2 6 5a6 6 0 0 1-6 6M7 9 5 3l3 2 1 3zm10 0 2-6-3 2-1 3z"/>',
    play:   '<path d="M6 4.5v15l13-7.5z"/>',
    sound:  '<path d="M4 9v6h4l5 4V5L8 9zm12.5 3a4 4 0 0 0-2-3.46v6.92A4 4 0 0 0 16.5 12m-2 7.9a8 8 0 0 0 0-15.8v2.06a6 6 0 0 1 0 11.68z"/>',
    back:   '<path d="M15.5 4 8 12l7.5 8 1.5-1.5L11 12l6-6.5z"/>',
    close:  '<path d="m6.4 5 12.6 12.6-1.4 1.4L5 6.4z"/><path d="M19 6.4 6.4 19 5 17.6 17.6 5z"/>',
    mic:    '<path d="M12 14a3 3 0 0 0 3-3V5a3 3 0 0 0-6 0v6a3 3 0 0 0 3 3m5-3a5 5 0 0 1-10 0H5a7 7 0 0 0 6 6.9V21h2v-3.1A7 7 0 0 0 19 11z"/>',
    cog:    '<path d="M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8m9 4-2.1-1.2a7 7 0 0 0-.5-1.2l.6-2.3-2.3-2.3-2.3.6a7 7 0 0 0-1.2-.5L12 3l-1.2 2.1a7 7 0 0 0-1.2.5l-2.3-.6-2.3 2.3.6 2.3a7 7 0 0 0-.5 1.2L3 12l2.1 1.2a7 7 0 0 0 .5 1.2l-.6 2.3 2.3 2.3 2.3-.6a7 7 0 0 0 1.2.5L12 21l1.2-2.1a7 7 0 0 0 1.2-.5l2.3.6 2.3-2.3-.6-2.3a7 7 0 0 0 .5-1.2z"/>',
    star:   '<path d="m12 2 3 6.6 7 .9-5.1 4.8 1.3 7L12 18l-6.2 3.3 1.3-7L2 9.5l7-.9z"/>',
    check:  '<path d="M9.6 17.2 4 11.6l1.6-1.6 4 4L18.4 5.2 20 6.8z"/>',
    chev:   '<path d="m9 5 7 7-7 7-1.5-1.5L13 12 7.5 6.5z"/>',
    import: '<path d="M12 3v10m0 0 4-4m-4 4-4-4" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><path d="M4 16v3a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-3" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>',
    people: '<path d="M9 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8m0 2c-4 0-7 2-7 4.5V21h14v-2.5C16 16 13 14 9 14m8.5-2a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7m.5 2c-.7 0-1.4.1-2 .3 1.9 1.1 3 2.7 3 4.2V21h5v-2.3c0-2.3-2.7-4.2-6-4.2"/>',
  };

  function icon(name, size) {
    const p = ICONS[name] || '';
    return `<svg viewBox="0 0 24 24" width="${size || 24}" height="${size || 24}"
             fill="currentColor" aria-hidden="true">${p}</svg>`;
  }

  /* ---- word rendering ---------------------------------------------------- */

  /**
   * Pick a font size that keeps a whole word on one line.
   *
   * Each character occupies roughly 1.15em once the pinyin above it and the
   * inter-character gap are counted, so a six-character word at the one-or-two
   * character size would need 600px on a 375px screen. Sizing from the length
   * means 你 fills the card and 很高兴认识你 still fits.
   *
   * @param {number} n      characters in the word
   * @param {number} cap    largest size to use, px
   */
  function hanziSize(n, cap) {
    cap = cap || 96;
    // Leave room for the 16px view padding either side plus a little breathing space.
    const avail = `(100vw - 56px)`;
    const per = (n * 1.15).toFixed(2);
    const floor = n >= 5 ? 26 : n === 4 ? 30 : n === 3 ? 38 : 46;
    return `clamp(${floor}px, calc(${avail} / ${per}), ${cap}px)`;
  }

  /** Characters with their pinyin stacked above, coloured by tone. */
  function ruby(word, opts) {
    opts = opts || {};
    const units = word.units && word.units.length
      ? word.units
      : [...word.hanzi].map(c => ({ c, p: '', t: 0 }));
    const hide = opts.hidePinyin;
    // `size` may be an explicit value; otherwise fit to the word's length.
    const size = opts.size || hanziSize(units.length, opts.cap);

    const inner = units.map(u => `
      <span class="ruby__u">
        <span class="ruby__p t${u.t || 5}">${esc(u.p)}</span>
        <span class="ruby__c">${esc(u.c)}</span>
      </span>`).join('');

    return `<div class="ruby${hide ? ' ruby--hide' : ''}"
                 style="font-size:${size}"
                 data-ruby="${esc(word.id || word.hanzi)}">${inner}</div>`;
  }

  /** Plain characters, no pinyin, sized to fit. */
  function hanziBlock(hanzi, cap) {
    const n = [...hanzi].length;
    return `<div class="hz" style="font-size:${hanziSize(n, cap)};line-height:1.15;
             letter-spacing:.03em;max-width:100%">${esc(hanzi)}</div>`;
  }

  /** Pinyin as plain text, each syllable coloured by its tone. */
  function pinyinColoured(word) {
    const units = word.units || [];
    if (!units.length) return `<span class="py">${esc(word.pinyin)}</span>`;
    return '<span class="py">' + units
      .map(u => `<span class="t${u.t || 5}">${esc(u.p)}</span>`)
      .join('') + '</span>';
  }

  function toneDots(word) {
    return (word.tones || []).map(t =>
      `<span class="t${t}" style="font-size:19px;font-weight:800">${t}</span>`).join(' ');
  }

  /* ---- feedback ---------------------------------------------------------- */

  let toastEl = null, toastTimer = null;
  function toast(msg, ms) {
    if (!toastEl) {
      toastEl = document.createElement('div');
      toastEl.className = 'toast';
      document.body.appendChild(toastEl);
    }
    toastEl.textContent = msg;
    requestAnimationFrame(() => toastEl.classList.add('toast--on'));
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toastEl.classList.remove('toast--on'), ms || 2000);
  }

  function confetti(n) {
    const colours = ['#E89049', '#FF8A75', '#56BE96', '#6FA8E0', '#A98BD8', '#FFD166'];
    const box = document.createElement('div');
    box.className = 'confetti';
    let html = '';
    for (let i = 0; i < (n || 34); i++) {
      const c = colours[i % colours.length];
      html += `<i style="left:${Math.random() * 100}%;background:${c};
        animation-duration:${(1.5 + Math.random() * 1.4).toFixed(2)}s;
        animation-delay:${(Math.random() * .45).toFixed(2)}s"></i>`;
    }
    box.innerHTML = html;
    document.body.appendChild(box);
    setTimeout(() => box.remove(), 3600);
  }

  /* ---- bottom sheet ------------------------------------------------------ */

  let sheetEls = null;
  function sheet(html, onClose) {
    closeSheet(true);
    const back = document.createElement('div');
    back.className = 'sheet-backdrop';
    const s = document.createElement('div');
    s.className = 'sheet';
    s.innerHTML = `<div class="sheet__grip"></div>${html}`;
    document.body.append(back, s);
    requestAnimationFrame(() => {
      back.classList.add('sheet-backdrop--on');
      s.classList.add('sheet--on');
    });
    back.addEventListener('click', () => closeSheet());
    sheetEls = { back, s, onClose };
    return s;
  }

  function closeSheet(immediate) {
    if (!sheetEls) return;
    const { back, s, onClose } = sheetEls;
    sheetEls = null;
    if (onClose) onClose();
    if (immediate) { back.remove(); s.remove(); return; }
    back.classList.remove('sheet-backdrop--on');
    s.classList.remove('sheet--on');
    setTimeout(() => { back.remove(); s.remove(); }, 320);
  }

  /* ---- misc -------------------------------------------------------------- */

  function ring(pct, size, stroke) {
    size = size || 84;
    stroke = stroke || 9;
    const r = (size - stroke) / 2;
    const circ = 2 * Math.PI * r;
    const off = circ * (1 - Math.max(0, Math.min(1, pct)));
    return `
      <svg class="ring" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
        <defs>
          <linearGradient id="ringGrad" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stop-color="#E89049"/>
            <stop offset="100%" stop-color="#FF8A75"/>
          </linearGradient>
        </defs>
        <circle class="ring__track" cx="${size / 2}" cy="${size / 2}" r="${r}" stroke-width="${stroke}"/>
        <circle class="ring__fill"  cx="${size / 2}" cy="${size / 2}" r="${r}"
                stroke-width="${stroke}" stroke-dasharray="${circ}" stroke-dashoffset="${off}"/>
      </svg>`;
  }

  const TOPIC_EMOJI = {
    greetings: '👋', self: '🙋', people: '👥', feelings: '😊', time: '🕐',
    clothes: '👕', transport: '🚊', food: '🍜', animals: '🐼', numbers: '🔢',
    places: '📍', verbs: '🏃', adjectives: '✨', questions: '❓', grammar: '🔧',
    school: '📚', daily: '☀️', body: '💪', weather: '🌦', colours: '🎨',
    objects: '📦',
  };
  const topicEmoji = t => TOPIC_EMOJI[t] || '🀄️';

  function shuffle(a) {
    a = a.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  /** Pick n distinct wrong answers that aren't too easy to eliminate. */
  function distractors(correct, n, keyFn, poolList) {
    const key = keyFn || (w => w.english);
    const pool = (poolList || SRS.familiar()).filter(w =>
      w.id !== correct.id && key(w) !== key(correct));
    // Prefer words from the same topic — makes the choice actually require knowing.
    const same = shuffle(pool.filter(w => w.topic === correct.topic));
    const rest = shuffle(pool.filter(w => w.topic !== correct.topic));
    return same.concat(rest).slice(0, n);
  }

  function el(html) {
    const t = document.createElement('template');
    t.innerHTML = html.trim();
    return t.content.firstElementChild;
  }

  window.UI = {
    esc, icon, ruby, hanziSize, hanziBlock, pinyinColoured, toneDots, toast, confetti,
    sheet, closeSheet, ring, topicEmoji, shuffle, distractors, el,
  };
})();
