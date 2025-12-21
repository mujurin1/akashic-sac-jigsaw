import { Label } from "@akashic-extension/akashic-label";
import { createFont, SacClient } from "akashic-sac";
import { Slider } from "../../common/Slider";
import { createButton } from "../../common/createButton";
import { timeFlowController } from "../../common/timeFlowController";
import { ChangeLevel, ChangePuzzle, GameStart } from "../../event/TitleEvent";
import { sendJoin } from "../../server_client";
import { PlayerManager } from "../../util/PlayerManager";
import { readAssets } from "../../util/readAssets";
import { createClientPlaying } from "../Playing/State/ClientPlaying";
import { customImageTitle, TitleUi } from "./Custom";

interface TitleState {
  client: SacClient;
  /** 0~デフォルトの画像枚数-1枚, index:-1 はカスタム画像 */
  puzzleIndex: number;
  /** 0~100 */
  level: number;
  origin: g.CommonOffset;
  pieceSize: g.CommonSize;
  pieceWH: g.CommonSize;
}

export function Title(client: SacClient) {
  const state: TitleState = {
    client,
    puzzleIndex: 0,
    level: 50,
    origin: { x: 0, y: 0 },
    pieceSize: null!,
    pieceWH: null!,
  };

  createUi(state);
}

function createUi(state: TitleState) {
  const { client } = state;
  const { scene, clientDI } = client.env;
  const playerManager = clientDI.get(PlayerManager);

  const previewsInfo = readAssets(scene);
  const fontN = createFont({ size: 50, fontWeight: "bold" });

  //#region 画像プレビュー
  const previewPanel = new g.FilledRect({
    scene, parent: scene, cssColor: "black",
    x: 25, y: 35, width: 770, height: 460,
  });
  const preview = new g.Sprite({
    scene, parent: previewPanel,
    // width: previewPanel.width, height: previewPanel.height,
    src: previewsInfo[state.puzzleIndex].imageAsset,
  });
  setPreviewSprite(preview, previewsInfo[state.puzzleIndex].imageAsset);
  //#endregion 画像プレビュー

  //#region タイトル・参加数・参加ボタン
  const titleBack = new g.Sprite({
    scene, parent: scene, src: scene.asset.getImageById("title_back"),
    x: 850, y: 35,
  });
  const titleText = new Label({
    scene, parent: titleBack, lineBreak: false,
    width: 360, widthAutoAdjust: true, font: fontN, text: previewsInfo[state.puzzleIndex].title,
    anchorX: 0.5, anchorY: 0.5, x: titleBack.width * 0.5, y: titleBack.height * 0.5 - 5,
  });

  const sankaNin = new g.Sprite({
    scene, parent: scene, src: scene.asset.getImageById("sanka_nin"),
    x: titleBack.x, y: titleBack.y + 100,
  });
  const sankaNinText = new Label({
    scene, parent: sankaNin, lineBreak: false,
    width: 380, font: fontN, fontSize: 50, textAlign: "center", text: "0",
    anchorY: 0.5, y: sankaNin.height * 0.5 - 5,
  });

  const joinBtn = createButton({
    scene, parent: scene,
    text: " 参加 ",
    // height: 200,
    width: titleBack.width,
    textAlign: "left",
    x: titleBack.x, y: titleBack.y + 240,
  });
  new Label({
    scene, parent: joinBtn,
    x: 200, y: 10,
    font: createFont({ size: 35, fontColor: "white", fontWeight: "bold" }),
    textAlign: "center",
    text: "途中参加\n可能",
    width: 170,
  });

  joinBtn.onPointDown.add(sendJoin);
  const removePmKey = playerManager.onJoined.on(({ id, realName }) => {
    setChangeLevel(state.level);

    if (id === g.game.selfId) {
      if (realName) {
        joinBtn.destroy();
      } else {
        // joinBtn.text = "ユーザー名に変更する";
        // joinBtn.invalidate();
      }
    }

    sankaNinText.text = `${playerManager.length}`;
    sankaNinText.invalidate();
  });
  //#endregion タイトル・参加数・参加ボタン

  //#region レベル・ピース数
  const levelTextBack = new g.FilledRect({
    scene, parent: scene,
    cssColor: "white",
    x: 25, y: 510,
    width: 1200, height: 70,
  });
  const levelNumText = new Label({
    scene, parent: levelTextBack,
    y: 5,
    font: fontN,
    text: "レベル 50",
    width: 300,
  });
  const pieceNumText = new Label({
    scene, parent: levelTextBack,
    x: 0,
    y: 5,
    font: fontN,
    text: "??x??  0000枚",
    textAlign: "right",
    width: 630,
  });
  const aboutTimeText = new Label({
    scene, parent: levelTextBack,
    x: 700,
    y: 10,
    font: createFont({ size: 40, fontWeight: "bold" }),
    text: "予想タイム：10～30分",
    width: levelTextBack.width - 5,
  });
  //#endregion レベル・ピース数

  //#region ホスト専用
  const titleUi: TitleUi = {
    previewPanel,
    levelTextBack,
  };

  if (client.env.isHost) {
    //#region パズル変更
    const left = createButton({
      scene, parent: scene,
      x: titleBack.x, y: 590, text: "←",
      width: 180, height: 100,
    });
    const right = createButton({
      scene, parent: scene,
      x: left.x + 200, y: left.y, text: "→",
      width: left.width, height: 100,
    });
    titleUi.startButton = createButton({
      scene, parent: scene,
      x: 950, y: 400, text: " 開始 ",
    });

    left.onPointDown.add(() => client.sendEvent(new ChangePuzzle(state.puzzleIndex - 1)));
    right.onPointDown.add(() => client.sendEvent(new ChangePuzzle(state.puzzleIndex + 1)));
    titleUi.startButton.onPointDown.add(() => client.sendEvent(new GameStart(
      Math.floor(Math.random() * 10000),
      g.game.getCurrentTime(),
      state.puzzleIndex,
      // { x: 350, y: 100 },
      // { width: 50, height: 50 },
      // { width: 10, height: 10 },
      state.origin,
      state.pieceSize,
      state.pieceWH,
    )));
    //#endregion パズル変更

    //#region レベル変更
    titleUi.levelSlider = new Slider({
      scene, parent: scene,
      width: 770, height: 80,
      x: levelTextBack.x, y: levelTextBack.y + 90,
      per: 0.5,
      min: 0, max: 100,
    });
    const sendChangeLevel = timeFlowController(500, (newLevel: number) => {
      client.sendEvent(new ChangeLevel(newLevel));
    });

    titleUi.levelSlider.onValueChange.add(value => {
      const newLevel = Math.round(value);
      if (newLevel === state.level) return;

      setChangeLevel(newLevel);
      sendChangeLevel.do(newLevel);

      // if (!flag && value === 100) {
      //   setTimeout(() => {
      //     levelSlider.setOverLimitPer(1.3);
      //   }, 1000);
      // }
    });
    //#endregion レベル変更
  }
  //#endregion ホスト専用

  // カスタム画像
  const customResult = customImageTitle(client, titleUi, setChangeLevel);


  setChangeLevel(50);

  const eventKeys: number[] = [
    GameStart.receive(client, data => {
      customResult.destroy();
      client.removeEventSets(eventKeys);
      playerManager.onJoined.off(removePmKey);

      const children = [...scene.children];
      for (const child of children) {
        child.destroy();
      }

      const unlockEvent = client.lockEvent();

      void createClientPlaying(client, data, previewsInfo[data.puzzleIndex])
        .then(unlockEvent);
    }),
    ChangePuzzle.receive(client, data => {
      state.puzzleIndex = data.index;
      setChangeLevel(state.level);

      if (state.puzzleIndex === -1) {
        titleText.text = "カスタム画像";
        titleText.invalidate();
      } else {
        const info = previewsInfo[state.puzzleIndex];
        titleText.text = info.title;
        titleText.invalidate();
        setPreviewSprite(preview, info.imageAsset);
      }
    }),
  ];

  if (!g.game.env.isHost) {
    eventKeys.push(
      ChangeLevel.receive(client, data => setChangeLevel(data.level))
    );
  }


  function setChangeLevel(level: number = state.level): void {
    state.level = level;
    levelNumText.text = `レベル ${Math.round(state.level)}`;
    levelNumText.invalidate();

    const surface =
      state.puzzleIndex === -1
        ? customResult.customSurface
        : previewsInfo[state.puzzleIndex].imageAsset;

    if (!surface) return;

    const pixel = (100 - state.level) + 40;

    state.pieceSize = { width: pixel, height: pixel };
    state.pieceWH = {
      width: Math.floor(surface.width / pixel),
      height: Math.floor(surface.height / pixel),
    };
    state.origin = {
      x: Math.floor((surface.width - (state.pieceSize.width * state.pieceWH.width)) / 2),
      y: Math.floor((surface.height - (state.pieceSize.height * state.pieceWH.height)) / 2),
    };

    const pieceCount = state.pieceWH.height * state.pieceWH.width;
    pieceNumText.text = `${state.pieceWH.height}x${state.pieceWH.width}  ${pieceCount}枚`;
    pieceNumText.invalidate();

    const [floorTime, upperTime] = estimateTime(playerManager.length, pieceCount);
    if (floorTime >= 60 * 5) {
      aboutTimeText.text = `予想タイム：ヤバイ`;
    } else if (upperTime >= 60 * 5) {
      aboutTimeText.text = `予想タイム：${floorTime}～ﾔﾊﾞｲ`;
    } else {
      aboutTimeText.text = `予想タイム：${floorTime}～${Math.floor(upperTime)}分`;
    }

    aboutTimeText.invalidate();
  }
}


