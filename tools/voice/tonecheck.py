"""每段語音用語音辨識聽一次，逐字比對聲調（含破音字），列出念錯音或聲調的。"""
import sys, io, json, re, subprocess, numpy as np, sherpa_onnx, imageio_ffmpeg
from pypinyin import pinyin, Style
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8", line_buffering=True)
FF = imageio_ffmpeg.get_ffmpeg_exe(); A = r"G:\我的雲端硬碟\發音課\練習App\source\assets\asr"
H = json.load(io.open("hash.json", encoding="utf-8")); jobs = json.load(io.open("jobs.json", encoding="utf-8"))
rec = sherpa_onnx.OfflineRecognizer.from_paraformer(paraformer=A + r"\model.int8.onnx", tokens=A + r"\tokens.txt", num_threads=8)
han = lambda t: re.sub(r"[^\u4e00-\u9fff]", "", t)
R = lambda t: [set(p) for p in pinyin(han(t), style=Style.TONE3, heteronym=True, neutral_tone_with_five=True)]
def recog(path):
    pcm = subprocess.run([FF, "-loglevel", "error", "-i", path, "-f", "s16le", "-ac", "1", "-ar", "16000", "-"], capture_output=True).stdout
    x = np.frombuffer(pcm, np.int16).astype(np.float32) / 32768
    st = rec.create_stream(); st.accept_waveform(16000, x); rec.decode_stream(st); return st.result.text
out = {}
for k in jobs:
    if len(han(k)) < 2 or k not in H: continue
    txt = recog(rf"G:\我的雲端硬碟\注音\sounds\tts\{H[k]}.mp3")
    want = [a | b for a, b in zip(R(k), R(jobs[k]))]; got = R(txt)
    if len(got) != len(want): continue
    bad = [(han(k)[i], han(txt)[i]) for i, (w, g) in enumerate(zip(want, got))
           if not (w & g) and not any(x.rstrip("5") in {y.rstrip("12345") for y in w} for x in g if x.endswith("5"))]
    if bad: out[k] = txt; print(k, "|", txt, bad)
json.dump(out, io.open("tonebad.json", "w", encoding="utf-8"), ensure_ascii=False, indent=0)
print("TOTAL", len(out))
