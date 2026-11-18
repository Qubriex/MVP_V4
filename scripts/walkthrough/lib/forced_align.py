"""Offline forced alignment of the voice-over to the script (pocketsphinx):
prints a JSON list with the start time (s) of each script line.
  python -I forced_align.py voice.wav lines.json
Needs: pip install pocketsphinx (ships its own English model; no network)."""
import json, re, subprocess, sys
from pocketsphinx import Decoder

EXTRA = {  # words the dictionary lacks, as the voice says them
    'crore': 'K R AO R', 'lakh': 'L AA K', 'priya': 'P R IY Y AA', 'andhra': 'AA N D R AH',
    'aicte': 'EY AY S IY T IY IY', 'qubirex': 'K Y UW B IY R EH K S'}
ONES = 'zero one two three four five six seven eight nine ten eleven twelve thirteen fourteen fifteen sixteen seventeen eighteen nineteen'.split()
TENS = 'x x twenty thirty forty fifty sixty seventy eighty ninety'.split()

def say_int(n):
    if n < 20: return ONES[n]
    if n < 100: return TENS[n // 10] + ('' if n % 10 == 0 else ' ' + ONES[n % 10])
    if n < 1000: return ONES[n // 100] + ' hundred' + ('' if n % 100 == 0 else ' ' + say_int(n % 100))
    return str(n)

def say_num(m):
    whole, _, frac = m.group(1).partition('.')
    out = say_int(int(whole)) + (' point ' + ' '.join(ONES[int(d)] for d in frac) if frac else '')
    return ' ' + out + (' percent' if m.group(2) else '') + ' '

def words(t):
    t = re.sub(r'(\d+(?:\.\d+)?)(%?)', say_num, t)
    return [w for w in re.sub(r"[^a-z' ]+", ' ', t.lower().replace('-', ' ')).split() if w]

def main(wav, lines_file):
    lines = json.load(open(lines_file))
    seq = [(w, i) for i, l in enumerate(lines) for w in words(l)]
    raw = subprocess.run(['ffmpeg', '-v', 'error', '-i', wav, '-ac', '1', '-ar', '16000', '-f', 's16le', '-'], capture_output=True, check=True).stdout
    d = Decoder(samprate=16000, bestpath=False)
    for w, ph in EXTRA.items():
        d.add_word(w, ph, True)
    d.set_align_text(' '.join(w for w, _ in seq))
    d.start_utt(); d.process_raw(raw, full_utt=True); d.end_utt()
    got = [s for s in d.seg() if s.word not in ('<s>', '</s>', '<sil>', '(NULL)')]
    starts = [None] * len(lines)
    timed = []
    j = 0
    for s in got:
        w = re.sub(r'\(\d+\)$', '', s.word)
        while j < len(seq) and seq[j][0] != w:
            j += 1
        if j >= len(seq):
            break
        li = seq[j][1]
        if starts[li] is None:
            starts[li] = round(s.start_frame / 100, 2)
        timed.append({'w': w, 'line': li, 'start': round(s.start_frame / 100, 2), 'end': round((s.end_frame + 1) / 100, 2)})
        j += 1
    print(json.dumps({'starts': starts, 'aligned_words': len(got), 'script_words': len(seq), 'words': timed}))

if __name__ == '__main__':
    main(sys.argv[1], sys.argv[2])
