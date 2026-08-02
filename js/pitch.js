/* Pitch tracking, for judging tones.

   Mandarin tones are pitch *shapes*, not absolute pitches, so everything here
   works on the contour: track F0 frame by frame, convert to semitones, then
   normalise so a low voice and a high voice are compared on equal terms.
   Runs entirely on-device — no network, no API key. */
(function () {
  'use strict';

  const MIN_F0 = 70;    // Hz — below a low male voice
  const MAX_F0 = 420;   // Hz — above a high female voice
  const RMS_GATE = 0.012;

  /**
   * Estimate the fundamental of one frame by normalised autocorrelation.
   * Returns Hz, or 0 if the frame is silent/unvoiced.
   */
  function detectF0(buf, sampleRate) {
    const n = buf.length;

    let rms = 0;
    for (let i = 0; i < n; i++) rms += buf[i] * buf[i];
    rms = Math.sqrt(rms / n);
    if (rms < RMS_GATE) return { hz: 0, rms };

    const minLag = Math.floor(sampleRate / MAX_F0);
    const maxLag = Math.min(Math.floor(sampleRate / MIN_F0), Math.floor(n / 2));
    if (maxLag <= minLag) return { hz: 0, rms };

    let bestLag = -1, bestScore = 0;
    const corr = new Float32Array(maxLag + 1);

    for (let lag = minLag; lag <= maxLag; lag++) {
      let sum = 0, e1 = 0, e2 = 0;
      const len = n - lag;
      for (let i = 0; i < len; i++) {
        const a = buf[i], b = buf[i + lag];
        sum += a * b; e1 += a * a; e2 += b * b;
      }
      const denom = Math.sqrt(e1 * e2);
      const score = denom > 0 ? sum / denom : 0;
      corr[lag] = score;
      if (score > bestScore) { bestScore = score; bestLag = lag; }
    }

    // A weak best match means the frame wasn't really voiced.
    if (bestLag < 0 || bestScore < 0.55) return { hz: 0, rms };

    // A periodic signal correlates just as strongly at 2× or 3× its period, and
    // longer lags use fewer samples so they can even edge ahead. Taking the
    // global maximum therefore reports the pitch an octave — or a twelfth —
    // too low. Take instead the *shortest* lag that is a local peak and nearly
    // as good, which lands on the true fundamental.
    const threshold = bestScore * 0.90;
    for (let lag = minLag + 1; lag < maxLag; lag++) {
      if (corr[lag] >= threshold && corr[lag] >= corr[lag - 1] && corr[lag] >= corr[lag + 1]) {
        bestLag = lag;
        break;
      }
    }

    // Parabolic interpolation for sub-sample accuracy.
    let lag = bestLag;
    const y1 = corr[bestLag - 1] || 0, y2 = corr[bestLag], y3 = corr[bestLag + 1] || 0;
    const denom = 2 * (2 * y2 - y1 - y3);
    if (denom !== 0) lag = bestLag + (y3 - y1) / denom;

    const hz = sampleRate / lag;
    return { hz: (hz >= MIN_F0 && hz <= MAX_F0) ? hz : 0, rms, conf: bestScore };
  }

  /* ---- recorder ---------------------------------------------------------- */

  function Recorder() {
    this.ctx = null;
    this.stream = null;
    this.raf = 0;
    this.frames = [];
    this.recording = false;
    this.onFrame = null;
  }

  Recorder.prototype.start = async function (onFrame) {
    this.onFrame = onFrame;
    this.frames = [];

    this.stream = await navigator.mediaDevices.getUserMedia({
      audio: {
        echoCancellation: false,
        noiseSuppression: false,
        autoGainControl: false,
      },
    });

    const AC = window.AudioContext || window.webkitAudioContext;
    this.ctx = new AC();
    if (this.ctx.state === 'suspended') await this.ctx.resume();

    const src = this.ctx.createMediaStreamSource(this.stream);
    const analyser = this.ctx.createAnalyser();
    analyser.fftSize = 2048;
    analyser.smoothingTimeConstant = 0;
    src.connect(analyser);

    const buf = new Float32Array(analyser.fftSize);
    const sr = this.ctx.sampleRate;
    const t0 = performance.now();
    this.recording = true;

    const tick = () => {
      if (!this.recording) return;
      analyser.getFloatTimeDomainData(buf);
      const r = detectF0(buf, sr);
      const frame = { t: (performance.now() - t0) / 1000, hz: r.hz, rms: r.rms };
      this.frames.push(frame);
      if (this.onFrame) this.onFrame(frame);
      this.raf = requestAnimationFrame(tick);
    };
    tick();
  };

  Recorder.prototype.stop = function () {
    this.recording = false;
    cancelAnimationFrame(this.raf);
    if (this.stream) this.stream.getTracks().forEach(t => t.stop());
    if (this.ctx && this.ctx.state !== 'closed') this.ctx.close();
    this.stream = null;
    this.ctx = null;
    return this.frames;
  };

  /* ---- contour maths ----------------------------------------------------- */

  /** Keep the voiced middle of the recording and smooth out tracking glitches. */
  function cleanContour(frames) {
    let voiced = frames.filter(f => f.hz > 0);
    if (voiced.length < 5) return [];

    // Median filter to kill single-frame octave jumps.
    const hz = voiced.map(f => f.hz);
    const med = [];
    for (let i = 0; i < hz.length; i++) {
      const w = hz.slice(Math.max(0, i - 2), i + 3).slice().sort((a, b) => a - b);
      med.push(w[Math.floor(w.length / 2)]);
    }

    // Drop outliers more than an octave from the median of the whole run.
    const all = med.slice().sort((a, b) => a - b);
    const centre = all[Math.floor(all.length / 2)];
    const kept = [];
    for (let i = 0; i < med.length; i++) {
      if (med[i] > centre / 2 && med[i] < centre * 2) {
        kept.push({ t: voiced[i].t, hz: med[i], rms: voiced[i].rms });
      }
    }
    return kept;
  }

  // A speaker's whole tonal range, in semitones. Mapping onto a fixed span
  // rather than onto each utterance's own min/max is what makes the amplitude
  // meaningful: a flat tone 1 stays flat instead of having its natural wobble
  // stretched to fill the chart, and an under-articulated tone 4 correctly
  // reads as under-articulated rather than being rescaled into a perfect one.
  const REF_SPAN = 10;

  /** Resample to n points and place on the fixed 0..1 scale. */
  function normalise(contour, n) {
    n = n || 5;
    if (contour.length < 3) return null;

    const semis = contour.map(p => 12 * Math.log2(p.hz / 100));
    const centre = semis.reduce((s, v) => s + v, 0) / semis.length;
    const lo = Math.min(...semis), hi = Math.max(...semis);

    const out = [];
    for (let i = 0; i < n; i++) {
      const pos = (i / (n - 1)) * (semis.length - 1);
      const a = Math.floor(pos), b = Math.min(a + 1, semis.length - 1);
      const f = pos - a;
      const v = semis[a] * (1 - f) + semis[b] * f;
      out.push(Math.max(0, Math.min(1, (v - centre) / REF_SPAN + 0.5)));
    }
    return { points: out, range: REF_SPAN, lowHz: contour[0].hz, span: hi - lo };
  }

  /**
   * Compare a spoken contour against a target tone shape.
   * Both are 0..1 over the same time span, so this is a shape comparison.
   */
  function compare(userPoints, targetPoints) {
    const n = Math.min(userPoints.length, targetPoints.length);

    // Both series already sit on the same fixed semitone scale (see REF_SPAN),
    // so only the overall height needs removing — a high voice and a low voice
    // saying the same tone should score the same.
    const u = userPoints.slice(0, n), t = targetPoints.slice(0, n);
    const mean = a => a.reduce((s, v) => s + v, 0) / a.length;
    const mu = mean(u), mt = mean(t);
    const uc = u.map(v => v - mu), tc = t.map(v => v - mt);

    // Root-mean-square distance between the shapes.
    let sq = 0;
    for (let i = 0; i < n; i++) sq += (uc[i] - tc[i]) ** 2;
    const rms = Math.sqrt(sq / n);
    const shape = Math.max(0, 1 - rms / 0.42);

    // Direction agreement: does it rise/fall where it should?
    let agree = 0, steps = 0;
    for (let i = 1; i < n; i++) {
      const du = u[i] - u[i - 1], dt = t[i] - t[i - 1];
      if (Math.abs(dt) < 0.04) { agree += Math.abs(du) < 0.12 ? 1 : 0.35; }
      else if (Math.sign(du) === Math.sign(dt)) { agree += 1; }
      else if (Math.abs(du) < 0.05) { agree += 0.3; }
      steps++;
    }
    const direction = steps ? agree / steps : 0;

    const score = Math.round(100 * (0.55 * shape + 0.45 * direction));
    return { score: Math.max(0, Math.min(100, score)), shape, direction };
  }

  /** Which of the five tones does this contour look most like? */
  function classify(points) {
    const targets = Store.S.tones.tones;
    let best = null;
    targets.forEach(t => {
      const r = compare(points, t.contour);
      if (!best || r.score > best.score) best = { tone: t.tone, score: r.score, name: t.name };
    });
    return best;
  }

  function verdict(score) {
    if (score >= 82) return { text: 'Spot on!', mood: 'cheer', colour: 'var(--mint)' };
    if (score >= 65) return { text: 'Close — nearly there', mood: 'proud', colour: 'var(--amber)' };
    if (score >= 45) return { text: 'Getting there, try again', mood: 'think', colour: 'var(--amber-deep)' };
    return { text: 'Not quite — listen once more', mood: 'sad', colour: 'var(--bad)' };
  }

  async function supported() {
    return !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia &&
              (window.AudioContext || window.webkitAudioContext));
  }

  window.Pitch = {
    Recorder, detectF0, cleanContour, normalise, compare, classify, verdict, supported,
  };
})();
