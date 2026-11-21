"""注音導讀：readbad.json 裡沒過的，重做幾次，每次用語音辨識檢查，過了就換上。用 f5xpu 的 python 跑。"""
import sys, io, os, json, re, subprocess, shutil
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8", line_buffering=True)
import numpy as np, sherpa_onnx, imageio_ffmpeg
from pypinyin import pinyin, Style
HERE = os.path.dirname(os.path.abspath(__file__)); sys.path.insert(0, HERE)
GAME = r"G:\我的雲端硬碟\注音"
FF = imageio_ffmpeg.get_ffmpeg_exe(); A = r"G:\我的雲端硬碟\發音課\練習App\source\assets\asr"
rec = sherpa_onnx.OfflineRecognizer.from_paraformer(paraformer=A + r"\model.int8.onnx", tokens=A + r"\tokens.txt", num_threads=4)
AF = ("atempo=1.15,silenceremove=start_periods=1:start_threshold=-45dB,areverse,"
      "silenceremove=start_periods=1:start_threshold=-45dB,areverse,adelay=60,apad=pad_dur=0.12,loudnorm=I=-18:TP=-1.5")
han = lambda t: re.sub(r"[^\u4e00-\u9fff]", "", t)
RN = lambda t: [set(p) for p in pinyin(han(t), style=Style.NORMAL, heteronym=True)]
def asr(path):
    pcm = subprocess.run([FF, "-loglevel", "error", "-i", path, "-f", "s16le", "-ac", "1", "-ar", "16000", "-"], capture_output=True).stdout
    x = np.frombuffer(pcm, np.int16).astype(np.float32) / 32768
    x = np.concatenate([np.zeros(3200, np.float32), x, np.zeros(4800, np.float32)])
    st = rec.create_stream(); st.accept_waveform(16000, x); rec.decode_stream(st); return st.result.text
def check(text, heard):
    want, got = RN(text), RN(heard)
    if len(want) == 1: return bool(got) and any(want[0] & g for g in got), len(got)
    score = sum(1 for w in want if any(w & g for g in got))
    return len(got) >= len(want) and bool(want[-1] & set().union(*got[-2:])), score

# 借用 readgen 的模型設定（不跑它的主程式）
src = io.open(os.path.join(HERE, "readgen.py"), encoding="utf-8").read().split("jobs = json.load")[0].replace("sys.stdout = io.TextIOWrapper", "_ = (lambda *a, **k: None)")
G = {"__file__": os.path.join(HERE, "readgen.py"), "__name__": "readgen_lib"}; exec(src, G)
from f5_tts.api import F5TTS
f5 = F5TTS(device="xpu")

jobs = {j["key"]: j for j in json.load(io.open(os.path.join(HERE, "readjobs.json"), encoding="utf-8"))}
bad = json.load(io.open(os.path.join(HERE, os.environ.get("BAD", "readbad.json")), encoding="utf-8"))
TRY = os.path.join(HERE, "wav", "readtry"); os.makedirs(TRY, exist_ok=True)
still = []
for key in bad:
    j = jobs[key]
    text = re.sub(r"[…]+", "。", j["text"])
    if G["HZ"](text) == 1: text += "。"
    if not re.search(r"[。！？]$", text): text = re.sub(r"[，、]$", "", text) + "。"
    force = [G["zy2py"](z) for z in j["zy"]] if j["zy"] else None
    single = G["HZ"](text) == 1
    # 句子裡：句尾輕聲、疊字的第二個輕聲、「個」，模型會吃掉 → 用本來的聲調
    if force and not single and os.environ.get("NEUTRAL_FIX"):
        hz = han(j["text"]); cit = [p[0] for p in pinyin(hz, style=Style.TONE3)]
        for n, py in enumerate(force):
            if re.search(r"\d$", py): continue
            if n == len(force) - 1 or (n and hz[n] == hz[n - 1] and hz[n] not in "爸媽") or hz[n] == "個":
                c = cit[n] if re.search(r"\d$", cit[n]) else None
                if n and hz[n] == hz[n - 1]: c = force[n - 1]
                if c: force = force[:n] + [c] + force[n + 1:]
    best = None
    for k in range(5):
        f = force
        # 輕聲字單獨念模型會做成沒聲音：試兩次還不行就用本來的聲調
        if single and force and not re.search(r"\d$", force[0]) and k >= 2:
            f = [pinyin(han(text), style=Style.TONE3)[0][0]]
            if not re.search(r"\d$", f[0]): f = [f[0] + "1"]
        G["FORCE"] = f
        dur = G["duration"](text) + (0.35 * k if not single else 0.15 * k)
        wav = os.path.join(TRY, f"{j['hash']}_{k}.wav"); mp3 = wav[:-4] + ".mp3"
        f5.infer(ref_file=G["REF"], ref_text=G["REF_TEXT"], gen_text=text, file_wave=wav, nfe_step=16, speed=0.8,
                 show_info=lambda *a: None, fix_duration=dur, seed=1000 + k)
        if subprocess.run([FF, "-y", "-loglevel", "error", "-i", wav, "-af", AF, "-ac", "1", "-ar", "24000", "-b:a", "32k", mp3]).returncode:
            print("  try", k, "encode failed"); continue
        heard = asr(mp3); ok, score = check(j["text"], heard)
        print("  try", k, f, "|", heard, ok)
        if best is None or score > best[0]: best = (score, wav, mp3)
        if ok: best = (99, wav, mp3); break
    if best:
        shutil.copy(best[1], os.path.join(HERE, "wav", "read", j["hash"] + ".wav"))
        shutil.copy(best[2], os.path.join(GAME, "sounds", "tts", j["hash"] + ".mp3"))
    print("OK " if best and best[0] == 99 else "NO ", key, flush=True)
    if not best or best[0] != 99: still.append(key)
json.dump(still, io.open(os.path.join(HERE, "readstill.json"), "w", encoding="utf-8"), ensure_ascii=False)
print("DONE still", len(still))