export function setPreviewSprite(preview: g.Sprite, src: g.Surface | g.ImageAsset) {
  preview.src = src;
  preview.width = preview.srcWidth = src.width;
  preview.height = preview.srcHeight = src.height;
  const width = (<g.E>preview.parent).width;
  const height = (<g.E>preview.parent).height;
  const widthPer = width / preview.width;
  const heightPer = height / preview.height;

  if (heightPer < widthPer) {
    preview.scale(heightPer);
    preview.x = (width - preview.width * preview.scaleX) / 2;
    preview.y = 0;
  } else {
    preview.scale(widthPer);
    preview.x = 0;
    preview.y = (height - preview.height * preview.scaleY) / 2;
  }

  preview.invalidate();
}

/**
 * 予想クリア時間を計算する
 * @param players プレイヤー人数
 * @param pieces ピース数
 * @returns [下限時間(分), 上限時間(分)]
 */
export function estimateTime(players: number, pieces: number): [floorTime: number, upperTime: number] {
  /* --- 1. ピース数の難易度（D） ---
   * 「ピース数あたりの難易度」を決める
   *
   * alpha: ピース数による難易度の強さ
   * 値を増やすと
   *   - ピース数が大きいほど難易度（=時間）が急激に増える
   *   - 100 → 200 → 300 → 500ピースの差が極端に大きくなる
   *   - 高ピースの時間が 爆発的 に伸びる
   * 値を減らすと
   *   - ピース数の影響が緩やかになり、全体的に短時間寄りになる
   *   - 特に200ピース以上の時間が抑えられる
   * 
   * D = ピース数による難易度係数（60ピースで1.0）
   */
  const alpha = 1.5;
  const D = Math.pow(pieces / 60, alpha);

  /* --- 2. 人数効率（E） ---
   * 「人数が増えた時に、どれだけ効率が上がるか」を決める
   *
   * k: 人数効果の立ち上がり速度
   * 値を増やすと
   *   - 効率がゆっくり上昇し、多人数でもあまり速くならない
   *   - 10人いても効率が頭打ちしにくく、 混雑感 が強い
   * 値を減らすと
   *   - 少人数で効率が急上昇する（例：3人でほぼ最大）
   *   - それ以上人数を増やしても改善が小さい
   *
   * beta: 人数による効率上昇の最大幅
   * 値を増やすと
   *   - 多人数が非常に効率的になり、時間が大幅に短くなる
   *   - 10人での時間が極端に短くなる可能性がある
   * 値を減らすと
   *   - 多人数のメリットが小さくなる
   *   - 5～10人いても劇的には速くならない
   * 
   * E = 人数による効率係数（大きいほど時間が短くなる）
   */
  const k = 6;
  const beta = 0.8;
  const E = 1 + beta * (1 - Math.exp(-players / k));

  /* --- 3. 基本時間と合成 ---
   * base: 基準時間（60ピースを平均的な人数で解いた時の目安）
   * 値を増やすと
   *   - 全てのケースで時間が長くなる
   * 値を減らすと
   *   - 全体的に短くなる（標準的なパズルが簡単な扱いになる）
   *
   * T = base * D / E:
   *     - D（難易度）が高いと時間が増える
   *     - E（人数効率）が高いと時間が減る
   */
  const base = 3.0;
  const T = base * D / E;

  /* --- 4. 上限・下限の幅 ---
   * low : 想定される最短クリア時間（理論的にうまく行った場合）
   * high: 想定される最長クリア時間
   *       時間幅は「ピース数が多いほどばらつく」ように調整している
   */
  const low = T;
  const high = T * (1.4 + Math.sqrt(pieces / 300));

  return [
    Math.max(1, Math.floor(low)),
    Math.max(2, Math.floor(high))
  ];
}
