"""注音樂園：用姨姨的聲音（F5-TTS 複製）做語音。Intel Arc (xpu)。做過的會跳過。
用法：f5gen.py [只做這些 key 的 keys.json]"""
import sys, io, os, json, re, time, hashlib
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8", line_buffering=True)
from f5_tts.api import F5TTS
import soundfile
HERE = os.path.dirname(os.path.abspath(__file__))
REF = os.path.join(HERE, "ref2.wav")
REF_TEXT = "小朋友你好！我們今天來玩喔。先吹長長的氣氣，嘴巴圓圓的。"
SPEED, NFE, PACE = 0.8, 16, 3.5
EXTRA = float(os.environ.get("EXTRA", "0"))   # 額外多給的秒數（尾巴被切掉時用）
REF_DUR = soundfile.info(REF).duration
jobs = json.load(io.open(os.path.join(HERE, "jobs.json"), encoding="utf-8"))
only = json.load(io.open(sys.argv[1], encoding="utf-8")) if len(sys.argv) > 1 else list(jobs)
OUT = os.path.join(HERE, "wav"); os.makedirs(OUT, exist_ok=True)
def wavname(k): return hashlib.md5(k.encode()).hexdigest()[:12] + ".wav"
HZ = lambda t: sum(1 for c in t if "一" <= c <= "鿿")
PUNCT = r"[，、。！？]"
MAXP = 12
def pieces(text):
    parts = [x for x in re.findall(r"[^，、。！？]+[，、。！？]*", text) if x]
    out = []
    for x in parts:
        if out and HZ(out[-1]) + HZ(x) <= MAXP and not re.search(r"[。！？]$", out[-1]): out[-1] += x
        else: out.append(x)
    return out
def duration(text):
    n = HZ(text)
    if n <= 2: return REF_DUR + 0.5 + 0.45 * n + EXTRA
    d = REF_DUR + 0.3 + n / PACE + 0.15 * len(re.findall(PUNCT, text[:-1]))
    # 「汽車的汽」：最後一個字常被吃掉，多給時間
    if re.fullmatch(r".+的.。?", text): d += 0.55
    if re.fullmatch(r".+的，.。", text): d += 0.45   # 「的」後面停一下
    return d + EXTRA
f5 = F5TTS(device="xpu")
# 破音字：單獨念的最後一個字讀音要指定（「茄」會被念成 jia1）
WORD_READING = {"蛤蜊": ["ge3", "li4"]}   # 台灣念法，模型沒有同音字可用
LAST_READING = {"番茄的，茄。": "qie2", "茄子的，茄。": "qie2", "干杯的，干。": "gan1"}
import f5_tts.infer.utils_infer as _ui
_orig_pinyin = _ui.convert_char_to_pinyin
def _pinyin(text_list, polyphone=True):
    out = _orig_pinyin(text_list, polyphone)
    for src, toks in zip(text_list, out):
        # 指定整個詞的讀音（蛤蜊 ㄍㄜˇ ㄌㄧˋ），「蛤蜊的，蛤。」最後那個字也一起改
        han_idx = [n for n, t in enumerate(toks) if t.strip() and t not in "，。！？、"]
        chars = [c for c in src if "一" <= c <= "鿿"]
        for w, pys in WORD_READING.items():
            for i in range(len(chars) - len(w) + 1):
                if "".join(chars[i:i + len(w)]) == w and len(han_idx) == len(chars):
                    for j, py in enumerate(pys): toks[han_idx[i + j]] = py
            m = re.fullmatch(r"(.+)的，(.)。", src)
            if m and w in m.group(1) and m.group(2) in w and len(han_idx) == len(chars):
                toks[han_idx[-1]] = pys[w.index(m.group(2))]
        for k, py in LAST_READING.items():
            if src.endswith(k):
                i = max(n for n, t in enumerate(toks) if t.strip() and t[-1].isdigit())
                toks[i] = py
    return out
_ui.convert_char_to_pinyin = _pinyin
def synth(text, path):
    import numpy as np
    if HZ(text) <= MAXP:
        f5.infer(ref_file=REF, ref_text=REF_TEXT, gen_text=text, file_wave=path, nfe_step=NFE, speed=SPEED,
                 show_info=lambda *a: None, fix_duration=duration(text))
        return
    segs, sr = [], 24000
    for x in pieces(text):
        wav, sr, _ = f5.infer(ref_file=REF, ref_text=REF_TEXT, gen_text=x, nfe_step=NFE, speed=SPEED,
                              show_info=lambda *a: None, fix_duration=duration(x))
        segs += [wav, np.zeros(int(sr * (0.3 if re.search(r"[。！？]$", x) else 0.12)), dtype=wav.dtype)]
    soundfile.write(path, np.concatenate(segs[:-1]), sr)
todo = [k for k in only if not os.path.exists(os.path.join(OUT, wavname(k)))]
print("todo", len(todo))
t0 = time.time()
for i, k in enumerate(todo):
    text = jobs[k]
    if not re.search(r"[。！？]$", text) and (HZ(text) == 1 or re.fullmatch(r".+的.", text)): text += "。"
    try:
        synth(text, os.path.join(OUT, wavname(k)))
    except Exception as e:
        print("ERR", k, e)
    if i % 10 == 0: print(f"{i}/{len(todo)} {time.time() - t0:.0f}s {text}")
print("DONE", len(todo), f"{time.time() - t0:.0f}s")
