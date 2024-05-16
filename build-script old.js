const fs = require("fs");
const { exec } = require("child_process");

build(watch);

function watch() {
  console.log("Start Watching");

  let nicoProc = startNico(() => console.error(`restarting nico...`));

  let lastChangeTime = Date.now();
  /** @type {import("child_process").ChildProcess | null} */
  let rebuildProc = null;

  // src に変更があった場合リビルド
  fs.watch(
    "./src",
    { recursive: true },
    eventType => {
      if (eventType !== "change") return;
      if (!checkRebuildAndKill()) return;

      console.log("rebuilding...");
      rebuildProc = build(code => { if (code === 0) console.log(`restarted: ${formatDate(Date.now(), "HH時mm分ss秒")}`); });
    }
  );

  // akashic-sac が更新された場合サーバー再起動
  fs.watch(
    "../akashic-sac/akashic-sac-0.2.3.tgz",
    eventType => {
      if (eventType !== "change") return;
      if (!checkRebuildAndKill()) return;

      console.log("updating...  akashic-sac");
      exec("npm run usac")
        .on("exit", () => rebuildProc = build(() => nicoProc.kill()));
    }
  );

  function checkRebuildAndKill() {
    const currentTime = Date.now();
    if (currentTime - lastChangeTime < 100) return false;
    lastChangeTime = currentTime;
    rebuildProc?.kill();
    return true;
  }
}

/**
 * @param {(code: number | null, signal: NodeJS.Signals | null) => void} exited
 */
function build(exited) {
  const child = exec("rimraf ./script && npm run build");
  child.stdout.on("data", msg => process.stdout.write(msg));
  child.stderr.on("data", msg => process.stderr.write(msg));
  child.on("error", error => console.error(`ビルドエラー: ${error}`));
  if (exited != null) child.on("exit", exited);
  return child;
}

/**
 * @param {(code: number | null, signal: NodeJS.Signals | null) => void} exited
 */
function startNico(exited) {
  const child = exec("akashic serve -p 3300 -s nicolive -w -B");
  child.stdout.on("data", msg => process.stdout.write(msg));
  child.stderr.on("data", msg => process.stderr.write(msg));
  child.on("error", error => console.error(`サーバーエラー: ${error}`));
  child.on("exit", () => startNico(exited));

  if (exited != null) child.on("exit", exited);

  return child;
}

function formatDate(ms, format) {
  const date = new Date(ms);
  format = format.replace("yyyy", date.getFullYear());
  format = format.replace("MM", `${date.getMonth() + 1}`.slice(-2));
  format = format.replace("dd", `${date.getDate()}`.slice(-2));
  format = format.replace("HH", `${date.getHours()}`.slice(-2));
  format = format.replace("mm", `${date.getMinutes()}`.slice(-2));
  format = format.replace("ss", `${date.getSeconds()}`.slice(-2));
  format = format.replace("SSS", `00${date.getMilliseconds()}`.slice(-3));
  return format;
}