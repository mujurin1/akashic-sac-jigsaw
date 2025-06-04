import { createFont, DragDrop, fileToImageDataUrl, imageDataUtil, SacClient, SacEvent, sacInitialize, SacInitializedValue, SacServer, SacSnapshotSaveData, ShareBigText } from "akashic-sac";
import { clientStart, serverStart } from "./server_client";

export = (gameMainParam: g.GameMainParameterObject) => {
  sacInitialize({
    gameMainParam,
    // initialized: () => { throw new Error("さいしょ"); },
    serverStart: serverStart,
    clientStart: clientStart,
    // serverStart: _minimalServer,
    // clientStart: _minimalClient,
    // serverStart: _changeSceneServer,
    // clientStart: _changeSceneClient,
    // serverStart: _imageShareServer,
    // clientStart: _imageShareSample,
    // serverStart: exampleServer,
    // clientStart: exampleClient,
    options: {
      sceneParam: {
        assetIds: [
          "default_frame", "title_back", "sanka_nin",
          "ico_ban", "ico_device", "ico_info", "ico_preview", "ico_ranking", "ico_more", "ico_visible",
        ],
        assetPaths: ["/assets/**/*"],
      }
    }
  });
};

//#region 最小限のサンプル

class ClickedEvent extends SacEvent() { }

function _minimalServer(server: SacServer) {
  ClickedEvent.receive(server, onEvent);

  function onEvent(data: ClickedEvent) {
    console.log("送信者ID", data.pId);
    server.broadcast(data);
  }
}

function _minimalClient(client: SacClient) {
  const scene = g.game.env.scene;

  const lastClickPlayerId = new g.Label({
    scene, parent: scene,
    text: "クリックしたプレイヤーのID: --",
    font: createFont({ size: 20 }),
    x: 10, y: 10,
  });

  scene.onPointDownCapture.add((e) => {
    console.log(e.button);
    client.sendEvent(new ClickedEvent());
  });

  ClickedEvent.receive(client, onEvent);

  function onEvent(data: ClickedEvent) {
    const playerId = data.pId;
    if (playerId == null) return;
    lastClickPlayerId.text = `クリックしたプレイヤーのID: ${playerId}`;
    lastClickPlayerId.invalidate();
  }
}
//#endregion 最小限のサンプル


//#region シーン切り替え・スナップショット
class ChangeScene__test extends SacEvent() {
  constructor() { super(); }
}
class RequestSnapShot extends SacEvent() { }

interface SnapshotData extends SacSnapshotSaveData {
  isFirstScene: boolean;
}

function _changeSceneServer(server: SacServer) {
  let isFirstScene = true;
  ChangeScene__test.receive(server, data => {
    console.log("receive!", data._);
    isFirstScene = !isFirstScene;
    server.broadcast(data);
  });
  RequestSnapShot.receive(server, () => {
    server.requestSaveSnapshot<SnapshotData>(() => {
      return {
        snapshot: { hostId: g.game.env.hostId, isFirstScene }
      };
    });
  });
}

function _changeSceneClient(client: SacClient, initializedValue: SacInitializedValue) {
  let isFirstScene = true;

  changeSceneBtn(client.env.scene, "red");
  saveBtn(client.env.scene);
  const blueScene = new g.Scene({
    game: g.game, tickGenerationMode: "manual", local: "interpolate-local",
  });
  blueScene.onLoad.add(() => {
    changeSceneBtn(blueScene, "blue");
    saveBtn(blueScene);
  });

  const snapshot = initializedValue.gameMainParam.snapshot as SnapshotData;
  if (snapshot != null) {
    console.log("has snapshot", snapshot);
    if (!snapshot.isFirstScene) switchScene();
  }

  ChangeScene__test.receive(client, switchScene);

  function switchScene() {
    isFirstScene = !isFirstScene;
    if (isFirstScene) g.game.popScene(true);
    else g.game.pushScene(blueScene);
  }

  function changeSceneBtn(scene: g.Scene, cssColor: string) {
    const btn = new g.FilledRect({
      scene, parent: scene,
      cssColor,
      x: 100, y: 100,
      width: 100, height: 100,
      touchable: true,
    });
    btn.onPointDown.add(() => {
      client.sendEvent(new ChangeScene__test());
    });
  }

  function saveBtn(scene: g.Scene) {
    const btn = new g.FilledRect({
      scene, parent: scene,
      cssColor: "gray",
      x: 300, y: 100,
      width: 100, height: 100,
      touchable: true,
    });
    btn.onPointDown.add(() => {
      client.sendEvent(new RequestSnapShot());
    });
  }
}
//#endregion シーン切り替え・スナップショット


//#region 画像を共有するテスト
class ChangeColor extends SacEvent() {
  constructor(
    public readonly color: string
  ) { super(); }
}

function _imageShareServer(server: SacServer) {
  ShareBigText.waitingFromSingleUser("IMAGE", g.game.env.hostId, () => true);

  const _eventKeys = [
    ChangeColor.receive(server, data => {
      server.broadcast(data);
      throw new Error("えらー！");
    }),
  ];
}

