# Mílù — what's done, what's next

Paste any unticked item below into Claude (Chrome, or Claude Code in this
folder) and it has enough context to do the work without re-reading everything.

**Repo layout is in [README.md](README.md). Deploy steps are in [SETUP.md](SETUP.md).**
After any change: bump `VERSION` in `sw.js` (currently `milu-v2`) or phones keep
serving the cached old copy.

---

## ✅ Done in this round

- [x] **Characters fit their containers.** `UI.hanziSize(n)` scales font size
      from word length, so 很高兴认识你 (6 chars) shrinks to fit instead of
      overflowing. Verified on 320px and 375px viewports — no horizontal scroll
      on any of 24 routes.
- [x] **Han voice preferred.** `audio.js` ranks voices by quality
      (Premium > Enhanced > Standard > Compact) then by name, with `Han` first.
      Settings stores `voiceName` as well as `voiceURI`, so the choice survives
      iOS updates and works on your sister's phone too. Me → Voice shows the
      quality of each and tells you how to install Han if it's missing.
- [x] **Mixed-exercise lessons** (the big one). `js/exercises.js` has 9 exercise
      types; `Exercises.pick()` chooses per word by how well it's known —
      recognise → recall → produce. No two of the same type in a row.
- [x] **Hearts, XP, levels, combos, daily XP goal** — `js/gamify.js`.
- [x] **Match Madness game** — `js/views/match.js`, 60-second timed pair matching.
- [x] **Mistakes review** — every wrong answer is logged and can be drilled from
      Today or Practice (`#/session/mistakes`).
- [x] **Learning path on Today** — zig-zag node path with crowns per lesson.
- [x] **16 achievements** with unlock toasts.

---

## 🔜 Next up — highest value first

### 1. Real audio for the top 150 words
The device voice is decent, but recorded or studio-TTS audio is a step change,
and the plumbing already exists.

> Generate MP3s for the 150 most common words in `data/vocab.json` using a
> high-quality Mandarin TTS. Save them to `milu/audio/` and write
> `milu/audio/index.json` mapping hanzi → filename, e.g.
> `{"你好":"nihao.mp3"}`. `js/audio.js` `speak()` already checks for clips
> before falling back to the device voice, so no other code changes. Add the
> audio files to the `ASSETS` list in `sw.js` and bump `VERSION`.

### 2. Grammar notes attached to lessons
HelloChinese puts a short grammar explainer at the start of each unit. We have
12 sentence patterns but they aren't tied into lessons.

> In `build/source_sentences.py`, add a `notes` field to each lesson in
> `LESSONS` (in `build/source_decks.py`) with 2–3 short grammar points. Surface
> them in `js/views/study.js` `Views.lesson` as a collapsible card at the top,
> and show one relevant note on the lesson-complete screen in
> `js/views/session.js`.

### 3. Listening to whole sentences, not just words
Right now only single words are drilled. Duolingo's most effective exercise is
"tap what you hear" on a full sentence.

> Add a `listen_sentence` exercise to `js/exercises.js`: play a dialogue line
> from `data/dialogues.json`, show the word tiles shuffled (reuse `segment()`
> from `js/views/sentences.js`), and have the learner rebuild it. Register it in
> `KINDS`, add it to the strength-2 and strength-3 pools in `pick()`, and gate
> it with `supported()` so it only fires when a dialogue line exists.

### 4. Unit tests for the scheduler and pitch maths
There are no automated tests — everything was verified by hand in the browser.

> Add `milu/test/test.html` that runs assertions in the browser with no
> framework: SRS interval progression (`SRS.schedule` across grades 0–3),
> `Import.units()` alignment on all 490 words, `Pitch.compare` confusion matrix
> (correct tone must beat all others), and `Exercises.plainPinyin` normalisation.
> Print pass/fail to the page.

### 5. Speaking: whole-sentence practice
> Extend `js/views/speak.js` to accept dialogue lines, not just vocabulary.
> Build the target contour by concatenating each word's tones (the
> `targetContour` function already handles multi-syllable), and let the learner
> record a full sentence with per-word scoring.

---

## 🎨 Polish

- [ ] **Path is a bit sparse.** Add a small progress ring around each
      `.path__dot` in `js/views/today.js` showing the lesson's completion, and
      dim locked lessons more clearly.
- [ ] **Streak freeze.** Duolingo lets you miss one day without losing the
      streak. Add a `freezes` count to `Store.S.stats`, earn one every 10 days,
      and spend it automatically in `Store.touchStreak()`.
- [ ] **Lesson-complete screen could show what was learned** — list the new
      words introduced in that lesson, not just the ones got wrong.
- [ ] **Haptics on iOS.** `navigator.vibrate` does nothing on iPhone. Consider
      the `<input switch>` trick or just drop the setting on iOS and say so.
- [ ] **Dark mode contrast** on `.path__dot--locked` and `.badge--locked` is a
      little low — check both in dark mode and lift if needed.

---

## 🐛 Known limitations

- **Word check while speaking needs internet** (iOS speech recognition is
  server-backed). Tone analysis is fully offline. This is stated in the UI.
- **.pptx import needs iOS 16.4+** for `DecompressionStream`. Paste-a-list is
  the fallback.
- **Words locked inside slide images can't be imported** — that's why the
  cooking-method vocabulary from decks 11.13/11.27 isn't in the app.
- **Leaderboard family codes are guessable.** Anyone who knew your code could
  read or write that board. Fine for two siblings; don't put anything sensitive
  in a name.
- **HSK lists are HSK 2.0** (150 + 150). The newer HSK 3.0 has different
  bandings if that ever matters.

---

## Rebuilding data

Word lists live in `build/source_decks.py` and `build/source_hsk.py`.

```bash
python3 build/build_data.py    # rewrites data/, fetches any new stroke data
python3 build/make_icons.py    # regenerates icons/
```

## Testing locally

```bash
python3 -m http.server 8777 --directory milu
```

Then open `http://localhost:8777`. If changes don't appear, the service worker
is serving its cache — open DevTools → Application → Service Workers →
Unregister, or bump `VERSION` in `sw.js`.
