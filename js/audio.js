/* Speech and sound.

   Pronunciation goes through speak(). It looks for a pre-recorded clip first
   and falls back to the device's Mandarin voice, so dropping a folder of
   studio-recorded MP3s in later needs no changes anywhere else in the app:
   name them audio/<hanzi>.mp3 and list them in audio/index.json. */
(function () {
  'use strict';

  let voices = [];
  let zhVoice = null;
  let clips = null;          // hanzi -> filename, or null if there's no clip set
  let ctx = null;            // Web Audio, for the little correct/wrong sounds
  let unlocked = false;

  /* ---- voice selection --------------------------------------------------- */

  // Ross downloads the premium "Han" voice on his iPhone, so prefer it by name.
  // Others are listed after it as sensible fallbacks on devices that lack it.
  const PREFERRED_NAMES = ['han', 'li-mu', 'yu-shu', 'tingting', 'ting-ting'];

  /** Rough quality ranking from whatever the platform puts in the voice name. */
  function quality(v) {
    const s = `${v.name || ''} ${v.voiceURI || ''}`.toLowerCase();
    if (/premium/.test(s)) return 3;
    if (/enhanced|siri/.test(s)) return 2;
    if (/compact/.test(s)) return 0;
    return 1;
  }

  function qualityLabel(v) {
    return ['Compact', 'Standard', 'Enhanced', 'Premium'][quality(v)];
  }

  function pickVoice() {
    voices = window.speechSynthesis ? speechSynthesis.getVoices() : [];
    const zh = chineseVoices();
    if (!zh.length) { zhVoice = null; return null; }

    // 1. An explicit choice from Settings wins. Match on URI first, then on
    //    name — voice URIs differ between devices and change across iOS
    //    updates, so the name is what actually survives.
    const S = Store.S.settings;
    if (S.voiceURI) {
      const byUri = zh.find(v => v.voiceURI === S.voiceURI);
      if (byUri) { zhVoice = byUri; return zhVoice; }
    }
    if (S.voiceName) {
      const byName = zh.find(v => v.name === S.voiceName) ||
                     zh.find(v => (v.name || '').toLowerCase().includes(S.voiceName.toLowerCase()));
      if (byName) { zhVoice = byName; return zhVoice; }
    }

    // 2. Otherwise pick the best available, favouring mainland Mandarin.
    const mainland = zh.filter(v => /zh[-_](CN|Hans)/i.test(v.lang));
    const list = mainland.length ? mainland : zh;

    const scored = list.slice().sort((a, b) => {
      const rank = v => {
        const n = (v.name || '').toLowerCase();
        const i = PREFERRED_NAMES.findIndex(p => n.includes(p));
        return i === -1 ? PREFERRED_NAMES.length : i;
      };
      // Higher quality first, then our name preference, then local voices.
      return (quality(b) - quality(a)) || (rank(a) - rank(b)) ||
             ((b.localService ? 1 : 0) - (a.localService ? 1 : 0));
    });

    zhVoice = scored[0] || null;
    return zhVoice;
  }

  function chineseVoices() {
    return voices.filter(v => /^zh([-_]|$)/i.test(v.lang || ''));
  }

  /** True when the chosen voice is one of the good downloadable ones. */
  function voiceIsPremium() {
    return !!zhVoice && quality(zhVoice) >= 2;
  }

  function init() {
    if (!window.speechSynthesis) return;
    pickVoice();
    // iOS populates the voice list asynchronously, sometimes more than once.
    speechSynthesis.addEventListener('voiceschanged', pickVoice);
    setTimeout(pickVoice, 400);
    setTimeout(pickVoice, 1500);

    fetch('audio/index.json', { cache: 'no-cache' })
      .then(r => (r.ok ? r.json() : null))
      .then(j => { clips = j; })
      .catch(() => { clips = null; });
  }

  /** iOS will not speak until something has been triggered by a real tap. */
  function unlock() {
    if (unlocked) return;
    unlocked = true;
    try {
      if (window.speechSynthesis) {
        const u = new SpeechSynthesisUtterance('');
        u.volume = 0;
        speechSynthesis.speak(u);
      }
      audioCtx();
    } catch (e) { /* nothing to do — audio just stays quiet */ }
  }

  function audioCtx() {
    if (!ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (AC) ctx = new AC();
    }
    if (ctx && ctx.state === 'suspended') ctx.resume();
    return ctx;
  }

  /* ---- speaking ---------------------------------------------------------- */

  let current = null;

  function speak(text, opts) {
    opts = opts || {};
    if (!text) return Promise.resolve();
    unlock();

    if (clips && clips[text]) {
      return playClip('audio/' + clips[text]).catch(() => tts(text, opts));
    }
    return tts(text, opts);
  }

  function playClip(src) {
    return new Promise((resolve, reject) => {
      const a = new Audio(src);
      a.playbackRate = Store.S.settings.rate < 0.8 ? 0.8 : 1;
      a.onended = resolve;
      a.onerror = reject;
      a.play().catch(reject);
    });
  }

  function tts(text, opts) {
    return new Promise(resolve => {
      if (!window.speechSynthesis) return resolve();
      try {
        speechSynthesis.cancel();       // iOS jams up without this
        const u = new SpeechSynthesisUtterance(text);
        u.lang = 'zh-CN';
        if (zhVoice) u.voice = zhVoice;
        u.rate = opts.rate || Store.S.settings.rate || 0.85;
        u.pitch = opts.pitch || 1;
        u.onend = resolve;
        u.onerror = resolve;
        current = u;
        // Safari sometimes drops the very first utterance after cancel().
        setTimeout(() => speechSynthesis.speak(u), 40);
        setTimeout(resolve, Math.max(2500, text.length * 420));
      } catch (e) {
        resolve();
      }
    });
  }

  function stop() {
    try { speechSynthesis.cancel(); } catch (e) {}
    current = null;
  }

  function available() {
    return !!(window.speechSynthesis && chineseVoices().length);
  }

  /* ---- interface sounds -------------------------------------------------- */

  function tone(freq, dur, type, gain, delay) {
    const c = audioCtx();
    if (!c || !Store.S.settings.sound) return;
    const t0 = c.currentTime + (delay || 0);
    const osc = c.createOscillator();
    const g = c.createGain();
    osc.type = type || 'sine';
    osc.frequency.setValueAtTime(freq, t0);
    g.gain.setValueAtTime(0, t0);
    g.gain.linearRampToValueAtTime(gain || 0.16, t0 + 0.012);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    osc.connect(g).connect(c.destination);
    osc.start(t0);
    osc.stop(t0 + dur + 0.03);
  }

  const ding    = () => { tone(784, 0.13, 'sine', .13); tone(1175, 0.20, 'sine', .11, .09); };
  const buzz    = () => { tone(196, 0.20, 'triangle', .12); tone(155, 0.24, 'triangle', .10, .07); };
  const pop     = () => tone(620, 0.07, 'sine', .09);
  const fanfare = () => {
    [523, 659, 784, 1047].forEach((f, i) => tone(f, 0.3, 'sine', .12, i * 0.11));
  };

  function buzzPhone(pattern) {
    if (!Store.S.settings.haptics) return;
    if (navigator.vibrate) { try { navigator.vibrate(pattern || 12); } catch (e) {} }
  }

  window.Audio2 = {
    init, unlock, speak, stop, available,
    pickVoice, chineseVoices, quality, qualityLabel, voiceIsPremium,
    get voice() { return zhVoice; },
    ding, buzz, pop, fanfare, buzzPhone,
  };
})();
