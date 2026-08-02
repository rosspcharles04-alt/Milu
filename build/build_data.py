# -*- coding: utf-8 -*-
"""Turn the source word lists into the JSON the app loads.

Run:  python3 build/build_data.py
Writes into ../data/ and downloads stroke-order data for every character used.
"""
import json
import os
import sys
import urllib.parse
import urllib.request
from concurrent.futures import ThreadPoolExecutor

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import pinyin as P
from source_decks import DECK_WORDS, FOOD_WORDS, LESSONS
from source_hsk import HSK1, HSK2
from source_sentences import DIALOGUES, PATTERNS, TONES, SANDHI_RULES, RADICALS

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
DATA = os.path.join(ROOT, "data")
CACHE = os.path.join(HERE, ".stroke_cache")
STROKE_URL = "https://raw.githubusercontent.com/chanind/hanzi-writer-data/master/data/{}.json"

os.makedirs(DATA, exist_ok=True)
os.makedirs(CACHE, exist_ok=True)


def build_vocab():
    words = {}          # hanzi -> record
    order_counter = [0]

    def add(hanzi, py, en, topic, lesson=None, hsk=0, group=9):
        if hanzi in words:
            rec = words[hanzi]
            if hsk and not rec["hsk"]:
                rec["hsk"] = hsk
            if lesson and lesson not in rec["lessons"]:
                rec["lessons"].append(lesson)
            rec["group"] = min(rec["group"], group)
            return
        units = P.align(hanzi, py)
        words[hanzi] = {
            "id": hanzi,
            "hanzi": hanzi,
            "pinyin": py,
            "english": en,
            "topic": topic,
            "lessons": [lesson] if lesson else [],
            "hsk": hsk,
            "group": group,
            "seq": order_counter[0],
            "units": units,
            "tones": [u["t"] for u in units if u["t"]],
            "chars": [u["c"] for u in units if P.is_cjk(u["c"])],
        }
        order_counter[0] += 1

    hsk1_set = {w[0] for w in HSK1}
    hsk2_set = {w[0] for w in HSK2}

    # Deck words first so their lesson tag and wording win on conflicts.
    for hanzi, py, en, topic, lesson in DECK_WORDS:
        hsk = 1 if hanzi in hsk1_set else (2 if hanzi in hsk2_set else 0)
        group = 0 if hanzi in hsk1_set else 1
        add(hanzi, py, en, topic, lesson, hsk, group)

    for hanzi, py, en, topic in HSK1:
        add(hanzi, py, en, topic, "hsk1", 1, 2)

    for hanzi, py, en, topic in FOOD_WORDS:
        add(hanzi, py, en, topic, "food", 0, 3)

    for hanzi, py, en, topic in HSK2:
        add(hanzi, py, en, topic, "hsk2", 2, 4)

    vocab = sorted(words.values(), key=lambda w: (w["group"], w["seq"]))
    for i, w in enumerate(vocab):
        w["order"] = i
        del w["seq"]
    return vocab


def build_sentences():
    dialogues = []
    for did, title, emoji, lesson, lines in DIALOGUES:
        dialogues.append({
            "id": did, "title": title, "emoji": emoji, "lesson": lesson,
            "lines": [
                {"speaker": sp, "hanzi": h, "pinyin": py, "english": en,
                 "units": P.align(h, py)}
                for sp, h, py, en in lines
            ],
        })

    patterns = []
    for pid, ph, pp, pe, lesson, note, examples in PATTERNS:
        patterns.append({
            "id": pid, "hanzi": ph, "pinyin": pp, "english": pe,
            "lesson": lesson, "note": note,
            "examples": [
                {"hanzi": h, "pinyin": py, "english": en, "units": P.align(h, py),
                 "words": segment(h)}
                for h, py, en in examples
            ],
        })
    return dialogues, patterns


# Longest-match segmentation so the sentence builder has sensible drag tiles.
_VOCAB_INDEX = set()


# Punctuation is never a tile — placing full stops is not a language skill.
PUNCT = set('，。！？、；：“”‘’〈〉《》（）,.!?;:\'"() \t')


