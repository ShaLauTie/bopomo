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
function playAudioUrl(url, onEnd) {
  if (_currentAudio) {
    _currentAudio.pause();
    _currentAudio.onended = null;
    _currentAudio = null;
  }
  const audio = new Audio(url);
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
  const audio = new Audio(url);
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

// 輔助函式：將詞彙字與字之間加上空格，減緩語速並避免特定字元（如「烏龜」）在語音引擎中聽起來太快或碎裂
function spaceOutVocabulary(text) {
  const vocabWords = [];
  if (typeof BOPOMOFO_SYMBOLS !== 'undefined') {
    BOPOMOFO_SYMBOLS.forEach(s => { if (s.word) vocabWords.push(s.word); });
  }
  if (typeof PINYIN_COMBOS !== 'undefined') {
    PINYIN_COMBOS.forEach(c => { if (c.word) vocabWords.push(c.word); });
  }
  
  // 去除重複，並過濾掉長度小於 2 的字詞
  const uniqueVocabs = [...new Set(vocabWords)].filter(w => w.length >= 2);
  
  // 依長度從長到短排序，避免短詞先被取代
  uniqueVocabs.sort((a, b) => b.length - a.length);
  
  let result = text;
  uniqueVocabs.forEach(word => {
    const spaced = word.split("").join(" ");
    result = result.replace(new RegExp(word, 'g'), " " + spaced); // 前面多加一個空格讓語音有明顯頓點
  });
  
  return result.trim();
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
  // 將詞彙分開，減緩發音速度並避免發音碎裂
  const spacedText = spaceOutVocabulary(text);
  // 含注音符號的複合字串 → 先轉成可唸的中文
  speakViaGoogle(bopomofoToSpeakable(spacedText), onEnd);
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
  _screenGen++;  // 讓所有舊的語音 callback 自動作廢
  _fcGen++;      // 閃卡專用
  if (_currentAudio)  { _currentAudio.pause();  _currentAudio  = null; }
  if (_toneAudio)     { _toneAudio.pause();     _toneAudio     = null; }
  if (_whAudio)       { _whAudio.pause();       _whAudio       = null; }
  if (_balloonAudio)  { _balloonAudio.pause(); }
  if ('speechSynthesis' in window) speechSynthesis.cancel();
  setFcLocked(false); // 解鎖閃卡箭頭

  document.querySelectorAll(".screen").forEach(el => el.classList.remove("active"));
  document.getElementById("screen-" + name).classList.add("active");

  if (name === "flashcards") renderFlashcard();
  if (name === "match") startMatchRound();
  if (name === "pinyin") renderPinyin();
  if (name === "quiz") startQuiz();
  if (name === "mole") startMoleGame();
  if (name === "wordhead") startWordHeadRound();
  if (name === "picture") startPictureGame();
  if (name === "train") startTrainGame();
  if (name === "monster") startMonsterGame();
  if (name === "island") startIslandGame();
  if (name === "memory") startMemoryGame();
  if (name === "tone") startToneRound();
  if (name === "balloon") startBalloonGame();
  if (name === "claw") startClawGame();
  if (name === "spell") startSpellGame();
}

function goHome() {
  stopMoleGame();
  stopBalloonGame();
  stopClawGame();
  stopSpellGame();
  stopPictureGame();
  stopTrainGame();
  stopMonsterGame();
  stopIslandGame();
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

function showFeedback(good) {
  const banner = document.getElementById("feedbackBanner");
  banner.textContent = good ? "答對了！🎉" : "再試一次 😊";
  banner.className = "feedback-banner show " + (good ? "good" : "bad");
  speak(good ? "答對了，好棒！" : "再試一次");
  setTimeout(() => {
    banner.classList.remove("show");
  }, 900);
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

function renderFlashcard() {
  const item = BOPOMOFO_SYMBOLS[fcIndex];
  document.getElementById("fcSymbol").textContent = item.symbol;
  document.getElementById("fcEmoji").textContent = item.emoji;
  document.getElementById("fcWord").textContent = item.word;
  document.getElementById("fcProgress").textContent =
    (fcIndex + 1) + " / " + BOPOMOFO_SYMBOLS.length;
  // 鎖住箭頭，唔完才解鎖
  setFcLocked(true);
  speakCurrentFlashcard();
}

function speakCurrentFlashcard() {
  const item = BOPOMOFO_SYMBOLS[fcIndex];
  const myGen = _fcGen;  // 捕捕當前世代
  // 先唔符號，檢查世代後唔例字，避免切畫面後舊 callback 干擾
  speak(item.symbol, () => {
    if (_fcGen !== myGen) return;       // 已切畫面，中止
    setTimeout(() => {
      if (_fcGen !== myGen) return;
      speak(item.word, () => {
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

// ========== 拼音練習 ==========

let pinyinIndex = 0;

function renderPinyin() {
  const combo = PINYIN_COMBOS[pinyinIndex];
  document.getElementById("pinyinInitial").textContent = combo.initial;

  // 把音調符號從韻母拆開，各自顯示
  const TONE = /[ˊˇˋ˙]/;
  const toneChar = (combo.final.match(TONE) || [''])[0];
  const bodyChars = combo.final.replace(TONE, '');
  const bodySize  = bodyChars.length >= 2 ? '50px' : '76px';
  document.getElementById("pinyinFinal").innerHTML =
    `<span class="slot-body" style="font-size:${bodySize}">${bodyChars}</span>` +
    (toneChar ? `<span class="slot-tone">${toneChar}</span>` : '');

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
      ${toneChar ? `<div class="bopomofo-tone">${toneChar}</div>` : ''}
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

const QUIZ_LENGTH = 16;
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
  const rand = Math.random();
  let type = "hearSymbol";
  if (rand < 0.2) type = "hearSymbol";
  else if (rand < 0.4) type = "seeSymbol";
  else if (rand < 0.6) type = "hearWord";
  else if (rand < 0.8) type = "seePinyin";
  else type = "hearPinyin";

  if (type === "hearSymbol" || type === "seeSymbol" || type === "hearWord") {
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
    } else if (type === "seeSymbol") {
      const choices = shuffle([target, ...others]);
      const targetWordObj = getWordForSymbol(target);
      area.innerHTML =
        '<div class="prompt-box"><div class="flashcard" style="cursor:default;height:220px;width:min(300px,70vw)">' +
        '<div class="symbol-big" style="font-size:140px">' + target.symbol + '</div></div></div>' +
        '<div class="choices-grid" id="quizChoices"></div>';
      const grid = document.getElementById("quizChoices");
      choices.forEach(choice => {
        const btn = document.createElement("button");
        btn.className = "choice-card";
        btn.style.fontSize = "60px";
        const choiceWordObj = choice.symbol === target.symbol ? targetWordObj : getWordForSymbol(choice);
        btn.textContent = choiceWordObj.emoji;
        btn.onclick = () => handleQuizAnswer(choice.symbol === target.symbol, btn);
        grid.appendChild(btn);
      });
    } else {
      // hearWord: Hear a vocabulary word, choose the correct symbol
      const choices = shuffle([target, ...others]);
      const targetWordObj = getWordForSymbol(target);
      area.innerHTML =
        '<div class="prompt-box"><button class="speaker-btn" id="quizSpeaker">🔊</button></div>' +
        '<div class="choices-grid" id="quizChoices"></div>';
      document.getElementById("quizSpeaker").onclick = () => speak(targetWordObj.word);
      const grid = document.getElementById("quizChoices");
      choices.forEach(choice => {
        const btn = document.createElement("button");
        btn.className = "choice-card";
        btn.textContent = choice.symbol;
        btn.onclick = () => handleQuizAnswer(choice.symbol === target.symbol, btn);
        grid.appendChild(btn);
      });
      speak(targetWordObj.word);
    }
  } else {
    // seePinyin or hearPinyin (testing 2-character pinyin combinations)
    const targetPinyin = PINYIN_COMBOS[randomInt(PINYIN_COMBOS.length)];
    const othersPinyin = shuffle(
      PINYIN_COMBOS.filter(c => c.word !== targetPinyin.word)
    ).slice(0, 3);
    const choices = shuffle([targetPinyin, ...othersPinyin]);
    
    if (type === "seePinyin") {
      area.innerHTML =
        '<div class="prompt-box"><div class="flashcard" style="cursor:default;height:220px;width:min(300px,70vw);display:flex;align-items:center;justify-content:center;">' +
        renderPinyinHtml(targetPinyin.initial + targetPinyin.final, 130) +
        '</div></div>' +
        '<div class="choices-grid" id="quizChoices"></div>';
      
      const grid = document.getElementById("quizChoices");
      choices.forEach(choice => {
        const btn = document.createElement("button");
        btn.className = "choice-card";
        btn.style.fontSize = "60px";
        btn.textContent = choice.emoji;
        btn.onclick = () => handleQuizAnswer(choice.word === targetPinyin.word, btn);
        grid.appendChild(btn);
      });
    } else {
      // hearPinyin
      area.innerHTML =
        '<div class="prompt-box"><button class="speaker-btn" id="quizSpeaker">🔊</button></div>' +
        '<div class="choices-grid" id="quizChoices"></div>';
      document.getElementById("quizSpeaker").onclick = () => speak(targetPinyin.word);
      
      const grid = document.getElementById("quizChoices");
      choices.forEach(choice => {
        const btn = document.createElement("button");
        btn.className = "choice-card";
        btn.style.padding = "5px";
        btn.innerHTML = renderPinyinHtml(choice.initial + choice.final, 65);
        btn.onclick = () => handleQuizAnswer(choice.word === targetPinyin.word, btn);
        grid.appendChild(btn);
      });
      speak(targetPinyin.word);
    }
  }
}

function handleQuizAnswer(correct, btn) {
  if (quizLocked) return;
  quizLocked = true;

  if (correct) {
    btn.classList.add("correct");
    quizScore++;
    showFeedback(true);
    updateQuizHeader();
    setTimeout(() => {
      quizQuestionNum++;
      nextQuizQuestion();
    }, 1100);
  } else {
    btn.classList.add("wrong");
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
    // 打錯：暴示懲罰 + 暫停 3 秒（地鼠全部下去，停止新出現）
    showMolePenalty(hole);
    hole.classList.add('wrong-shake');
    setTimeout(() => hole.classList.remove('wrong-shake'), 400);
    clearTimeout(molePopTimeout);
    document.querySelectorAll('.mole-hole').forEach(h =>
      h.classList.remove('up', 'wrong-shake', 'whacked'));
    molePopTimeout = setTimeout(() => {
      if (moleRunning) scheduleMoleBatch();
    }, 3000);
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

// ========== 看圖找字頭 ==========

let whTarget = null;
let whLocked = false;

function getWordForSymbol(item) {
  const extras1 = (typeof INITIAL_WORD_EXTRAS !== 'undefined' && INITIAL_WORD_EXTRAS[item.symbol]) || [];
  const extras2 = (typeof OTHER_WORD_EXTRAS !== 'undefined' && OTHER_WORD_EXTRAS[item.symbol]) || [];
  const all = [{ word: item.word, emoji: item.emoji }, ...extras1, ...extras2];
  return all[randomInt(all.length)];
}

// 看圖找字頭：用預載語音念中文詞
let _whAudio = null;

function playWhWord(word) {
  if (_whAudio) { _whAudio.pause(); _whAudio = null; }
  if (!('speechSynthesis' in window)) return;
  const utter = new SpeechSynthesisUtterance(word);
  utter.lang  = 'zh-TW';
  if (_zhVoice) utter.voice = _zhVoice;
  utter.rate  = 0.85;
  speechSynthesis.speak(utter);
}

function startWordHeadRound() {
  whLocked = false;
  whTarget = BOPOMOFO_SYMBOLS[randomInt(BOPOMOFO_SYMBOLS.length)];
  const chosen = getWordForSymbol(whTarget);

  document.getElementById('whEmoji').textContent = chosen.emoji;
  document.getElementById('whWord').textContent  = chosen.word;

  const others = shuffle(BOPOMOFO_SYMBOLS.filter(s => s.symbol !== whTarget.symbol)).slice(0, 3);
  const choices = shuffle([whTarget, ...others]);

  const grid = document.getElementById('whChoices');
  grid.innerHTML = '';
  choices.forEach(c => {
    const btn = document.createElement('button');
    btn.className = 'choice-card';
    btn.textContent = c.symbol;
    btn.onclick = () => handleWhChoice(c, btn);
    grid.appendChild(btn);
  });

  playWhWord(chosen.word);
}

function replayWordHeadSound() {
  const word = document.getElementById('whWord').textContent;
  if (word) playWhWord(word);
}

function handleWhChoice(choice, btn) {
  if (whLocked) return;
  const correct = choice.symbol === whTarget.symbol;
  if (correct) {
    whLocked = true;
    btn.classList.add('correct');
    showFeedback(true);
    setTimeout(startWordHeadRound, 1100);
  } else {
    btn.classList.add('wrong');
    showFeedback(false);
    setTimeout(() => btn.classList.remove('wrong'), 1200);
  }
}

// ========== 看圖選注音 ==========

const PICTURE_LENGTH = 10;
let pictureScore = 0;
let pictureQuestionNum = 0;
let pictureCombo = null;
let pictureLocked = false;
let pictureRunning = false;

function comboSpelling(combo) {
  return `${combo.initial}${combo.final}`;
}

function startPictureGame() {
  pictureScore = 0;
  pictureQuestionNum = 0;
  pictureRunning = true;
  pictureLocked = false;
  document.getElementById('pictureGameover').style.display = 'none';
  nextPictureRound();
}

function nextPictureRound() {
  if (pictureQuestionNum >= PICTURE_LENGTH) {
    endPictureGame();
    return;
  }

  pictureLocked = false;
  pictureCombo = PINYIN_COMBOS[randomInt(PINYIN_COMBOS.length)];

  document.getElementById('pictureProgress').textContent = `第 ${pictureQuestionNum + 1} / ${PICTURE_LENGTH} 題`;
  document.getElementById('pictureStars').textContent = `⭐ ${pictureScore}`;
  document.getElementById('pictureEmoji').textContent = pictureCombo.emoji;
  document.getElementById('pictureWord').textContent = pictureCombo.word;

  const correctSpelling = comboSpelling(pictureCombo);
  const others = shuffle(PINYIN_COMBOS
    .map(comboSpelling)
    .filter(value => value !== correctSpelling)
  ).slice(0, 3);
  const choices = shuffle([correctSpelling, ...others]);

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

function replayPictureSound() {
  if (pictureCombo) speak(pictureCombo.word);
}

function handlePictureChoice(value, btn) {
  if (pictureLocked || !pictureRunning) return;
  const correct = value === comboSpelling(pictureCombo);

  if (!correct) {
    btn.classList.add('wrong');
    showFeedback(false);
    setTimeout(() => btn.classList.remove('wrong'), 1200);
    return;
  }

  pictureLocked = true;
  btn.classList.add('correct');
  pictureScore++;
  pictureQuestionNum++;
  document.getElementById('pictureStars').textContent = `⭐ ${pictureScore}`;
  showFeedback(true);
  speak(pictureCombo.word);

  setTimeout(() => {
    if (pictureRunning) nextPictureRound();
  }, 1200);
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

function toneLabel(tone) {
  if (tone === "ˊ") return "ˊ 二聲";
  if (tone === "ˇ") return "ˇ 三聲";
  if (tone === "ˋ") return "ˋ 四聲";
  if (tone === "˙") return "˙ 輕聲";
  return "一聲";
}

function toneSpeakText(tone) {
  if (tone === "ˊ") return "二聲";
  if (tone === "ˇ") return "三聲";
  if (tone === "ˋ") return "四聲";
  if (tone === "˙") return "輕聲";
  return "一聲";
}

function isTonePiece(value) {
  return value === "" || /^[ˊˇˋ˙]$/.test(value);
}

function renderGameChoiceHtml(value, baseSize = 68, extraClass = "game-bopomofo") {
  if (isTonePiece(value)) {
    return `<span class="tone-choice-mark">${toneLabel(value)}</span>`;
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

// ========== 注音小火車 ==========

const TRAIN_LENGTH = 8;
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
  document.getElementById("trainGameover").style.display = "none";
  nextTrainRound();
}

function nextTrainRound() {
  if (trainQuestionNum >= TRAIN_LENGTH) {
    endTrainGame();
    return;
  }

  trainCombo = PINYIN_COMBOS[randomInt(PINYIN_COMBOS.length)];
  trainStep = 0;
  trainLocked = false;

  document.getElementById("trainProgress").textContent = `第 ${trainQuestionNum + 1} / ${TRAIN_LENGTH} 題`;
  document.getElementById("trainStars").textContent = `⭐ ${trainScore}`;
  document.getElementById("trainEmoji").textContent = trainCombo.emoji;
  document.getElementById("trainWord").textContent = trainCombo.word;
  document.getElementById("trainInitialCar").innerHTML = "";
  document.getElementById("trainFinalCar").innerHTML = "";
  document.getElementById("trainToneCar").textContent = "";

  updateTrainHint();
  renderTrainChoices();
  speak(trainCombo.word);
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
    values = buildChoiceValues(
      parts.initial,
      BOPOMOFO_SYMBOLS.filter(item => item.category === "initial").map(item => item.symbol),
      4
    );
  } else if (trainStep === 1) {
    values = buildChoiceValues(
      parts.finalBody,
      PINYIN_COMBOS.map(combo => comboParts(combo).finalBody),
      4
    );
  } else {
    values = buildChoiceValues(parts.tone, GAME_TONE_OPTIONS, 4);
  }

  values.forEach(value => {
    const btn = document.createElement("button");
    btn.className = "choice-card train-choice-card";
    btn.innerHTML = renderGameChoiceHtml(value, trainStep === 1 ? 58 : 70, "game-bopomofo train-bopomofo");
    btn.onclick = () => handleTrainChoice(value, btn);
    grid.appendChild(btn);
  });
}

function handleTrainChoice(value, btn) {
  if (!trainRunning || trainLocked || !trainCombo) return;
  const expected = trainExpectedValue();

  if (value !== expected) {
    btn.classList.add("wrong");
    showFeedback(false);
    setTimeout(() => btn.classList.remove("wrong"), 1100);
    return;
  }

  btn.classList.add("correct");
  fillTrainCar(value);
  trainStep++;

  if (trainStep >= 3) {
    trainLocked = true;
    trainScore++;
    trainQuestionNum++;
    document.getElementById("trainStars").textContent = `⭐ ${trainScore}`;
    showFeedback(true);
    speak(trainCombo.word);
    setTimeout(() => {
      if (trainRunning) nextTrainRound();
    }, 1200);
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
    document.getElementById("trainToneCar").textContent = toneLabel(value);
  }
}

function replayTrainSound() {
  if (trainCombo) speak(trainCombo.word);
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
let monsterScore = 0;
let monsterQuestionNum = 0;
let monsterCombo = null;
let monsterRunning = false;
let monsterLocked = false;

function startMonsterGame() {
  monsterScore = 0;
  monsterQuestionNum = 0;
  monsterRunning = true;
  monsterLocked = false;
  document.getElementById("monsterGameover").style.display = "none";
  nextMonsterRound();
}

function nextMonsterRound() {
  if (monsterQuestionNum >= MONSTER_LENGTH) {
    endMonsterGame();
    return;
  }

  monsterCombo = PINYIN_COMBOS[randomInt(PINYIN_COMBOS.length)];
  monsterLocked = false;

  document.getElementById("monsterProgress").textContent = `第 ${monsterQuestionNum + 1} / ${MONSTER_LENGTH} 題`;
  document.getElementById("monsterStars").textContent = `⭐ ${monsterScore}`;
  document.getElementById("monsterFace").textContent = "👾";
  document.getElementById("monsterEmoji").textContent = monsterCombo.emoji;
  document.getElementById("monsterWord").textContent = monsterCombo.word;

  const correctSpelling = comboSpelling(monsterCombo);
  const values = buildChoiceValues(correctSpelling, PINYIN_COMBOS.map(comboSpelling), 4);
  const grid = document.getElementById("monsterChoices");
  grid.innerHTML = "";
  values.forEach(value => {
    const btn = document.createElement("button");
    btn.className = "choice-card monster-choice-card";
    btn.innerHTML = renderGameChoiceHtml(value, 72, "game-bopomofo monster-bopomofo");
    btn.onclick = () => handleMonsterChoice(value, btn);
    grid.appendChild(btn);
  });

  speak(monsterCombo.word);
}

function replayMonsterSound() {
  if (monsterCombo) speak(monsterCombo.word);
}

function handleMonsterChoice(value, btn) {
  if (!monsterRunning || monsterLocked || !monsterCombo) return;
  const correct = value === comboSpelling(monsterCombo);

  if (!correct) {
    btn.classList.add("wrong");
    document.getElementById("monsterFace").textContent = "😖";
    showFeedback(false);
    setTimeout(() => {
      btn.classList.remove("wrong");
      if (monsterRunning) document.getElementById("monsterFace").textContent = "👾";
    }, 1100);
    return;
  }

  monsterLocked = true;
  btn.classList.add("correct");
  document.getElementById("monsterFace").textContent = "😋";
  monsterScore++;
  monsterQuestionNum++;
  document.getElementById("monsterStars").textContent = `⭐ ${monsterScore}`;
  showFeedback(true);
  speak(monsterCombo.word);

  setTimeout(() => {
    if (monsterRunning) nextMonsterRound();
  }, 1200);
}

function endMonsterGame() {
  monsterRunning = false;
  document.getElementById("monsterFinalScore").textContent = monsterScore;
  document.getElementById("monsterGameover").style.display = "flex";
  const msg = monsterScore >= MONSTER_LENGTH ? "怪獸吃到全部正確注音了！" :
              monsterScore >= 6 ? "很棒，怪獸吃得很開心！" : "再試一次，先看圖再找完整注音！";
  speak(msg);
}

function stopMonsterGame() {
  monsterRunning = false;
  monsterLocked = false;
}

// ========== 注音拼圖島 ==========

const ISLAND_LENGTH = 8;
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
  document.getElementById("islandGameover").style.display = "none";
  nextIslandRound();
}

function nextIslandRound() {
  if (islandQuestionNum >= ISLAND_LENGTH) {
    endIslandGame();
    return;
  }

  islandCombo = PINYIN_COMBOS[randomInt(PINYIN_COMBOS.length)];
  islandTargetPieces = fullSpellingPieces(comboSpelling(islandCombo));
  islandSelectedPieces = [];
  islandLocked = false;

  document.getElementById("islandProgress").textContent = `第 ${islandQuestionNum + 1} / ${ISLAND_LENGTH} 題`;
  document.getElementById("islandStars").textContent = `⭐ ${islandScore}`;
  document.getElementById("islandEmoji").textContent = islandCombo.emoji;
  document.getElementById("islandWord").textContent = islandCombo.word;
  updateIslandHint();
  renderIslandTower();
  renderIslandPieces();
  speak(islandCombo.word);
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

function renderIslandPieces() {
  const pool = [
    ...BOPOMOFO_SYMBOLS.map(item => item.symbol),
    "ˊ", "ˇ", "ˋ", "˙"
  ];
  const values = buildChoiceValues(
    islandTargetPieces[0],
    [...islandTargetPieces, ...shuffle(pool)],
    Math.max(6, islandTargetPieces.length)
  );
  const orderedValues = shuffle(uniqueValues([...islandTargetPieces, ...values]).slice(0, Math.max(6, islandTargetPieces.length)));
  const grid = document.getElementById("islandPieces");
  grid.innerHTML = "";

  orderedValues.forEach(value => {
    const used = islandSelectedPieces.includes(value);
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
    showFeedback(false);
    setTimeout(() => btn.classList.remove("wrong"), 1100);
    return;
  }

  islandSelectedPieces.push(value);
  btn.classList.add("correct");
  speakGamePiece(value);
  renderIslandTower();

  if (islandSelectedPieces.length >= islandTargetPieces.length) {
    islandLocked = true;
    islandScore++;
    islandQuestionNum++;
    document.getElementById("islandStars").textContent = `⭐ ${islandScore}`;
    showFeedback(true);
    speak(islandCombo.word);
    setTimeout(() => {
      if (islandRunning) nextIslandRound();
    }, 1200);
    return;
  }

  updateIslandHint();
  renderIslandPieces();
}

function replayIslandSound() {
  if (islandCombo) speak(islandCombo.word);
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

  const chosen = shuffle(BOPOMOFO_SYMBOLS).slice(0, MEM_PAIRS);
  const cards  = [];
  chosen.forEach((item, i) => {
    cards.push({ matchId: i, type: 'symbol', display: item.symbol, item });
    cards.push({ matchId: i, type: 'emoji',  display: item.emoji,  item });
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
  speak(card.item.symbol);
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
  toneSet    = TONE_SETS[randomInt(TONE_SETS.length)];
  toneTarget = toneSet.tones[randomInt(toneSet.tones.length)];

  document.getElementById('toneEmoji').textContent = toneTarget.emoji;
  document.getElementById('toneWord').textContent  = toneTarget.word;

  playToneQuestion();

  const grid = document.getElementById('toneChoices');
  grid.innerHTML = '';
  // 固定順序：一聲→二聲→三聲→四聲
  toneSet.tones.forEach(tone => {
    const btn = document.createElement('button');
    btn.className = 'choice-card';
    btn.style.fontSize   = '1.5rem';
    btn.style.minHeight  = '80px';
    btn.style.padding    = '5px';
    btn.innerHTML = renderPinyinHtml(toneSet.spelling + tone.mark, 45);
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

  if (!('speechSynthesis' in window)) return;

  // 先清一次佇列
  speechSynthesis.cancel();

  // 延遲 200ms 讓 cancel 生效，再次清除後才 speak
  setTimeout(() => {
    if (_toneGen !== myGen) return;
    // 再清一次：防止其他遊戲的 error callback 在這 200ms 內偷塞了 utterance
    speechSynthesis.cancel();
    if (_currentAudio) { _currentAudio.pause(); _currentAudio = null; }

    const utter = new SpeechSynthesisUtterance(myWord);
    utter.lang  = 'zh-TW';
    if (_zhVoice) utter.voice = _zhVoice;
    utter.rate  = 0.85;
    speechSynthesis.speak(utter);
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
    setTimeout(() => banner.classList.remove("show"), 900);
    setTimeout(startToneRound, 1100);
  } else {
    btn.classList.add('wrong');
    banner.textContent = "再試一次 😊";
    banner.className = "feedback-banner show bad";
    setTimeout(() => banner.classList.remove("show"), 900);
    setTimeout(() => btn.classList.remove('wrong'), 1200);
  }
}

// ========== 射氣球 ==========

let balloonScore = 0;
let balloonTimeLeft = 45;
let balloonTimerInt = null;
let balloonRunning = false;
let balloonTarget = null;
let balloonCreateTimeout = null;
let _balloonAudio = null;  // 重複使用的 Audio 元素（避免 Android 上限）
const BALLOON_COLORS = ['#ff6b9d','#ffa552','#ffd166','#06d6a0','#4cc9f0','#7b5ea7'];

// 射氣球專用播音：每次新建 Audio（確保 MISS 後的 setTimeout 也能播）
function playBalloonSymbol(symbol) {
  const bare = symbol.replace(TONE_MARKS, '');
  const wav  = BPMF_TO_WAV[bare];
  if (!wav) return;

  // 釋放舊的 Audio 資源
  if (_balloonAudio) {
    _balloonAudio.pause();
    _balloonAudio.onended = null;
    _balloonAudio.onerror = null;
    try { _balloonAudio.src = ''; _balloonAudio.load(); } catch(e) {}
    _balloonAudio = null;
  }

  // 每次建新的 Audio，避免 Android 同 src 重播靜音問題
  const audio = new Audio();
  _balloonAudio = audio;
  audio.src = MOE_BASE + wav;
  audio.load();

  // 嘗試播放
  const playPromise = audio.play();

  // 安全網：500ms 內如果 play 失敗或沒聲音，用 speechSynthesis 補
  let played = false;
  audio.onplaying = () => { played = true; };

  if (playPromise && playPromise.catch) {
    playPromise.catch(() => {
      if (played) return;
      played = true;
      _speakFallbackBalloon(bare);
    });
  }

  setTimeout(() => {
    if (!played && _balloonAudio === audio) {
      played = true;
      _speakFallbackBalloon(bare);
    }
  }, 500);
}

function _speakFallbackBalloon(bare) {
  if ('speechSynthesis' in window) {
    speechSynthesis.cancel();
    const utter = new SpeechSynthesisUtterance(BPMF_TO_CHAR[bare] || bare);
    utter.lang = 'zh-TW';
    if (_zhVoice) utter.voice = _zhVoice;
    utter.rate = 0.85;
    speechSynthesis.speak(utter);
  }
}

function startBalloonGame() {
  balloonScore = 0;
  balloonTimeLeft = 45;
  balloonRunning = true;
  
  document.getElementById('balloonScore').textContent = '0';
  document.getElementById('balloonTimer').textContent = '45';
  document.getElementById('balloonGameover').style.display = 'none';
  document.getElementById('balloonContainer').innerHTML = '';
  
  clearInterval(balloonTimerInt);
  balloonTimerInt = setInterval(() => {
    balloonTimeLeft--;
    document.getElementById('balloonTimer').textContent = balloonTimeLeft;
    if (balloonTimeLeft <= 0) endBalloonGame();
  }, 1000);
  
  pickBalloonTarget();
  launchBalloons();
}

function pickBalloonTarget() {
  balloonTarget = BOPOMOFO_SYMBOLS[randomInt(BOPOMOFO_SYMBOLS.length)];
}

function replayBalloonSound() {
  if (balloonTarget) playBalloonSymbol(balloonTarget.symbol);
}

function launchBalloons() {
  if (!balloonRunning) return;
  const container = document.getElementById('balloonContainer');
  container.innerHTML = '';
  
  const others = shuffle(
    BOPOMOFO_SYMBOLS.filter(s => s.symbol !== balloonTarget.symbol)
  ).slice(0, 2).map(s => s.symbol);
  
  const symbols = shuffle([balloonTarget.symbol, ...others]);
  
  symbols.forEach((sym, i) => {
    const balloon = document.createElement('div');
    balloon.className = 'balloon';
    balloon.style.background = BALLOON_COLORS[randomInt(BALLOON_COLORS.length)];
    balloon.style.left = (15 + i * 30) + '%';
    balloon.textContent = sym;
    
    const string = document.createElement('div');
    string.className = 'balloon-string';
    balloon.appendChild(string);
    
    balloon.onclick = () => handleBalloonClick(sym, balloon);
    
    // Auto remove and relaunch
    balloon.addEventListener('animationend', (e) => {
      if (e.animationName === 'floatUp' && balloonRunning) {
        if (container.contains(balloon)) {
          // If the correct one flew away, just relaunch
          if (sym === balloonTarget.symbol && !document.querySelector('.balloon-penalty')) {
             clearTimeout(balloonCreateTimeout);
             balloonCreateTimeout = setTimeout(launchBalloons, 500);
          }
        }
      }
    });
    
    container.appendChild(balloon);
  });

  // 氣球出現後立刻念題目
  playBalloonSymbol(balloonTarget.symbol);
}

function handleBalloonClick(sym, balloonEl) {
  if (!balloonRunning || balloonEl.dataset.hit) return;
  balloonEl.dataset.hit = '1';  // 防止重複點擊

  const container = document.getElementById('balloonContainer');
  const bRect = balloonEl.getBoundingClientRect();
  const cRect = container.getBoundingClientRect();

  // 氣球中心（相對於 container）
  const bx = bRect.left - cRect.left + bRect.width / 2;
  const by = bRect.top - cRect.top + bRect.height / 2;

  // ── 飛鏢從底部中央飛向氣球 ──
  const dart = document.createElement('div');
  dart.className = 'dart';
  dart.textContent = '🎯';
  // 起點：底部中央
  const startX = cRect.width / 2;
  const startY = cRect.height;
  dart.style.left = startX + 'px';
  dart.style.top = startY + 'px';
  // 用 transition 飛到氣球位置
  dart.style.transition = 'left 0.3s ease-in, top 0.3s ease-in';
  container.appendChild(dart);

  requestAnimationFrame(() => {
    dart.style.left = bx + 'px';
    dart.style.top = by + 'px';
  });

  // 飛鏢到達後的效果
  setTimeout(() => {
    dart.remove();

    if (sym === balloonTarget.symbol) {
      // ── 射中！氣球爆 + 彩帶 ──
      balloonScore++;
      document.getElementById('balloonScore').textContent = balloonScore;

      // 分數彈跳
      const scoreEl = document.getElementById('balloonScore');
      scoreEl.classList.remove('score-bounce');
      void scoreEl.offsetWidth;
      scoreEl.classList.add('score-bounce');

      balloonEl.classList.add('balloon-pop');

      // 彩帶粒子從氣球位置噴射
      spawnConfetti(container, bx, by);

      const myScreen = _screenGen;
      setTimeout(() => {
        if (myScreen !== _screenGen) return;
        pickBalloonTarget();
        launchBalloons();
      }, 600);

    } else {
      // ── 射不中！MISS ──
      balloonEl.dataset.hit = '';  // 允許再點

      // MISS 文字
      const miss = document.createElement('div');
      miss.className = 'miss-text';
      miss.textContent = 'MISS!';
      miss.style.left = (bx - 45) + 'px';
      miss.style.top = (by - 20) + 'px';
      container.appendChild(miss);
      setTimeout(() => miss.remove(), 1000);

      // 懲罰遮罩
      const penalty = document.createElement('div');
      penalty.className = 'balloon-penalty';
      penalty.textContent = '😵';
      container.appendChild(penalty);

      // 凍結氣球
      document.querySelectorAll('.balloon').forEach(b => {
        b.style.animationPlayState = 'paused';
        b.onclick = null;
      });

      setTimeout(() => {
        if (!balloonRunning) return;
        penalty.remove();
        launchBalloons();
      }, 3000);
    }
  }, 320);  // 飛鏢飛行時間
}

// 彩帶粒子噴射
function spawnConfetti(container, cx, cy) {
  const colors = ['#ff6b9d','#ffd166','#06d6a0','#4cc9f0','#7b5ea7','#ff5252','#ffab40'];
  for (let i = 0; i < 18; i++) {
    const c = document.createElement('div');
    c.className = 'confetti';
    c.style.left = cx + 'px';
    c.style.top = cy + 'px';
    c.style.background = colors[i % colors.length];
    c.style.width = (6 + Math.random() * 8) + 'px';
    c.style.height = (6 + Math.random() * 8) + 'px';
    c.style.borderRadius = Math.random() > 0.5 ? '50%' : '2px';
    // 隨機方向
    const angle = Math.random() * Math.PI * 2;
    const dist = 40 + Math.random() * 80;
    c.style.setProperty('--cx', Math.cos(angle) * dist + 'px');
    c.style.setProperty('--cy', Math.sin(angle) * dist - 30 + 'px');
    container.appendChild(c);
    setTimeout(() => c.remove(), 950);
  }
}

function endBalloonGame() {
  balloonRunning = false;
  clearInterval(balloonTimerInt);
  clearTimeout(balloonCreateTimeout);
  document.getElementById('balloonContainer').innerHTML = '';
  
  document.getElementById('balloonFinalScore').textContent = balloonScore;
  document.getElementById('balloonGameover').style.display = 'flex';
  
  const msg = balloonScore >= 15 ? '哇！你超厲害！' :
              balloonScore >= 8  ? '很棒！繼續加油！' : '再試一次！';
  speak(msg);
}

function stopBalloonGame() {
  balloonRunning = false;
  clearInterval(balloonTimerInt);
  clearTimeout(balloonCreateTimeout);
  if (_balloonAudio) { _balloonAudio.pause(); }
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

function initClawControls() {
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
    
    const clientX = e.type.includes('touch') ? e.touches[0].clientX : e.clientX;
    updateJoystickPosition(clientX);
  }
  
  function handleJoystickMove(e) {
    if (!isDraggingJoystick || !clawRunning || isGrabbing) return;
    const clientX = e.type.includes('touch') ? e.touches[0].clientX : e.clientX;
    updateJoystickPosition(clientX);
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
    symbols = shuffle(PINYIN_COMBOS).slice(0, 5);
  } else {
    symbols = shuffle(BOPOMOFO_SYMBOLS).slice(0, 5);
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
      speak(clawTarget.word);
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
          // 夾錯了：夾不起來，語音提示錯誤，靜止三秒
          showFeedback(false);
          
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

let spellScore = 0;
let spellQuestionNum = 0;
let spellCombo = null;      // 目前題目（PINYIN_COMBOS 之一）
let spellStep = 'initial';  // 'initial' → 選聲母；'final' → 選韻符
let spellLocked = false;
let spellRunning = false;

// 所有題庫用到的韻符池（含聲調），供第二步生成干擾選項
const SPELL_FINALS = [...new Set(PINYIN_COMBOS.map(c => c.final))];
// 所有聲母池，供第一步生成干擾選項
const SPELL_INITIALS = [...new Set(PINYIN_COMBOS.map(c => c.initial))];

function startSpellGame() {
  spellScore = 0;
  spellQuestionNum = 0;
  spellRunning = true;
  spellLocked = false;
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
  spellCombo = PINYIN_COMBOS[randomInt(PINYIN_COMBOS.length)];

  document.getElementById('spellEmoji').textContent = spellCombo.emoji;
  document.getElementById('spellWord').textContent  = spellCombo.word;

  // 拼字槽：同一個音節直排，等孩子依序選聲母與韻符
  renderSpellSyllable();

  renderSpellChoices('initial');
  speak(spellCombo.word);
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

  const others = shuffle(pool.filter(v => v !== correct)).slice(0, 3);
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

    // 拼起來唸出完整詞
    speak(spellCombo.word);
    showFeedback(true);

    setTimeout(() => {
      if (spellRunning) nextSpellRound();
    }, 1300);
  }
}

function replaySpellSound() {
  if (spellCombo) speak(spellCombo.word);
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
