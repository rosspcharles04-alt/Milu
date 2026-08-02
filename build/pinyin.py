# -*- coding: utf-8 -*-
"""Split tone-marked pinyin into syllables and read the tone off each one.

Needed so the app can show pinyin character-by-character (ruby style, the way
Ross's Transportation deck does it) and so the tone trainer knows which tone
each syllable carries.
"""
import re

TONE_MAP = {
    'ā': ('a', 1), 'á': ('a', 2), 'ǎ': ('a', 3), 'à': ('a', 4),
    'ē': ('e', 1), 'é': ('e', 2), 'ě': ('e', 3), 'è': ('e', 4),
    'ī': ('i', 1), 'í': ('i', 2), 'ǐ': ('i', 3), 'ì': ('i', 4),
    'ō': ('o', 1), 'ó': ('o', 2), 'ǒ': ('o', 3), 'ò': ('o', 4),
    'ū': ('u', 1), 'ú': ('u', 2), 'ǔ': ('u', 3), 'ù': ('u', 4),
    'ǖ': ('ü', 1), 'ǘ': ('ü', 2), 'ǚ': ('ü', 3), 'ǜ': ('ü', 4),
    'ń': ('n', 2), 'ň': ('n', 3), 'ǹ': ('n', 4),
    'ḿ': ('m', 2),
}

INITIALS = ['zh', 'ch', 'sh', 'b', 'p', 'm', 'f', 'd', 't', 'n', 'l',
            'g', 'k', 'h', 'j', 'q', 'x', 'r', 'z', 'c', 's', 'y', 'w']

# 'ue' is included because ü loses its umlaut after j/q/x/y (yuē, xué, juéde).
FINALS = ['iang', 'iong', 'uang', 'ueng', 'üan',
          'uai', 'uan', 'ian', 'iao', 'ing', 'ong', 'eng', 'ang', 'iu',
          'ai', 'ei', 'ao', 'ou', 'an', 'en', 'er', 'ia', 'ie', 'in',
          'ua', 'uo', 'ui', 'un', 'ün', 'üe', 'ue', 'io',
          'a', 'o', 'e', 'i', 'u', 'ü', 'n', 'm', 'r']
FINALS.sort(key=len, reverse=True)

# Syllables that exist with no initial at all.
_STANDALONE = set(FINALS)


def strip_tones(text):
    """Return (plain_text, {index: tone}) with tone marks removed."""
    plain, tones = [], {}
    for ch in text:
        low = ch.lower()
        if low in TONE_MAP:
            base, tone = TONE_MAP[low]
            if ch.isupper():
                base = base.upper()
            tones[len(plain)] = tone
            plain.append(base)
        else:
            plain.append(ch)
    return ''.join(plain), tones


def _split_run(run):
    """Split a run of plain pinyin letters into syllables. Greedy-longest with
    backtracking, which matches how pinyin is written (apostrophes handle the
    genuinely ambiguous cases)."""
    low = run.lower()
    n = len(low)
    memo = {}

    def solve(i):
        if i == n:
            return []
        if i in memo:
            return memo[i]
        candidates = []
        for ini in [''] + INITIALS:
            if ini and not low.startswith(ini, i):
                continue
            j = i + len(ini)
            for fin in FINALS:
                if not low.startswith(fin, j):
                    continue
                if not ini and fin not in _STANDALONE:
                    continue
                if ini and fin in ('n', 'm', 'r'):
                    continue  # an initial needs a real vowel after it
                candidates.append(j + len(fin))
        # longest syllable first
        for end in sorted(set(candidates), reverse=True):
            # an 'r' suffix left dangling gets absorbed into this syllable
            if end < n and low[end] == 'r' and (end + 1 == n or low[end + 1] not in 'aeiouü'):
                rest = solve(end + 1)
                if rest is not None:
                    memo[i] = [(i, end + 1)] + rest
                    return memo[i]
            rest = solve(end)
            if rest is not None:
                memo[i] = [(i, end)] + rest
                return memo[i]
        memo[i] = None
        return None

    result = solve(0)
    if result is None:
        return [(0, n)]  # not parseable — keep it whole rather than mangling it
    return result


def syllables(pinyin):
    """Split tone-marked pinyin into [(syllable_with_marks, tone), ...]."""
    plain, tones = strip_tones(pinyin)
    out = []
    for m in re.finditer(r"[A-Za-zü]+", plain):
        start, end = m.start(), m.end()
        run = plain[start:end]
        if not re.fullmatch(r"[A-Za-zü]+", run) or len(run) == 0:
            continue
        for (a, b) in _split_run(run):
            s_start, s_end = start + a, start + b
            tone = 5
            for idx in range(s_start, s_end):
                if idx in tones:
                    tone = tones[idx]
                    break
            out.append((pinyin[s_start:s_end], tone))
    return out


def tone_list(pinyin):
    return [t for _, t in syllables(pinyin)]


def align(hanzi, pinyin):
    """Pair each written character with its syllable. Returns a list of
    {"c": char, "p": syllable, "t": tone}. Latin letters count as units too, so
    'T恤' lines up with 'T xù'. If the counts still disagree the pinyin is
    dropped rather than shown against the wrong character."""
    chars = [c for c in hanzi if is_cjk(c) or c.isalpha()]
    syls = syllables(pinyin)

    # Erhua: 儿 has no syllable of its own, it just adds -r to the one before.
    if len(chars) == len(syls) + 1 and chars[-1] == '儿' and syls and syls[-1][0].endswith('r'):
        last, tone = syls[-1]
        syls = syls[:-1] + [(last[:-1], tone), ('r', 5)]

    if len(chars) != len(syls):
        return [{"c": c, "p": "", "t": 0} for c in chars]
    return [{"c": c, "p": s, "t": t} for c, (s, t) in zip(chars, syls)]


def is_cjk(ch):
    o = ord(ch)
    return 0x4E00 <= o <= 0x9FFF or 0x3400 <= o <= 0x4DBF


if __name__ == "__main__":
    tests = ["nǐ hǎo", "xǐhuan", "niúzǎikù", "gōngchéngshī", "Àodàlìyà",
             "zěnmeyàng", "xīngqī'èr", "yìdiǎnr", "nǎr", "lǜchá", "bīngqílín",
             "wǒ", "hěn gāoxìng rènshi nǐ", "T xù", "mápó dòufu", "dì-yī",
             "gōngjiāochē", "wǎngyuēchē", "jiāotōngkǎ", "xiǎolóngbāo",
             "Yìdàlìmiàn", "zhēnzhū nǎichá", "duìbuqǐ", "shuìjiào", "yìqǐ"]
    for t in tests:
        print(f"{t:28} -> {syllables(t)}")
