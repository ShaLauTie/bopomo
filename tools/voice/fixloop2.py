"""重做語音並嚴格檢查（最多 4 輪）：
1. 字數夠、最後一個字有念到；2. 每個字的音和聲調辨識得出來；3.「X的，Y。」最後的 Y 單獨拿去辨識也要對。
用法：python fixloop2.py keys.json"""
import sys, io, os, json, re, subprocess, hashlib, shutil
import numpy as np
sys.argv_saved = sys.argv; sys.argv = ["x"]
exec(open(os.path.join(os.path.dirname(os.path.abspath(__file__)), "tailcheck.py"), encoding="utf-8").read().split("if __name__")[0])
sys.argv = sys.argv_saved
HERE = os.path.dirname(os.path.abspath(__file__))
PY = os.path.join(HERE, "..", "f5xpu", "Scripts", "python.exe")
DST = r"G:\我的雲端硬碟\注音\sounds\tts"
AF = ("atempo=1.15,silenceremove=start_periods=1:start_threshold=-45dB,areverse,"
      "silenceremove=start_periods=1:start_threshold=-45dB,areverse,adelay=60,apad=pad_dur=0.12,loudnorm=I=-18:TP=-1.5")
R = lambda t: [set(p) for p in pinyin(han(t), style=Style.TONE3, heteronym=True, neutral_tone_with_five=True)]
RN = lambda t: [set(p) for p in pinyin(han(t), style=Style.NORMAL, heteronym=True)]
wav = lambda k: os.path.join(HERE, "wav", hashlib.md5(k.encode()).hexdigest()[:12] + ".wav")
def score(k, x):
    """0 = 全對；越大越糟"""
    txt = asr(x); want = [a | b for a, b in zip(RN(k), RN(jobs[k]))]; got = RN(txt)
    s = 0
    if len(want) >= 2 and not (len(got) >= len(want) and want[-1] & set().union(*got[-2:])): s += 10
    wt = [a | b for a, b in zip(R(k), R(jobs[k]))]; gt = R(txt)
    if len(gt) == len(wt): s += sum(1 for w, g in zip(wt, gt) if not (w & g) and not any(x.endswith("5") for x in g))
    else: s += 1
    n = len(x) // 160; db = 20 * np.log10(np.sqrt((x[:n * 160].reshape(-1, 160) ** 2).mean(1)) + 1e-6)
    v = np.where(db > -45)[0]
    if len(v) and np.median(db[v[-1] - 3:v[-1] + 1]) > -24: s += 3      # 還很大聲就突然停（尾巴被切）
    if re.fullmatch(r".+的，.。", jobs[k]):
        seg, ms = tail(x)
        if not (180 <= ms <= 900): s += 3                          # 最後一個字前面要有停頓、而且要念完整
    return s, txt
keys = json.load(io.open(sys.argv[1], encoding="utf-8"))
best = {}
for rnd in range(1, 4):
    # 第 1 輪沿用已經做好的 wav（中斷後可以接著做）；加 --fresh 才全部重做
    for k in keys if rnd > 1 or "--fresh" in sys.argv else []:
        if os.path.exists(wav(k)): os.remove(wav(k))
    json.dump(keys, io.open(os.path.join(HERE, "todo.json"), "w", encoding="utf-8"), ensure_ascii=False)
    subprocess.run([PY, "-I", os.path.join(HERE, "f5gen.py"), os.path.join(HERE, "todo.json")])
    still = []
    for k in keys:
        if not os.path.exists(wav(k)): still.append(k); continue
        tmp = os.path.join(HERE, "cand", f"{H[k]}_{rnd}.mp3"); os.makedirs(os.path.dirname(tmp), exist_ok=True)
        subprocess.run([FF, "-y", "-loglevel", "error", "-i", wav(k), "-af", AF, "-ac", "1", "-ar", "24000", "-b:a", "32k", tmp], check=True)
        s, txt = score(k, load(tmp))
        if k not in best or s < best[k][0]:
            best[k] = (s, tmp); shutil.copyfile(tmp, os.path.join(DST, H[k] + ".mp3"))
        if s > 0: still.append(k); print(f"round {rnd} score {s}: {k} | {txt}")
    print(f"round {rnd}: good {len(keys) - len(still)}, left {len(still)}")
    keys = still
    if not keys: break
json.dump({k: v[0] for k, v in best.items() if v[0] > 0}, io.open(os.path.join(HERE, "left2.json"), "w", encoding="utf-8"), ensure_ascii=False)
print("LEFT", keys)
