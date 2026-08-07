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
  if (name === "memory") startMemoryGame();
  if (name === "tone") startToneRound();
  if (name === "balloon") startBalloonGame();
}

function goHome() {
  stopMoleGame();
  stopBalloonGame();
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
  const extras = (typeof INITIAL_WORD_EXTRAS !== 'undefined' && INITIAL_WORD_EXTRAS[item.symbol]) || [];
  const all = [{ word: item.word, emoji: item.emoji }, ...extras];
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
    btn.textContent = toneSet.spelling + tone.mark;
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

// 射氣球專用播音：重複使用同一個 Audio，WAV 失敗 fallback speechSynthesis
function playBalloonSymbol(symbol) {
  const bare = symbol.replace(TONE_MARKS, '');
  const wav  = BPMF_TO_WAV[bare];
  if (!wav) return;

  if (!_balloonAudio) _balloonAudio = new Audio();
  _balloonAudio.pause();
  _balloonAudio.currentTime = 0;
  _balloonAudio.src = MOE_BASE + wav;
  _balloonAudio.play().catch(() => {
    // WAV 失敗 → speechSynthesis 備用
    if ('speechSynthesis' in window) {
      speechSynthesis.cancel();
      const utter = new SpeechSynthesisUtterance(BPMF_TO_CHAR[bare] || bare);
      utter.lang = 'zh-TW';
      if (_zhVoice) utter.voice = _zhVoice;
      utter.rate = 0.85;
      speechSynthesis.speak(utter);
    }
  });
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
  playBalloonSymbol(balloonTarget.symbol);
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
