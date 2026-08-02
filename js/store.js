/* Everything the app knows: the word lists it loaded, and what the user has
   done with them. All progress lives in localStorage on the device — nothing
   here needs a network. */
(function () {
  'use strict';

  const NS = 'milu.v1.';
  const K = {
    progress: NS + 'progress',
    profile:  NS + 'profile',
    settings: NS + 'settings',
    custom:   NS + 'custom',
    stats:    NS + 'stats',
    chars:    NS + 'chars',
  };

  const DEFAULT_SETTINGS = {
    newPerDay: 10,
    pinyinMode: 'fade',      // fade | hidden | always
    voiceURI: '',
    rate: 0.85,
    theme: 'auto',
    sound: true,
    haptics: true,
    familyCode: '',
  };

  function read(key, fallback) {
    try {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : structuredClone(fallback);
    } catch (e) {
      console.warn('could not read', key, e);
      return structuredClone(fallback);
    }
  }

  function write(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
      return true;
    } catch (e) {
      console.warn('could not save', key, e);
      return false;
    }
  }

  const S = {
    vocab: [],
    byId: new Map(),
    lessons: [],
    dialogues: [],
    patterns: [],
    tones: { tones: [], sandhi: [] },
    radicals: {},
    strokes: null,          // lazily loaded, it's the biggest file

    progress: {},
    chars: {},
    profile: { name: '', joined: null, id: '' },
    settings: structuredClone(DEFAULT_SETTINGS),
    custom: [],
    stats: { streak: 0, longest: 0, lastDay: null, days: {}, totalReviews: 0 },
  };

  /* ---- loading ---------------------------------------------------------- */

  async function loadJSON(path) {
    const r = await fetch(path, { cache: 'no-cache' });
    if (!r.ok) throw new Error(`${path} → ${r.status}`);
    return r.json();
  }

  async function load() {
    const [vocab, lessons, dialogues, patterns, tones, radicals] =
      await Promise.all([
        loadJSON('data/vocab.json'),
        loadJSON('data/lessons.json'),
        loadJSON('data/dialogues.json'),
        loadJSON('data/patterns.json'),
        loadJSON('data/tones.json'),
        loadJSON('data/radicals.json'),
      ]);

    S.lessons = lessons;
    S.dialogues = dialogues;
    S.patterns = patterns;
    S.tones = tones;
    S.radicals = radicals;

    S.progress = read(K.progress, {});
    S.chars    = read(K.chars, {});
    S.profile  = read(K.profile, { name: '', joined: null, id: '' });
    S.settings = Object.assign(structuredClone(DEFAULT_SETTINGS), read(K.settings, {}));
    S.custom   = read(K.custom, []);
    S.stats    = read(K.stats, { streak: 0, longest: 0, lastDay: null, days: {}, totalReviews: 0 });

    if (!S.profile.id) {
      S.profile.id = 'u' + Math.random().toString(36).slice(2, 10);
      S.profile.joined = Date.now();
      write(K.profile, S.profile);
    }

    setVocab(vocab.concat(S.custom));
    return S;
  }

  function setVocab(list) {
    S.vocab = list;
    S.byId = new Map(list.map(w => [w.id, w]));
  }

  /** Stroke data is ~1.2 MB, so it only loads when a character view needs it. */
  async function strokes() {
    if (!S.strokes) S.strokes = await loadJSON('data/strokes.json');
    return S.strokes;
  }

  /* ---- persistence ------------------------------------------------------ */

  const saveProgress = () => write(K.progress, S.progress);
  const saveChars    = () => write(K.chars, S.chars);
  const saveStats    = () => write(K.stats, S.stats);
  const saveProfile  = () => write(K.profile, S.profile);

  function saveSettings() {
    write(K.settings, S.settings);
    applyTheme();
  }

  function saveCustom() {
    write(K.custom, S.custom);
  }

  function addCustomWords(words) {
    const existing = new Set(S.vocab.map(w => w.hanzi));
    const fresh = words.filter(w => w.hanzi && !existing.has(w.hanzi));
    fresh.forEach(w => {
      w.id = w.hanzi;
      w.custom = true;
      w.group = 1;
      w.order = 10000 + S.custom.length;
      S.custom.push(w);
    });
    saveCustom();
    setVocab(S.vocab.concat(fresh));
    return fresh.length;
  }

  function removeCustomWord(id) {
    S.custom = S.custom.filter(w => w.id !== id);
    saveCustom();
    delete S.progress[id];
    saveProgress();
    setVocab(S.vocab.filter(w => w.id !== id));
  }

  /* ---- theme ------------------------------------------------------------ */

  function applyTheme() {
    const t = S.settings.theme;
    const dark = t === 'dark' ||
      (t === 'auto' && window.matchMedia('(prefers-color-scheme: dark)').matches);
    document.documentElement.dataset.theme = dark ? 'dark' : 'light';
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute('content', dark ? '#1B1512' : '#FFF7EF');
  }

  /* ---- day bookkeeping -------------------------------------------------- */

  function today() {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }

  function dayEntry(key) {
    const k = key || today();
    if (!S.stats.days[k]) S.stats.days[k] = { new: 0, reviews: 0, correct: 0, seconds: 0 };
    return S.stats.days[k];
  }

  /** Called whenever the user actually answers something. Keeps the streak. */
  function touchStreak() {
    const t = today();
    if (S.stats.lastDay === t) return;

    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const y = `${yesterday.getFullYear()}-${String(yesterday.getMonth() + 1).padStart(2, '0')}-${String(yesterday.getDate()).padStart(2, '0')}`;

    S.stats.streak = (S.stats.lastDay === y) ? S.stats.streak + 1 : 1;
    S.stats.longest = Math.max(S.stats.longest, S.stats.streak);
    S.stats.lastDay = t;
    saveStats();
  }

  /** The streak shown in the UI: it lapses if they missed yesterday and today. */
  function liveStreak() {
    if (!S.stats.lastDay) return 0;
    const t = today();
    if (S.stats.lastDay === t) return S.stats.streak;
    const yd = new Date();
    yd.setDate(yd.getDate() - 1);
    const y = `${yd.getFullYear()}-${String(yd.getMonth() + 1).padStart(2, '0')}-${String(yd.getDate()).padStart(2, '0')}`;
    return S.stats.lastDay === y ? S.stats.streak : 0;
  }

  function reset() {
    Object.values(K).forEach(k => localStorage.removeItem(k));
  }

  window.Store = {
    S, K, load, strokes, setVocab,
    saveProgress, saveChars, saveStats, saveSettings, saveProfile, saveCustom,
    addCustomWords, removeCustomWord,
    applyTheme, today, dayEntry, touchStreak, liveStreak, reset,
    DEFAULT_SETTINGS,
  };
})();
