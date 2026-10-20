// ========== 語音 ==========

// 全域預載中文語音（Android Chrome 的 getVoices() 首次呼叫回空陣列）
let _zhVoice = null;
function _loadZhVoice() {
  if (!('speechSynthesis' in window)) return;
  const voices = speechSynthesis.getVoices();
  _zhVoice = voices.find(v => v.lang === 'zh-TW')
          || voices.find(v => v.lang === 'zh-CN')
          || voices.find(v => v.lang.startsWith('zh'))
          || null;
}
_loadZhVoice();
if ('speechSynthesis' in window) {
  speechSynthesis.addEventListener('voiceschanged', _loadZhVoice);
}

// 注音符號 → 代表字對照表（純代表字，供 TTS 發音用）
const BPMF_TO_CHAR = {
  "ㄅ": "八",  "ㄆ": "怕",  "ㄇ": "媽",  "ㄈ": "發",
  "ㄉ": "大",  "ㄊ": "他",  "ㄋ": "那",  "ㄌ": "拉",
  "ㄍ": "哥",  "ㄎ": "科",  "ㄏ": "喝",  "ㄐ": "雞",
  "ㄑ": "期",  "ㄒ": "西",  "ㄓ": "知",  "ㄔ": "吃",
  "ㄕ": "詩",  "ㄖ": "日",  "ㄗ": "字",  "ㄘ": "次",
  "ㄙ": "司",  "ㄧ": "一",  "ㄨ": "五",  "ㄩ": "魚",
  "ㄚ": "啊",  "ㄛ": "哦",  "ㄜ": "鵝",  "ㄝ": "耶",
  "ㄞ": "愛",  "ㄟ": "欸",  "ㄠ": "熬",  "ㄡ": "歐",
  "ㄢ": "安",  "ㄣ": "恩",  "ㄤ": "昂",  "ㄥ": "嗯",
  "ㄦ": "兒",
};

// 將含注音符號的字串轉成純中文，讓 TTS 能正確發音
const TONE_MARKS = /[ˊˇˋ˙]/g;
function bopomofoToSpeakable(text) {
  return text
    .replace(TONE_MARKS, "")                           // 去掉聲調符號
    .replace(/[ㄅ-ㄩㄚ-ㄦ]/g, ch => BPMF_TO_CHAR[ch] || ch); // 注音 → 代表字
}

// ── 本地注音音檔（sounds/ 資料夾）──
// 實際排列：聲符 F1-F21、韻符 F22-F34、介音 F35-F37（ㄧ ㄨ ㄩ 排在最後）
const MOE_BASE = "sounds/";
const BPMF_TO_WAV = {
  // 聲符 F1–F21
  "ㄅ": "F1.WAV",  "ㄆ": "F2.WAV",  "ㄇ": "F3.WAV",  "ㄈ": "F4.WAV",
  "ㄉ": "F5.WAV",  "ㄊ": "F6.WAV",  "ㄋ": "F7.WAV",  "ㄌ": "F8.WAV",
  "ㄍ": "F9.WAV",  "ㄎ": "F10.WAV", "ㄏ": "F11.WAV", "ㄐ": "F12.WAV",
  "ㄑ": "F13.WAV", "ㄒ": "F14.WAV", "ㄓ": "F15.WAV", "ㄔ": "F16.WAV",
  "ㄕ": "F17.WAV", "ㄖ": "F18.WAV", "ㄗ": "F19.WAV", "ㄘ": "F20.WAV",
  "ㄙ": "F21.WAV",
  // 韻符 F22–F34
  "ㄚ": "F22.WAV", "ㄛ": "F23.WAV", "ㄜ": "F24.WAV", "ㄝ": "F25.WAV",
  "ㄞ": "F26.WAV", "ㄟ": "F27.WAV", "ㄠ": "F28.WAV", "ㄡ": "F29.WAV",
  "ㄢ": "F30.WAV", "ㄣ": "F31.WAV", "ㄤ": "F32.WAV", "ㄥ": "F33.WAV",
  "ㄦ": "F34.WAV",
  // 介音 F35–F37（排在最後）
  "ㄧ": "F35.WAV", "ㄨ": "F36.WAV", "ㄩ": "F37.WAV",
};

// ── 當前播放的 Audio 物件 ──
let _currentAudio = null;



/**
 * 播放一段音訊（Audio URL）。
 * @param {string}   url    - 音訊 URL
 * @param {Function} [onEnd] - 播完後的回呼
 */
function playAudioUrl(url, onEnd, rate = 1) {
  if (_currentAudio) {
    _currentAudio.pause();
    _currentAudio.onended = null;
    _currentAudio = null;
  }
  const audio = new Audio(url);
  audio.playbackRate = rate;  // 放慢時瀏覽器會保持音高
  _currentAudio = audio;
  const myScreenGen = _screenGen;
  if (onEnd) audio.addEventListener("ended", () => {
    if (_screenGen !== myScreenGen) return;
    onEnd();
  }, { once: true });
  audio.play().catch(() => {
    if (_screenGen !== myScreenGen) return;
    if (onEnd) setTimeout(onEnd, 800);
  });
}

/**
 * 播放單一注音符號（教育部官方 WAV）。
 * @param {string}   symbol - 單一注音符號，如「ㄅ」
 * @param {Function} [onEnd]
 */
function speakSymbol(symbol, onEnd) {
  const bare = symbol.replace(TONE_MARKS, "");
  const wav = BPMF_TO_WAV[bare];
  if (wav) {
    playAudioUrl(MOE_BASE + wav, onEnd);
  } else if (onEnd) {
    setTimeout(onEnd, 200);
  }
}

/**
 * 用 Google Translate TTS 播放一般中文文字（例字、回饋語句）。
 * @param {string}   text
 * @param {Function} [onEnd]
 */
let _screenGen = 0;  // 切畫面時遞增，讓跨畫面 callback 不再塗 utterance

function speakViaGoogle(text, onEnd) {
  const url = `https://translate.google.com/translate_tts?ie=UTF-8&q=${encodeURIComponent(text)}&tl=zh-TW&client=tw-ob`;
  if (_currentAudio) {
    _currentAudio.pause();
    _currentAudio.onended = null;
    _currentAudio = null;
  }
  const audio = new Audio();
  // Google 會拒絕帶著其他網站來源的請求，所以不送 Referer
  audio.referrerPolicy = "no-referrer";
  audio.src = url;
  _currentAudio = audio;
  const myScreenGen = _screenGen;
  if (onEnd) audio.addEventListener("ended", () => {
    if (_screenGen !== myScreenGen) return;
    onEnd();
  }, { once: true });
  audio.play().catch(() => {
    if (_screenGen !== myScreenGen) { if (onEnd) onEnd(); return; }
    _currentAudio = null;
    if ("speechSynthesis" in window) {
      const utter = new SpeechSynthesisUtterance(bopomofoToSpeakable(text));
      utter.lang = "zh-TW";
      if (_zhVoice) utter.voice = _zhVoice;
      utter.rate = 0.75;
      utter.pitch = 1.1;
      if (onEnd) utter.onend = onEnd;
      speechSynthesis.speak(utter);
    } else {
      if (onEnd) setTimeout(onEnd, 800);
    }
  });
}


// ── 備用：瀏覽器內建語音（僅在 Google TTS 失敗時使用）──
let bopomofoVoice = null;
function pickVoice() {
  const voices = speechSynthesis.getVoices();
  bopomofoVoice =
    voices.find(v => v.lang === "zh-TW") ||
    voices.find(v => v.lang && v.lang.toLowerCase().startsWith("zh")) ||
    null;
}
if ("speechSynthesis" in window) {
  pickVoice();
  speechSynthesis.onvoiceschanged = pickVoice;
}
function speakFallback(text) {
  if (!("speechSynthesis" in window)) return;
  // 不呼叫 cancel()，避免清掉其他畫面正在說的話
  const utter = new SpeechSynthesisUtterance(bopomofoToSpeakable(text));
  utter.lang = "zh-TW";
  if (_zhVoice) utter.voice = _zhVoice;
  utter.rate = 0.75;
  utter.pitch = 1.1;
  speechSynthesis.speak(utter);
}

/**
 * 主要 speak 函式。
 * - 純注音符號（含帶聲調，如「ㄚˋ」）→ 教育部官方 WAV
 * - 其他中文字串 → Google TTS（失敗則退回瀏覽器內建語音）
 * @param {string}   text
 * @param {Function} [onEnd]
 */
// 複合韻（如「ㄧㄠˇ」）→ 念起來一樣的代表字（「咬」）
function rimeSpeakChar(text) {
  const toneMatch = text.match(/[ˊˇˋ˙]/);
  const list = RIME_SPEAK_CHAR[text.replace(TONE_MARKS, "")];
  if (!list) return null;
  const idx = { "ˊ": 1, "ˇ": 2, "ˋ": 3 }[toneMatch ? toneMatch[0] : ""] || 0;
  return list[idx] || list[0];
}

function speak(text, onEnd) {
  const bare = text.replace(TONE_MARKS, "");
  // 單一注音符號 → 教育部音檔
  if (BPMF_TO_WAV[bare]) {
    speakSymbol(text, onEnd);
    return;
  }
  // 複合韻 → 代表字
  const rimeChar = rimeSpeakChar(text);
  if (rimeChar) {
    speak(rimeChar, onEnd);
    return;
  }
  // 預先產生的語音檔（最穩定，不需要網路語音服務）
  const key = text.trim();
  if (typeof TTS_FILES !== "undefined" && TTS_FILES.has(ttsHash(key))) {
    playAudioUrl(`sounds/tts/${ttsHash(key)}.mp3?v=yiyi1`, onEnd, 1);
    return;
  }
  // 沒有音檔的文字 → 線上語音，再不行用裝置內建語音
  speakViaGoogle(bopomofoToSpeakable(text), onEnd);
}

/**
 * 依序播放多段語音，前一段「真的播完」後才接下一段。
 * @param {string[]} texts  - 要依序播放的文字陣列
 * @param {number}   gapMs  - 前後段之間的停頓（毫秒），預設 350ms
 * @param {Function} onDone - 全部播完後的回呼
 */
function speakSequence(texts, gapMs = 350, onDone) {
  const items = texts.filter(t => t && t.trim());
  function playAt(i) {
    if (i >= items.length) {
      if (onDone) onDone();
      return;
    }
    speak(items[i], () => setTimeout(() => playAt(i + 1), gapMs));
  }
  playAt(0);
}

// ========== 畫面切換 ==========

function showScreen(name) {
  // 切換畫面時，停止所有進行中的音訊（防止跨畫面干擾）
  _screenGen++;
  unlockAnswers();  // 讓所有舊的語音 callback 自動作廢
  _fcGen++;      // 閃卡專用
  if (_currentAudio)  { _currentAudio.pause();  _currentAudio  = null; }
  if (_toneAudio)     { _toneAudio.pause();     _toneAudio     = null; }
  if ('speechSynthesis' in window) speechSynthesis.cancel();
  setFcLocked(false); // 解鎖閃卡箭頭
  breakStreak();      // 換遊戲，連對重新計算
  updateStarBank();

  document.getElementById("roundGameover").style.display = "none";
  document.querySelectorAll(".screen").forEach(el => el.classList.remove("active"));
  const activeScreen = document.getElementById("screen-" + name);
  activeScreen.classList.add("active");
  animateScreenEntrance(activeScreen, name);

  if (name === "flashcards") renderFlashcard();
  if (name === "match") startMatchGame();
  if (name === "quiz") startQuiz();
  if (name === "picture") startPictureGame();
  if (name === "train") startTrainGame();
  if (name === "monster") startMonsterGame();
  if (name === "island") startIslandGame();
  if (name === "rhythm") startRhythmGame();
  if (name === "memory") startMemoryGame();
  if (name === "tone") startToneGame();
  if (name === "claw") startClawGame();
  if (name === "spell") startSpellGame();
}

// 入門區裡的遊戲，返回時先回入門區
const BASICS_SCREENS = ["flashcards", "match", "memory"];

function goHome() {
  const current = document.querySelector(".screen.active");
  const currentName = current ? current.id.replace("screen-", "") : "home";
  stopClawGame();
  stopSpellGame();
  stopPictureGame();
  stopTrainGame();
  stopMonsterGame();
  stopIslandGame();
  stopRhythmGame();
  showScreen(BASICS_SCREENS.includes(currentName) ? "basics" : "home");
}

// ========== 小工具 ==========

