"""重做 keys 檔裡的語音：產生 → 轉 mp3 → 語音辨識檢查，沒過的再做，最多 5 輪。
用法：python fixloop.py keys.json"""
import sys, io, os, json, re, subprocess, hashlib, shutil
import numpy as np, sherpa_onnx, imageio_ffmpeg
from pypinyin import lazy_pinyin
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8", line_buffering=True)
HERE = os.path.dirname(os.path.abspath(__file__))
PY = os.path.join(HERE, "..", "f5xpu", "Scripts", "python.exe")
DST = r"G:\我的雲端硬碟\注音\sounds\tts"
A = r"G:\我的雲端硬碟\發音課\練習App\source\assets\asr"
FF = imageio_ffmpeg.get_ffmpeg_exe()
jobs = json.load(io.open(os.path.join(HERE, "jobs.json"), encoding="utf-8"))
H = json.load(io.open(os.path.join(HERE, "hash.json"), encoding="utf-8"))
rec = sherpa_onnx.OfflineRecognizer.from_paraformer(paraformer=A + r"\model.int8.onnx", tokens=A + r"\tokens.txt", num_threads=8)
AF = ("atempo=1.15,silenceremove=start_periods=1:start_threshold=-45dB,areverse,"
      "silenceremove=start_periods=1:start_threshold=-45dB,areverse,adelay=60,apad=pad_dur=0.12,loudnorm=I=-18:TP=-1.5")
han = lambda t: re.sub(r"[^\u4e00-\u9fff]", "", t)
wav = lambda k: os.path.join(HERE, "wav", hashlib.md5(k.encode()).hexdigest()[:12] + ".wav")

def recog(path):
    pcm = subprocess.run([FF, "-loglevel", "error", "-i", path, "-f", "s16le", "-ac", "1", "-ar", "16000", "-"], capture_output=True).stdout
    x = np.frombuffer(pcm, np.int16).astype(np.float32) / 32768
    st = rec.create_stream(); st.accept_waveform(16000, x); rec.decode_stream(st)
    return st.result.text

def ok(k, txt):
    want, got = lazy_pinyin(han(jobs[k])), lazy_pinyin(han(txt))
    if len(want) < 2: return True
    return len(got) >= len(want) and want[-1] in got[-2:]

keys = json.load(io.open(sys.argv[1], encoding="utf-8"))
best = {}
for rnd in range(1, 6):
    if rnd > 1 or "--fresh" in sys.argv:
        for k in keys:
            if os.path.exists(wav(k)): os.remove(wav(k))
    json.dump(keys, io.open(os.path.join(HERE, "todo.json"), "w", encoding="utf-8"), ensure_ascii=False)
    subprocess.run([PY, "-I", os.path.join(HERE, "f5gen.py"), os.path.join(HERE, "todo.json")])
    still = []
    for k in keys:
        if not os.path.exists(wav(k)): still.append(k); continue
        tmp = os.path.join(HERE, "tmp.mp3")
        subprocess.run([FF, "-y", "-loglevel", "error", "-i", wav(k), "-af", AF, "-ac", "1", "-ar", "24000", "-b:a", "32k", tmp], check=True)
        txt = recog(tmp)
        if ok(k, txt):
            shutil.copyfile(tmp, os.path.join(DST, H[k] + ".mp3"))
        else:
            still.append(k); print(f"round {rnd} still bad: {k} | {txt}")
    print(f"round {rnd}: fixed {len(keys) - len(still)}, left {len(still)}")
    keys = still
    if not keys: break
json.dump(keys, io.open(os.path.join(HERE, "left.json"), "w", encoding="utf-8"), ensure_ascii=False)
print("LEFT", keys)
