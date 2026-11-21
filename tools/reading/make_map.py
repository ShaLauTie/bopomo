"""產生 reading-map.js：每個讀音（注音、不分聲調）有哪些字。注音導讀用來判斷孩子念的字對不對。
語音辨識會回傳同音字（念「沙」可能聽成「殺」），所以比的是讀音，不是字。"""
import io, re, sys
from pypinyin import pinyin, Style
TONES = "ˊˇˋ˙"
# 台灣念法 pypinyin 沒有的
EXTRA = {"和": ["ㄏㄢ"], "蛤": ["ㄍㄜ"], "垃": ["ㄌㄜ"], "圾": ["ㄙㄜ"]}
m = {}
for cp in range(0x4E00, 0xA000):
    c = chr(cp)
    rs = pinyin(c, style=Style.BOPOMOFO, heteronym=True)[0]
    if not rs or rs[0] == c: continue
    for r in set(re.sub(f"[{TONES}]", "", x) for x in rs) | set(EXTRA.get(c, [])):
        m.setdefault(r, []).append(c)
out = "// 讀音（注音、不分聲調）→ 字。由 tools/reading/make_map.py 產生，不要手改。\nconst READ_MAP = {" + \
      ",".join(f'"{k}":"{"".join(v)}"' for k, v in sorted(m.items())) + "};\n"
io.open(sys.argv[1], "w", encoding="utf-8", newline="\n").write(out)
print(len(m), "readings", sum(len(v) for v in m.values()), "chars", len(out.encode()) // 1024, "KB")
