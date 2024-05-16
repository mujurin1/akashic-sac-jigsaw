import { Client, createFont } from "akashic-sac";
import { PlayerManager } from "../event/Player";
import { sendJoin } from "./share";
import { Label } from "@akashic-extension/akashic-label";
import { createButton } from "../util/createButton";
import { ChangeLevel, ChangePuzzle, GameStart } from "../event/TitleEvent";
import { Playing } from "./Playing/Playing";

interface TitleState {
  client: Client;
  puzzleIndex: number;
  level: number;
}

export function Title(client: Client) {
  const { scene, clientDI } = client.env;
  const playerManager = clientDI.get(PlayerManager);

  const state: TitleState = {
    client,
    puzzleIndex: 0,   // -1 はカスタム画像
    level: 1,         // 1,2,3
  };

  const eventKeys = [
    GameStart.receive(client, data => {
      client.removeEventSet(...eventKeys);

      const children = [...scene.children];
      for (const child of children) {
        child.destroy();
      }

      void Playing(client, data);
    }),
  ];

  createUi(state);
}

function createUi(state: TitleState) {
  const { client } = state;
  const { scene, clientDI } = client.env;
  const playerManager = clientDI.get(PlayerManager);

  const fontN = createFont({ size: 50, fontWeight: "bold" });
  const isHost = client.env.isHost;

  const previewPanel = new g.FilledRect({
    scene, parent: scene, cssColor: "black",
    x: 25, y: 35, width: 770, height: 460,
  });
  const titleBack = new g.Sprite({
    scene, parent: scene, src: scene.asset.getImageById("title_back"),
    x: 850, y: 35,
  });
  const levels = [1, 2, 3].map(l => new g.Sprite({
    scene, parent: scene, src: scene.asset.getImageById(`level${l}`),
    x: titleBack.x, y: titleBack.y + 100 * l,
    opacity: l === 1 ? 1 : 0.6, touchable: isHost,
  }));

  const sankaNin = new g.Sprite({
    scene, parent: scene, src: scene.asset.getImageById("sanka_nin"),
    x: titleBack.x, y: titleBack.y + 400,
  });
  const titleText = new Label({
    scene, parent: titleBack, lineBreak: false,
    width: 360, widthAutoAdjust: true, font: fontN, text: "たいとる",
    anchorX: 0.5, anchorY: 0.5, x: titleBack.width * 0.5, y: titleBack.height * 0.5 - 5,
  });
  const levelTexts = levels.map(level => new Label({
    scene, parent: level, lineBreak: false,
    width: 170, font: fontN, fontSize: 40, textAlign: "right", text: "100",
    anchorY: 0.5, x: 150, y: level.height * 0.5 - 5,
  }));
  const sankaNinText = new Label({
    scene, parent: sankaNin, lineBreak: false,
    width: 380, font: fontN, fontSize: 50, textAlign: "center", text: "0",
    anchorY: 0.5, y: sankaNin.height * 0.5 - 5,
  });

  for (let level = 1; level < levels.length + 1; level++) {
    const levelP = levels[level - 1];
    levelP.onPointDown.add(() => {
      if (state.level !== level) client.sendEvent(new ChangeLevel(level));
    });
  }

  const joinBtn = createButton({
    scene, parent: scene,
    text: " 参加 ",
    x: 40, y: g.game.height - 100
  });
  joinBtn.onPointDown.add(sendJoin);
  const removePmKey = playerManager.onUpdate.add(({ id, realName }) => {
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


  if (client.env.isHost) {
    const left = createButton({
      scene, parent: scene,
      x: 250, y: 540, text: "←",
      width: 200, height: 100,
    });
    const right = createButton({
      scene, parent: scene,
      x: 500, y: 540, text: "→",
      width: 200, height: 100,
    });
    const start = createButton({
      scene, parent: scene,
      x: 950, y: 540, text: " 開始 ",
    });

    left.onPointDown.add(() => client.sendEvent(new ChangePuzzle(state.puzzleIndex - 1)));
    right.onPointDown.add(() => client.sendEvent(new ChangePuzzle(state.puzzleIndex + 1)));
    start.onPointDown.add(() => client.sendEvent(new GameStart(
      Math.floor(Math.random() * 10000),
      g.game.getCurrentTime(),
      state.puzzleIndex,
      { x: 350, y: 100 },
      { width: 50, height: 50 },
      { width: 10, height: 10 },
    )));
  }

  const eventKeys = [
    ChangePuzzle.receive(client, data => {
      state.puzzleIndex = data.index;
      // TODO:
    }),
    ChangeLevel.receive(client, data => {
      state.level = data.level;

      for (let level = 0; level < levels.length; level++) {
        const levelP = levels[level];
        levelP.opacity = state.level === (level + 1) ? 1 : 0.6;
        levelP.modified();
      }
    }),
    GameStart.receive(client, () => {
      client.removeEventSet(...eventKeys);
      playerManager.onUpdate.remove(removePmKey);
    }),
  ];
}
