import { Label } from "@akashic-extension/akashic-label";
import { createFont } from "akashic-sac";
import { sendJoin } from "../../server_client";
import { Player, PlayerManager } from "../../util/PlayerManager";
import { JigsawAssets } from "../../util/readAssets";
import { ClientPlayingState } from "./PlayingState";

export interface PlayingUi {
  /**
   * 階層
   * ```
   * panel > 他
   * ```
   */
  readonly info: {
    readonly panel: g.FilledRect;
    readonly title: Label;
    readonly percent: Label;
    readonly fitCount: Label;
    readonly time: Label;
    readonly players: (readonly [name: Label, score: Label])[];
  };
}

/**
 * プレビューやランキングなどのパーツを作る
 */
export function createUi(state: ClientPlayingState): PlayingUi {
  const { client, playArea: { camerable }, display } = state;
  const { scene } = client.env;
  const font = createFont({ size: 50 });

  /** 左上の仮UI */
  {
    const zoomIn = new g.Label({
      scene, parent: display, font, text: "In",
      x: 10, y: 10, touchable: true,
    });
    const zoomOut = new g.Label({
      scene, parent: display, font, text: "Out",
      x: 90, y: 10, touchable: true,
    });
    const join = new g.Label({
      scene, parent: display, font, text: "参加",
      x: 210, y: 10, touchable: true,
    });
    const change = new g.Label({
      scene, parent: display, font, text: "変更",
      x: 330, y: 10, touchable: true,
    });
    zoomIn.onPointDown.add(() => {
      camerable.scale(camerable.scaleX * 0.9);
      camerable.modified();
    });
    zoomOut.onPointDown.add(() => {
      camerable.scale(camerable.scaleX * 1.1);
      camerable.modified();
    });
    join.onPointDown.add(sendJoin);
    change.onPointDown.add(() => state.pieceOperatorControl.toggle());

    const { board } = state.playArea;
    camerable.moveTo(
      board.x + board.width / 2 + 500,
      board.y + board.height / 2,
    );
    camerable.scale(3);
    camerable.modified();
  }

  //#region 右上のやつ
  const panel = new g.FilledRect({
    scene, parent: scene,
    cssColor: "rgba(255,255,255,0.5)",
    width: 300, height: 360,
    x: 950, y: 10,
  });
  const textFont = createFont({ size: 30 });
  const info = {
    panel,
    title: new Label({
      scene, parent: panel,
      font: createFont({ size: 40 }),
      text: JigsawAssets[state.gameState.puzzleIndex].title,
      textAlign: "center",
      width: panel.width,
      x: 0, y: 10,
    }),
    percent: new Label({
      scene, parent: panel,
      font: textFont, text: "",
      textAlign: "right",
      width: 100,
      x: 0, y: 60,
    }),
    fitCount: new Label({
      scene, parent: panel,
      font: textFont, text: "",
      textAlign: "right",
      width: 180,
      x: 100, y: 60,
    }),
    time: new Label({
      scene, parent: panel,
      font: textFont, text: "",
      textAlign: "right",
      width: 280,
      x: 0, y: 100,
    }),
    players: [0, 1, 2, 3, 4].map(i => {
      const y = 150 + i * 40;
      return [
        new Label({
          scene, parent: panel,
          // font: textFont, text: `GUEST00${i}`,
          font: textFont, text: "",
          textAlign: "left",
          lineBreak: false,
          width: 200,
          x: 10, y,
        }),
        new Label({
          scene, parent: panel,
          // font: textFont, text: `2000`,
          font: textFont, text: "",
          textAlign: "right",
          width: 80,
          x: 210, y,
        }),
      ] as readonly [name: Label, score: Label];
    }),
  } as const;
  //#endregion 右上のやつ

  return { info };
}

/**
 * プレビューやランキングなどの更新
 * @returns 終了後の削除関数
 */
export function setPartsEvent(
  state: ClientPlayingState,
): () => void {
  const { clientDI, scene } = state.client.env;
  const { info } = state.playUi;
  const playerManager = clientDI.get(PlayerManager);

  let counter = g.game.fps;
  let lastUpdatedPiece = -1;
  scene.onUpdate.add(update);

  // 通常は毎秒/スキップ中は5分毎
  const updateCountNormal = g.game.fps;
  const updateCountSkipping = g.game.fps * 300;

  return () => {
    scene.onUpdate.remove(update);
  };

  function update() {
    if (!info.panel.visible()) return;

    counter += 1;
    const updateCount = g.game.isSkipping ? updateCountSkipping : updateCountNormal;
    if (counter < updateCount) return;
    counter = 0;

    // 累計スコアが更新された時のみ更新
    if (lastUpdatedPiece !== state.pieces.length) {
      lastUpdatedPiece = state.totalScore;
      updateScore();
      updatePlayer();
    }
    updateTime();
  }

  /** 完成率/ピース数表記 */
  function updateScore() {
    const per = Math.round(state.totalScore / state.pieces.length);
    info.percent.text = `${per}%`;
    info.percent.invalidate();

    info.fitCount.text = `${state.totalScore}/${state.pieces.length}`;
    info.fitCount.invalidate();
  }
  /** 時刻 */
  function updateTime() {
    info.time.text = createElapsedTimeText(state.gameState.startTime);
    info.time.invalidate();
  }
  /** プレイヤー */
  function updatePlayer() {
    let players: Player[];
    if (playerManager.players.length <= 5) {
      players = playerManager.players;
    } else {
      players = playerManager.players.slice(0, 5);
      if (
        players.every(p => p.id !== g.game.selfId) &&
        playerManager.has(g.game.selfId)
      ) {
        players[4] = playerManager.get(g.game.selfId)!;
      }
    }

    // プレイヤー毎に予め名前テキストを作りすげ替えると効率が上がる
    // 便利に作るにはキャッシュ強化版Labelを作ると良いが面倒なので‥
    for (let i = 0; i < players.length; i++) {
      const p = players[i];
      const isSelf = p.id === g.game.selfId;
      // const color = isSelf ? "#7345ff" : "black";
      const color = isSelf ? "blue" : "black";
      const [name, score] = info.players[i];
      if (name.text != p.name) {
        name.text = p.name;
        name.textColor = color;
        name.invalidate();
      }
      // if (score.text != p.score as unknown as string) {
      score.text = p.score + "";
      score.textColor = color;
      score.invalidate();
      // }
    }
  }
}

const inv3600 = 1 / 3600;
const inv60 = 1 / 60;

/**
 * `startTime`から現在時刻までの経過時間をテキストで返す
 * @param startTime 開始時刻
 */
function createElapsedTimeText(startTime: number): string {
  // scene.local が `interpolate-local` のため正確でないことがある
  // 最後に受信したイベント以降はローカルの経過tick数で計算されるため
  // (新しくイベントを受信すれば正しい時刻になる)
  let time = Math.floor((g.game.getCurrentTime() - startTime) / 1000);
  // const hour = Math.floor(time / 3600);
  // const minute = Math.floor(time / 60) % 60;
  // const second = time % 60;
  const hour = (time * inv3600) | 0;
  time -= hour * 3600;  // 残り秒数から時間分を差し引く
  const minute = (time * inv60) | 0;
  const second = time - minute * 60;

  if (hour === 0) {
    return `${minute}分${second}秒`;
  }
  return `${hour}時${minute}分${second}秒`;
}
