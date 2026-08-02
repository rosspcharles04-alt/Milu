/* Importing new vocabulary — from a .pptx, or typed in by hand.

   Includes a JavaScript port of the build-time pinyin splitter so words added
   on the phone get the same per-character pinyin and tone colouring as the
   built-in ones. */
(function () {
  const Views = window.Views = window.Views || {};

  /* ---- pinyin splitting (mirrors build/pinyin.py) -------------------------- */

  const TONE_MAP = {
    'ā':['a',1],'á':['a',2],'ǎ':['a',3],'à':['a',4],
    'ē':['e',1],'é':['e',2],'ě':['e',3],'è':['e',4],
    'ī':['i',1],'í':['i',2],'ǐ':['i',3],'ì':['i',4],
    'ō':['o',1],'ó':['o',2],'ǒ':['o',3],'ò':['o',4],
    'ū':['u',1],'ú':['u',2],'ǔ':['u',3],'ù':['u',4],
    'ǖ':['ü',1],'ǘ':['ü',2],'ǚ':['ü',3],'ǜ':['ü',4],
    'ń':['n',2],'ň':['n',3],'ǹ':['n',4],'ḿ':['m',2],
  };

  const INITIALS = ['zh','ch','sh','b','p','m','f','d','t','n','l','g','k','h',
                    'j','q','x','r','z','c','s','y','w'];
  const FINALS = ['iang','iong','uang','ueng','üan','uai','uan','ian','iao','ing',
                  'ong','eng','ang','iu','ai','ei','ao','ou','an','en','er','ia',
                  'ie','in','ua','uo','ui','un','ün','üe','ue','io',
                  'a','o','e','i','u','ü','n','m','r']
                 .sort((a, b) => b.length - a.length);
  const STANDALONE = new Set(FINALS);

  const isCJK = ch => /[㐀-䶿一-鿿]/.test(ch);

  function stripTones(text) {
    let plain = '';
    const tones = {};
    for (const ch of text) {
      const low = ch.toLowerCase();
      if (TONE_MAP[low]) {
        let [base, tone] = TONE_MAP[low];
        if (ch !== low) base = base.toUpperCase();
        tones[plain.length] = tone;
        plain += base;
      } else {
        plain += ch;
      }
    }
    return { plain, tones };
  }

  function splitRun(run) {
    const low = run.toLowerCase();
    const n = low.length;
    const memo = new Map();

    function solve(i) {
      if (i === n) return [];
      if (memo.has(i)) return memo.get(i);
      const ends = new Set();
      for (const ini of [''].concat(INITIALS)) {
        if (ini && !low.startsWith(ini, i)) continue;
        const j = i + ini.length;
        for (const fin of FINALS) {
          if (!low.startsWith(fin, j)) continue;
          if (!ini && !STANDALONE.has(fin)) continue;
          if (ini && (fin === 'n' || fin === 'm' || fin === 'r')) continue;
          ends.add(j + fin.length);
        }
      }
      const sorted = [...ends].sort((a, b) => b - a);
      for (const end of sorted) {
        if (end < n && low[end] === 'r' &&
            (end + 1 === n || !'aeiouü'.includes(low[end + 1]))) {
          const rest = solve(end + 1);
          if (rest) { const r = [[i, end + 1]].concat(rest); memo.set(i, r); return r; }
        }
        const rest = solve(end);
        if (rest) { const r = [[i, end]].concat(rest); memo.set(i, r); return r; }
      }
      memo.set(i, null);
      return null;
    }

    const out = solve(0);
    return out || [[0, n]];
  }

  function syllables(pinyin) {
    const { plain, tones } = stripTones(pinyin || '');
    const out = [];
    const re = /[A-Za-zü]+/g;
    let m;
    while ((m = re.exec(plain)) !== null) {
      const start = m.index;
      for (const [a, b] of splitRun(m[0])) {
        const s = start + a, e = start + b;
        let tone = 5;
        for (let k = s; k < e; k++) if (tones[k]) { tone = tones[k]; break; }
        out.push({ p: pinyin.slice(s, e), t: tone });
      }
    }
    return out;
  }

  /** Pair characters with syllables, exactly as the build step does. */
  function units(hanzi, pinyin) {
    const chars = [...(hanzi || '')].filter(c => isCJK(c) || /[a-z]/i.test(c));
    let syls = syllables(pinyin);

    if (chars.length === syls.length + 1 && chars[chars.length - 1] === '儿' &&
        syls.length && syls[syls.length - 1].p.endsWith('r')) {
      const last = syls[syls.length - 1];
      syls = syls.slice(0, -1).concat(
        [{ p: last.p.slice(0, -1), t: last.t }, { p: 'r', t: 5 }]);
    }

    if (chars.length !== syls.length) {
      return chars.map(c => ({ c, p: '', t: 0 }));
    }
    return chars.map((c, i) => ({ c, p: syls[i].p, t: syls[i].t }));
  }

  function makeWord(hanzi, pinyin, english, topic, lesson) {
    const u = units(hanzi, pinyin);
    return {
      id: hanzi, hanzi, pinyin: pinyin || '', english: english || '',
      topic: topic || 'custom', lessons: [lesson || 'custom'], hsk: 0,
      group: 1, units: u,
      tones: u.map(x => x.t).filter(Boolean),
      chars: u.map(x => x.c).filter(isCJK),
      custom: true,
    };
  }

  window.Import = { units, syllables, makeWord };

  /* ---- the import view ------------------------------------------------------ */

  Views.import = function (host) {
    host.innerHTML = `
      <div class="topbar">
        <button class="icon-btn" id="back" aria-label="Back">${UI.icon('back', 20)}</button>
        <div>
          <div class="topbar__title" style="font-size:22px">Import a deck</div>
          <div class="topbar__sub">Pull words out of a PowerPoint</div>
        </div>
      </div>

      ${Pptx.supported() ? '' : `
        <div class="banner banner--bad" style="margin-bottom:14px">
          This browser can't unzip files — you need iOS 16.4 or newer.
        </div>`}

      <div class="card card--amber">
        <div class="card__title">📲 Getting a deck from WhatsApp</div>
        <ol class="card__note" style="padding-left:18px;margin-top:6px">
          <li>Open the .pptx in WhatsApp and tap <b>Share</b></li>
          <li>Choose <b>Save to Files</b></li>
          <li>Come back here and tap <b>Choose a file</b></li>
        </ol>
        <p class="card__note small" style="margin-top:8px">
          iPhones don't let a web app receive a share directly, so it's this
          small detour. Nothing leaves your phone — the file is read on-device.</p>
      </div>

      <button class="btn btn--primary btn--block" id="pick" ${Pptx.supported() ? '' : 'disabled'}>
        ${UI.icon('import', 20)} Choose a file</button>
      <input type="file" id="file" accept=".pptx,application/vnd.openxmlformats-officedocument.presentationml.presentation"
             class="hidden">

      <div id="out" style="margin-top:16px"></div>

      <div class="card card--tint" style="margin-top:18px">
        <div class="card__title">✏️ Or paste a list</div>
        <p class="card__note">One word per line, as
          <b>汉字, pīnyīn, meaning</b> — commas or tabs both work.</p>
        <textarea class="field" id="paste" style="margin-top:10px"
          placeholder="火锅, huǒ guō, hot pot&#10;汉堡, hàn bǎo, hamburger"></textarea>
        <button class="btn btn--ghost btn--block btn--sm" id="parsePaste" style="margin-top:10px">
          Read the list</button>
      </div>`;

    host.querySelector('#back').addEventListener('click', () => App.go('#/me'));

    const file = host.querySelector('#file');
    const out = host.querySelector('#out');

    host.querySelector('#pick').addEventListener('click', () => file.click());

    file.addEventListener('change', async () => {
      const f = file.files && file.files[0];
      if (!f) return;
      out.innerHTML = `<div class="card center"><p class="card__note">Reading ${UI.esc(f.name)}…</p></div>`;
      try {
        const r = await Pptx.parse(f);
        if (!r.words.length) {
          out.innerHTML = `<div class="banner banner--bad">
            Read ${r.slides} slides but couldn't find any vocabulary. Some decks
            keep their words inside images, which can't be read as text — you can
            paste them in below instead.</div>`;
          return;
        }
        review(out, r.words, r.title);
      } catch (e) {
        out.innerHTML = `<div class="banner banner--bad">${UI.esc(e.message)}</div>`;
      }
      file.value = '';
    });

    host.querySelector('#parsePaste').addEventListener('click', () => {
      const text = host.querySelector('#paste').value;
      const rows = text.split(/\r?\n/).map(l => l.trim()).filter(Boolean).map(line => {
        const parts = line.split(/\s*[,\t;，]\s*/);
        return { hanzi: (parts[0] || '').trim(), pinyin: (parts[1] || '').trim(),
                 english: parts.slice(2).join(', ').trim() };
      }).filter(r => r.hanzi && /[一-鿿]/.test(r.hanzi));
      if (!rows.length) { UI.toast('Nothing usable in that list'); return; }
      review(out, rows, 'Pasted list');
    });
  };

  /* ---- confirm and edit before adding ---------------------------------------- */

  function review(out, words, title) {
    const known = new Set(Store.S.vocab.map(w => w.hanzi));
    const rows = words.map((w, i) => ({
      ...w, i,
      dupe: known.has(w.hanzi),
      keep: !known.has(w.hanzi),
    }));

    function paint() {
      const keeping = rows.filter(r => r.keep).length;
      out.innerHTML = `
        <div class="card card--mint">
          <div class="card__title">Found ${words.length} word${words.length === 1 ? '' : 's'}</div>
          <p class="card__note">From “${UI.esc(title)}”. Check them over — tap any
            field to fix it, and untick anything you don't want.</p>
        </div>

        ${rows.map(r => `
          <div class="card" style="padding:12px;${r.keep ? '' : 'opacity:.45'}">
            <div class="hstack" style="align-items:flex-start">
              <button class="icon-btn" data-keep="${r.i}" style="flex:none"
                      aria-label="${r.keep ? 'Exclude' : 'Include'}">
                ${r.keep ? `<span style="color:var(--mint)">${UI.icon('check', 20)}</span>`
                         : `<span style="color:var(--muted)">${UI.icon('close', 16)}</span>`}
              </button>
              <div class="flex1 stack" style="gap:6px;min-width:0">
                <input class="field hz" data-f="hanzi" data-i="${r.i}"
                       value="${UI.esc(r.hanzi)}" placeholder="汉字"
                       style="padding:8px 11px;font-size:19px">
                <input class="field" data-f="pinyin" data-i="${r.i}"
                       value="${UI.esc(r.pinyin)}" placeholder="pīnyīn"
                       style="padding:8px 11px;font-size:14px">
                <input class="field" data-f="english" data-i="${r.i}"
                       value="${UI.esc(r.english)}" placeholder="meaning"
                       style="padding:8px 11px;font-size:14px">
                ${r.dupe ? `<span class="pill pill--amber">already in your deck</span>` : ''}
              </div>
              <button class="icon-btn" data-say="${UI.esc(r.hanzi)}" style="flex:none"
                      aria-label="Play">${UI.icon('sound', 18)}</button>
            </div>
          </div>`).join('')}

        <button class="btn btn--primary btn--block" id="add" ${keeping ? '' : 'disabled'}>
          Add ${keeping} word${keeping === 1 ? '' : 's'} to my deck</button>`;

      out.querySelectorAll('[data-keep]').forEach(b =>
        b.addEventListener('click', () => { rows[+b.dataset.keep].keep = !rows[+b.dataset.keep].keep; paint(); }));
      out.querySelectorAll('[data-say]').forEach(b =>
        b.addEventListener('click', () => Audio2.speak(b.dataset.say)));
      out.querySelectorAll('[data-f]').forEach(inp =>
        inp.addEventListener('change', () => { rows[+inp.dataset.i][inp.dataset.f] = inp.value.trim(); }));

      out.querySelector('#add')?.addEventListener('click', () => {
        const picked = rows.filter(r => r.keep && r.hanzi)
          .map(r => makeWord(r.hanzi, r.pinyin, r.english, 'custom', 'custom'));
        const n = Store.addCustomWords(picked);
        UI.toast(n ? `Added ${n} word${n === 1 ? '' : 's'}` : 'Nothing new to add');
        App.go('#/me');
      });
    }

    paint();
    out.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
})();
