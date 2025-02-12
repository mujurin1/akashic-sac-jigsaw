const fs = require("fs");
const { exec } = require("child_process");

const buildCommand = "npm run build";
const startServer = "akashic serve -p 3300 -s nicolive -w -B";

let lastChangeTime = Date.now();
let buildProc = /** @type {ChildProcess} */ (null);
const servProc = run(startServer, true);


watchChangeFile("./src", () => {
  const currentTime = Date.now();
  if (currentTime - lastChangeTime < 1000) return;
  lastChangeTime = currentTime;

  build();
});

watchChangeFile("../akashic-sac/akashic-sac-0.2.3.tgz", () => {
  exec("npm run usac")
    .on("exit", build);
});


build();


function build() {
  buildProc?.kill();
  buildProc = run(buildCommand)
    .on("exit", code => {
      // if (code === 0) servProc.kill();
    });
}

/**
 * @param {string} command
 * @param {boolean} [autoRestart=false]
 */
function run(command, autoRestart = false) {
  const proc = exec(command);
  proc.stdout.on("data", msg => process.stdout.write(msg));
  proc.stderr.on("data", msg => process.stderr.write(msg));
  proc.on("error", error => console.error(`サーバーエラー: ${error}`));

  if (autoRestart) {
    proc.stdout.on("close", () => run(command, autoRestart));
    // proc.on("exit", () => run(command, autoRestart));
  }

  return proc;
}

/**
 * @param {string} folder
 * @param {() => void} changed
 */
function watchChangeFile(folder, changed) {
  fs.watch(
    folder,
    { recursive: true },
    eventType => { if (eventType === "change") changed(); }
  );
}
