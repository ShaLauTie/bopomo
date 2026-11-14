import sys, io, os, json, re, hashlib, subprocess, numpy as np, sherpa_onnx, imageio_ffmpeg
from pypinyin import pinyin, lazy_pinyin, Style
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8")
FF = imageio_ffmpeg.get_ffmpeg_exe(); A = r"G:\我的雲端硬碟\發音課\練習App\source\assets\asr"
H = json.load(io.open("hash.json", encoding="utf-8")); jobs = json.load(io.open("jobs.json", encoding="utf-8"))
rec = sherpa_onnx.OfflineRecognizer.from_paraformer(paraformer=A + r"\model.int8.onnx", tokens=A + r"\tokens.txt", num_threads=8)
AF = ("atempo=1.15,silenceremove=start_periods=1:start_threshold=-45dB,areverse,"
      "silenceremove=start_periods=1:start_threshold=-45dB,areverse,adelay=60,apad=pad_dur=0.12,loudnorm=I=-18:TP=-1.5")
han = lambda t: re.sub(r"[^\u4e00-\u9fff]", "", t)
def readings(text):  # 每個字所有可能的念法（不分聲調），同音字和原字都算
    return [set(p) for p in pinyin(han(text), style=Style.NORMAL, heteronym=True)]
def recog(path):
    pcm = subprocess.run([FF, "-loglevel", "error", "-i", path, "-f", "s16le", "-ac", "1", "-ar", "16000", "-"], capture_output=True).stdout
    x = np.frombuffer(pcm, np.int16).astype(np.float32) / 32768
    st = rec.create_stream(); st.accept_waveform(16000, x); rec.decode_stream(st); return st.result.text
mode = sys.argv[1]; keys = sys.argv[2].split(",")
left = []
for k in keys:
    src = "wav/" + hashlib.md5(k.encode()).hexdigest()[:12] + ".wav" if mode == "wav" else rf"G:\我的雲端硬碟\注音\sounds\tts\{H[k]}.mp3"
    tmp = "chk.mp3"
    if mode == "wav": subprocess.run([FF, "-y", "-loglevel", "error", "-i", src, "-af", AF, "-ac", "1", "-ar", "24000", "-b:a", "32k", tmp], check=True)
    else: tmp = src
    txt = recog(tmp)
    want = [a | b for a, b in zip(readings(k), readings(jobs[k]))]
    got = [set(p) for p in pinyin(han(txt), style=Style.NORMAL, heteronym=True)]
    ok = len(got) >= len(want) and bool(want[-1] & set().union(*got[-2:]))
    print(k, "|", txt, "OK" if ok else "bad")
    if ok and mode == "wav":
        import shutil; shutil.copyfile(tmp, rf"G:\我的雲端硬碟\注音\sounds\tts\{H[k]}.mp3")
    if not ok: left.append(k)
print("LEFT", ",".join(left))
