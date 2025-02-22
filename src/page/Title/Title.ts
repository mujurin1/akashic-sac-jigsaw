import { Label } from "@akashic-extension/akashic-label";
import { SacClient, createFont } from "akashic-sac";
import { ChangeLevel, ChangePuzzle, GameStart } from "../../event/TitleEvent";
import { PlayerManager } from "../../util/PlayerManager";
import { Slider } from "../../util/Slider";
import { createButton } from "../../util/createButton";
import { readAssets } from "../../util/readAssets";
import { timeFlowController } from "../../util/timeFlowController";
import { Playing } from "../Playing/Playing";
import { sendJoin } from "../share";

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
  setSprite(preview, previewsInfo[state.puzzleIndex].imageAsset);
  //#endregion 画像プレビュー

  //#region 右側のUI
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
  const removePmKey = playerManager.onUpdate.on(({ id, realName }) => {
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

  //#region ホスト専用UI
  if (client.env.isHost) {
    const left = createButton({
      scene, parent: scene,
      x: titleBack.x, y: 580, text: "←",
      width: 180, height: 100,
    });
    const right = createButton({
      scene, parent: scene,
      x: left.x + 200, y: left.y, text: "→",
      width: left.width, height: 100,
    });
    const start = createButton({
      scene, parent: scene,
      x: 950, y: 400, text: " 開始 ",
    });

    left.onPointDown.add(() => client.sendEvent(new ChangePuzzle(state.puzzleIndex - 1)));
    right.onPointDown.add(() => client.sendEvent(new ChangePuzzle(state.puzzleIndex + 1)));
    start.onPointDown.add(() => client.sendEvent(new GameStart(
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
  }
  //#endregion ホスト専用UI
  //#endregion 右側のUI

  //#region レベルUI
  const levelTextBack = new g.FilledRect({
    scene, parent: scene,
    cssColor: "white",
    x: 25, y: 510,
    width: 770, height: 70,
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
    text: "??x??   0000 枚",
    textAlign: "right",
    width: levelTextBack.width - 5,
  });

  //#region ホスト専用UI
  if (g.game.env.isHost) {
    const levelSlider = new Slider({
      scene, parent: scene,
      width: levelTextBack.width, height: 80,
      x: levelTextBack.x, y: levelTextBack.y + 90,
      per: 0.5,
      min: 0, max: 100,
    });
    const sendChangeLevel = timeFlowController(500, (newLevel: number) => {
      client.sendEvent(new ChangeLevel(newLevel));
    });

    levelSlider.onValueChange.add(value => {
      const newLevel = Math.round(value);
      if (newLevel === state.level) return;

      setChangeLevel(newLevel);
      sendChangeLevel.do(newLevel);
    });
  }
  //#endregion ホスト専用UI
  //#endregion レベルUI

  const setChangeLevel = (level: number) => {
    state.level = level;
    levelNumText.text = `レベル ${Math.round(state.level)}`;
    levelNumText.invalidate();

    if (state.puzzleIndex === -1) {
      // TODO
      pieceNumText.text = `??x??   ??? 枚`;
      pieceNumText.invalidate();
    } else {
      const imageAsset = previewsInfo[state.puzzleIndex].imageAsset;
      const pixel = (100 - state.level) + 40;

      state.pieceSize = { width: pixel, height: pixel };
      state.pieceWH = {
        width: Math.floor(imageAsset.width / pixel),
        height: Math.floor(imageAsset.height / pixel),
      };
      state.origin = {
        x: Math.floor((imageAsset.width - (state.pieceSize.width * state.pieceWH.width)) / 2),
        y: Math.floor((imageAsset.height - (state.pieceSize.height * state.pieceWH.height)) / 2),
      };

      pieceNumText.text = `${state.pieceWH.height}x${state.pieceWH.width}   ${state.pieceWH.height * state.pieceWH.width} 枚`;
      pieceNumText.invalidate();
    }
  };
  setChangeLevel(50);

  const eventKeys: number[] = [
    GameStart.receive(client, data => {
      client.removeEventSets(eventKeys);
      playerManager.onUpdate.off(removePmKey);

      const children = [...scene.children];
      for (const child of children) {
        child.destroy();
      }

      void Playing(client, data, previewsInfo);
    }),
    ChangePuzzle.receive(client, data => {
      state.puzzleIndex = data.index;
      setChangeLevel(state.level);

      if (state.puzzleIndex === -1) {
        preview.hide();
        titleText.text = "カスタム画像";
        titleText.invalidate();
      } else {
        const info = previewsInfo[state.puzzleIndex];
        preview.show();
        titleText.text = info.title;
        titleText.invalidate();
        setSprite(preview, info.imageAsset);
      }
    }),
  ];

  if (!g.game.env.isHost) {
    eventKeys.push(
      ChangeLevel.receive(client, data => setChangeLevel(data.level))
    );
  }
}


function setSprite(sprite: g.Sprite, src: g.ImageAsset) {
  sprite.src = src;
  sprite.width = sprite.srcWidth = src.width;
  sprite.height = sprite.srcHeight = src.height;
  const width = (<g.E>sprite.parent).width;
  const height = (<g.E>sprite.parent).height;
  const widthPer = width / sprite.width;
  const heightPer = height / sprite.height;

  if (heightPer < widthPer) {
    sprite.scale(heightPer);
    sprite.x = (width - sprite.width * sprite.scaleX) / 2;
    sprite.y = 0;
  } else {
    sprite.scale(widthPer);
    sprite.x = 0;
    sprite.y = (height - sprite.height * sprite.scaleY) / 2;
  }

  sprite.invalidate();
}
