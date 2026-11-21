"""注音導讀：照課本的注音做姨姨的聲音（每個字、每一句）。用 f5xpu 的 python 跑。
readjobs.json：[{key, hash, text, zy:[每個字的注音] 或 null}]；做好的 wav 放 wav/read/<hash>.wav，做過的跳過。"""
import sys, io, os, json, re
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8", line_buffering=True)
from pypinyin import pinyin, Style
from f5_tts.api import F5TTS
import f5_tts.infer.utils_infer as ui
import soundfile
HERE = os.path.dirname(os.path.abspath(__file__))
REF = os.path.join(HERE, "ref2.wav"); REF_TEXT = "小朋友你好！我們今天來玩喔。先吹長長的氣氣，嘴巴圓圓的。"
REF_DUR = soundfile.info(REF).duration
OUT = os.path.join(HERE, "wav", "read"); os.makedirs(OUT, exist_ok=True)
HZ = lambda t: sum(1 for c in t if "一" <= c <= "鿿")

# 注音 → 模型用的拼音（ㄕㄚ → sha1，˙ㄌㄜ → le）
ZY2PY = {}
for cp in range(0x4E00, 0xA000):
    c = chr(cp)
    for z, p in zip(pinyin(c, style=Style.BOPOMOFO, heteronym=True)[0], pinyin(c, style=Style.TONE3, heteronym=True)[0]):
        if z != c: ZY2PY.setdefault(z, p)
def zy2py(z):
    if z in ZY2PY: return ZY2PY[z]
    if z.startswith("˙") and z[1:] in ZY2PY: return re.sub(r"\d$", "", ZY2PY[z[1:]])
    for t in "ˊˇˋ":                       # 有些輕聲寫在後面
        if z.endswith("˙") and z[:-1] + t in ZY2PY: return re.sub(r"\d$", "", ZY2PY[z[:-1] + t])
    raise KeyError(z)

FORCE = None   # 這一段每個字要用的拼音
_orig = ui.convert_char_to_pinyin
def _pinyin(text_list, polyphone=True):
    out = _orig(text_list, polyphone)
    if FORCE:
        for toks in out:
            # 模型把「參考錄音的文字＋要念的字」接在一起轉，要念的字在最後面
            idx = [n for n, t in enumerate(toks) if t.strip() and t not in "，。！？、…；：「」"]
            if len(idx) >= len(FORCE):
                for n, py in zip(idx[-len(FORCE):], FORCE): toks[n] = py
                print("  forced", [toks[n] for n in idx[-len(FORCE):]])
    return out
ui.convert_char_to_pinyin = _pinyin

def duration(text):
    n = HZ(text)
    if n <= 2: return REF_DUR + 0.5 + 0.45 * n
    return REF_DUR + 0.3 + n / 3.5 + 0.15 * len(re.findall(r"[，、。！？]", text[:-1]))

jobs = json.load(io.open(os.path.join(HERE, "readjobs.json"), encoding="utf-8"))
f5 = F5TTS(device="xpu")
for i, j in enumerate(jobs):
    path = os.path.join(OUT, j["hash"] + ".wav")
    if os.path.exists(path): continue
    text = re.sub(r"[…]+", "。", j["text"])
    if HZ(text) == 1: text += "。"
    if not re.search(r"[。！？]$", text): text = re.sub(r"[，、]$", "", text) + "。"
    FORCE = [zy2py(z) for z in j["zy"]] if j["zy"] else None
    f5.infer(ref_file=REF, ref_text=REF_TEXT, gen_text=text, file_wave=path, nfe_step=16, speed=0.8,
             show_info=lambda *a: None, fix_duration=duration(text))
    print(i, len(jobs), j["key"], text, FORCE)
print("DONE")
