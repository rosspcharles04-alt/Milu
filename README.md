# Mílù 麋鹿

A Chinese learning app for your phone, built around the vocabulary from Ross's
tutor lessons.

麋鹿 (mílù) is Père David's deer — the "四不像", *four-not-like*, from the
animals lesson: head of a horse, antlers of a deer, hooves of an ox, tail of a
donkey. It went extinct in China and was brought back from Europe.

**→ [SETUP.md](SETUP.md) for how to get it on your home screen.**
**→ [NEXT-STEPS.md](NEXT-STEPS.md) for what's done and what's worth building next.**

## What's in it

**490 words** — everything extracted from the eleven lesson decks, plus HSK 1
and HSK 2 core vocabulary and a spread of Chinese and Australian food.
**540 characters** with full stroke-order data. Ten dialogues and twelve
sentence patterns, all taken from the lessons.

## What it does

| | |
|---|---|
| **Today** | Daily XP goal, streak, level, the learning path, and mistakes to fix |
| **Study** | The eleven lessons as browsable decks, the dialogues with a role-play mode, and the grammar patterns |
| **Practice** | Match-up game, four quiz directions, tone training, speaking, sentence building, writing |
| **Hanzi** | Every character: stroke-order animation, finger tracing, and what it's built from |
| **Me** | Level, achievements, progress, family leaderboard, settings, importing new decks |

### The parts worth knowing about

**Lessons mix exercise types.** A word isn't drilled the same way twice. There
are nine exercise types and `Exercises.pick()` chooses one based on how well you
know that word: recognise it (pick the meaning, pick what you heard), then
recall it (pick the characters, identify the tone), then produce it (type the
pinyin, write the character, say it aloud). Production exercises are flagged
"harder" and pay bonus XP. Nothing repeats back to back.

**Hearts, XP and combos.** Five mistakes per lesson, a daily XP goal that keeps
the streak alive, a combo bonus for runs of correct answers, sixteen
achievements, and levels. Hearts can be switched off in settings if they annoy
you.

**Pinyin fades out.** New words show pinyin above the characters. Once you've
got a word right three times running it disappears, so you drift onto reading
characters without ever hitting a wall. Tap to bring it back. Switchable in
settings.

**Tones get taught properly.** The five shapes, an ear test, and the four
sandhi rules — including why 你好 is *said* ní hǎo though it's *written*
nǐ hǎo.

**Speaking is measured, not guessed.** Hold the mic and say the word. The app
tracks your pitch, converts it to semitones, and compares the shape against
what that tone should look like — drawn on screen against the target. It scores
the shape, not your accent, and works with any voice, high or low. All of it
runs on the phone. Alongside that, iOS's speech recogniser confirms you said
the right word (that part needs a connection).

**Spaced repetition.** An SM-2 variant. Cards you find hard come back sooner;
ones you know drift out to weeks. The grade buttons show you when each choice
brings the card back.

**Import your next lesson.** Point it at a .pptx from your tutor and it reads
the slides, pulls out the character/pinyin/English triples, and shows you what
it found to correct before anything is added. It handles all the layouts the
existing decks use, including the one where pinyin sits above each character
individually. Words locked inside images can't be read — paste those in
instead.

## Offline

After the first load everything is cached: the word list, stroke data, all the
code. It works in aeroplane mode. Only two things need a connection — the
leaderboard, and the "did I say the right word" check.

Progress lives in `localStorage` on the device. Nothing is uploaded unless you
switch the leaderboard on.

## Layout

```
index.html          shell + script order
sw.js               service worker (bump VERSION on deploy)
css/style.css       design system
js/
  config.js         ← your Firebase URL goes here
  store.js          state, persistence, loading
  srs.js            spaced repetition scheduler
  audio.js          speech + sound effects
  pitch.js          F0 tracking and tone contour comparison
  speech.js         speech recognition wrapper
  hanzi.js          stroke rendering on hanzi-writer
  pptx.js           in-browser .pptx reader
  cloud.js          leaderboard over Firebase REST
  ui.js, mascot.js  shared rendering, the deer
  app.js            router
  views/            one file per screen
data/               generated — see below
build/              generators (Python 3, no dependencies but Pillow)
```

## Rebuilding the data

The word lists live in `build/source_*.py` as plain Python lists. Edit those,
then:

```bash
python3 build/build_data.py
```

That rewrites everything in `data/`, splits the pinyin into per-character
syllables with tone numbers, and downloads stroke data for any new characters
(cached in `build/.stroke_cache`, so it's only slow the first time).

Icons:

```bash
python3 build/make_icons.py
```

## Adding real recorded audio later

The app speaks through the phone's Mandarin voice. To replace that with
studio-recorded or higher-quality TTS clips, drop MP3s into `audio/` and add an
`audio/index.json` mapping:

```json
{ "你好": "nihao.mp3", "火锅": "huoguo.mp3" }
```

`audio.js` checks for a clip before falling back to the device voice, so
nothing else has to change — and any word without a clip still speaks.

## Credits

Stroke-order data and the writer come from
[hanzi-writer](https://github.com/chanind/hanzi-writer) (MIT), whose data
derives from [Make Me a Hanzi](https://github.com/skishore/makemeahanzi)
(Arphic Public License).

Everything else is dependency-free vanilla JavaScript — no build step, no
framework, no npm.
