const fs = require("fs");
const { exec, ChildProcess } = require("child_process");

const buildCommand = "npm run build";
const startServer = "akashic serve -p 3300 -s nicolive -w -B";
// akashic-serve-sli v2.17.25 では -w を付けると最初の変更が発生するまでサーバーが起動しない

let buildProc = /** @type {ChildProcess} */ (null);
let building = false;
const serverProc = run(startServer, true);

watchChangeFile("./src", build);

// watchChangeFile("../akashic-sac/akashic-sac-0.2.3.tgz", () => {
//   exec("npm run usac")
//     .on("exit", build);
// });

build();

function build() {
  if (building) return;
  console.log("ビルド実行");

  building = true;
  buildProc?.kill();
  buildProc = run(buildCommand)
    .on("exit", code => {
      building = false;
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
