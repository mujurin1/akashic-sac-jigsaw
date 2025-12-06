import { Label } from "@akashic-extension/akashic-label";
import { createFont, SacClient } from "akashic-sac";
import { toggleVisibleTo } from "../../../common/func";
import { sendJoin } from "../../../server_client";
import { Player, PlayerManager } from "../../../util/PlayerManager";
import { JigsawAssets } from "../../../util/readAssets";
import type { ClientPlaying } from "./ClientPlaying";
import type { PlayState } from "./PlayState";

interface InfoUi {
  readonly panel: g.FilledRect;
  readonly title: Label;
  readonly percent: Label;
  readonly fitCount: Label;
  readonly time: Label;
  readonly players: readonly [Label, Label][];
}

export interface InfoGroup {
  readonly panel: g.FilledRect;
  // readonly title: Label;
  // readonly percent: Label;
  // readonly fitCount: Label;
  // readonly time: Label;
  // readonly players: (readonly [name: Label, score: Label])[];

  /**
   * 表示を切り替える
   * @param visibleTo `true`: 表示, `false`: 非表示, `undefined`: トグル
   */
  toggle(visibleTo?: boolean): void;
}

/**
 * プレビューやランキングなどのパーツを作る
 */
export function createInfoGroup(clientPlaying: ClientPlaying): InfoGroup {
  const scene = g.game.env.scene;

  /** 左下の仮UI */
  {
    const font = createFont({ size: 50 });
    const parent = scene;
    const join = new g.Label({
      scene, parent, font, text: "参加",
      x: 10, y: g.game.height - 70, touchable: true,
    });
    join.onPointDown.add(sendJoin);
  }

  const infoUi = createInfoUi({
    display: clientPlaying.display,
    title: JigsawAssets[clientPlaying.playState.gameState.puzzleIndex].title,
  });

  setPartsEvent(clientPlaying.client, clientPlaying.playState, infoUi);

  const info: InfoGroup = {
    panel: infoUi.panel,
    toggle: value => toggleVisibleTo(info.panel, value),
  };

  return info;
}

/**
 * プレビューやランキングなどの更新
 * @returns 終了後の削除関数
 */
export function setPartsEvent(
  client: SacClient,
  state: PlayState,
  infoUi: InfoUi,
): () => void {
  const { clientDI, scene } = client.env;
  const playerManager = clientDI.get(PlayerManager);

  let counter = g.game.fps;
  let lastUpdatedPieceLength = -1;
  scene.onUpdate.add(update);

  // 通常は毎秒/スキップ中は5分毎
  const updateCountNormal = g.game.fps;
  const updateCountSkipping = g.game.fps * 300;

  return () => {
    scene.onUpdate.remove(update);
  };

  function update() {
    if (!infoUi.panel.visible()) return;

    counter += 1;
    const updateCount = g.game.isSkipping ? updateCountSkipping : updateCountNormal;
    if (counter < updateCount) return;
    counter = 0;

    // 累計スコアが更新された時のみ更新
    if (lastUpdatedPieceLength !== state.pieces.length) {
      lastUpdatedPieceLength = state.totalScore;
      updateScore();
      updatePlayer();
    }
    updateTime();
  }

  /** 完成率/ピース数表記 */
  function updateScore() {
    const per = Math.round(state.totalScore / state.pieces.length);
    infoUi.percent.text = `${per}%`;
    infoUi.percent.invalidate();

    infoUi.fitCount.text = `${state.totalScore}/${state.pieces.length}`;
    infoUi.fitCount.invalidate();
  }
  /** 時刻 */
  function updateTime() {
    infoUi.time.text = createElapsedTimeText(state.gameState.startTime);
    infoUi.time.invalidate();
  }
  /** プレイヤー */
  function updatePlayer() {
    let players: Player[];
    if (playerManager.players.length <= 5) {
      players = playerManager.players;
    } else {
      players = playerManager.players.slice(0, 5);
      if (
        playerManager.has(g.game.selfId) &&
        players.every(p => p.id !== g.game.selfId)
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
      const [name, score] = infoUi.players[i];
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

function createInfoUi({ display, title }: { display: g.E; title: string; }): InfoUi {
  const scene = g.game.env.scene;
  const font = createFont({ size: 30 });

  const panel = new g.FilledRect({
    scene, parent: display,
    cssColor: "rgba(255,255,255,0.5)",
    width: 300, height: 360,
    x: 950, y: 10,
  });

  return {
    panel,
    title: new Label({
      scene, parent: panel,
      font: createFont({ size: 40 }),
      text: title,
      textAlign: "center",
      width: panel.width,
      x: 0, y: 10,
    }),
    percent: new Label({
      scene, parent: panel,
      font, text: "",
      textAlign: "right",
      width: 100,
      x: 0, y: 60,
    }),
    fitCount: new Label({
      scene, parent: panel,
      font, text: "",
      textAlign: "right",
      width: 180,
      x: 100, y: 60,
    }),
    time: new Label({
      scene, parent: panel,
      font, text: "",
      textAlign: "right",
      width: 280,
      x: 0, y: 100,
    }),
    players: [0, 1, 2, 3, 4].map(i => createPlayerSet(i)),
  };

  function createPlayerSet(index: number): [Label, Label] {
    const y = 150 + index * 40;
    return [
      new Label({
        scene, parent: panel,
        font, text: `EMPTY-${index}`,   // TODO: "" にすれば ok
        textAlign: "left",
        lineBreak: false,
        width: 200,
        x: 10, y,
      }),
      new Label({
        scene, parent: panel,
        font, text: "",
        textAlign: "right",
        width: 80,
        x: 210, y,
      }),
    ] as const;
  }
}
