// 產生遊戲用的語音檔：node tools/gen_tts.js
// 讀 data.js 裡所有會念到的字詞，下載成 sounds/tts/<雜湊>.mp3，
// 並寫出 tts-manifest.js 讓網頁知道哪些字詞有音檔。
// 已存在的檔案會略過，所以新增詞語後重跑即可。
const fs = require("fs");
const path = require("path");
const vm = require("vm");

const root = path.join(__dirname, "..");
const outDir = path.join(root, "sounds", "tts");
fs.mkdirSync(outDir, { recursive: true });

const ctx = {};
vm.createContext(ctx);
vm.runInContext(fs.readFileSync(path.join(root, "data.js"), "utf8") +
  "\n;this.__texts = allTtsTexts(); this.__hash = ttsHash;", ctx);
const texts = ctx.__texts;
const hash = ctx.__hash;

const sleep = ms => new Promise(r => setTimeout(r, ms));

async function download(text, file) {
  const url = "https://translate.google.com/translate_tts?ie=UTF-8&tl=zh-TW&client=tw-ob&q=" +
    encodeURIComponent(text);
  for (let attempt = 1; attempt <= 4; attempt++) {
    const res = await fetch(url, { headers: { "User-Agent": "Mozilla/5.0" } });
    if (res.ok && (res.headers.get("content-type") || "").includes("audio")) {
      fs.writeFileSync(file, Buffer.from(await res.arrayBuffer()));
      return true;
    }
    await sleep(2000 * attempt);
  }
  return false;
}

(async () => {
  const done = [];
  const failed = [];
  for (const text of texts) {
    const h = hash(text);
    const file = path.join(outDir, h + ".mp3");
    if (fs.existsSync(file) && fs.statSync(file).size > 500) {
      done.push(h);
      continue;
    }
    if (await download(text, file)) {
      done.push(h);
      process.stdout.write(".");
    } else {
      failed.push(text);
      process.stdout.write("x");
    }
    await sleep(200);
  }
  // 詞庫拿掉的字詞，音檔也一併刪掉
  const keep = new Set(done.map(h => h + ".mp3"));
  const removed = fs.readdirSync(outDir).filter(f => f.endsWith(".mp3") && !keep.has(f));
  removed.forEach(f => fs.unlinkSync(path.join(outDir, f)));
  if (removed.length) console.log(`\n刪除 ${removed.length} 個用不到的音檔`);

  const manifest = "// 由 tools/gen_tts.js 產生，請勿手動修改\nconst TTS_FILES = new Set(" +
    JSON.stringify(done.sort()) + ");\n";
  fs.writeFileSync(path.join(root, "tts-manifest.js"), manifest);
  console.log(`\n${done.length} 個音檔，失敗 ${failed.length} 個` + (failed.length ? "：" + failed.join("、") : ""));
})();
