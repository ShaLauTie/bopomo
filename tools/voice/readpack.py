"""注音導讀：wav/read/*.wav → sounds/tts/<hash>.mp3，用語音辨識檢查，再把 hash 加進 tts-manifest.js。
用法：python readpack.py  （印出沒過的，存在 readbad.json）"""
import sys, io, os, json, re, subprocess
import numpy as np, sherpa_onnx, imageio_ffmpeg
from pypinyin import pinyin, Style
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8", line_buffering=True)
HERE = os.path.dirname(os.path.abspath(__file__))
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
jobs = json.load(io.open(os.path.join(HERE, "readjobs.json"), encoding="utf-8"))
bad, done = [], []
for j in jobs:
    wav = os.path.join(HERE, "wav", "read", j["hash"] + ".wav")
    if not os.path.exists(wav): bad.append(j["key"]); continue
    mp3 = os.path.join(GAME, "sounds", "tts", j["hash"] + ".mp3")
    r = subprocess.run([FF, "-y", "-loglevel", "error", "-i", wav, "-af", AF, "-ac", "1", "-ar", "24000", "-b:a", "32k", mp3])
    if r.returncode: bad.append(j["key"]); print("bad", j["key"], "| encode failed"); continue
    done.append(j["hash"])
    heard = asr(mp3)
    want, got = RN(j["text"]), RN(heard)
    if len(want) == 1: ok = bool(got) and any(want[0] & g for g in got)          # 單字：聽得出那個音
    else: ok = len(got) >= len(want) and bool(want[-1] & set().union(*got[-2:]))  # 句子：字數夠、最後一個字有念到
    if not ok: bad.append(j["key"]); print("bad", j["key"], "|", heard)
# 加進 tts-manifest.js
mf = os.path.join(GAME, "tts-manifest.js")
s = io.open(mf, encoding="utf-8").read()
have = set(re.findall(r'"([0-9a-f]{8})"', s))
allh = sorted(have | set(done))
s = re.sub(r"new Set\(\[.*?\]\)", "new Set([" + ",".join(f'"{h}"' for h in allh) + "])", s, flags=re.S)
io.open(mf, "w", encoding="utf-8", newline="").write(s)
json.dump(bad, io.open(os.path.join(HERE, "readbad.json"), "w", encoding="utf-8"), ensure_ascii=False)
print("packed", len(done), "bad", len(bad), "manifest", len(allh))