function _imageShareSample(client: SacClient) {
  const scene = g.game.env.scene;
  const font = createFont({ size: 20 });

  new g.FilledRect({
    scene, parent: scene,
    cssColor: "green",
    width: g.game.width,
    height: g.game.height,
  });

  const rect = new g.FilledRect({
    scene, parent: scene,
    x: 10, y: 10,
    width: 100, height: 100,
    cssColor: "red",
    touchable: g.game.env.isHost,
  });

  rect.onPointDown.add(() => {
    client.sendEvent(new ChangeColor("purple"));
  });
  ChangeColor.receive(client, data => {
    rect.cssColor = data.color;
    rect.modified();
  });

  ShareBigText.waitingFromSingleUser(
    "IMAGE",
    g.game.env.hostId,
    receiveShareText,
  );

  if (g.game.env.isHost) {
    DragDrop.hook(async e => {
      const file = e.dataTransfer?.files[0];
      if (file == null || file.type.match(/image.*/g) == null) return;
      DragDrop.unhook();

      const imageDataUrl = await fileToImageDataUrl(file);
      ShareBigText.send("IMAGE", imageDataUrl);
    });
  }

  function receiveShareText(imageDataUrl: string) {
    console.log(`ShareBigText finish. size: ${imageDataUrl.length / 1000} KB`);

    // 非同期処理を行うのでイベントの処理を一時停止
    const unlockEvent = client.lockEvent();

    imageDataUtil.fromImageDataUrl(imageDataUrl)
      .then(imageData => {
        imageDataUtil.toSprite(
          imageData,
          {
            scene, parent: g.game.env.scene,
            x: 110,
          });

        ChangeColor.receive(client, data => {
          rect.cssColor = data.color;
          rect.modified();
        });

      })
      .catch(e => {
        new g.Label({
          scene, parent: scene,
          text: (e ? "不明なエラー" : e + ""),
          font,
          x: 100,
          y: 200,
        });
      })
      // イベントの再開は最後
      .finally(unlockEvent);

    // {
    //   if (g.game.env.hasClient) {
    //     const img = document.createElement("img");
    //     img.src = imageDataUrl;
    //     g.game.env.canvas.parentElement!.prepend(img);
    //   }
    // }
  }
}
//#endregion 画像を共有するテスト


//#region 実践的な例
class PlayGame extends SacEvent() { }
class ScoreUp extends SacEvent() { readonly point = 1; }
class EndGame extends SacEvent() { }

interface Snapshot { endGame: EndGame; }

function exampleServer(server: SacServer) {
  const hostId = g.game.env.hostId;

  PlayGame.receive(server, data => {
    if (data.pId !== hostId) return;

    server.broadcast(data);
    g.game.env.scene.setTimeout(() => {
      const endGame = new EndGame();
      server.requestSaveSnapshot<Snapshot>(() => ({
        snapshot: { hostId, endGame }
      }));
      server.broadcast(endGame, hostId);
    }, 5000);
  });
  ScoreUp.receive(server, server.broadcast_bind);
}

function exampleClient(client: SacClient, initializedValue: SacInitializedValue) {
  const snapshot = initializedValue.gameMainParam.snapshot;

  if (hasSnapshot(snapshot)) {
    console.log(snapshot);
    gameFinish(snapshot.endGame);
    return;
  }

  const eventKeys: number[] = [
    PlayGame.receive(client, () => {
      client.removeEventSets(eventKeys);
      gameStart();
    }),
  ];

  g.game.env.scene.onPointDownCapture.addOnce(() => {
    client.sendEvent(new PlayGame());
  });
}

function gameStart() {
  console.log("ゲーム開始");
  const client = g.game.clientEnv.client;
  const playerManager = client.env.clientDI.get(PlayerManager);
  playerManager.reset();

  const eventKeys: number[] = [
    ScoreUp.receive(client, playerManager.scoreUp),
    EndGame.receive(client, data => {
      client.removeEventSets(eventKeys);
      gameFinish(data);
    })
  ];

  g.game.env.scene.onPointDownCapture.addOnce(() => {
    client.sendEvent(new ScoreUp());
  });
}

function gameFinish(endGame: EndGame) {
  const client = g.game.clientEnv.client;
  console.log("優勝者は ", endGame.pId!);

  const eventKeys: number[] = [
    PlayGame.receive(client, () => {
      client.removeEventSets(eventKeys);
      gameStart();
    }),
  ];

  g.game.env.scene.onPointDownCapture.addOnce(() => {
    client.sendEvent(new PlayGame());
  });
}

function hasSnapshot(snapshot: unknown): snapshot is SacSnapshotSaveData<Snapshot> {
  if (snapshot) return true;
  return false;
}

class PlayerManager {
  public scoreUp(scoreUp: ScoreUp): void {
    console.log(`${scoreUp.point}点 ${scoreUp.pId}`);
  }
  public reset(): void { }
}
//#endregion 実践的な例
