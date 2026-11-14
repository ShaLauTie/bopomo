"""「X的Y」：把最後一個停頓後的聲音單獨拿去語音辨識，看是不是 Y（不讓辨識靠前文猜）。
用法：python tailcheck.py [mp3|wav] [keys.json]"""
import subprocess,numpy as np,imageio_ffmpeg,sys,io,json,re,hashlib,sherpa_onnx
from pypinyin import pinyin, Style
sys.stdout=io.TextIOWrapper(sys.stdout.buffer,encoding='utf-8',line_buffering=True)
FF=imageio_ffmpeg.get_ffmpeg_exe();A=r"G:\我的雲端硬碟\發音課\練習App\source\assets\asr"
H=json.load(io.open('hash.json',encoding='utf-8'));jobs=json.load(io.open('jobs.json',encoding='utf-8'))
rec=sherpa_onnx.OfflineRecognizer.from_paraformer(paraformer=A+r"\model.int8.onnx",tokens=A+r"\tokens.txt",num_threads=8)
han=lambda t:re.sub(r"[^\u4e00-\u9fff]","",t)
rd=lambda c:set(pinyin(c,style=Style.NORMAL,heteronym=True)[0])
def load(path):
  pcm=subprocess.run([FF,"-loglevel","error","-i",path,"-f","s16le","-ac","1","-ar","16000","-"],capture_output=True).stdout
  return np.frombuffer(pcm,np.int16).astype(np.float32)/32768
def asr(x):
  st=rec.create_stream();st.accept_waveform(16000,np.concatenate([np.zeros(3200,np.float32),x,np.zeros(4800,np.float32)]));rec.decode_stream(st);return st.result.text
def tail(x):
  n=len(x)//160;db=20*np.log10(np.sqrt((x[:n*160].reshape(-1,160)**2).mean(1))+1e-6)  # 10ms
  v=np.where(db>-40)[0]; end=v[-1]+1
  # 往回找最後一個 >=50ms 的無聲段落（不要切掉 ㄘㄙ 這種小聲的開頭）
  i=end-1; quiet=0
  while i>0:
    quiet = quiet+1 if db[i]<-38 else 0
    if quiet>=4: break
    i-=1
  start=i+quiet
  return x[start*160:end*160], (end-start)*10
def check(k,x):
  seg,ms=tail(x); t=han(asr(seg)); want=han(jobs[k])[-1]; orig=han(k)[-1]
  ok = bool(t) and bool((rd(want)|rd(orig)) & rd(t[-1])) and ms>=180
  return ok,t,ms
if __name__=="__main__":
  mode=sys.argv[1] if len(sys.argv)>1 else "mp3"
  keys=json.load(io.open(sys.argv[2],encoding='utf-8')) if len(sys.argv)>2 else [k for k in jobs if re.fullmatch(r".+的.",k)]
  bad=[]
  for k in keys:
    p=rf"G:\我的雲端硬碟\注音\sounds\tts\{H[k]}.mp3" if mode=="mp3" else "wav/"+hashlib.md5(k.encode()).hexdigest()[:12]+".wav"
    ok,t,ms=check(k,load(p))
    if not ok: bad.append(k); print("bad",k,"|",t,ms)
  json.dump(bad,io.open('tailbad.json','w',encoding='utf-8'),ensure_ascii=False)
  print("checked",len(keys),"bad",len(bad))
