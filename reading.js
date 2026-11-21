// ===================================================================
// 注音導讀：一個字一個字讓孩子念，用語音辨識聽，念錯了姨姨糾正
// ===================================================================

const READ_TONES = /[ˊˇˋ˙]/g;
const readBare = zy => zy.replace(READ_TONES, "");

// 字 → 這個字可能的讀音（不分聲調）
let _readCharMap = null;
function readingsOf(ch) {
  if (!_readCharMap) {
    _readCharMap = new Map();
    for (const [zy, chars] of Object.entries(READ_MAP)) {
      for (const c of chars) {
        if (!_readCharMap.has(c)) _readCharMap.set(c, new Set());
        _readCharMap.get(c).add(zy);
      }
    }
  }
  return _readCharMap.get(ch) || new Set();
}

// 小朋友口音放寬：ㄓㄔㄕㄖ≈ㄗㄘㄙ、ㄣ≈ㄥ、ㄋ≈ㄌ、ㄈ≈ㄏㄨ
const readLoose = zy => readBare(zy)
  .replace(/ㄓ/g, "ㄗ").replace(/ㄔ/g, "ㄘ").replace(/ㄕ/g, "ㄙ").replace(/ㄖ/g, "ㄌ")
  .replace(/ㄥ/g, "ㄣ").replace(/ㄋ/g, "ㄌ").replace(/^ㄈ/, "ㄏㄨ");
// 只念一個音時，辨識常給英文字母（地 → D、逼 → B）
const READ_LETTERS = { A: "ㄟ", B: "ㄅㄧ", C: "ㄙㄧ", D: "ㄉㄧ", E: "ㄧ", G: "ㄐㄧ", J: "ㄐㄟ", K: "ㄎㄟ",
  O: "ㄡ", P: "ㄆㄧ", Q: "ㄎㄧㄡ", T: "ㄊㄧ", U: "ㄧㄡ", V: "ㄨㄟ", Y: "ㄨㄞ" };

// 聽到的話裡有沒有念對：同一個字、讀音一樣或很像的字都算（語音辨識常給同音字）
function readingHeardRight(transcripts, ch, zy) {
  const want = readLoose(zy);
  return transcripts.some(t => {
    const hz = [...t].filter(c => /[一-鿿]/.test(c));
    if (hz.length > 8) return false;                    // 念一整串不算
    if (hz.some(c => c === ch || [...readingsOf(c)].some(r => readLoose(r) === want))) return true;
    const letters = t.toUpperCase().replace(/[^A-Z]/g, "");
    return letters.length > 0 && letters.length <= 2 && [...letters].some(L => READ_LETTERS[L] && readLoose(READ_LETTERS[L]) === want);
  });
}

let readLesson = null;     // 目前這一課
let readLine = 0;          // 第幾行
let readPos = 0;           // 這一行第幾個字
let readTries = 0;         // 這個字念錯幾次
let readBusy = false;      // 正在聽或正在念，按鈕先不能按
let readRecog = null;
let readStars = 0;

function readingSpeakKey(key, fallback, onEnd) {
  if (typeof TTS_FILES !== "undefined" && TTS_FILES.has(ttsHash(key))) {
    playAudioUrl(`sounds/tts/${ttsHash(key)}.mp3?v=yiyi5`, onEnd, 1);
  } else {
    speak(fallback, onEnd);
  }
}

function startReading() {
  stopReading();
  readLesson = null;
  renderReadingMenu();
}

function stopReading() {
  if (readRecog) { try { readRecog.abort(); } catch (e) {} readRecog = null; }
  readBusy = false;
}

// 隱藏國字：孩子還看不懂國字，只看注音；念對的字才顯示國字（記在這台平板）
let readHideHanzi = true;
try { readHideHanzi = localStorage.getItem("readHideHanzi") !== "0"; } catch (e) {}
function toggleReadingHanzi() {
  readHideHanzi = !readHideHanzi;
  try { localStorage.setItem("readHideHanzi", readHideHanzi ? "1" : "0"); } catch (e) {}
  applyReadingHanzi();
  readingPrompt();
}
function applyReadingHanzi() {
  document.getElementById("readText").classList.toggle("hide-han", readHideHanzi);
  document.getElementById("readHanziBtn").textContent = readHideHanzi ? "👀 顯示國字" : "🙈 隱藏國字";
}