function shuffle(arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function randomInt(max) {
  return Math.floor(Math.random() * max);
}

// ========== 星星存錢筒 · 連對 · 貼紙簿 ==========

const TOTAL_STARS_KEY = "bpmf_total_stars";
const STARS_PER_STICKER = 10;
const STICKERS = [
  "🐣", "🐶", "🐱", "🐰", "🐼", "🦊", "🐯", "🦁", "🐸", "🐵",
  "🐧", "🐢", "🐙", "🦄", "🐳", "🦋", "🐞", "🦖", "🐲", "🦩",
  "🍓", "🍩", "🍦", "🧁", "🍭", "🎈", "🎁", "🚀", "🚂", "🚁",
  "🏰", "🎠", "🎡", "🌈", "⭐", "🌙", "🪐", "👑", "💎", "🏆"
];
const PRAISES_TEXT = ["答對了！🎉", "好厲害！🌟", "太棒了！👏", "你好棒！💪", "完全正確！✨", "超級棒！🏅"];

let _streak = 0;

function loadTotalStars() {
  try { return parseInt(localStorage.getItem(TOTAL_STARS_KEY) || "0", 10) || 0; }
  catch (e) { return 0; }
}

function saveTotalStars(n) {
  try { localStorage.setItem(TOTAL_STARS_KEY, String(n)); } catch (e) {}
}

let _totalStars = loadTotalStars();

function unlockedStickerCount() {
  return Math.min(STICKERS.length, Math.floor(_totalStars / STARS_PER_STICKER));
}

// 每答對一次呼叫：加一顆星、累計連對、必要時發新貼紙
function rewardCorrect() {
  const before = unlockedStickerCount();
  _totalStars++;
  saveTotalStars(_totalStars);
  _streak++;
  updateStarBank();
  updateStreakBadge();
  if (unlockedStickerCount() > before) {
    setTimeout(() => showStickerUnlock(STICKERS[unlockedStickerCount() - 1]), 700);
  }
}

// 答錯時呼叫：連對歸零
function breakStreak() {
  _streak = 0;
  updateStreakBadge();
}

function updateStarBank() {
  const el = document.getElementById("starBankCount");
  if (el) el.textContent = _totalStars;
  const st = document.getElementById("stickerBankCount");
  if (st) st.textContent = `${unlockedStickerCount()} / ${STICKERS.length}`;
  const bar = document.getElementById("stickerProgressFill");
  if (bar) {
    const done = unlockedStickerCount() >= STICKERS.length;
    bar.style.width = done ? "100%" : `${(_totalStars % STARS_PER_STICKER) / STARS_PER_STICKER * 100}%`;
  }
}

function updateStreakBadge() {
  const badge = document.getElementById("streakBadge");
  if (!badge) return;
  if (_streak >= 3) {
    badge.textContent = `🔥 連對 ${_streak}`;
    badge.classList.add("show");
    replayAnimation(badge, "streak-pop", 500);
  } else {
    badge.classList.remove("show");
  }
}

function showStickerUnlock(sticker) {
  const box = document.getElementById("stickerUnlock");
  if (!box) return;
  document.getElementById("stickerUnlockEmoji").textContent = sticker;
  box.classList.add("show");
  burstAtViewportCenter(true, 26);
  speak("哇！你得到一張新貼紙！");
}

function closeStickerUnlock() {
  document.getElementById("stickerUnlock").classList.remove("show");
}

function openStickerBook() {
  const grid = document.getElementById("stickerGrid");
  const count = unlockedStickerCount();
  grid.innerHTML = STICKERS.map((s, i) =>
    i < count
      ? `<div class="sticker-slot got">${s}</div>`
      : `<div class="sticker-slot locked">❓</div>`
  ).join("");
  const left = STARS_PER_STICKER - (_totalStars % STARS_PER_STICKER);
  document.getElementById("stickerBookHint").textContent = count >= STICKERS.length
    ? "全部貼紙都收集到了！你是注音大師！"
    : `再拿 ${left} 顆星星，就能得到下一張貼紙！`;
  document.getElementById("stickerBook").classList.add("show");
}

function closeStickerBook() {
  document.getElementById("stickerBook").classList.remove("show");
}

// 答錯後鎖住選項 5 秒，避免亂點就過關
const ANSWER_LOCK_MS = 5000;
let _answerLockTimer = null;

function lockAnswers(ms = ANSWER_LOCK_MS) {
  const el = document.getElementById("answerLock");
  if (!el) return;
  clearInterval(_answerLockTimer);
  let left = Math.ceil(ms / 1000);
  const count = el.querySelector(".answer-lock-count");
  count.textContent = left;
  el.classList.add("show");
  _answerLockTimer = setInterval(() => {
    left--;
    if (left <= 0) unlockAnswers();
    else count.textContent = left;
  }, 1000);
}

function unlockAnswers() {
  clearInterval(_answerLockTimer);
  _answerLockTimer = null;
  const el = document.getElementById("answerLock");
  if (el) el.classList.remove("show");
}

function showFeedback(good, lock = true) {
  const banner = document.getElementById("feedbackBanner");
  banner.textContent = good ? PRAISES_TEXT[randomInt(PRAISES_TEXT.length)] : "再試一次 😊";
  banner.className = "feedback-banner show " + (good ? "good" : "bad");
  burstAtViewportCenter(good);
  if (good) {
    playCorrectDingDing();
    rewardCorrect();
  } else {
    breakStreak();
    speak("再試一次");
    if (lock) lockAnswers();
  }
  setTimeout(() => {
    banner.classList.remove("show");
  }, 900);
}

// ========== 選項工具：容易混淆的注音 ==========

// 孩子最常搞混的音：干擾選項優先從同一組挑，練到真正的聽辨
const CONFUSABLE_GROUPS = [
  ["ㄅ", "ㄆ", "ㄉ"], ["ㄉ", "ㄊ"], ["ㄍ", "ㄎ", "ㄉ"], ["ㄋ", "ㄌ"], ["ㄈ", "ㄏ"],
  ["ㄐ", "ㄑ", "ㄒ"], ["ㄓ", "ㄗ"], ["ㄔ", "ㄘ"], ["ㄕ", "ㄙ"], ["ㄖ", "ㄌ"],
  ["ㄣ", "ㄥ"], ["ㄢ", "ㄤ"], ["ㄛ", "ㄜ", "ㄡ"], ["ㄞ", "ㄟ"], ["ㄧ", "ㄩ"], ["ㄨ", "ㄛ"]
];

function confusablesOf(symbol) {
  const set = new Set();
  CONFUSABLE_GROUPS.forEach(g => { if (g.includes(symbol)) g.forEach(s => set.add(s)); });
  set.delete(symbol);
  return [...set];
}

// 從 pool（符號字串陣列）挑 n 個干擾符號，至少一個是易混淆音（如果有）
function pickDistractorSymbols(target, n, pool = BOPOMOFO_SYMBOLS.map(s => s.symbol)) {
  const candidates = pool.filter(s => s !== target);
  const tricky = shuffle(confusablesOf(target).filter(s => candidates.includes(s)));
  const picked = tricky.slice(0, Math.min(tricky.length, Math.max(1, Math.floor(n / 2))));
  shuffle(candidates).forEach(s => { if (picked.length < n && !picked.includes(s)) picked.push(s); });
  return picked;
}

// 字頭有詞語可以出題的符號
function symbolsWithWords() {
  return BOPOMOFO_SYMBOLS.filter(s => (WORDS_BY_HEAD[s.symbol] || []).length > 0);
}

function symbolsWithListenWords() {
  return BOPOMOFO_SYMBOLS.filter(s => (LISTEN_BY_HEAD[s.symbol] || []).length > 0);
}

function randomListenWordForHead(symbol) {
  const list = LISTEN_BY_HEAD[symbol] || [];
  return list.length ? list[randomInt(list.length)] : null;
}

function randomWordForHead(symbol) {
  const list = WORDS_BY_HEAD[symbol] || [];
  return list.length ? list[randomInt(list.length)] : null;
}

// 挑 n 個拼法、圖案都和 target 不同的音節（避免兩個選項都對）
function pickOtherCombos(target, n, pool = PINYIN_COMBOS) {
  const usedSpelling = new Set([comboSpelling(target)]);
  const usedEmoji = new Set([target.emoji]);
  const out = [];
  shuffle(pool).forEach(c => {
    if (out.length >= n) return;
    const sp = comboSpelling(c);
    if (usedSpelling.has(sp) || usedEmoji.has(c.emoji)) return;
    usedSpelling.add(sp);
    usedEmoji.add(c.emoji);
    out.push(c);
  });
  return out;
}

// 「差一點點」的錯誤拼法：同音不同調、易混聲母、同聲母不同韻……
function nearMissSpellings(combo, n) {
  const correct = comboSpelling(combo);
  const p = comboParts(combo);
  const out = new Set();
  ["", "ˊ", "ˇ", "ˋ"].forEach(t => {
    if (t !== p.tone) out.add(p.initial + p.finalBody + t);
  });
  if (p.initial) {
    confusablesOf(p.initial)
      .filter(s => BPMF_INITIALS.includes(s))
      .forEach(s => out.add(s + p.finalBody + p.tone));
  }
  PINYIN_COMBOS.forEach(c => {
    const q = comboParts(c);
    if (q.initial === p.initial || q.finalBody === p.finalBody) out.add(q.full);
  });
  out.delete(correct);
  const list = shuffle([...out]);
  // 聲調干擾最多一個，其他用聲母韻母的錯音，比較像真正的「錯音」
  const toneOnly = list.filter(v => v.replace(GAME_TONE_RE_GLOBAL, "") === p.initial + p.finalBody);
  const others = list.filter(v => !toneOnly.includes(v));
  const picked = [...toneOnly.slice(0, 1), ...others].slice(0, n);
  if (picked.length < n) {
    shuffle(PINYIN_COMBOS.map(comboSpelling))
      .forEach(v => { if (picked.length < n && v !== correct && !picked.includes(v)) picked.push(v); });
  }
  return picked;
}

function replayAnimation(el, className, duration = 700) {
  if (!el) return;
  el.classList.remove(className);
  void el.offsetWidth;
  el.classList.add(className);
  setTimeout(() => el.classList.remove(className), duration);
}

function burstAtViewportCenter(good, count = 18) {
  burstParticles(window.innerWidth / 2, window.innerHeight * 0.38, good, count);
}

function burstAtElement(el, good, count = 14) {
  if (!el) return;
  const rect = el.getBoundingClientRect();
  burstParticles(rect.left + rect.width / 2, rect.top + rect.height / 2, good, count);
}

function burstParticles(x, y, good, count = 14) {
  const goodItems = ["⭐", "✨", "🎉", "🌟", "💛"];
  const badItems = ["💥", "❌", "💫", "😵", "⚡"];
  const items = good ? goodItems : badItems;
  for (let i = 0; i < count; i++) {
    const p = document.createElement("div");
    const angle = (Math.PI * 2 * i) / count + Math.random() * 0.45;
    const dist = 46 + Math.random() * 86;
    p.className = "screen-particle " + (good ? "good" : "bad");
    p.textContent = items[randomInt(items.length)];
    p.style.left = `${x}px`;
    p.style.top = `${y}px`;
    p.style.setProperty("--px", `${Math.cos(angle) * dist}px`);
    p.style.setProperty("--py", `${Math.sin(angle) * dist - 34}px`);
    p.style.setProperty("--spin", `${Math.round(Math.random() * 240 - 120)}deg`);
    document.body.appendChild(p);
    setTimeout(() => p.remove(), 920);
  }
}

function animateScreenEntrance(screen, name) {
  if (!screen) return;
  replayAnimation(screen, "screen-stage-pop", 760);
  const glyphsByScreen = {
    home: ["ㄅ", "ㄆ", "ㄇ", "✨", "🎈"],
    flashcards: ["ㄅ", "ㄆ", "ㄇ", "🌟"],
    match: ["🔊", "ㄚ", "ㄧ", "✨"],
    quiz: ["🏆", "⭐", "ㄇ", "✨"],
    basics: ["ㄅ", "ㄆ", "ㄇ", "🌱"],
    memory: ["🃏", "⭐", "?", "✨"],
    tone: ["ˊ", "ˇ", "ˋ", "🎵"],
    claw: ["🕹️", "🎁", "⭐", "✨"],
    spell: ["🏭", "⚙️", "ㄅ", "✨"],
    picture: ["🖼️", "⭐", "ㄚ", "✨"],
    train: ["🚂", "💨", "⭐", "✨"],
    monster: ["👾", "🍽️", "⭐", "✨"],
    island: ["🏝️", "🧩", "⭐", "✨"],
    rhythm: ["🥁", "♪", "ㄅ", "⭐"]
  };
  const glyphs = glyphsByScreen[name] || ["✨", "⭐"];
  for (let i = 0; i < 10; i++) {
    const f = document.createElement("div");
    f.className = "screen-firefly";
    f.textContent = glyphs[randomInt(glyphs.length)];
    f.style.left = `${8 + Math.random() * 84}%`;
    f.style.top = `${12 + Math.random() * 72}%`;
    f.style.setProperty("--float-x", `${Math.round(Math.random() * 80 - 40)}px`);
    f.style.setProperty("--float-y", `${Math.round(-30 - Math.random() * 90)}px`);
    f.style.animationDelay = `${Math.random() * 0.5}s`;
    screen.appendChild(f);
    setTimeout(() => f.remove(), 4300);
  }
}

// ========== 10 題一輪（聽音找符號、聲調辨識） ==========

const ROUND_LENGTH = 10;
const rounds = {};

function roundReset(key) {
  rounds[key] = { num: 0, score: 0, missed: false };
  roundHud(key);
}

function roundHud(key) {
  const r = rounds[key];
  const progress = document.getElementById(key + "Progress");
  const stars = document.getElementById(key + "Stars");
  if (progress) progress.textContent = `第 ${Math.min(r.num + 1, ROUND_LENGTH)} / ${ROUND_LENGTH} 題`;
  if (stars) stars.textContent = `⭐ ${r.score}`;
}

// 答錯過的題目，答對時不算星星
function roundWrong(key) {
  if (rounds[key]) rounds[key].missed = true;
  lockAnswers();
}

// 答對：前進一題；滿 10 題顯示成績
function roundCorrect(key, next, restart) {
  const r = rounds[key];
  r.num++;
  if (!r.missed) r.score++;
  r.missed = false;
  const myGen = _screenGen;
  if (r.num >= ROUND_LENGTH) {
    roundHud(key);
    setTimeout(() => { if (myGen === _screenGen) showRoundEnd(r.score, restart); }, 1000);
  } else {
    roundHud(key);
    setTimeout(() => { if (myGen === _screenGen) next(); }, 1100);
  }
}

function showRoundEnd(score, restart) {
  const box = document.getElementById("roundGameover");
  document.getElementById("roundFinalScore").textContent = score;
  document.getElementById("roundTitle").textContent =
    score >= ROUND_LENGTH ? "全部一次答對！" : score >= 7 ? "很棒！" : "完成了！";
  document.getElementById("roundAgainBtn").onclick = () => {
    box.style.display = "none";
    restart();
  };
  box.style.display = "flex";
  speak(score >= ROUND_LENGTH ? "太棒了！你全部過關了！" : score >= 7 ? "很棒！繼續加油！" : "再試一次！");
}

function startMatchGame() {
  roundReset("match");
  matchTarget = null;
  startMatchRound();
}

function startToneGame() {
  roundReset("tone");
  toneSet = null;
  startToneRound();
}

// ========== 認識注音符號牌 ==========

let fcIndex = 0;
let fcSpeaking = false;
let fcSpeakTimer = null;
let _fcGen = 0;  // 切畫面時遞增，讓舊 callback 作廢

function setFcLocked(locked) {
  fcSpeaking = locked;
  if (fcSpeakTimer) { clearTimeout(fcSpeakTimer); fcSpeakTimer = null; }
  const nav = document.querySelector('#screen-flashcards .card-nav');
  if (nav) nav.style.opacity = locked ? '0.35' : '1';
  // 保険：最多鎖 6 秒，防止語音標籤沒回呼
  if (locked) fcSpeakTimer = setTimeout(() => setFcLocked(false), 6000);
}

let fcExample = null;  // 目前顯示的例詞 { word, emoji }

function showFlashcardExample(example) {
  fcExample = example;
  document.getElementById("fcEmoji").textContent = example.emoji;
  document.getElementById("fcWord").textContent = example.word;
}

function renderFlashcard() {
  const item = BOPOMOFO_SYMBOLS[fcIndex];
  const card = document.getElementById("flashcard");
  document.getElementById("fcSymbol").textContent = item.symbol;
  showFlashcardExample({ word: item.word, emoji: item.emoji });
  const more = (WORDS_BY_HEAD[item.symbol] || []).length;
  document.getElementById("fcMore").textContent = more > 1 ? `👆 點圖片換例子（${more} 個）` : "";
  document.getElementById("fcProgress").textContent =
    (fcIndex + 1) + " / " + BOPOMOFO_SYMBOLS.length;
  replayAnimation(card, "flashcard-swap", 760);
  // 鎖住箭頭，念完才解鎖
  setFcLocked(true);
  speakCurrentFlashcard();
}

// 點圖片：換一個同字頭的例詞
function nextFlashcardExample(event) {
  if (event) event.stopPropagation();
  const item = BOPOMOFO_SYMBOLS[fcIndex];
  const list = (WORDS_BY_HEAD[item.symbol] || []).filter(w => w.word !== fcExample.word);
  if (!list.length) { speakCurrentFlashcard(); return; }
  showFlashcardExample(list[randomInt(list.length)]);
  replayAnimation(document.getElementById("fcEmoji"), "emoji-bounce", 600);
  speakCurrentFlashcard();
}

function speakCurrentFlashcard() {
  const item = BOPOMOFO_SYMBOLS[fcIndex];
  const word = fcExample ? fcExample.word : item.word;
  const myGen = ++_fcGen;  // 重新點擊時讓上一輪的 callback 作廢
  // 先念符號，再念例詞
  speak(item.symbol, () => {
    if (_fcGen !== myGen) return;
    setTimeout(() => {
      if (_fcGen !== myGen) return;
      speak(word, () => {
        if (_fcGen === myGen) setFcLocked(false);
      });
    }, 200);
  });
}

function nextFlashcard() {
  if (fcSpeaking) return;  // 正在唔讀，忽略點擊
  fcIndex = (fcIndex + 1) % BOPOMOFO_SYMBOLS.length;
  renderFlashcard();
}

function prevFlashcard() {
  if (fcSpeaking) return;  // 正在唔讀，忽略點擊
  fcIndex = (fcIndex - 1 + BOPOMOFO_SYMBOLS.length) % BOPOMOFO_SYMBOLS.length;
  renderFlashcard();
}

// ========== 聽音找符號 遊戲 ==========

let matchTarget = null;
let matchLocked = false;

function startMatchRound() {
  matchLocked = false;
  // 不要連續兩題同一個音
  const prev = matchTarget;
  do {
    matchTarget = BOPOMOFO_SYMBOLS[randomInt(BOPOMOFO_SYMBOLS.length)];
  } while (prev && matchTarget.symbol === prev.symbol);

  const others = pickDistractorSymbols(matchTarget.symbol, 3)
    .map(sym => BOPOMOFO_SYMBOLS.find(s => s.symbol === sym));
  const choices = shuffle([matchTarget, ...others]);

  const grid = document.getElementById("matchChoices");
  grid.innerHTML = "";
  choices.forEach(choice => {
    const btn = document.createElement("button");
    btn.className = "choice-card";
    btn.textContent = choice.symbol;
    btn.onclick = () => handleMatchChoice(choice, btn);
    grid.appendChild(btn);
  });

  replayMatchSound();
  replayAnimation(document.getElementById("matchSpeaker"), "speaker-mega-pulse", 900);
}

function replayMatchSound() {
  speak(matchTarget.symbol);
}

function handleMatchChoice(choice, btn) {
  if (matchLocked) return;
  const correct = choice.symbol === matchTarget.symbol;

  if (correct) {
    matchLocked = true;
    btn.classList.add("correct");
    burstAtElement(btn, true, 18);
    showFeedback(true);
    roundCorrect("match", startMatchRound, startMatchGame);
  } else {
    btn.classList.add("wrong");
    burstAtElement(btn, false, 12);
    breakStreak();
    roundWrong("match");
    // 說「這個是ㄉ，不是ㄅ」，念完才讓 banner 消失
    const banner = document.getElementById("feedbackBanner");
    banner.textContent = "再試一次 😊";
    banner.className = "feedback-banner show bad";
    speakSequence(["這個是", choice.symbol, "不是", matchTarget.symbol], 300, () => {
      setTimeout(() => banner.classList.remove("show"), 300);
    });
    setTimeout(() => btn.classList.remove("wrong"), 1200);
  }
}

// ========== 拼音顯示 ==========

// 拼音顯示共用工具

// 聲調畫成粗線圖示：字型裡的 ˊˇˋ 太細，小朋友看不清楚
const TONE_SVG_SHAPES = {
  "": '<path d="M7 20 L33 20"/>',
  "ˊ": '<path d="M10 31 L30 9"/>',
  "ˇ": '<path d="M8 10 L20 30 L32 10"/>',
  "ˋ": '<path d="M10 9 L30 31"/>',
  "˙": '<circle cx="20" cy="20" r="7"/>'
};

function toneSvg(tone) {
  const shape = TONE_SVG_SHAPES[tone] || TONE_SVG_SHAPES[""];
  return `<svg class="tone-svg" viewBox="0 0 40 40" role="img" aria-label="${TONE_NAMES[tone] || "一聲"}">${shape}</svg>`;
}

// 選聲調用的大按鈕內容：粗線圖示 + 「二聲」文字
function toneBadgeHtml(tone) {
  return `<span class="tone-badge">${toneSvg(tone)}<span class="tone-badge-name">${TONE_NAMES[tone] || "一聲"}</span></span>`;
}

// 拼音 + 下方標示第幾聲（聲調題的選項）
function toneOptionHtml(spelling, tone, size = 44) {
  const body = spelling.replace(TONE_MARKS, "");
  return `<span class="tone-option">${renderPinyinHtml(body, size)}${toneBadgeHtml(tone)}</span>`;
}

// 將拼音字串轉為直排 HTML 元件的輔助函式 (支援聲調置右)
function renderPinyinHtml(bopomofoStr, baseSize = 120, extraClass = '') {
  const TONE = /[ˊˇˋ˙]/;
  const toneChar = (bopomofoStr.match(TONE) || [''])[0];
  const bodyChars = bopomofoStr.replace(TONE, '');

  // 根據字數縮小字型大小以防超出區域
  let fontSize = baseSize;
  if (bodyChars.length === 2) fontSize = baseSize * 0.75;
  else if (bodyChars.length === 3) fontSize = baseSize * 0.55;

  let symbolsHtml = '';
  for (let char of bodyChars) {
    symbolsHtml += `<div>${char}</div>`;
  }

  const className = ['bopomofo-vertical', extraClass].filter(Boolean).join(' ');

  return `
    <div class="${className}" style="font-size: ${fontSize}px;">
      <div class="bopomofo-stack">
        ${symbolsHtml}
      </div>
      ${toneChar ? `<div class="bopomofo-tone">${toneSvg(toneChar)}</div>` : ''}
    </div>
  `;
}

function renderSpellSyllable(initial = '', final = '') {
  const slot = document.getElementById('spellSyllableSlot');
  if (!slot) return;

  const syllable = `${initial || ''}${final || ''}`;
  slot.innerHTML = syllable
    ? renderPinyinHtml(syllable, 62, 'spell-bopomofo spell-answer-bopomofo')
    : '';
}

// ========== 小測驗 ==========

const QUIZ_LENGTH = 10;
const HIGH_SCORE_KEY = "bpmf_high_score";

let quizQuestionNum = 0;
let quizScore = 0;
let quizLocked = false;

function startQuiz() {
  quizQuestionNum = 0;
  quizScore = 0;
  quizLocked = false;
  nextQuizQuestion();
}

function updateQuizHeader() {
  document.getElementById("quizProgress").textContent =
    "第 " + Math.min(quizQuestionNum + 1, QUIZ_LENGTH) + " / " + QUIZ_LENGTH + " 題";
  document.getElementById("quizStars").textContent = "⭐️ " + quizScore;
}

// 10 種題型輪流出現，同一種不會連續出兩次
const QUIZ_TYPES = [
  "hearSymbol",  // 聽符號音 → 選符號
  "seeSymbol",   // 看符號 → 選字頭相同的圖
  "hearWord",    // 聽詞語 → 選字頭（含沒有圖的聽力詞）
  "seePinyin",   // 看拼音 → 選圖
  "hearPinyin",  // 聽字 → 選拼音
  "hearTone",    // 聽字 → 選聲調
  "hearRime",    // 聽字 → 選韻（ㄢ/ㄤ、ㄣ/ㄥ 等）
  "oddOne",      // 四張圖，找字頭不一樣的
  "combine",     // 看聲母＋韻 → 拼起來是哪張圖
  "sameHead"     // 找和題目圖字頭一樣的圖
];
let quizLastType = null;

function quizAsk(text) {
  return `<div class="quiz-ask">${text}</div>`;
}

function quizEmojiButton(wordObj, isCorrect, showWord = true) {
  const btn = document.createElement("button");
  btn.className = "choice-card emoji-choice";
  btn.innerHTML = `<span class="emoji-choice-pic">${wordObj.emoji}</span>` +
    (showWord ? `<span class="emoji-choice-word">${wordObj.word}</span>` : "");
  btn.onclick = () => handleQuizAnswer(isCorrect, btn);
  return btn;
}

function quizSyllableButton(spelling, isCorrect, size = 65) {
  const btn = document.createElement("button");
  btn.className = "choice-card";
  btn.style.padding = "5px";
  btn.innerHTML = renderPinyinHtml(spelling, size);
  btn.onclick = () => handleQuizAnswer(isCorrect, btn);
  return btn;
}

function quizSymbolButton(symbol, isCorrect) {
  const btn = document.createElement("button");
  btn.className = "choice-card";
  btn.textContent = symbol;
  btn.onclick = () => handleQuizAnswer(isCorrect, btn);
  return btn;
}

function nextQuizQuestion() {
  if (quizQuestionNum >= QUIZ_LENGTH) {
    finishQuiz();
    return;
  }
  quizLocked = false;
  updateQuizHeader();

  let type;
  do { type = QUIZ_TYPES[randomInt(QUIZ_TYPES.length)]; } while (type === quizLastType);
  quizLastType = type;

  const area = document.getElementById("quizQuestionArea");
  const speakerBox = '<div class="prompt-box"><button class="speaker-btn" id="quizSpeaker">🔊</button></div>';
  const grid = () => document.getElementById("quizChoices");
  const gridHtml = '<div class="choices-grid" id="quizChoices"></div>';
  const setSpeaker = text => {
    document.getElementById("quizSpeaker").onclick = () => speak(text);
    speak(text);
  };

  if (type === "hearSymbol") {
    const target = BOPOMOFO_SYMBOLS[randomInt(BOPOMOFO_SYMBOLS.length)].symbol;
    area.innerHTML = quizAsk("聽一聽，是哪個注音？") + speakerBox + gridHtml;
    shuffle([target, ...pickDistractorSymbols(target, 3)])
      .forEach(sym => grid().appendChild(quizSymbolButton(sym, sym === target)));
    setSpeaker(target);

  } else if (type === "seeSymbol") {
    const pool = symbolsWithWords();
    const target = pool[randomInt(pool.length)].symbol;
    const others = pickDistractorSymbols(target, 3, pool.map(s => s.symbol));
    area.innerHTML = quizAsk("哪一個的第一個音是它？") +
      '<div class="prompt-box"><div class="flashcard quiz-symbol-card" id="quizSymbolCard">' +
      '<div class="symbol-big" style="font-size:140px">' + target + '</div></div></div>' + gridHtml;
    document.getElementById("quizSymbolCard").onclick = () => speak(target);
    shuffle([target, ...others]).forEach(sym =>
      grid().appendChild(quizEmojiButton(randomWordForHead(sym), sym === target)));
    speak(target);

  } else if (type === "hearWord") {
    const pool = BOPOMOFO_SYMBOLS.filter(s => (LISTEN_BY_HEAD[s.symbol] || []).length);
    const target = pool[randomInt(pool.length)].symbol;
    const list = LISTEN_BY_HEAD[target];
    const wordObj = list[randomInt(list.length)];
    area.innerHTML = quizAsk("聽詞語，第一個音是哪個注音？") + speakerBox + gridHtml;
    shuffle([target, ...pickDistractorSymbols(target, 3, pool.map(s => s.symbol))])
      .forEach(sym => grid().appendChild(quizSymbolButton(sym, sym === target)));
    setSpeaker(wordObj.word);

  } else if (type === "seePinyin") {
    const target = PINYIN_COMBOS[randomInt(PINYIN_COMBOS.length)];
    area.innerHTML = quizAsk("念念看，是哪一張圖？") +
      '<div class="prompt-box"><div class="flashcard quiz-symbol-card">' +
      renderPinyinHtml(comboSpelling(target), 130) + '</div></div>' + gridHtml;
    shuffle([target, ...pickOtherCombos(target, 3)])
      .forEach(c => grid().appendChild(quizEmojiButton(c, c === target, false)));

  } else if (type === "hearPinyin") {
    const target = PINYIN_COMBOS[randomInt(PINYIN_COMBOS.length)];
    const correct = comboSpelling(target);
    const near = nearMissSpellings(target, 1);
    const others = pickOtherCombos(target, 3).map(comboSpelling).filter(v => !near.includes(v)).slice(0, 2);
    area.innerHTML = quizAsk("聽一聽，注音怎麼拼？") + speakerBox + gridHtml;
    shuffle([correct, ...near, ...others])
      .forEach(sp => grid().appendChild(quizSyllableButton(sp, sp === correct)));
    setSpeaker(target.word);

  } else if (type === "hearTone") {
    // 單字念起來聲調最清楚
    const target = PINYIN_COMBOS[randomInt(PINYIN_COMBOS.length)];
    const p = comboParts(target);
    area.innerHTML = quizAsk(`聽一聽「${target.emoji}」是第幾聲？`) + speakerBox + gridHtml;
    ["", "ˊ", "ˇ", "ˋ"].forEach(t => {
      const btn = quizSyllableButton(p.initial + p.finalBody + t, t === p.tone, 60);
      btn.innerHTML = toneOptionHtml(p.initial + p.finalBody + t, t, 50);
      grid().appendChild(btn);
    });
    setSpeaker(target.word);

  } else if (type === "hearRime") {
    const pool = PINYIN_COMBOS.filter(c => comboParts(c).finalBody.length);
    const target = pool[randomInt(pool.length)];
    const rime = comboParts(target).finalBody;
    const allRimes = uniqueValues(pool.map(c => comboParts(c).finalBody));
    // 易混淆的韻（ㄢ↔ㄤ、ㄣ↔ㄥ、ㄧㄢ↔ㄧㄤ…）優先當干擾
    const swap = { "ㄢ": "ㄤ", "ㄤ": "ㄢ", "ㄣ": "ㄥ", "ㄥ": "ㄣ", "ㄞ": "ㄟ", "ㄟ": "ㄞ", "ㄛ": "ㄜ", "ㄜ": "ㄛ" };
    const last = rime.slice(-1);
    const tricky = swap[last] ? [rime.slice(0, -1) + swap[last]] : [];
    const others = uniqueValues([...tricky.filter(r => allRimes.includes(r)), ...shuffle(allRimes)])
      .filter(r => r !== rime).slice(0, 3);
    area.innerHTML = quizAsk(`「${target.emoji} ${target.word}」的韻是哪一個？`) + speakerBox + gridHtml;
    shuffle([rime, ...others]).forEach(r => grid().appendChild(quizSyllableButton(r, r === rime, 60)));
    setSpeaker(target.word);

  } else if (type === "oddOne") {
    const heads = Object.keys(WORDS_BY_HEAD).filter(h => WORDS_BY_HEAD[h].length >= 3);
    const same = heads[randomInt(heads.length)];
    const odd = pickDistractorSymbols(same, 1, Object.keys(WORDS_BY_HEAD))[0];
    const sameWords = shuffle(WORDS_BY_HEAD[same]).slice(0, 3);
    const oddWord = randomWordForHead(odd);
    area.innerHTML = quizAsk("哪一個的第一個音不一樣？<small>點一下聽，再點一下作答</small>") + gridHtml;
    shuffle([...sameWords, oddWord]).forEach(w => {
      const btn = quizEmojiButton(w, w === oddWord);
      const answer = btn.onclick;
      // 第一次點只念出來，再點一次才作答，讓孩子可以先聽
      btn.onclick = () => {
        if (btn.dataset.heard) { answer(); return; }
        grid().querySelectorAll(".emoji-choice").forEach(b => { delete b.dataset.heard; b.classList.remove("heard"); });
        btn.dataset.heard = "1";
        btn.classList.add("heard");
        speak(w.word);
      };
      grid().appendChild(btn);
    });
    speak("哪一個的第一個音不一樣？");

  } else if (type === "combine") {
    const target = SPLIT_COMBOS[randomInt(SPLIT_COMBOS.length)];
    area.innerHTML = quizAsk("拼起來是哪一個？") +
      '<div class="prompt-box quiz-combine">' +
      `<div class="pinyin-slot quiz-slot">${target.initial}</div><span class="plus-sign">➕</span>` +
      `<div class="pinyin-slot quiz-slot">${renderPinyinHtml(target.final, 90)}</div></div>` + gridHtml;
    shuffle([target, ...pickOtherCombos(target, 3, SPLIT_COMBOS)])
      .forEach(c => grid().appendChild(quizEmojiButton(c, c === target, false)));
    speakSequence([target.initial, target.final], 250);

  } else {
    // sameHead
    const pool = symbolsWithWords().filter(s => WORDS_BY_HEAD[s.symbol].length >= 2);
    const head = pool[randomInt(pool.length)].symbol;
    const [promptWord, answerWord] = shuffle(WORDS_BY_HEAD[head]).slice(0, 2);
    const others = pickDistractorSymbols(head, 3, symbolsWithWords().map(s => s.symbol)).map(randomWordForHead);
    area.innerHTML = quizAsk("哪一個的第一個音和它一樣？") +
      '<div class="prompt-box"><div class="flashcard quiz-symbol-card" id="quizPromptWord">' +
      `<div class="word-emoji" style="font-size:80px">${promptWord.emoji}</div><div class="word-text">${promptWord.word}</div></div></div>` +
      gridHtml;
    document.getElementById("quizPromptWord").onclick = () => speak(promptWord.word);
    shuffle([answerWord, ...others]).forEach(w => grid().appendChild(quizEmojiButton(w, w === answerWord)));
    speak(promptWord.word);
  }
}

function handleQuizAnswer(correct, btn) {
  if (quizLocked) return;
  quizLocked = true;

  if (correct) {
    btn.classList.add("correct");
    burstAtElement(btn, true, 18);
    quizScore++;
    showFeedback(true);
    updateQuizHeader();
    setTimeout(() => {
      quizQuestionNum++;
      nextQuizQuestion();
    }, 1100);
  } else {
    btn.classList.add("wrong");
    burstAtElement(btn, false, 12);
    showFeedback(false);
    // 答錯：停留同一題，讓孩子再試一次
    setTimeout(() => {
      btn.classList.remove("wrong");
      quizLocked = false;
    }, 1200);
  }
}

function finishQuiz() {
  const prevHigh = parseInt(localStorage.getItem(HIGH_SCORE_KEY) || "0", 10);
  const highScore = Math.max(prevHigh, quizScore);
  localStorage.setItem(HIGH_SCORE_KEY, String(highScore));

  const area = document.getElementById("quizQuestionArea");
  area.innerHTML =
    '<div class="quiz-result">' +
    '<div class="big-score">🏆</div>' +
    '<div class="word-text">恭喜你！你得到了 ' + quizScore + ' 顆星星！</div>' +
    '<div class="progress-text">最高紀錄：' + highScore + ' 顆星星</div>' +
    '<button class="big-btn combine-btn" onclick="startQuiz()">再玩一次</button>' +
    '</div>';
  document.getElementById("quizProgress").textContent = "完成！";
  speak("恭喜你，完成小測驗！");
}

// ========== 看圖選注音 ==========

const PICTURE_LENGTH = 10;
const PICTURE_IMAGES = {
  "狗": "images/picture/dog.jpg",
  "貓": "images/picture/cat.jpg",
  "兔": "images/picture/rabbit.jpg",
  "雞": "images/picture/chicken.jpg",
  "奶": "images/picture/milk.jpg",
  "花": "images/picture/flower.jpg",
  "牛": "images/picture/cow.jpg",
  "樹": "images/picture/tree.jpg"
};
let pictureDeck = [];
let pictureScore = 0;
let pictureQuestionNum = 0;
let pictureCombo = null;
let pictureLocked = false;
let pictureRunning = false;
let correctSfxContext = null;

function comboSpelling(combo) {
  return `${combo.initial}${combo.final}`;
}

function startPictureGame() {
  pictureScore = 0;
  pictureQuestionNum = 0;
  pictureRunning = true;
  pictureLocked = false;
  // 每輪 10 題不重複；有實拍照片的字一定會出現，其餘用圖示補滿
  const photos = shuffle(PINYIN_COMBOS.filter(c => PICTURE_IMAGES[c.word])).slice(0, 4);
  const rest = shuffle(PINYIN_COMBOS.filter(c => !PICTURE_IMAGES[c.word]));
  pictureDeck = shuffle([...photos, ...rest.slice(0, PICTURE_LENGTH - photos.length)]);
  document.getElementById('pictureGameover').style.display = 'none';
  nextPictureRound();
}

function nextPictureRound() {
  if (pictureQuestionNum >= PICTURE_LENGTH) {
    endPictureGame();
    return;
  }

  pictureLocked = false;
  pictureCombo = pictureDeck[pictureQuestionNum];

  document.getElementById('pictureProgress').textContent = `第 ${pictureQuestionNum + 1} / ${PICTURE_LENGTH} 題`;
  document.getElementById('pictureStars').textContent = `⭐ ${pictureScore}`;
  renderPicturePhoto(pictureCombo);
  document.getElementById('pictureWord').textContent = pictureCombo.word;
  resetPictureAnimationState();

  const correctSpelling = comboSpelling(pictureCombo);
  // 一個「差一點點」的錯音 + 兩個不同的音
  const near = nearMissSpellings(pictureCombo, 1);
  const others = pickOtherCombos(pictureCombo, 4)
    .map(comboSpelling)
    .filter(v => !near.includes(v))
    .slice(0, 2);
  const choices = shuffle([correctSpelling, ...near, ...others]);

  const grid = document.getElementById('pictureChoices');
  grid.innerHTML = '';
  choices.forEach(value => {
    const btn = document.createElement('button');
    btn.className = 'choice-card picture-choice-card';
    btn.innerHTML = renderPinyinHtml(value, 72, 'spell-bopomofo picture-bopomofo');
    btn.onclick = () => handlePictureChoice(value, btn);
    grid.appendChild(btn);
  });

  speak(pictureCombo.word);
}

function renderPicturePhoto(combo) {
  const img = document.getElementById("pictureImage");
  const big = document.getElementById("pictureEmojiBig");
  if (!img) return;
  const photo = PICTURE_IMAGES[combo.word];
  if (photo) {
    img.src = photo;
    img.alt = combo.word;
    img.style.display = "";
    if (big) big.style.display = "none";
  } else {
    img.removeAttribute("src");
    img.style.display = "none";
    if (big) {
      big.textContent = combo.emoji;
      big.style.display = "";
    }
  }
}

function replayPictureSound() {
  if (pictureCombo) speak(pictureCombo.word);
}

function playCorrectDingDing() {
  if (_currentAudio) {
    _currentAudio.pause();
    _currentAudio.onended = null;
    _currentAudio = null;
  }
  if ("speechSynthesis" in window) speechSynthesis.cancel();

  const AudioCtx = window.AudioContext || window.webkitAudioContext;
  if (!AudioCtx) return;
  if (!correctSfxContext) correctSfxContext = new AudioCtx();
  if (correctSfxContext.state === "suspended") correctSfxContext.resume();

  const ctx = correctSfxContext;
  const notes = [
    { start: 0, freq: 784, duration: 0.1 },
    { start: 0.13, freq: 1046.5, duration: 0.12 }
  ];
  notes.forEach(note => {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    const start = ctx.currentTime + note.start;
    const end = start + note.duration;
    osc.type = "sine";
    osc.frequency.setValueAtTime(note.freq, start);
    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.exponentialRampToValueAtTime(0.22, start + 0.012);
    gain.gain.exponentialRampToValueAtTime(0.0001, end);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(start);
    osc.stop(end + 0.02);
  });
}

function showPictureQuickCorrect() {
  const banner = document.getElementById("feedbackBanner");
  banner.textContent = PRAISES_TEXT[randomInt(PRAISES_TEXT.length)];
  banner.className = "feedback-banner show good";
  burstAtViewportCenter(true, 12);
  setTimeout(() => banner.classList.remove("show"), 420);
}

function handlePictureChoice(value, btn) {
  if (pictureLocked || !pictureRunning) return;
  const correct = value === comboSpelling(pictureCombo);

  if (!correct) {
    btn.classList.add('wrong');
    animatePictureWrong();
    showFeedback(false);
    setTimeout(() => btn.classList.remove('wrong'), 1200);
    return;
  }

  pictureLocked = true;
  btn.classList.add('correct');
  animatePictureCorrect();
  pictureScore++;
  pictureQuestionNum++;
  document.getElementById('pictureStars').textContent = `⭐ ${pictureScore}`;
  showPictureQuickCorrect();
  playCorrectDingDing();
  rewardCorrect();

  setTimeout(() => {
    if (pictureRunning) nextPictureRound();
  }, 520);
}

function endPictureGame() {
  pictureRunning = false;
  document.getElementById('pictureFinalScore').textContent = pictureScore;
  document.getElementById('pictureGameover').style.display = 'flex';
  const msg = pictureScore >= PICTURE_LENGTH ? '太棒了！圖片注音都選對了！' :
              pictureScore >= 6 ? '很棒！再練一下會更熟！' : '再試一次，慢慢看圖片和注音！';
  speak(msg);
}

function stopPictureGame() {
  pictureRunning = false;
  pictureLocked = false;
}

function resetPictureAnimationState() {
  const card = document.querySelector("#screen-picture .picture-card");
  if (!card) return;
  card.classList.remove("picture-enter", "picture-correct-burst", "picture-wrong-shake");
  void card.offsetWidth;
  card.classList.add("picture-enter");
}

function animatePictureWrong() {
  const card = document.querySelector("#screen-picture .picture-card");
  if (!card) return;
  card.classList.remove("picture-wrong-shake");
  void card.offsetWidth;
  card.classList.add("picture-wrong-shake");
  setTimeout(() => card.classList.remove("picture-wrong-shake"), 500);
}

function animatePictureCorrect() {
  const card = document.querySelector("#screen-picture .picture-card");
  if (!card) return;
  card.classList.remove("picture-correct-burst");
  void card.offsetWidth;
  card.classList.add("picture-correct-burst");
}

// ========== 新遊戲共用工具 ==========

const GAME_TONE_RE = /[ˊˇˋ˙]/;
const GAME_TONE_RE_GLOBAL = /[ˊˇˋ˙]/g;
const GAME_TONE_OPTIONS = ["", "ˊ", "ˇ", "ˋ", "˙"];

function uniqueValues(values) {
  return [...new Set(values.filter(value => value !== undefined && value !== null))];
}

function buildChoiceValues(correctValue, pool, count = 4) {
  const cleanPool = uniqueValues(pool);
  const others = shuffle(cleanPool.filter(value => value !== correctValue)).slice(0, count - 1);
  return shuffle([correctValue, ...others]);
}

function comboParts(combo) {
  const toneMatch = combo.final.match(GAME_TONE_RE);
  const tone = toneMatch ? toneMatch[0] : "";
  return {
    initial: combo.initial,
    finalBody: combo.final.replace(GAME_TONE_RE_GLOBAL, ""),
    tone,
    full: comboSpelling(combo)
  };
}

function toneSpeakText(tone) {
  return TONE_NAMES[tone] || TONE_NAMES[""];
}

function isTonePiece(value) {
  return value === "" || /^[ˊˇˋ˙]$/.test(value);
}

function renderGameChoiceHtml(value, baseSize = 68, extraClass = "game-bopomofo") {
  if (isTonePiece(value)) {
    return toneBadgeHtml(value);
  }
  return renderPinyinHtml(value, baseSize, extraClass);
}

function speakGamePiece(value) {
  if (isTonePiece(value)) speak(toneSpeakText(value));
  else speak(value);
}

function fullSpellingPieces(spelling) {
  const toneMatch = spelling.match(GAME_TONE_RE);
  const tone = toneMatch ? toneMatch[0] : "";
  const body = spelling.replace(GAME_TONE_RE_GLOBAL, "");
  const pieces = Array.from(body);
  if (tone) pieces.push(tone);
  return pieces;
}

// 題目詞語：要拼的字用顏色標出來（單字就直接顯示）
function questionWordHtml(q) {
  if (q.hl === undefined || q.word.length <= 1) return q.word;
  return [...q.word].map((ch, i) => i === q.hl ? `<span class="tone-hl">${ch}</span>` : ch).join("");
}

function questionChar(q) {
  return q.char || q.word;
}

// ========== 注音小火車 ==========

const TRAIN_LENGTH = 10;
let trainDeck = [];
let trainScore = 0;
let trainQuestionNum = 0;
let trainCombo = null;
let trainStep = 0;
let trainRunning = false;
let trainLocked = false;

function startTrainGame() {
  trainScore = 0;
  trainQuestionNum = 0;
  trainStep = 0;
  trainRunning = true;
  trainLocked = false;
  trainDeck = makeQuestionDeck(SPLIT_QUESTIONS, TRAIN_LENGTH);
  document.getElementById("trainGameover").style.display = "none";
  nextTrainRound();
}

function nextTrainRound() {
  if (trainQuestionNum >= TRAIN_LENGTH) {
    endTrainGame();
    return;
  }

  trainCombo = trainDeck[trainQuestionNum];
  trainStep = 0;
  trainLocked = false;

  document.getElementById("trainProgress").textContent = `第 ${trainQuestionNum + 1} / ${TRAIN_LENGTH} 題`;
  document.getElementById("trainStars").textContent = `⭐ ${trainScore}`;
  document.getElementById("trainEmoji").textContent = trainCombo.emoji;
  document.getElementById("trainWord").innerHTML = questionWordHtml(trainCombo);
  document.getElementById("trainInitialCar").innerHTML = "";
  document.getElementById("trainFinalCar").innerHTML = "";
  document.getElementById("trainToneCar").textContent = "";
  resetTrainAnimationState();

  updateTrainHint();
  renderTrainChoices();
  speak(promptText(trainCombo));
}

function trainExpectedValue() {
  const parts = comboParts(trainCombo);
  if (trainStep === 0) return parts.initial;
  if (trainStep === 1) return parts.finalBody;
  return parts.tone;
}

function updateTrainHint() {
  const hints = ["先選聲母", "再選韻符", "最後選聲調"];
  document.getElementById("trainHint").textContent = hints[trainStep] || "火車準備出發";
}

function renderTrainChoices() {
  const parts = comboParts(trainCombo);
  const grid = document.getElementById("trainChoices");
  grid.innerHTML = "";

  let values;
  if (trainStep === 0) {
    values = shuffle([parts.initial, ...pickDistractorSymbols(parts.initial, 3, BPMF_INITIALS.split(""))]);
  } else if (trainStep === 1) {
    values = buildChoiceValues(
      parts.finalBody,
      [...SPLIT_QUESTIONS.map(combo => comboParts(combo).finalBody), ...confusablesOf(parts.finalBody)],
      4
    );
  } else {
    // 四個聲調固定順序排好，比較好比較
    values = ["", "ˊ", "ˇ", "ˋ"];
  }

  values.forEach(value => {
    const btn = document.createElement("button");
    btn.className = "choice-card train-choice-card";
    btn.innerHTML = trainStep === 2
      ? renderTrainToneHtml(value)
      : renderGameChoiceHtml(value, trainStep === 1 ? 58 : 70, "game-bopomofo train-bopomofo");
    btn.onclick = () => handleTrainChoice(value, btn);
    grid.appendChild(btn);
  });
}

function renderTrainToneHtml(tone) {
  return toneBadgeHtml(tone);
}

function handleTrainChoice(value, btn) {
  if (!trainRunning || trainLocked || !trainCombo) return;
  const expected = trainExpectedValue();

  if (value !== expected) {
    btn.classList.add("wrong");
    animateTrainWrong();
    showFeedback(false);
    setTimeout(() => btn.classList.remove("wrong"), 1100);
    return;
  }

  btn.classList.add("correct");
  fillTrainCar(value);
  animateTrainCar(trainStep);
  trainStep++;
  updateTrainCarStates();

  if (trainStep >= 3) {
    trainLocked = true;
    trainScore++;
    trainQuestionNum++;
    document.getElementById("trainStars").textContent = `⭐ ${trainScore}`;
    animateTrainDepart();
    showFeedback(true);
    setTimeout(() => {
      if (trainRunning) nextTrainRound();
    }, 1450);
    return;
  }

  speakGamePiece(value);
  updateTrainHint();
  setTimeout(() => {
    if (trainRunning) renderTrainChoices();
  }, 350);
}

function fillTrainCar(value) {
  if (trainStep === 0) {
    document.getElementById("trainInitialCar").innerHTML = renderPinyinHtml(value, 52, "game-bopomofo train-car-bopomofo");
  } else if (trainStep === 1) {
    document.getElementById("trainFinalCar").innerHTML = renderPinyinHtml(value, 50, "game-bopomofo train-car-bopomofo");
  } else {
    document.getElementById("trainToneCar").innerHTML = renderTrainToneHtml(value);
  }
}

function resetTrainAnimationState() {
  const board = document.querySelector("#screen-train .train-board");
  const track = document.querySelector("#screen-train .train-track");
  const picture = document.querySelector("#screen-train .train-picture");
  if (board) {
    board.classList.remove("train-round-enter");
    void board.offsetWidth;
    board.classList.add("train-round-enter");
  }
  if (track) {
    track.classList.remove("departing", "arriving", "shake");
    void track.offsetWidth;
    track.classList.add("arriving");
    setTimeout(() => {
      if (track.classList.contains("arriving")) track.classList.remove("arriving");
    }, 1100);
  }
  if (picture) {
    picture.classList.remove("train-picture-pulse");
    void picture.offsetWidth;
    picture.classList.add("train-picture-pulse");
  }
  document.querySelectorAll("#screen-train .train-car").forEach(car => {
    car.classList.remove("active", "filled", "pop");
  });
  updateTrainCarStates();
}

function updateTrainCarStates() {
  document.querySelectorAll("#screen-train .train-car").forEach((car, index) => {
    car.classList.toggle("filled", index < trainStep);
    car.classList.toggle("active", index === trainStep && trainStep < 3);
  });
}

function animateTrainCar(index) {
  const car = document.querySelectorAll("#screen-train .train-car")[index];
  if (!car) return;
  car.classList.remove("pop");
  void car.offsetWidth;
  car.classList.add("pop");
}

function animateTrainDepart() {
  const track = document.querySelector("#screen-train .train-track");
  if (!track) return;
  track.classList.remove("departing", "arriving");
  void track.offsetWidth;
  track.classList.add("departing");
}

function animateTrainWrong() {
  const track = document.querySelector("#screen-train .train-track");
  if (!track) return;
  track.classList.remove("shake");
  void track.offsetWidth;
  track.classList.add("shake");
  setTimeout(() => track.classList.remove("shake"), 500);
}

function replayTrainSound() {
  if (trainCombo) speak(promptText(trainCombo));
}

function endTrainGame() {
  trainRunning = false;
  document.getElementById("trainFinalScore").textContent = trainScore;
  document.getElementById("trainGameover").style.display = "flex";
  const msg = trainScore >= TRAIN_LENGTH ? "小火車全部接對了！" :
              trainScore >= 5 ? "很棒，聲母韻符聲調越來越熟了！" : "再玩一次，慢慢接每一節車廂！";
  speak(msg);
}

function stopTrainGame() {
  trainRunning = false;
  trainLocked = false;
}

// ========== 怪獸吃錯音 ==========

const MONSTER_LENGTH = 10;
let monsterDeck = [];
let monsterScore = 0;
let monsterQuestionNum = 0;
let monsterCombo = null;
let monsterRunning = false;
let monsterLocked = false;
let monsterWrongCount = 0;

function startMonsterGame() {
  monsterScore = 0;
  monsterQuestionNum = 0;
  monsterWrongCount = 0;
  monsterRunning = true;
  monsterDeck = makeQuestionDeck(SYLLABLE_QUESTIONS, MONSTER_LENGTH);
  monsterLocked = false;
  document.getElementById("monsterGameover").style.display = "none";
  nextMonsterRound();
}

function nextMonsterRound() {
  if (monsterQuestionNum >= MONSTER_LENGTH) {
    endMonsterGame();
    return;
  }

  monsterCombo = monsterDeck[monsterQuestionNum];
  monsterLocked = false;

  document.getElementById("monsterProgress").textContent = `第 ${monsterQuestionNum + 1} / ${MONSTER_LENGTH} 題`;
  document.getElementById("monsterStars").textContent = `⭐ ${monsterScore}`;
  document.getElementById("monsterFace").textContent = "👾";
  document.getElementById("monsterEmoji").textContent = monsterCombo.emoji;
  document.getElementById("monsterWord").innerHTML = questionWordHtml(monsterCombo);
  updateMonsterBelly();
  updateMonsterPersona(`嗷！我要吃「${questionChar(monsterCombo)}」的注音！`, "hungry");
  resetMonsterAnimationState();

  const correctSpelling = comboSpelling(monsterCombo);
  // 錯音獸的陷阱：都是「聽起來很像」的錯音
  const values = shuffle([correctSpelling, ...nearMissSpellings(monsterCombo, 3)]);
  const grid = document.getElementById("monsterChoices");
  grid.innerHTML = "";
  values.forEach(value => {
    const btn = document.createElement("button");
    btn.className = "choice-card monster-choice-card";
    btn.innerHTML = renderGameChoiceHtml(value, 72, "game-bopomofo monster-bopomofo");
    btn.onclick = () => handleMonsterChoice(value, btn);
    grid.appendChild(btn);
  });

  speak(promptText(monsterCombo));
}

function replayMonsterSound() {
  if (monsterCombo) speak(promptText(monsterCombo));
}

function handleMonsterChoice(value, btn) {
  if (!monsterRunning || monsterLocked || !monsterCombo) return;
  const correct = value === comboSpelling(monsterCombo);

  if (!correct) {
    monsterLocked = true;
    monsterWrongCount++;
    btn.classList.add("wrong", "monster-choice-spitting");
    document.getElementById("monsterFace").textContent = "😖";
    updateMonsterPersona("呸！錯音吐掉！", "angry");
    animateMonsterWrong(btn);
    showFeedback(false);
    setTimeout(() => {
      btn.classList.remove("wrong", "monster-choice-spitting");
      if (monsterRunning) {
        monsterLocked = false;
        document.getElementById("monsterFace").textContent = "👾";
        updateMonsterPersona(`再餵一次「${questionChar(monsterCombo)}」的正確注音！`, "hungry");
      }
    }, 1250);
    return;
  }

  monsterLocked = true;
  btn.classList.add("correct");
  document.getElementById("monsterFace").textContent = "😋";
  monsterScore++;
  monsterQuestionNum++;
  document.getElementById("monsterStars").textContent = `⭐ ${monsterScore}`;
  updateMonsterBelly();
  updateMonsterPersona(`嗷嗚！${comboSpelling(monsterCombo)} 好吃！`, "happy");
  animateMonsterEat(btn);
  showFeedback(true);

  setTimeout(() => {
    if (monsterRunning) nextMonsterRound();
  }, 1200);
}

function endMonsterGame() {
  monsterRunning = false;
  document.getElementById("monsterFinalScore").textContent = monsterScore;
  document.getElementById("monsterGameover").style.display = "flex";
  const msg = monsterScore >= MONSTER_LENGTH ? "錯音獸吃到全部正確注音了！" :
              monsterScore >= 6 ? "很棒，錯音獸吃得很開心！" : "再試一次，先看圖再餵錯音獸！";
  speak(msg);
}

function stopMonsterGame() {
  monsterRunning = false;
  monsterLocked = false;
}

function updateMonsterBelly() {
  const fill = document.getElementById("monsterBellyFill");
  const text = document.getElementById("monsterBellyText");
  const percent = Math.min(100, Math.round((monsterScore / MONSTER_LENGTH) * 100));
  if (fill) fill.style.width = `${percent}%`;
  if (text) text.textContent = `${monsterScore} / ${MONSTER_LENGTH}`;
}

function updateMonsterPersona(message, mood) {
  const speech = document.getElementById("monsterSpeech");
  const creature = document.getElementById("monsterCreature");
  const rule = document.getElementById("monsterRule");
  if (speech) speech.textContent = message;
  if (rule) {
    rule.textContent = monsterWrongCount >= 2
      ? "牠被錯音惹毛了，餵正確音讓牠冷靜"
      : "錯音獸只吃和圖片同音的注音";
  }
  if (creature) {
    creature.classList.remove("hungry", "happy", "angry");
    creature.classList.add(mood || "hungry");
  }
}

function resetMonsterAnimationState() {
  const card = document.querySelector("#screen-monster .monster-card");
  const mouth = document.querySelector("#screen-monster .monster-mouth");
  const food = document.querySelector("#screen-monster .monster-food-picture");
  const creature = document.getElementById("monsterCreature");
  if (card) {
    card.classList.remove("monster-enter", "monster-wrong", "monster-eat");
    void card.offsetWidth;
    card.classList.add("monster-enter");
  }
  if (mouth) mouth.classList.remove("chewing", "ready", "rejecting");
  if (food) food.classList.remove("food-fly");
  if (creature) creature.classList.remove("monster-fed", "monster-reject");
  document.querySelectorAll(".monster-flying-snack").forEach(el => el.remove());
  setTimeout(() => {
    if (monsterRunning && mouth) mouth.classList.add("ready");
  }, 120);
}

function animateMonsterWrong(btn) {
  const card = document.querySelector("#screen-monster .monster-card");
  const mouth = document.getElementById("monsterMouth");
  const creature = document.getElementById("monsterCreature");
  animateMonsterSpitSnack(btn);
  if (card) {
    card.classList.remove("monster-wrong");
    void card.offsetWidth;
    card.classList.add("monster-wrong", "monster-spit");
    setTimeout(() => card.classList.remove("monster-wrong", "monster-spit"), 980);
  }
  if (mouth) {
    mouth.classList.remove("rejecting");
    void mouth.offsetWidth;
    mouth.classList.add("rejecting");
    setTimeout(() => mouth.classList.remove("rejecting"), 1050);
  }
  if (creature) {
    creature.classList.remove("monster-reject");
    void creature.offsetWidth;
    creature.classList.add("monster-reject");
    setTimeout(() => creature.classList.remove("monster-reject"), 1050);
  }
}

function animateMonsterEat(btn) {
  const card = document.querySelector("#screen-monster .monster-card");
  const mouth = document.querySelector("#screen-monster .monster-mouth");
  const food = document.querySelector("#screen-monster .monster-food-picture");
  const creature = document.getElementById("monsterCreature");
  animateMonsterFlyingSnack(btn);
  if (card) {
    card.classList.remove("monster-eat");
    void card.offsetWidth;
    card.classList.add("monster-eat");
  }
  if (food) {
    food.classList.remove("food-fly");
    void food.offsetWidth;
    food.classList.add("food-fly");
  }
  if (mouth) {
    mouth.classList.remove("ready", "chewing");
    void mouth.offsetWidth;
    mouth.classList.add("chewing");
  }
  if (creature) {
    creature.classList.remove("monster-fed");
    void creature.offsetWidth;
    creature.classList.add("monster-fed");
  }
}

function animateMonsterFlyingSnack(btn) {
  const mouth = document.getElementById("monsterMouth");
  if (!btn || !mouth) return;
  btn.classList.add("monster-choice-eaten");

  const from = btn.getBoundingClientRect();
  const to = mouth.getBoundingClientRect();
  const clone = btn.cloneNode(true);
  clone.className = "monster-flying-snack";
  clone.style.left = `${from.left}px`;
  clone.style.top = `${from.top}px`;
  clone.style.width = `${from.width}px`;
  clone.style.height = `${from.height}px`;
  clone.style.setProperty("--fly-x", `${to.left + to.width / 2 - (from.left + from.width / 2)}px`);
  clone.style.setProperty("--fly-y", `${to.top + to.height / 2 - (from.top + from.height / 2)}px`);
  document.body.appendChild(clone);
  setTimeout(() => clone.remove(), 760);
}

function animateMonsterSpitSnack(btn) {
  const mouth = document.getElementById("monsterMouth");
  if (!btn || !mouth) return;

  const from = btn.getBoundingClientRect();
  const to = mouth.getBoundingClientRect();
  const clone = btn.cloneNode(true);
  const spitX = (from.left < window.innerWidth / 2 ? -120 : 120);
  clone.className = "monster-flying-snack rejecting";
  clone.style.left = `${from.left}px`;
  clone.style.top = `${from.top}px`;
  clone.style.width = `${from.width}px`;
  clone.style.height = `${from.height}px`;
  clone.style.setProperty("--fly-x", `${to.left + to.width / 2 - (from.left + from.width / 2)}px`);
  clone.style.setProperty("--fly-y", `${to.top + to.height / 2 - (from.top + from.height / 2)}px`);
  clone.style.setProperty("--spit-x", `${to.left + to.width / 2 - (from.left + from.width / 2) + spitX}px`);
  clone.style.setProperty("--spit-y", `${to.top + to.height / 2 - (from.top + from.height / 2) + 92}px`);
  document.body.appendChild(clone);
  setTimeout(() => clone.remove(), 1180);
}

// ========== 注音拼圖島 ==========

const ISLAND_LENGTH = 8;
let islandDeck = [];
let islandScore = 0;
let islandQuestionNum = 0;
let islandCombo = null;
let islandTargetPieces = [];
let islandSelectedPieces = [];
let islandRunning = false;
let islandLocked = false;

function startIslandGame() {
  islandScore = 0;
  islandQuestionNum = 0;
  islandTargetPieces = [];
  islandSelectedPieces = [];
  islandRunning = true;
  islandLocked = false;
  islandDeck = makeQuestionDeck(SYLLABLE_QUESTIONS, ISLAND_LENGTH);
  document.getElementById("islandGameover").style.display = "none";
  nextIslandRound();
}

function nextIslandRound() {
  if (islandQuestionNum >= ISLAND_LENGTH) {
    endIslandGame();
    return;
  }

  islandCombo = islandDeck[islandQuestionNum];
  islandTargetPieces = fullSpellingPieces(comboSpelling(islandCombo));
  islandSelectedPieces = [];
  islandLocked = false;

  document.getElementById("islandProgress").textContent = `第 ${islandQuestionNum + 1} / ${ISLAND_LENGTH} 題`;
  document.getElementById("islandStars").textContent = `⭐ ${islandScore}`;
  document.getElementById("islandEmoji").textContent = islandCombo.emoji;
  document.getElementById("islandWord").innerHTML = questionWordHtml(islandCombo);
  updateIslandHint();
  renderIslandTower();
  buildIslandPieceValues();
  renderIslandPieces();
  resetIslandAnimationState();
  speak(promptText(islandCombo));
}

function renderIslandTower() {
  const tower = document.getElementById("islandTower");
  const targetTone = islandTargetPieces.find(piece => GAME_TONE_RE.test(piece)) || "";
  const targetBody = islandTargetPieces.filter(piece => !GAME_TONE_RE.test(piece));
  const selectedTone = islandSelectedPieces.find(piece => GAME_TONE_RE.test(piece)) || "";
  const selectedBody = islandSelectedPieces.filter(piece => !GAME_TONE_RE.test(piece));

  const bodyHtml = targetBody.map((piece, index) => {
    const filled = index < selectedBody.length;
    return `<div class="island-slot ${filled ? "filled" : ""}">${filled ? selectedBody[index] : "？"}</div>`;
  }).join("");

  const toneHtml = targetTone
    ? `<div class="island-tone-lane"><div class="island-slot tone-slot ${selectedTone ? "filled" : ""}">${selectedTone || "？"}</div></div>`
    : "";

  tower.innerHTML = `
    <div class="island-stack-lane">${bodyHtml}</div>
    ${toneHtml}
  `;
}

let islandPieceValues = [];

function buildIslandPieceValues() {
  const size = Math.max(6, islandTargetPieces.length + 2);
  const targets = uniqueValues(islandTargetPieces);
  // 干擾塊優先用易混淆音，讓拼圖需要真的聽清楚
  const tricky = targets.flatMap(confusablesOf);
  const pool = [...tricky, ...shuffle(BOPOMOFO_SYMBOLS.map(item => item.symbol)), "ˊ", "ˇ", "ˋ"];
  const extras = uniqueValues(pool).filter(v => !targets.includes(v));
  islandPieceValues = shuffle([...targets, ...extras.slice(0, size - targets.length)]);
}

function renderIslandPieces() {
  const grid = document.getElementById("islandPieces");
  grid.innerHTML = "";

  islandPieceValues.forEach(value => {
    // 同一塊在題目中出現幾次，就要用幾次才算用完
    const need = islandTargetPieces.filter(v => v === value).length;
    const usedCount = islandSelectedPieces.filter(v => v === value).length;
    const used = need > 0 && usedCount >= need;
    const btn = document.createElement("button");
    btn.className = `choice-card island-piece-card${used ? " used" : ""}`;
    btn.innerHTML = renderGameChoiceHtml(value, 68, "game-bopomofo island-piece-bopomofo");
    btn.disabled = used;
    btn.onclick = () => handleIslandPiece(value, btn);
    grid.appendChild(btn);
  });
}

function updateIslandHint() {
  const current = islandSelectedPieces.length + 1;
  const total = islandTargetPieces.length;
  document.getElementById("islandHint").textContent = `依照順序拼出注音：第 ${Math.min(current, total)} / ${total} 塊`;
}

function handleIslandPiece(value, btn) {
  if (!islandRunning || islandLocked || !islandCombo) return;
  const expected = islandTargetPieces[islandSelectedPieces.length];

  if (value !== expected) {
    btn.classList.add("wrong");
    animateIslandWrong();
    showFeedback(false);
    setTimeout(() => btn.classList.remove("wrong"), 1100);
    return;
  }

  islandSelectedPieces.push(value);
  btn.classList.add("correct", "piece-launch");
  speakGamePiece(value);
  renderIslandTower();
  animateIslandPiece();

  if (islandSelectedPieces.length >= islandTargetPieces.length) {
    islandLocked = true;
    islandScore++;
    islandQuestionNum++;
    document.getElementById("islandStars").textContent = `⭐ ${islandScore}`;
    animateIslandComplete();
    showFeedback(true);
    setTimeout(() => {
      if (islandRunning) nextIslandRound();
    }, 1200);
    return;
  }

  updateIslandHint();
  renderIslandPieces();
}

function replayIslandSound() {
  if (islandCombo) speak(promptText(islandCombo));
}

function endIslandGame() {
  islandRunning = false;
  document.getElementById("islandFinalScore").textContent = islandScore;
  document.getElementById("islandGameover").style.display = "flex";
  const msg = islandScore >= ISLAND_LENGTH ? "拼圖島全部完成了！" :
              islandScore >= 5 ? "很棒，注音順序越來越清楚！" : "再試一次，一塊一塊慢慢拼！";
  speak(msg);
}

function stopIslandGame() {
  islandRunning = false;
  islandLocked = false;
}

function resetIslandAnimationState() {
  const card = document.querySelector("#screen-island .island-card");
  const tower = document.getElementById("islandTower");
  if (card) {
    card.classList.remove("island-card-enter", "island-card-celebrate");
    void card.offsetWidth;
    card.classList.add("island-card-enter");
  }
  if (tower) {
    tower.classList.remove("island-tower-enter", "island-tower-pop", "island-tower-shake", "island-tower-complete");
    void tower.offsetWidth;
    tower.classList.add("island-tower-enter");
  }
}

function animateIslandPiece() {
  const tower = document.getElementById("islandTower");
  const filledSlots = document.querySelectorAll("#islandTower .island-slot.filled");
  const lastSlot = filledSlots[filledSlots.length - 1];
  if (tower) {
    tower.classList.remove("island-tower-pop");
    void tower.offsetWidth;
    tower.classList.add("island-tower-pop");
  }
  if (lastSlot) {
    lastSlot.classList.remove("island-slot-pop");
    void lastSlot.offsetWidth;
    lastSlot.classList.add("island-slot-pop");
  }
}

function animateIslandWrong() {
  const tower = document.getElementById("islandTower");
  if (!tower) return;
  tower.classList.remove("island-tower-shake");
  void tower.offsetWidth;
  tower.classList.add("island-tower-shake");
  setTimeout(() => tower.classList.remove("island-tower-shake"), 500);
}

function animateIslandComplete() {
  const card = document.querySelector("#screen-island .island-card");
  const tower = document.getElementById("islandTower");
  if (card) {
    card.classList.remove("island-card-celebrate");
    void card.offsetWidth;
    card.classList.add("island-card-celebrate");
  }
  if (tower) {
    tower.classList.remove("island-tower-complete");
    void tower.offsetWidth;
    tower.classList.add("island-tower-complete");
  }
}

// ========== 注音節奏台 ==========

const RHYTHM_LENGTH = 8;
let rhythmDeck = [];
const RHYTHM_COUNT_MS = 820;
const RHYTHM_ANSWER_MS = 2600;

let rhythmScore = 0;
let rhythmBeatNum = 0;
let rhythmLives = 5;
let rhythmStreak = 0;
let rhythmCombo = null;
let rhythmChoices = [];
let rhythmCorrectIndex = -1;
let rhythmCountStep = 0;
let rhythmAnswerOpen = false;
let rhythmRunning = false;
let rhythmLocked = false;
let rhythmMissTimer = null;
let rhythmNextTimer = null;
let rhythmCountTimer = null;

function startRhythmGame() {
  stopRhythmGame();
  rhythmScore = 0;
  rhythmBeatNum = 0;
  rhythmLives = 5;
  rhythmStreak = 0;
  rhythmRunning = true;
  rhythmLocked = false;
  rhythmDeck = makeQuestionDeck(SYLLABLE_QUESTIONS, RHYTHM_LENGTH);
  document.getElementById("rhythmGameover").style.display = "none";
  nextRhythmBeat();
}

function nextRhythmBeat() {
  if (!rhythmRunning) return;
  clearTimeout(rhythmCountTimer);
  clearTimeout(rhythmMissTimer);
  clearTimeout(rhythmNextTimer);

  if (rhythmBeatNum >= RHYTHM_LENGTH || rhythmLives <= 0) {
    endRhythmGame();
    return;
  }

  rhythmLocked = false;
  rhythmCombo = rhythmDeck[rhythmBeatNum];
  const correctSpelling = comboSpelling(rhythmCombo);
  rhythmChoices = buildChoiceValues(correctSpelling, PINYIN_COMBOS.map(comboSpelling), 3);
  rhythmCorrectIndex = rhythmChoices.indexOf(correctSpelling);
  rhythmCountStep = 0;
  rhythmAnswerOpen = false;

  document.getElementById("rhythmEmoji").textContent = rhythmCombo.emoji;
  document.getElementById("rhythmWord").innerHTML = questionWordHtml(rhythmCombo);
  document.getElementById("rhythmStatus").textContent = "聽詞語，前三拍跟著答";
  updateRhythmHud();
  updateRhythmCount();
  renderRhythmLanes();

  speak(promptText(rhythmCombo), () => {
    if (!rhythmRunning || rhythmLocked) return;
    rhythmCountTimer = setTimeout(playRhythmCount, 260);
  });
}

function updateRhythmHud() {
  document.getElementById("rhythmProgress").textContent = `第 ${Math.min(rhythmBeatNum + 1, RHYTHM_LENGTH)} / ${RHYTHM_LENGTH} 題`;
  document.getElementById("rhythmCombo").textContent = `連擊 ${rhythmStreak}`;
  document.getElementById("rhythmLives").textContent = "❤".repeat(Math.max(0, rhythmLives));
  document.getElementById("rhythmStars").textContent = `⭐ ${rhythmScore}`;
}

function renderRhythmLanes() {
  const lanes = document.getElementById("rhythmLanes");
  lanes.innerHTML = "";

  rhythmChoices.forEach((value, index) => {
    const lane = document.createElement("button");
    lane.className = "rhythm-lane waiting";
    lane.innerHTML = `
      <div class="rhythm-note">♪</div>
      <div class="rhythm-hit-line"></div>
      <div class="rhythm-lane-label">${renderGameChoiceHtml(value, 56, "game-bopomofo rhythm-bopomofo")}</div>
    `;
    lane.onclick = () => handleRhythmTap(index, lane);
    lanes.appendChild(lane);
  });
}

function updateRhythmCount() {
  const count = document.getElementById("rhythmCount");
  if (!count) return;
  [...count.children].forEach((item, index) => {
    item.classList.toggle("active", index === rhythmCountStep - 1);
    item.classList.toggle("answer", rhythmAnswerOpen && index === 3);
  });
}

function playRhythmTapSound(accent = false) {
  const AudioCtx = window.AudioContext || window.webkitAudioContext;
  if (!AudioCtx) return;
  if (!correctSfxContext) correctSfxContext = new AudioCtx();
  if (correctSfxContext.state === "suspended") correctSfxContext.resume();
  const ctx = correctSfxContext;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  const start = ctx.currentTime;
  const end = start + (accent ? 0.16 : 0.13);
  osc.type = "square";
  osc.frequency.setValueAtTime(accent ? 523.25 : 261.63, start);
  gain.gain.setValueAtTime(0.0001, start);
  gain.gain.exponentialRampToValueAtTime(accent ? 0.24 : 0.18, start + 0.01);
  gain.gain.exponentialRampToValueAtTime(0.0001, end);
  osc.connect(gain);
  gain.connect(ctx.destination);
  osc.start(start);
  osc.stop(end + 0.02);
}

function speakRhythmBeat(text) {
  speak(text);
}

function playRhythmCount() {
  if (!rhythmRunning || rhythmLocked) return;
  rhythmCountStep++;
  rhythmAnswerOpen = rhythmCountStep >= 4;
  updateRhythmCount();

  if (rhythmCountStep < 4) {
    document.getElementById("rhythmStatus").textContent = "答";
    playRhythmTapSound(false);
    speakRhythmBeat("答");
    rhythmCountTimer = setTimeout(playRhythmCount, RHYTHM_COUNT_MS);
    return;
  }

  document.getElementById("rhythmStatus").textContent = "第四拍，選答案！";
  playRhythmTapSound(true);
  speakRhythmBeat("選");
  document.querySelectorAll("#rhythmLanes .rhythm-lane").forEach(lane => lane.classList.remove("waiting"));
  rhythmMissTimer = setTimeout(() => missRhythmBeat(), RHYTHM_ANSWER_MS);
}

function handleRhythmTap(index, lane) {
  if (!rhythmRunning || rhythmLocked || !rhythmCombo) return;
  if (!rhythmAnswerOpen) {
    document.getElementById("rhythmStatus").textContent = "還沒到第四拍";
    playRhythmTapSound(false);
    return;
  }

  const isCorrectLane = index === rhythmCorrectIndex;

  if (!isCorrectLane) {
    rhythmLives--;
    rhythmStreak = 0;
    lane.classList.add("wrong");
    document.getElementById("rhythmStatus").textContent = "注音不對，再聽一次";
    showFeedback(false, false);
    updateRhythmHud();
    if (rhythmLives <= 0) {
      clearTimeout(rhythmMissTimer);
      rhythmNextTimer = setTimeout(endRhythmGame, 700);
      return;
    }
    setTimeout(() => {
      lane.classList.remove("wrong");
      if (rhythmRunning && !rhythmLocked) document.getElementById("rhythmStatus").textContent = "第四拍，選答案！";
    }, 650);
    return;
  }

  rhythmLocked = true;
  rhythmAnswerOpen = false;
  clearTimeout(rhythmCountTimer);
  clearTimeout(rhythmMissTimer);
  rhythmScore++;
  rhythmStreak++;
  rhythmBeatNum++;
  lane.classList.add("correct");
  document.getElementById("rhythmStatus").textContent = "選對了！";
  updateRhythmHud();
  burstAtElement(lane, true, 14);
  playCorrectDingDing();
  rewardCorrect();
  rhythmNextTimer = setTimeout(nextRhythmBeat, 680);
}

function missRhythmBeat() {
  if (!rhythmRunning || rhythmLocked) return;
  rhythmLocked = true;
  rhythmAnswerOpen = false;
  rhythmLives--;
  rhythmStreak = 0;
  document.getElementById("rhythmStatus").textContent = "漏拍了";
  document.querySelectorAll("#rhythmLanes .rhythm-lane").forEach(lane => lane.classList.add("missed"));
  updateRhythmHud();
  showFeedback(false, false);
  rhythmNextTimer = setTimeout(() => {
    rhythmBeatNum++;
    nextRhythmBeat();
  }, 900);
}

function replayRhythmSound() {
  if (rhythmCombo) speak(promptText(rhythmCombo));
}

function endRhythmGame() {
  rhythmRunning = false;
  clearTimeout(rhythmMissTimer);
  clearTimeout(rhythmNextTimer);
  document.getElementById("rhythmFinalScore").textContent = rhythmScore;
  document.getElementById("rhythmGameover").style.display = "flex";
  const msg = rhythmScore >= RHYTHM_LENGTH ? "注音都選對了！節奏很穩！" :
              rhythmScore >= 5 ? "很棒，聽音越來越準！" : "再試一次，先聽詞語再選注音！";
  speak(msg);
}

function stopRhythmGame() {
  rhythmRunning = false;
  rhythmLocked = false;
  rhythmAnswerOpen = false;
  clearTimeout(rhythmCountTimer);
  clearTimeout(rhythmMissTimer);
  clearTimeout(rhythmNextTimer);
}

// ========== 記憑配對 ==========

let memFlipped = [];
let memMatched = 0;
let memMoves   = 0;
let memLocked  = false;
const MEM_PAIRS = 6;

function startMemoryGame() {
  memFlipped = [];
  memMatched = 0;
  memMoves   = 0;
  memLocked  = false;

  document.getElementById('memoryMoves').textContent   = '翻牌次數：0';
  document.getElementById('memoryMatched').textContent = '配對：0 / ' + MEM_PAIRS;

  // 符號牌 ↔ 字頭是這個符號的圖片牌；避開容易混淆的音同時出現太多
  const chosen = shuffle(symbolsWithWords()).slice(0, MEM_PAIRS);
  const cards  = [];
  chosen.forEach((item, i) => {
    const w = randomWordForHead(item.symbol);
    cards.push({ matchId: i, type: 'symbol', display: item.symbol, speakText: item.symbol });
    cards.push({ matchId: i, type: 'emoji',
                 display: `<span class="memory-pic">${w.emoji}</span><span class="memory-word">${w.word}</span>`,
                 speakText: w.word });
  });

  const grid = document.getElementById('memoryGrid');
  grid.innerHTML = '';
  shuffle(cards).forEach(card => {
    const el = document.createElement('div');
    el.className = 'memory-card';
    el.style.background = card.type === 'symbol'
      ? 'linear-gradient(135deg,#ffb7c5,#ffc078)'
      : 'linear-gradient(135deg,#a5f3fc,#818cf8)';
    el.innerHTML = `<div class="memory-front">？</div><div class="memory-back">${card.display}</div>`;
    el.addEventListener('click', () => handleMemoryFlip(el, card));
    grid.appendChild(el);
  });
}

function handleMemoryFlip(el, card) {
  if (memLocked) return;
  if (el.classList.contains('flipped') || el.classList.contains('matched')) return;

  el.classList.add('flipped');
  speak(card.speakText);
  memFlipped.push({ el, card });

  if (memFlipped.length === 2) {
    memMoves++;
    document.getElementById('memoryMoves').textContent = '翻牌次數：' + memMoves;
    const [a, b] = memFlipped;

    if (a.card.matchId === b.card.matchId && a.card.type !== b.card.type) {
      a.el.classList.add('matched');
      b.el.classList.add('matched');
      memFlipped = [];
      memMatched++;
      document.getElementById('memoryMatched').textContent = '配對：' + memMatched + ' / ' + MEM_PAIRS;
      showFeedback(true);
      if (memMatched === MEM_PAIRS) {
        setTimeout(() => {
          speak('你全部找完了！真棒！');
          setTimeout(startMemoryGame, 2500);
        }, 600);
      }
    } else {
      memLocked = true;
      breakStreak();
      setTimeout(() => {
        a.el.classList.remove('flipped');
        b.el.classList.remove('flipped');
        memFlipped = [];
        memLocked  = false;
      }, 1000);
    }
  }
}

// ========== 聲調辨識 ==========

let toneTarget = null;
let toneSet    = null;
let toneLocked = false;

function startToneRound() {
  toneLocked = false;
  const prevSet = toneSet;
  do {
    toneSet = TONE_SETS[randomInt(TONE_SETS.length)];
  } while (toneSet === prevSet);
  toneTarget = toneSet.tones[randomInt(toneSet.tones.length)];

  document.getElementById('toneEmoji').textContent = toneTarget.emoji;
  // 把要辨識聲調的那個字標出來
  document.getElementById('toneWord').innerHTML = [...toneTarget.word]
    .map((ch, i) => i === toneTarget.hl ? `<span class="tone-hl">${ch}</span>` : ch)
    .join("");
  replayAnimation(document.querySelector("#screen-tone .flashcard"), "flashcard-swap", 760);

  playToneQuestion();

  const grid = document.getElementById('toneChoices');
  grid.innerHTML = '';
  // 固定順序：¯ → ˊ → ˇ → ˋ
  toneSet.tones.forEach(tone => {
    const btn = document.createElement('button');
    btn.className = 'choice-card';
    btn.style.fontSize   = '1.5rem';
    btn.style.minHeight  = '80px';
    btn.style.padding    = '5px';
    btn.innerHTML = toneOptionHtml(toneSet.spelling + tone.mark, tone.mark);
    btn.onclick = () => handleToneChoice(tone, btn);
    grid.appendChild(btn);
  });
}

// 聲調遊戲專用
let _toneAudio = null;
let _toneGen   = 0;

function playToneQuestion() {
  if (!toneTarget || !toneSet) return;
  if (_toneAudio) { _toneAudio.pause(); _toneAudio = null; }
  if (_currentAudio) { _currentAudio.pause(); _currentAudio = null; }

  const myGen  = ++_toneGen;
  const myWord = toneTarget.word;  // 只念中文詞如「馬」

  // 先清一次佇列
  if ('speechSynthesis' in window) speechSynthesis.cancel();

  // 延遲 200ms 讓 cancel 生效，再次清除後才 speak
  setTimeout(() => {
    if (_toneGen !== myGen) return;
    // 再清一次：防止其他遊戲的 error callback 在這 200ms 內偷塞了 utterance
    if ('speechSynthesis' in window) speechSynthesis.cancel();
    speak(myWord);
  }, 200);
}

function replayToneSound() {
  if (toneSet && toneTarget) playToneQuestion();
}

function handleToneChoice(tone, btn) {
  if (toneLocked) return;
  const correct = tone.mark === toneTarget.mark;
  // 只顯示視覺回饋，不念出聲（避免蓋掉題目語音）
  const banner = document.getElementById("feedbackBanner");
  if (correct) {
    toneLocked = true;
    btn.classList.add('correct');
    banner.textContent = "答對了！🎉";
    banner.className = "feedback-banner show good";
    burstAtViewportCenter(true, 12);
    playCorrectDingDing();
    rewardCorrect();
    setTimeout(() => banner.classList.remove("show"), 900);
    roundCorrect("tone", startToneRound, startToneGame);
  } else {
    breakStreak();
    roundWrong("tone");
    btn.classList.add('wrong');
    banner.textContent = "再試一次 😊";
    banner.className = "feedback-banner show bad";
    setTimeout(() => banner.classList.remove("show"), 900);
    setTimeout(() => btn.classList.remove('wrong'), 1200);
  }
}

// ========== 夾娃娃機 ==========

let clawScore = 0;
let clawQuestionNum = 1;
let clawRunning = false;
let clawTarget = null;
let clawPos = 80; // 仿翰林，爪子一開始在右側
let isGrabbing = false;
let clawCapsulesData = [];
let clawMoveInterval = null;

function startClawGame() {
  clawScore = 0;
  clawQuestionNum = 1;
  clawRunning = true;
  isGrabbing = false;
  clawPos = 80;

  const arm = document.getElementById('clawArm');
  arm.style.left = '80%';
  arm.style.transition = '';
  arm.style.top = '32px';
  arm.className = 'claw-arm';
  const line = arm.querySelector('.claw-line');
  const caughtItem = document.getElementById('clawCaught');
  caughtItem.className = 'claw-caught';
  caughtItem.innerHTML = '';

  document.getElementById('clawScore').textContent = '0';
  document.getElementById('clawProgress').textContent = '第 1 / 5 題';
  document.getElementById('clawGameover').style.display = 'none';
  document.getElementById('btnClawDrop').disabled = false;

  initClawCapsules();
  pickNextClawTarget();
  initClawControls();
}

let clawControlsReady = false;

function initClawControls() {
  // 只綁一次，避免每玩一次就多一組 window 監聽器
  if (clawControlsReady) return;
  clawControlsReady = true;
  const btnLeft = document.getElementById('btnClawLeft');
  const btnRight = document.getElementById('btnClawRight');
  const stick = document.getElementById('joystickStick');

  // 清除舊有的監聽器以防重複綁定
  const newBtnLeft = btnLeft.cloneNode(true);
  const newBtnRight = btnRight.cloneNode(true);
  btnLeft.parentNode.replaceChild(newBtnLeft, btnLeft);
  btnRight.parentNode.replaceChild(newBtnRight, btnRight);

  const startMove = (dir) => {
    if (!clawRunning || isGrabbing) return;
    if (dir === -1) stick.classList.add('tilt-left');
    else stick.classList.add('tilt-right');

    clearInterval(clawMoveInterval);
    clawMoveInterval = setInterval(() => {
      if (!clawRunning || isGrabbing) {
        clearInterval(clawMoveInterval);
        return;
      }
      clawPos += dir * 0.8;
      if (clawPos < 15) clawPos = 15; // 左邊界
      if (clawPos > 85) clawPos = 85; // 右邊界限制右側
      document.getElementById('clawArm').style.left = clawPos + '%';
    }, 16);
  };

  const stopMove = () => {
    stick.classList.remove('tilt-left', 'tilt-right');
    clearInterval(clawMoveInterval);
  };

  // 綁定左移按鈕
  newBtnLeft.addEventListener('mousedown', () => startMove(-1));
  newBtnLeft.addEventListener('touchstart', (e) => { e.preventDefault(); startMove(-1); });
  newBtnLeft.addEventListener('mouseup', stopMove);
  newBtnLeft.addEventListener('mouseleave', stopMove);
  newBtnLeft.addEventListener('touchend', stopMove);

  // 綁定右移按鈕
  newBtnRight.addEventListener('mousedown', () => startMove(1));
  newBtnRight.addEventListener('touchstart', (e) => { e.preventDefault(); startMove(1); });
  newBtnRight.addEventListener('mouseup', stopMove);
  newBtnRight.addEventListener('mouseleave', stopMove);
  newBtnRight.addEventListener('touchend', stopMove);

  // 搖桿拖拉邏輯
  const joystickArea = document.querySelector('.control-joystick-area');
  const baseEl = document.querySelector('.joystick-base');
  let isDraggingJoystick = false;
  let currentDragDir = 0; // -1 for left, 1 for right, 0 for neutral
  let dragStartY = 0;
  const PULL_DOWN_PX = 40;  // 搖桿往下拉這麼多就直接夾

  function updateJoystickPosition(clientX) {
    const baseRect = baseEl.getBoundingClientRect();
    const centerX = baseRect.left + baseRect.width / 2;
    const diff = clientX - centerX;

    let angle = diff * 0.8;
    if (angle > 35) angle = 35;
    if (angle < -35) angle = -35;

    // 根據角度決定夾爪移動
    if (angle < -10) {
      if (currentDragDir !== -1) {
        currentDragDir = -1;
        startMove(-1);
      }
    } else if (angle > 10) {
      if (currentDragDir !== 1) {
        currentDragDir = 1;
        startMove(1);
      }
    } else {
      if (currentDragDir !== 0) {
        currentDragDir = 0;
        stopMove();
      }
    }
    stick.style.transform = `rotate(${angle}deg)`;
  }

  function handleJoystickStart(e) {
    if (!clawRunning || isGrabbing) return;
    isDraggingJoystick = true;
    stick.style.transition = 'none'; // 讓搖桿即時跟隨

    const pt = e.type.includes('touch') ? e.touches[0] : e;
    dragStartY = pt.clientY;
    updateJoystickPosition(pt.clientX);
  }

  function handleJoystickMove(e) {
    if (!isDraggingJoystick || !clawRunning || isGrabbing) return;
    const pt = e.type.includes('touch') ? e.touches[0] : e;
    if (pt.clientY - dragStartY > PULL_DOWN_PX) {
      // 往下拉：搖桿壓下去，夾爪直接夾
      handleJoystickEnd();
      stick.classList.add('pull-down');
      setTimeout(() => stick.classList.remove('pull-down'), 350);
      dropClaw();
      return;
    }
    updateJoystickPosition(pt.clientX);
  }

  function handleJoystickEnd() {
    if (isDraggingJoystick) {
      isDraggingJoystick = false;
      currentDragDir = 0;
      stick.style.transition = 'transform 0.15s ease';
      stick.style.transform = '';
      stopMove();
    }
  }

  joystickArea.addEventListener('mousedown', handleJoystickStart);
  window.addEventListener('mousemove', handleJoystickMove);
  window.addEventListener('mouseup', handleJoystickEnd);

  joystickArea.addEventListener('touchstart', handleJoystickStart, { passive: true });
  window.addEventListener('touchmove', handleJoystickMove, { passive: true });
  window.addEventListener('touchend', handleJoystickEnd);
}

// 扭蛋顏色交替 (綠色/橘色禮物盒)
const boxColors = ['box-green', 'box-orange'];

function initClawCapsules() {
  const isPinyinRound = Math.random() < 0.5; // 50% 機率出拼音組合題，50% 單個注音題
  const container = document.getElementById('clawCapsules');
  container.innerHTML = '';
  clawCapsulesData = [];

  const singleRowX = [15, 32, 50, 68, 85];
  let symbols = [];

  if (isPinyinRound) {
    // 5 個拼法都不同的音節，才不會有兩個正確答案
    const first = SYLLABLE_QUESTIONS[randomInt(SYLLABLE_QUESTIONS.length)];
    symbols = [first, ...pickOtherCombos(first, 4, SYLLABLE_QUESTIONS)];
  } else {
    // 5 個不同字頭，念的詞語字頭就是要夾的符號
    const pool = symbolsWithListenWords();
    const first = pool[randomInt(pool.length)];
    symbols = [first, ...pickDistractorSymbols(first.symbol, 4, pool.map(s => s.symbol))
      .map(sym => pool.find(s => s.symbol === sym))]
      .map(s => {
        const chosen = randomListenWordForHead(s.symbol);
        // 考的是第一個字的字頭（念「汽車的汽」）
        return { ...s, word: chosen.word, emoji: chosen.emoji, hl: 0 };
      });
    symbols = shuffle(symbols);
  }

  symbols.forEach((symObj, i) => {
    const x = singleRowX[i];
    const el = document.createElement('div');
    const colorClass = boxColors[i % 2];
    el.className = `capsule ${colorClass}`;
    el.style.left = `calc(${x}% - 37px)`;
    el.style.bottom = `15px`;

    let symStr = '';
    let isPinyin = false;
    if (isPinyinRound) {
      symStr = symObj.initial + symObj.final;
      isPinyin = true;
    } else {
      symStr = symObj.symbol;
    }

    el.innerHTML = renderPinyinHtml(symStr, 34);
    container.appendChild(el);

    clawCapsulesData.push({
      el: el,
      symbol: symStr,
      isPinyin: isPinyin,
      word: symObj.word || symStr,
      colorClass: colorClass,
      row: 1,
      x: x,
      isCaught: false,
      symObj: symObj
    });

    el.onclick = () => {
      if (!clawRunning || isGrabbing) return;
      clawPos = x;
      document.getElementById('clawArm').style.left = clawPos + '%';
      dropClaw();
    };
  });
}

function pickNextClawTarget() {
  const remaining = clawCapsulesData.filter(c => !c.isCaught);
  if (remaining.length === 0) return;

  const targetCap = remaining[randomInt(remaining.length)];
  clawTarget = targetCap.symObj;

  document.getElementById('clawRoofDisplay').textContent = '❓';
  replayClawSound();
}

function replayClawSound() {
  if (clawTarget) {
    if (clawTarget.word) {
      speak(promptText(clawTarget));
    } else {
      speak(clawTarget.symbol);
    }
  }
}

function dropClaw() {
  if (!clawRunning || isGrabbing) return;
  isGrabbing = true;
  document.getElementById('btnClawDrop').disabled = true;

  const arm = document.getElementById('clawArm');
  const line = arm.querySelector('.claw-line');
  const caughtItem = document.getElementById('clawCaught');

  // 1. 爪子張開 (Claw open)
  arm.classList.remove('closed');
  arm.classList.add('open');

  // 尋找水平位置最接近的禮物盒 (8% 誤差範圍內)
  let caughtIdx = -1;
  let minDiff = 8;

  clawCapsulesData.forEach((cap, i) => {
    if (cap.el.classList.contains('empty') || cap.isCaught) return;
    const diff = Math.abs(cap.x - clawPos);
    if (diff < minDiff) {
      minDiff = diff;
      caughtIdx = i;
    }
  });

  let isCorrect = false;
  if (caughtIdx !== -1) {
    const cap = clawCapsulesData[caughtIdx];
    if (cap.isPinyin) {
      isCorrect = (cap.symbol === (clawTarget.initial + clawTarget.final));
    } else {
      isCorrect = (cap.symbol === clawTarget.symbol);
    }
  }

  // 只降到能碰到禮物盒的高度即可 (動態計算)
  const machineHeight = document.getElementById('clawMachine').offsetHeight;
  const targetDepth = (machineHeight - 110) + 'px';

  setTimeout(() => {
    // 2. 夾爪下降 (Claw drop)
    arm.style.transition = 'top 1s cubic-bezier(0.25, 0.46, 0.45, 0.94)';
    arm.style.top = targetDepth;

    setTimeout(() => {
      // 3. 抓取收爪 (Clasp claws)
      arm.classList.remove('open');
      arm.classList.add('closed');

      let colorClass = '';
      let caughtSymbol = '';

      if (caughtIdx !== -1) {
        if (!isCorrect) {
          // 夾錯了：夾不起來，念出夾到的是什麼，靜止三秒
          showFeedback(false);
          const wrongCap = clawCapsulesData[caughtIdx];
          setTimeout(() => {
            if (!clawRunning) return;
            if (wrongCap.isPinyin) speakSequence(["這是", promptText(wrongCap.symObj), "再聽一次", promptText(clawTarget)], 250);
            else speakSequence(["這是", wrongCap.symbol, "再聽一次", promptText(clawTarget)], 250);
          }, 900);

          setTimeout(() => {
            // 4. 空爪升起
            arm.style.top = '32px';

            setTimeout(() => {
              // 回到原始位置
              arm.style.left = clawPos + '%';

              setTimeout(() => {
                arm.style.transition = '';
                arm.classList.remove('open', 'closed');
                isGrabbing = false;
                document.getElementById('btnClawDrop').disabled = false;
              }, 1200);
            }, 800);
          }, 3000);
          return; // 結束夾錯的流程
        }

        // 夾對了：正常夾取
        const cap = clawCapsulesData[caughtIdx];
        cap.el.classList.add('empty');
        cap.isCaught = true;
        caughtSymbol = cap.symbol;
        colorClass = cap.colorClass;

        // 爪中顯示被夾到的禮物盒
        caughtItem.innerHTML = renderPinyinHtml(cap.symbol, 28);
        caughtItem.className = `claw-caught visible ${colorClass}`;
      }

      setTimeout(() => {
        // 4. 夾爪升起 (Pull up)
        arm.style.top = '32px';

        setTimeout(() => {
          // 5. 升到頂端後移動 (Move to chute)
          if (caughtIdx !== -1) {
            arm.style.transition = 'left 1.2s ease-in-out';
            arm.style.left = '50px'; // 移動至出物口上方

            setTimeout(() => {
              // 6. 鬆爪掉落 (Release)
              arm.classList.remove('closed');
              arm.classList.add('open');
              caughtItem.classList.remove('visible');

              // 出物口掉落特效
              const machine = document.getElementById('clawMachine');
              const fallEl = document.createElement('div');
              fallEl.className = `falling-capsule ${colorClass}`;
              fallEl.style.left = '25px';
              fallEl.style.top = '70px';
              fallEl.style.transition = 'top 0.6s cubic-bezier(0.25, 0.46, 0.45, 0.94), opacity 0.6s, transform 0.6s';
              fallEl.innerHTML = renderPinyinHtml(caughtSymbol, 28);
              machine.appendChild(fallEl);

              // 強制重繪以觸發動畫
              void fallEl.offsetWidth;

              fallEl.style.top = 'calc(100% - 70px)';
              fallEl.style.opacity = '0';
              fallEl.style.transform = 'scale(0.6)';

              setTimeout(() => {
                fallEl.remove();
              }, 600);

              // 答對結算
              clawScore++;
              document.getElementById('clawScore').textContent = clawScore;
              showFeedback(true);

              setTimeout(() => {
                // 7. 爪子回到原位 (Move back)
                arm.style.left = clawPos + '%';

                setTimeout(() => {
                  arm.style.transition = '';
                  arm.classList.remove('open');

                  isGrabbing = false;
                  document.getElementById('btnClawDrop').disabled = false;

                  if (clawQuestionNum === 5) {
                    // 5 題全部答對，贏得挑戰！
                    endClawGame(true);
                  } else {
                    // 進到下一題，從剩下的扭蛋挑選
                    clawQuestionNum++;
                    document.getElementById('clawProgress').textContent = `第 ${clawQuestionNum} / 5 題`;
                    if (clawRunning) pickNextClawTarget();
                  }
                }, 1200);
              }, 600);

            }, 1200);
          } else {
            // 沒抓到 (空抓)，重置狀態，允許繼續操作
            arm.classList.remove('closed');
            isGrabbing = false;
            document.getElementById('btnClawDrop').disabled = false;
          }

        }, 800);
      }, 500);
    }, 800);
  }, 300);
}

function endClawGame(isWin) {
  clawRunning = false;
  clearInterval(clawMoveInterval);
  document.getElementById('btnClawDrop').disabled = true;

  const box = document.getElementById('clawGameover');
  const emojiEl = box.querySelector('.gameover-box div:nth-child(1)');
  const titleEl = box.querySelector('.gameover-box div:nth-child(2)');

  document.getElementById('clawFinalScore').textContent = clawScore;

  if (isWin) {
    emojiEl.textContent = '🎉';
    titleEl.textContent = '挑戰成功！';
    speak('太神啦！你全部過關了！');
  } else {
    emojiEl.textContent = '😢';
    titleEl.textContent = '挑戰失敗！';
    speak('差一點點，再試一次吧！');
  }

  box.style.display = 'flex';
}

function stopClawGame() {
  clawRunning = false;
  clearInterval(clawMoveInterval);
}

// ========== 拼字工廠 ==========

const SPELL_LENGTH = 10;
let spellDeck = [];

let spellScore = 0;
let spellQuestionNum = 0;
let spellCombo = null;      // 目前題目（PINYIN_COMBOS 之一）
let spellStep = 'initial';  // 'initial' → 選聲母；'final' → 選韻符
let spellLocked = false;
let spellRunning = false;

// 所有題庫用到的韻符池（含聲調），供第二步生成干擾選項
const SPELL_FINALS = [...new Set(SPLIT_QUESTIONS.map(c => c.final))];
// 所有聲母池，供第一步生成干擾選項
const SPELL_INITIALS = [...new Set(SPLIT_QUESTIONS.map(c => c.initial))];

function startSpellGame() {
  spellScore = 0;
  spellQuestionNum = 0;
  spellRunning = true;
  spellLocked = false;
  spellDeck = makeQuestionDeck(SPLIT_QUESTIONS, SPELL_LENGTH);
  document.getElementById('spellGameover').style.display = 'none';
  nextSpellRound();
}

function nextSpellRound() {
  if (spellQuestionNum >= SPELL_LENGTH) {
    endSpellGame();
    return;
  }
  spellLocked = false;
  spellStep = 'initial';
  spellCombo = spellDeck[spellQuestionNum];

  document.getElementById('spellEmoji').textContent = spellCombo.emoji;
  document.getElementById('spellWord').innerHTML  = questionWordHtml(spellCombo);

  // 拼字槽：同一個音節直排，等孩子依序選聲母與韻符
  renderSpellSyllable();

  renderSpellChoices('initial');
  speak(promptText(spellCombo));
}

function updateSpellHint() {
  const hint = document.getElementById('spellHint');
  hint.textContent = spellStep === 'initial' ? '先選「聲母」🔊' : '再選「韻符」🔊';
}

function renderSpellChoices(step) {
  updateSpellHint();

  let correct, pool;
  if (step === 'initial') {
    correct = spellCombo.initial;
    pool = SPELL_INITIALS;
  } else {
    correct = spellCombo.final;
    pool = SPELL_FINALS;
  }

  let others;
  if (step === 'initial') {
    others = pickDistractorSymbols(correct, 3, pool);
  } else {
    // 韻符：放一個「同韻不同調」的陷阱，練聲調
    const body = correct.replace(GAME_TONE_RE_GLOBAL, "");
    const sameBody = shuffle(["", "ˊ", "ˇ", "ˋ"].map(t => body + t).filter(v => v !== correct)).slice(0, 1);
    others = [...sameBody, ...shuffle(pool.filter(v => v !== correct && !sameBody.includes(v))).slice(0, 2)];
  }
  const choices = shuffle([correct, ...others]);

  const grid = document.getElementById('spellChoices');
  grid.innerHTML = '';
  choices.forEach(value => {
    const btn = document.createElement('button');
    btn.className = 'choice-card';
    btn.style.padding = '5px';
    btn.innerHTML = renderPinyinHtml(value, 55, 'spell-bopomofo');
    btn.onclick = () => handleSpellChoice(value, step, btn);
    grid.appendChild(btn);
  });
}

function handleSpellChoice(value, step, btn) {
  if (spellLocked || !spellRunning) return;
  if (step !== spellStep) return;  // 防止上一步殘留按鈕誤觸

  const correct = step === 'initial'
    ? value === spellCombo.initial
    : value === spellCombo.final;

  if (!correct) {
    btn.classList.add('wrong');
    showFeedback(false);
    setTimeout(() => btn.classList.remove('wrong'), 1200);
    return;
  }

  btn.classList.add('correct');

  if (step === 'initial') {
    // 第一步答對：填入聲母，進到第二步
    renderSpellSyllable(spellCombo.initial);
    speak(spellCombo.initial);
    spellStep = 'final';
    setTimeout(() => {
      if (spellRunning) renderSpellChoices('final');
    }, 550);
  } else {
    // 第二步答對：整題完成
    spellLocked = true;
    renderSpellSyllable(spellCombo.initial, spellCombo.final);
    document.getElementById('spellChoices').innerHTML = '';

    spellScore++;
    spellQuestionNum++;

    showFeedback(true);

    setTimeout(() => {
      if (spellRunning) nextSpellRound();
    }, 1300);
  }
}

function replaySpellSound() {
  if (spellCombo) speak(promptText(spellCombo));
}

function endSpellGame() {
  spellRunning = false;
  document.getElementById('spellFinalScore').textContent = spellScore;
  document.getElementById('spellGameover').style.display = 'flex';
  const msg = spellScore >= SPELL_LENGTH ? '太厲害了！全部拼對！' :
              spellScore >= 6            ? '很棒！繼續加油！' : '再試一次！';
  speak(msg);
}

function stopSpellGame() {
  spellRunning = false;
  spellLocked = false;
}
updateStarBank();
