"""把遊戲要念的字詞做成 jobs.json：{原文: 合成用文字}。台灣念法和大陸不同的字，用同音字合成。"""
import json, io, re
d = json.load(io.open("data.json", encoding="utf-8"))
SUBS = {
    "餅乾": "餅干", "乾杯": "干杯", "乾淨": "干淨", "企鵝": "器鵝", "假日": "架日", "湯匙": "湯池",
    "垃圾桶": "樂色桶", "姊姊": "姐姐", "阿嬤": "阿罵", "帆船": "凡船", "拳擊": "拳及", "椰子": "爺子",
    "漂亮": "票亮", "炸雞": "閘雞", "相機": "像機", "背包": "被包", "蛤蜊": "格蜊", "睡覺": "睡叫",
    "長頸鹿": "常頸鹿", "頭髮": "頭法", "肚子": "杜子", "音樂": "音月", "刨冰": "袍冰",
    "掃把": "埽把", "掃地": "埽地",   # 掃要念第四聲，模型會念成第三聲
}
ONE = {"耶": "噎", "弟弟": "地弟", "弟弟的弟": "地弟的弟"}   # 弟弟：疊字模型會吞掉一個   # 弟弟：疊字模型會吞掉一個
def synth(t):
    if t in ONE: return ONE[t]
    m = re.fullmatch(r"(.+)的(.)", t)
    for w, r in SUBS.items():
        if t == w: return r
        if m and m.group(1) == w: return r + "的" + r[w.index(m.group(2))]
        if w in t: return t.replace(w, r)
    return t
def pause(t):
    # 「彩虹的虹」：最後一個字常被吃掉，在「的」後面停一下再念
    m = re.fullmatch(r"(.+)的(.)", t)
    return f"{m.group(1)}的，{m.group(2)}。" if m else t
jobs = {t: pause(synth(t)) for t in d["t"]}
json.dump(jobs, io.open("jobs.json", "w", encoding="utf-8"), ensure_ascii=False, indent=0)
print(len(jobs), "changed", sum(1 for k, v in jobs.items() if k != v))