function renderReadingMenu() {
  document.getElementById("readMenu").style.display = "";
  document.getElementById("readBook").style.display = "none";
  const box = document.getElementById("readMenu");
  box.innerHTML = READING_LESSONS.map((l, i) => `
    <button class="read-lesson-card" onclick="openReadingLesson(${i})">
      <span class="read-lesson-emoji">${l.emoji}</span>
      <span class="read-lesson-label">${l.label}</span>
      <span class="read-lesson-title">${l.title}</span>
    </button>`).join("");
}

function openReadingLesson(i) {
  readLesson = READING_LESSONS[i];
  readLine = 0; readPos = 0; readTries = 0; readStars = 0;
  document.getElementById("readMenu").style.display = "none";
  document.getElementById("readBook").style.display = "";
  document.getElementById("readTitle").textContent = `${readLesson.label} ${readLesson.title}`;
  skipPunctuation();
  applyReadingHanzi();
  renderReadingText();
  readingPrompt();
}

function readingChars(line) { return readingLineChars(readLesson.lines[line]); }

// 跳過標點，停在下一個要念的字
function skipPunctuation() {
  while (readLine < readLesson.lines.length) {
    const cs = readingChars(readLine);
    while (readPos < cs.length && !cs[readPos].zy) readPos++;
    if (readPos < cs.length) return;
    readLine++; readPos = 0;
  }
}

function renderReadingText() {
  const box = document.getElementById("readText");
  box.innerHTML = readLesson.lines.map((line, li) => {
    // 標點黏在前一個字後面，換行時不會自己掉到下一行
    const groups = [];
    readingLineChars(line).forEach((c, ci) => {
      if (!c.zy) {
        const p = `<span class="read-punct">${c.ch}</span>`;
        if (groups.length) groups[groups.length - 1] += p; else groups.push(p);
        return;
      }
      const done = li < readLine || (li === readLine && ci < readPos);
      const now = li === readLine && ci === readPos;
      groups.push(`<span class="read-cell${done ? " done" : ""}${now ? " now" : ""}" id="readCell-${li}-${ci}"
        onclick="tapReadingCell(${li}, ${ci})">
        <span class="read-ch">${c.ch}</span>${renderPinyinHtml(c.zy, 26, "read-zy")}</span>`);
    });
    const cells = groups.map(g => `<span class="read-group">${g}</span>`).join("");
    return `<div class="read-line${li === 0 ? " read-line-title" : ""}${li === readLine ? " current" : ""}">${cells}</div>`;
  }).join("");
  const now = document.querySelector(".read-cell.now");
  if (now) now.scrollIntoView({ block: "nearest", behavior: "smooth" });
}

function currentReadChar() {
  if (!readLesson || readLine >= readLesson.lines.length) return null;
  return readingChars(readLine)[readPos];
}

function setReadStatus(text, cls = "") {
  const el = document.getElementById("readStatus");
  el.textContent = text;
  el.className = "read-status " + cls;
}

function readingPrompt() {
  const c = currentReadChar();
  if (!c) return;
  readTries = 0;
  setReadStatus(readHideHanzi ? `念念看這個注音 👉 ${c.zy}` : `念念看這個字 👉 ${c.ch}`);
}

// 點已經念過的字：聽姨姨念那個字
function tapReadingCell(li, ci) {
  if (readBusy) return;
  const c = readingLineChars(readLesson.lines[li])[ci];
  readingSpeakKey(readingCharKey(c.ch, c.zy), c.ch);
}

function readingListenChar() {
  const c = currentReadChar();
  if (!c || readBusy) return;
  readingSpeakKey(readingCharKey(c.ch, c.zy), c.ch);
}

function readingListenLine() {
  if (!readLesson || readBusy) return;
  const li = Math.min(readLine, readLesson.lines.length - 1);
  readingSpeakKey(readingLineKey(readLesson.lines[li][0]), readLesson.lines[li][0]);
}

