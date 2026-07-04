// ========== 語音 ==========

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
function playAudioUrl(url, onEnd) {
  if (_currentAudio) {
    _currentAudio.pause();
    _currentAudio.onended = null;
    _currentAudio = null;
  }
  const audio = new Audio(url);
  _currentAudio = audio;
  if (onEnd) audio.addEventListener("ended", onEnd, { once: true });
  audio.play().catch(() => {
    // 無法播放時直接呼叫 onEnd，讓串接流程繼續
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
function speakViaGoogle(text, onEnd) {
  const url = `https://translate.google.com/translate_tts?ie=UTF-8&q=${encodeURIComponent(text)}&tl=zh-TW&client=tw-ob`;
  if (_currentAudio) {
    _currentAudio.pause();
    _currentAudio.onended = null;
    _currentAudio = null;
  }
  const audio = new Audio(url);
  _currentAudio = audio;

  let fallenBack = false;
  function fallbackToSpeechSynthesis() {
    // 避免 play() 的 catch 跟 <audio> 的 error 事件同時觸發兩次
    if (fallenBack) return;
    fallenBack = true;
    _currentAudio = null;
    if ("speechSynthesis" in window) {
      speechSynthesis.cancel();
      const utter = new SpeechSynthesisUtterance(bopomofoToSpeakable(text));
      utter.lang = "zh-TW";
      if (bopomofoVoice) utter.voice = bopomofoVoice;
      utter.rate = 0.75;
      utter.pitch = 1.1;
      if (onEnd) utter.onend = onEnd;
      speechSynthesis.speak(utter);
    } else {
      if (onEnd) setTimeout(onEnd, 800);
    }
  }

  if (onEnd) audio.addEventListener("ended", onEnd, { once: true });
  // Google TTS 被 CORS 擋住時（常見於 HTTPS 環境，例如 GitHub Pages），
  // 失敗有時不會讓 play() 的 promise reject，而是觸發 <audio> 的 error 事件，
  // 所以兩種情況都要接住，才能穩定改用瀏覽器內建語音。
  audio.addEventListener("error", fallbackToSpeechSynthesis, { once: true });
  audio.play().catch(fallbackToSpeechSynthesis);
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
  speechSynthesis.cancel();
  const utter = new SpeechSynthesisUtterance(bopomofoToSpeakable(text));
  utter.lang = "zh-TW";
  if (bopomofoVoice) utter.voice = bopomofoVoice;
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
function speak(text, onEnd) {
  const bare = text.replace(TONE_MARKS, "");
  // 是否為單一注音符號（去聲調後查表）
  if (BPMF_TO_WAV[bare]) {
    speakSymbol(text, onEnd);
    return;
  }
  // 含注音符號的複合字串 → 先轉成可唸的中文
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
  document.querySelectorAll(".screen").forEach(el => el.classList.remove("active"));
  document.getElementById("screen-" + name).classList.add("active");

  if (name === "flashcards") renderFlashcard();
  if (name === "match") startMatchRound();
  if (name === "pinyin") renderPinyin();
  if (name === "quiz") startQuiz();
  if (name === "mole") startMoleGame();
  if (name === "wordhead") startWordHeadRound();
  if (name === "memory") startMemoryGame();
  if (name === "tone") startToneRound();
}

function goHome() {
  stopMoleGame();
  showScreen("home");
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

function showFeedback(good, speakText) {
  const banner = document.getElementById("feedbackBanner");
  banner.textContent = good ? "答對了！🎉" : "再試一次 😊";
  banner.className = "feedback-banner show " + (good ? "good" : "bad");
  speak(speakText || (good ? "答對了，好棒！" : "再試一次"));
  setTimeout(() => {
    banner.classList.remove("show");
  }, 900);
}

// ========== 認識注音符號牌 ==========

let fcIndex = 0;

function renderFlashcard() {
  const item = BOPOMOFO_SYMBOLS[fcIndex];
  document.getElementById("fcSymbol").textContent = item.symbol;
  document.getElementById("fcEmoji").textContent = item.emoji;
  document.getElementById("fcWord").textContent = item.word;
  document.getElementById("fcProgress").textContent =
    (fcIndex + 1) + " / " + BOPOMOFO_SYMBOLS.length;
  speakCurrentFlashcard();
}

function speakCurrentFlashcard() {
  const item = BOPOMOFO_SYMBOLS[fcIndex];
  // 先唸符號（含描述），停頓後再唸例字
  speakSequence([item.symbol, item.word], 100);
}

function nextFlashcard() {
  fcIndex = (fcIndex + 1) % BOPOMOFO_SYMBOLS.length;
  renderFlashcard();
}

function prevFlashcard() {
  fcIndex = (fcIndex - 1 + BOPOMOFO_SYMBOLS.length) % BOPOMOFO_SYMBOLS.length;
  renderFlashcard();
}

// ========== 聽音找符號 遊戲 ==========

let matchTarget = null;
let matchLocked = false;

function startMatchRound() {
  matchLocked = false;
  matchTarget = BOPOMOFO_SYMBOLS[randomInt(BOPOMOFO_SYMBOLS.length)];

  const others = shuffle(
    BOPOMOFO_SYMBOLS.filter(s => s.symbol !== matchTarget.symbol)
  ).slice(0, 3);
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
    showFeedback(true);
    setTimeout(startMatchRound, 1100);
  } else {
    btn.classList.add("wrong");
    // 整句一次念出「這個是ㄉ，不是ㄅ」，避免逐字播放造成停頓過久、不通順
    const banner = document.getElementById("feedbackBanner");
    banner.textContent = "再試一次 😊";
    banner.className = "feedback-banner show bad";
    speak(`這個是${choice.symbol}，不是${matchTarget.symbol}`, () => {
      setTimeout(() => banner.classList.remove("show"), 300);
    });
    setTimeout(() => btn.classList.remove("wrong"), 1200);
  }
}

// ========== 拼音練習 ==========

let pinyinIndex = 0;

function renderPinyin() {
  const combo = PINYIN_COMBOS[pinyinIndex];
  document.getElementById("pinyinInitial").textContent = combo.initial;
  document.getElementById("pinyinFinal").textContent = combo.final;
  document.getElementById("pinyinProgress").textContent =
    (pinyinIndex + 1) + " / " + PINYIN_COMBOS.length;
  document.getElementById("pinyinResult").innerHTML = "";
}

function speakPart(which) {
  const combo = PINYIN_COMBOS[pinyinIndex];
  speak(which === "initial" ? combo.initial : combo.final);
}

function combinePinyin() {
  const combo = PINYIN_COMBOS[pinyinIndex];
  speak(combo.word);
  document.getElementById("pinyinResult").innerHTML =
    '<div class="word-emoji">' + combo.emoji + '</div>' +
    '<div class="word-text">' + combo.word + '</div>';
}

function nextPinyin() {
  pinyinIndex = (pinyinIndex + 1) % PINYIN_COMBOS.length;
  renderPinyin();
}

function prevPinyin() {
  pinyinIndex = (pinyinIndex - 1 + PINYIN_COMBOS.length) % PINYIN_COMBOS.length;
  renderPinyin();
}

// ========== 看圖找字頭 遊戲 ==========

const INITIAL_SYMBOLS = BOPOMOFO_SYMBOLS.filter(s => s.category === "initial");

function pickInitialWordItem(symbol) {
  const base = BOPOMOFO_SYMBOLS.find(s => s.symbol === symbol);
  const extras = INITIAL_WORD_EXTRAS[symbol] || [];
  const pool = [{ word: base.word, emoji: base.emoji }, ...extras];
  return pool[randomInt(pool.length)];
}

let wordHeadTarget = null;
let wordHeadLocked = false;

function startWordHeadRound() {
  wordHeadLocked = false;
  const targetSymbol = INITIAL_SYMBOLS[randomInt(INITIAL_SYMBOLS.length)].symbol;
  const item = pickInitialWordItem(targetSymbol);
  wordHeadTarget = { symbol: targetSymbol, word: item.word, emoji: item.emoji };

  document.getElementById("whEmoji").textContent = wordHeadTarget.emoji;
  document.getElementById("whWord").textContent = wordHeadTarget.word;

  const others = shuffle(
    INITIAL_SYMBOLS.filter(s => s.symbol !== wordHeadTarget.symbol)
  ).slice(0, 2);
  const choices = shuffle([wordHeadTarget, ...others]);

  const grid = document.getElementById("whChoices");
  grid.innerHTML = "";
  choices.forEach(choice => {
    const btn = document.createElement("button");
    btn.className = "choice-card";
    btn.textContent = choice.symbol;
    btn.onclick = () => handleWordHeadChoice(choice, btn);
    grid.appendChild(btn);
  });

  replayWordHeadSound();
}

function replayWordHeadSound() {
  if (wordHeadTarget) speak(wordHeadTarget.word);
}

function handleWordHeadChoice(choice, btn) {
  if (wordHeadLocked) return;
  const correct = choice.symbol === wordHeadTarget.symbol;

  if (correct) {
    wordHeadLocked = true;
    btn.classList.add("correct");
    speak(choice.symbol, () => {
      showFeedback(true, "答對了");
      setTimeout(startWordHeadRound, 1100);
    });
  } else {
    btn.classList.add("wrong");
    speak(choice.symbol, () => {
      showFeedback(false);
    });
    setTimeout(() => btn.classList.remove("wrong"), 1200);
  }
}

// ========== 記憶翻牌配對 ==========

const MEMORY_PAIR_COUNT = 6;

let memoryCards = [];
let memoryFlipped = [];
let memoryMoves = 0;
let memoryMatchedCount = 0;
let memoryLocked = false;

function startMemoryGame() {
  memoryMoves = 0;
  memoryMatchedCount = 0;
  memoryFlipped = [];
  memoryLocked = false;

  const picks = shuffle(INITIAL_SYMBOLS).slice(0, MEMORY_PAIR_COUNT);
  const symbolCards = shuffle(picks.map(item => {
    const w = pickInitialWordItem(item.symbol);
    return { symbol: item.symbol, emoji: w.emoji, word: w.word, kind: "symbol", matched: false };
  }));
  const emojiCards = shuffle(picks.map(item => {
    const w = pickInitialWordItem(item.symbol);
    return { symbol: item.symbol, emoji: w.emoji, word: w.word, kind: "emoji", matched: false };
  }));
  memoryCards = [...symbolCards, ...emojiCards];

  updateMemoryHeader();
  renderMemoryGrid();
}

function updateMemoryHeader() {
  document.getElementById("memoryMoves").textContent = "翻牌次數：" + memoryMoves;
  document.getElementById("memoryMatched").textContent =
    "配對：" + memoryMatchedCount + " / " + MEMORY_PAIR_COUNT;
}

function renderMemoryGrid() {
  const grid = document.getElementById("memoryGrid");
  grid.innerHTML = "";
  memoryCards.forEach((card, idx) => {
    const btn = document.createElement("button");
    btn.className = "memory-card";
    btn.dataset.idx = idx;
    updateMemoryCardFace(btn, card, memoryFlipped.includes(idx));
    btn.onclick = () => handleMemoryFlip(idx, btn);
    grid.appendChild(btn);
  });
}

function updateMemoryCardFace(btn, card, faceUp) {
  if (card.matched || faceUp) {
    btn.textContent = card.kind === "symbol" ? card.symbol : card.emoji;
    btn.classList.add("face-up");
    if (card.matched) btn.classList.add("matched");
  } else {
    btn.textContent = "❓";
    btn.classList.remove("face-up", "matched");
  }
}

function handleMemoryFlip(idx, btn) {
  if (memoryLocked) return;
  const card = memoryCards[idx];
  if (card.matched || memoryFlipped.includes(idx)) return;

  memoryFlipped.push(idx);
  updateMemoryCardFace(btn, card, true);
  if (card.kind === "symbol") {
    speak(card.symbol);
  } else {
    speak(card.word);
  }

  if (memoryFlipped.length < 2) return;

  memoryMoves++;
  updateMemoryHeader();
  memoryLocked = true;

  const [firstIdx, secondIdx] = memoryFlipped;
  const first = memoryCards[firstIdx];
  const second = memoryCards[secondIdx];
  const isMatch = first.symbol === second.symbol && first.kind !== second.kind;

  setTimeout(() => {
    const cards = document.querySelectorAll(".memory-card");
    if (isMatch) {
      first.matched = true;
      second.matched = true;
      memoryMatchedCount++;
      updateMemoryCardFace(cards[firstIdx], first, true);
      updateMemoryCardFace(cards[secondIdx], second, true);
      showFeedback(true);
      updateMemoryHeader();
      if (memoryMatchedCount >= MEMORY_PAIR_COUNT) {
        setTimeout(finishMemoryGame, 700);
      }
    } else {
      updateMemoryCardFace(cards[firstIdx], first, false);
      updateMemoryCardFace(cards[secondIdx], second, false);
    }
    memoryFlipped = [];
    memoryLocked = false;
  }, 700);
}

function finishMemoryGame() {
  const grid = document.getElementById("memoryGrid");
  grid.innerHTML =
    '<div class="quiz-result">' +
    '<div class="big-score">🎉</div>' +
    '<div class="word-text">全部配對成功！</div>' +
    '<div class="progress-text">翻牌次數：' + memoryMoves + '</div>' +
    '<button class="big-btn combine-btn" onclick="startMemoryGame()">再玩一次</button>' +
    '</div>';
  speak("太棒了，全部配對成功！");
}

// ========== 聲調辨識 遊戲 ==========

let toneSet = null;
let toneTarget = null;
let toneLocked = false;

function startToneRound() {
  toneLocked = false;
  toneSet = TONE_SETS[randomInt(TONE_SETS.length)];
  toneTarget = toneSet.tones[randomInt(toneSet.tones.length)];

  document.getElementById("toneEmoji").textContent = toneTarget.emoji;
  document.getElementById("toneWord").textContent = toneTarget.word;

  const choices = toneSet.tones;
  const grid = document.getElementById("toneChoices");
  grid.innerHTML = "";
  choices.forEach(choice => {
    const btn = document.createElement("button");
    btn.className = "choice-card";
    btn.style.fontSize = "56px";
    btn.textContent = toneSet.spelling + choice.mark;
    btn.onclick = () => handleToneChoice(choice, btn);
    grid.appendChild(btn);
  });

  replayToneSound();
}

function replayToneSound() {
  if (toneTarget) speak(toneTarget.word);
}

function handleToneChoice(choice, btn) {
  if (toneLocked) return;
  const correct = choice.mark === toneTarget.mark;

  if (correct) {
    toneLocked = true;
    btn.classList.add("correct");
    showFeedback(true);
    setTimeout(startToneRound, 1100);
  } else {
    btn.classList.add("wrong");
    showFeedback(false);
    setTimeout(() => btn.classList.remove("wrong"), 1200);
  }
}

// ========== 小測驗 ==========

const QUIZ_LENGTH = 8;
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

function nextQuizQuestion() {
  if (quizQuestionNum >= QUIZ_LENGTH) {
    finishQuiz();
    return;
  }
  quizLocked = false;
  updateQuizHeader();

  const area = document.getElementById("quizQuestionArea");
  const type = Math.random() < 0.5 ? "hearSymbol" : "seeSymbol";
  const target = BOPOMOFO_SYMBOLS[randomInt(BOPOMOFO_SYMBOLS.length)];
  const others = shuffle(
    BOPOMOFO_SYMBOLS.filter(s => s.symbol !== target.symbol)
  ).slice(0, 3);

  if (type === "hearSymbol") {
    const choices = shuffle([target, ...others]);
    area.innerHTML =
      '<div class="prompt-box"><button class="speaker-btn" id="quizSpeaker">🔊</button></div>' +
      '<div class="choices-grid" id="quizChoices"></div>';
    document.getElementById("quizSpeaker").onclick = () => speak(target.symbol);
    const grid = document.getElementById("quizChoices");
    choices.forEach(choice => {
      const btn = document.createElement("button");
      btn.className = "choice-card";
      btn.textContent = choice.symbol;
      btn.onclick = () => handleQuizAnswer(choice.symbol === target.symbol, btn);
      grid.appendChild(btn);
    });
    speak(target.symbol);
  } else {
    const choices = shuffle([target, ...others]);
    area.innerHTML =
      '<div class="prompt-box"><div class="flashcard" style="cursor:default;height:220px;width:min(300px,70vw)">' +
      '<div class="symbol-big" style="font-size:140px">' + target.symbol + '</div></div></div>' +
      '<div class="choices-grid" id="quizChoices"></div>';
    const grid = document.getElementById("quizChoices");
    choices.forEach(choice => {
      const btn = document.createElement("button");
      btn.className = "choice-card";
      btn.style.fontSize = "60px";
      btn.textContent = choice.emoji;
      btn.onclick = () => handleQuizAnswer(choice.symbol === target.symbol, btn);
      grid.appendChild(btn);
    });
  }
}

function handleQuizAnswer(correct, btn) {
  if (quizLocked) return;
  quizLocked = true;

  if (correct) {
    btn.classList.add("correct");
    quizScore++;
  } else {
    btn.classList.add("wrong");
  }
  showFeedback(correct);
  updateQuizHeader();

  setTimeout(() => {
    quizQuestionNum++;
    nextQuizQuestion();
  }, 1100);
}

function finishQuiz() {
  const prevHigh = parseInt(localStorage.getItem(HIGH_SCORE_KEY) || "0", 10);
  const highScore = Math.max(prevHigh, quizScore);
  localStorage.setItem(HIGH_SCORE_KEY, String(highScore));

  const area = document.getElementById("quizQuestionArea");
  area.innerHTML =
    '<div class="quiz-result">' +
    '<div class="big-score">🏆</div>' +
    '<div class="word-text">你得到了 ' + quizScore + ' 顆星星！</div>' +
    '<div class="progress-text">最高紀錄：' + highScore + ' 顆星星</div>' +
    '<button class="big-btn combine-btn" onclick="startQuiz()">再玩一次</button>' +
    '</div>';
  document.getElementById("quizProgress").textContent = "完成！";
  speak("恭喜你，得到了 " + quizScore + " 顆星星！");
}

// ========== 打地鼠遊戲 ==========

const MOLE_COUNT = 9;
const MOLE_COLORS = [
  '#ff6b9d','#ffa552','#ffd166','#06d6a0','#4cc9f0',
  '#7b5ea7','#f72585','#4361ee','#3a86ff'
];

let moleScore = 0;
let moleTimeLeft = 60;
let moleTimerInt = null;
let molePopTimeout = null;
let moleTarget = null;
let moleRunning = false;

function startMoleGame() {
  moleScore = 0;
  moleTimeLeft = 60;
  moleRunning = true;

  document.getElementById('moleScore').textContent = '0';
  document.getElementById('moleTimer').textContent = '60';
  document.getElementById('moleGameover').style.display = 'none';

  // 建立 9 個地洞
  const grid = document.getElementById('moleGrid');
  grid.innerHTML = '';
  for (let i = 0; i < MOLE_COUNT; i++) {
    const hole = document.createElement('div');
    hole.className = 'mole-hole';

    const cup = document.createElement('div');
    cup.className = 'hole-cup';

    const body = document.createElement('div');
    body.className = 'mole-body';
    body.style.background = MOLE_COLORS[i];

    const ground = document.createElement('div');
    ground.className = 'hole-ground';

    cup.appendChild(body);
    cup.appendChild(ground);
    hole.appendChild(cup);
    hole.addEventListener('click', () => handleMoleClick(i));
    grid.appendChild(hole);
  }

  pickMoleTarget();

  // 倒數計時
  clearInterval(moleTimerInt);
  moleTimerInt = setInterval(() => {
    moleTimeLeft--;
    document.getElementById('moleTimer').textContent = moleTimeLeft;
    if (moleTimeLeft <= 0) endMoleGame();
  }, 1000);

  scheduleMoleBatch();
}

function pickMoleTarget() {
  moleTarget = BOPOMOFO_SYMBOLS[randomInt(BOPOMOFO_SYMBOLS.length)];
}

function replayMoleSound() {
  if (moleTarget) speak(moleTarget.symbol);
}

function scheduleMoleBatch() {
  if (!moleRunning) return;
  clearTimeout(molePopTimeout);

  // 先讓全部地鼠下去
  document.querySelectorAll('.mole-hole').forEach(h =>
    h.classList.remove('up', 'wrong-shake', 'whacked'));

  // 短暫停頓後彈出新一批
  molePopTimeout = setTimeout(() => {
    if (!moleRunning) return;
    popMoleBatch();
    // 每次新一批地鼠出現就重播目標音
    setTimeout(() => { if (moleRunning) speak(moleTarget.symbol); }, 100);
    molePopTimeout = setTimeout(() => scheduleMoleBatch(), 3500);
  }, 350);
}

function popMoleBatch() {
  const holes = document.querySelectorAll('.mole-hole');
  const count = 3 + randomInt(2); // 3 或 4 個
  const indices = shuffle([...Array(MOLE_COUNT).keys()]).slice(0, count);

  const others = shuffle(
    BOPOMOFO_SYMBOLS.filter(s => s.symbol !== moleTarget.symbol)
  ).slice(0, count - 1).map(s => s.symbol);

  const symbols = shuffle([moleTarget.symbol, ...others]);

  indices.forEach((idx, i) => {
    const hole = holes[idx];
    hole.querySelector('.mole-body').textContent = symbols[i];
    setTimeout(() => {
      if (moleRunning) hole.classList.add('up');
    }, i * 80);
  });
}

function handleMoleClick(idx) {
  if (!moleRunning) return;
  const hole = document.querySelectorAll('.mole-hole')[idx];
  if (!hole.classList.contains('up')) return;

  const symbol = hole.querySelector('.mole-body').textContent;

  if (symbol === moleTarget.symbol) {
    // 打中！
    moleScore++;
    document.getElementById('moleScore').textContent = moleScore;
    hole.classList.remove('up');
    hole.classList.add('whacked');
    setTimeout(() => hole.classList.remove('whacked'), 300);
    showMoleReward(hole);
    pickMoleTarget();
    scheduleMoleBatch();
  } else {
    // 打錯：扰 3 秒
    showMolePenalty(hole);
    hole.classList.add('wrong-shake');
    setTimeout(() => hole.classList.remove('wrong-shake'), 400);
  }
}

function endMoleGame() {
  moleRunning = false;
  clearInterval(moleTimerInt);
  clearTimeout(molePopTimeout);
  document.querySelectorAll('.mole-hole').forEach(h => h.classList.remove('up'));

  document.getElementById('moleFinalScore').textContent = moleScore;
  document.getElementById('moleGameover').style.display = 'flex';

  const msg = moleScore >= 15 ? '哇！你超厲害！' :
              moleScore >= 8  ? '很棒！繼續加油！' : '再試一次！';
  speak(msg);
}

function stopMoleGame() {
  moleRunning = false;
  clearInterval(moleTimerInt);
  clearTimeout(molePopTimeout);
}

function showMoleReward(holeEl) {
  const rect = holeEl.getBoundingClientRect();
  const emojis = ['⭐', '🌟', '✨', '🎉'];
  const el = document.createElement('div');
  el.className = 'mole-reward';
  el.textContent = emojis[randomInt(emojis.length)];
  el.style.left = (rect.left + rect.width / 2 - 18) + 'px';
  el.style.top  = (rect.top  + 10) + 'px';
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 750);

  // 分數彈跳
  const scoreEl = document.getElementById('moleScore');
  scoreEl.classList.remove('score-bounce');
  void scoreEl.offsetWidth;
  scoreEl.classList.add('score-bounce');
  setTimeout(() => scoreEl.classList.remove('score-bounce'), 400);
}

function showMolePenalty(holeEl) {
  // 浮出 ❌
  const rect = holeEl.getBoundingClientRect();
  const el = document.createElement('div');
  el.className = 'mole-reward';
  el.textContent = '❌';
  el.style.left = (rect.left + rect.width / 2 - 18) + 'px';
  el.style.top  = (rect.top  + 10) + 'px';
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 750);

  // 紅色閃屏
  const flash = document.createElement('div');
  flash.className = 'mole-wrong-flash';
  document.body.appendChild(flash);
  setTimeout(() => flash.remove(), 400);

  // 少 3 秒
  moleTimeLeft = Math.max(0, moleTimeLeft - 3);
  document.getElementById('moleTimer').textContent = moleTimeLeft;
  if (moleTimeLeft <= 0) endMoleGame();
}