def segment(hanzi):
    """Split a sentence into word-sized tiles using known vocabulary."""
    tiles, i = [], 0
    while i < len(hanzi):
        ch = hanzi[i]
        if not P.is_cjk(ch):
            if ch.strip() and ch not in PUNCT:
                tiles.append(ch)
            i += 1
            continue
        for length in range(min(4, len(hanzi) - i), 0, -1):
            chunk = hanzi[i:i + length]
            if chunk in _VOCAB_INDEX or length == 1:
                tiles.append(chunk)
                i += length
                break
    return tiles


def fetch_stroke(ch):
    safe = "".join(c for c in ch if c.isalnum() or P.is_cjk(c))
    path = os.path.join(CACHE, f"{ord(ch):05X}.json")
    if os.path.exists(path):
        with open(path, encoding="utf-8") as f:
            return ch, json.load(f)
    url = STROKE_URL.format(urllib.parse.quote(ch))
    try:
        with urllib.request.urlopen(url, timeout=30) as r:
            data = json.loads(r.read().decode("utf-8"))
        with open(path, "w", encoding="utf-8") as f:
            json.dump(data, f, ensure_ascii=False, separators=(",", ":"))
        return ch, data
    except Exception as e:
        print(f"   ! no stroke data for {ch}: {e}")
        return ch, None


def main():
    print("Building vocabulary…")
    vocab = build_vocab()
    _VOCAB_INDEX.update(w["hanzi"] for w in vocab)
    print(f"   {len(vocab)} unique words")

    by_group = {}
    for w in vocab:
        by_group[w["group"]] = by_group.get(w["group"], 0) + 1
    labels = {0: "deck+HSK1", 1: "deck only", 2: "HSK1 only", 3: "food", 4: "HSK2"}
    for g in sorted(by_group):
        print(f"      {labels.get(g, g):12} {by_group[g]}")

    dialogues, patterns = build_sentences()
    print(f"   {len(dialogues)} dialogues, {len(patterns)} sentence patterns")

    chars = sorted({c for w in vocab for c in w["chars"]} |
                   {c for d in dialogues for ln in d["lines"] for c in ln["hanzi"] if P.is_cjk(c)} |
                   {c for p in patterns for ex in p["examples"] for c in ex["hanzi"] if P.is_cjk(c)} |
                   {c for c in RADICALS if P.is_cjk(c)})
    print(f"   {len(chars)} unique characters")

    lessons = [{"id": i, "title": t, "chinese": c, "subtitle": s, "emoji": e, "order": o}
               for i, t, c, s, e, o in LESSONS]

    tones = [{"tone": n, "name": nm, "mark": mk, "desc": d, "example": ex, "contour": co}
             for n, nm, mk, d, ex, co in TONES]

    sandhi = [{"title": t, "rule": r, "explain": ex,
               "examples": [{"hanzi": h, "written": w, "spoken": s, "english": e}
                            for h, w, s, e in exs]}
              for t, r, ex, exs in SANDHI_RULES]

    radicals = {k: {"parts": v[0], "note": v[1]} for k, v in RADICALS.items()}

    def write(name, obj):
        path = os.path.join(DATA, name)
        with open(path, "w", encoding="utf-8") as f:
            json.dump(obj, f, ensure_ascii=False, separators=(",", ":"))
        print(f"   wrote {name}  ({os.path.getsize(path)/1024:.0f} KB)")

    write("vocab.json", vocab)
    write("lessons.json", lessons)
    write("dialogues.json", dialogues)
    write("patterns.json", patterns)
    write("tones.json", {"tones": tones, "sandhi": sandhi})
    write("radicals.json", radicals)

    print(f"Fetching stroke data for {len(chars)} characters…")
    strokes = {}
    with ThreadPoolExecutor(max_workers=12) as pool:
        for ch, data in pool.map(fetch_stroke, chars):
            if data:
                # Keep only what hanzi-writer needs; drop the rest to save space.
                strokes[ch] = {"strokes": data["strokes"], "medians": data["medians"]}
    missing = [c for c in chars if c not in strokes]
    if missing:
        print(f"   missing: {''.join(missing)}")
    write("strokes.json", strokes)
    print(f"Done. {len(strokes)}/{len(chars)} characters have stroke data.")


if __name__ == "__main__":
    main()