// 🎤 孩子念
function readingMic() {
  const c = currentReadChar();
  if (!c || readBusy) return;
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SR) {
    setReadStatus("這個瀏覽器不能聽，請用 Chrome；或請爸爸媽媽按 ✔ ✘", "bad");
    return;
  }
  const rec = new SR();
  readRecog = rec;
  rec.lang = "zh-TW";
  // 邊聽邊判斷：一聽到念對就算過，不用等辨識結束（念一個字時常常等不到最後結果）
  rec.interimResults = true;
  rec.maxAlternatives = 5;
  rec.continuous = true;
  let done = false, heard = [];
  readBusy = true;
  document.getElementById("readMicBtn").classList.add("listening");
  setReadStatus("👂 正在聽…");
  const finish = ok => {
    if (done) return;
    done = true;
    clearTimeout(timer);
    try { rec.stop(); } catch (e) {}
    finishListening();
    if (ok) judgeReading(true, null);
    else if (heard.length) judgeReading(false, heard[heard.length - 1]);
    else {
      readNoHear++;
      setReadStatus(readNoHear >= 2 ? "沒聽到聲音，大聲一點再按 🎤；或請爸爸媽媽按 ✔ ✘" : "沒聽到，大聲一點再按 🎤 念一次");
    }
  };
  const timer = setTimeout(() => finish(false), 5000);
  rec.onresult = e => {
    const alts = [];
    for (let i = e.resultIndex; i < e.results.length; i++) for (const a of e.results[i]) alts.push(a.transcript);
    const said = alts.filter(t => t.trim());
    if (!said.length) return;
    readNoHear = 0;
    heard.push(said[0].trim());
    if (readingHeardRight(said, c.ch, c.zy)) finish(true);
    else if ([...e.results].some(r => r.isFinal)) finish(false);
  };
  rec.onerror = e => {
    if (done) return;
    if (e.error === "not-allowed" || e.error === "service-not-allowed") { done = true; clearTimeout(timer); finishListening(); setReadStatus("請允許使用麥克風 🎤", "bad"); }
    else if (e.error === "network") { done = true; clearTimeout(timer); finishListening(); setReadStatus("要連上網路才能聽喔", "bad"); }
    else finish(false);
  };
  rec.onend = () => finish(false);
  try { rec.start(); } catch (e) { finish(false); }
}
let readNoHear = 0;

function finishListening() {
  readBusy = false;
  readRecog = null;
  document.getElementById("readMicBtn").classList.remove("listening");
}

// 爸爸媽媽在旁邊聽：直接按對或錯
function readingParent(ok) {
  if (!currentReadChar() || readBusy) return;
  judgeReading(ok, null);
}

function judgeReading(ok, heard) {
  const c = currentReadChar();
  if (!c) return;
  const cell = document.getElementById(`readCell-${readLine}-${readPos}`);
  if (ok) {
    playCorrectDingDing();
    setReadStatus(`✅ 念對了！${c.ch}`, "good");
    readStars++;
    advanceReading();
    return;
  }
  // 念錯：姨姨告訴他怎麼念，再念一次
  readTries++;
  if (cell) { cell.classList.remove("wrong"); void cell.offsetWidth; cell.classList.add("wrong"); }
  breakStreak();
  setReadStatus(heard ? `聽到「${heard}」，這個字念 ${c.zy}` : `這個字念 ${c.zy}`, "bad");
  readBusy = true;
  const after = () => {
    readBusy = false;
    if (readTries >= 3) {
      // 念了三次還不對：先跳過，不要卡住
      setReadStatus("沒關係，我們先念下一個字");
      advanceReading();
    }
  };
  speak("這個字念", () => setTimeout(() =>
    readingSpeakKey(readingCharKey(c.ch, c.zy), c.ch, () => setTimeout(() =>
      speak(readTries >= 3 ? "我們先念下一個字" : "再念一次", after), 300)), 250));
  lockAnswers();
}

function readingSkip() {
  if (!currentReadChar() || readBusy) return;
  advanceReading();
}

function advanceReading() {
  const lineBefore = readLine;
  readPos++;
  skipPunctuation();
  renderReadingText();
  if (readLine !== lineBefore) {
    // 念完一行：姨姨把整行念一次
    const text = readLesson.lines[lineBefore][0];
    readBusy = true;
    setTimeout(() => {
      readingSpeakKey(readingLineKey(text), text, () => {
        readBusy = false;
        if (readLine >= readLesson.lines.length) finishReadingLesson();
        else readingPrompt();
      });
    }, 400);
  } else {
    setTimeout(readingPrompt, 600);
  }
}

function finishReadingLesson() {
  setReadStatus(`🎉 整課念完了！念對 ${readStars} 個字`, "good");
  showFeedback(true);
  speak("太棒了！你全部過關了！");
}
