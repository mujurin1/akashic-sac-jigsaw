import { Client, DragDrop, fileToImageDataUrl, imageDataUtil, SacEvent, sacInitialize, SacInitializedValue, Server, ShareBigText, SnapshotSaveDataSac } from "akashic-sac";
import { clientStart } from "./page/share";
import { serverStart } from "./server";

export = (gameMainParam: g.GameMainParameterObject) => {
  sacInitialize({
    gameMainParam,
    serverStart,
    // initialized: () => { },
    clientStart,
    // serverStart: _changeSceneServer,
    // clientStart: _changeSceneClient,
    // serverStart: _imageShareServer,
    // clientStart: _imageShareSample,
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


//#region シーン切り替え・スナップショット
class ChangeScene__test extends SacEvent { }
class RequestSnapShot extends SacEvent { }

interface SnapshotData extends SnapshotSaveDataSac {
  isFirstScene: boolean;
}

function _changeSceneServer(server: Server) {
  let isFirstScene = true;
  ChangeScene__test.receive(server, data => {
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

function _changeSceneClient(client: Client, initializedValue: SacInitializedValue) {
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

  ChangeScene__test.receive(client, switchScene);

  const snapshot = initializedValue.gameMainParam.snapshot as SnapshotData;
  if (snapshot != null) {
    console.log("has snaphost");
    console.log(snapshot);
    if (!snapshot.isFirstScene) switchScene();
  }


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
class ChangeColor extends SacEvent {
  constructor(
    public readonly color: string
  ) { super(); }
}

function _imageShareServer(server: Server) {
  ShareBigText.waitingFromSingleUser("IMAGE", g.game.env.hostId, () => true);

  const _eventKeys = [
    ChangeColor.receive(server, data => {
      server.broadcast(data);
    }),
  ];
}

function _imageShareSample(client: Client) {
  const scene = g.game.env.scene;
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

  ShareBigText.waitingFromSingleUser(
    "IMAGE",
    g.game.env.hostId,
    imageDataUrl => {
      console.log(`receuve size: ${imageDataUrl.length / 1000} KB`);

      // 非同期処理を行うのでイベントの処理を一時停止
      const unlockEvent = client.lockEvent();

      void imageDataUtil.fromImageDataUrl(imageDataUrl)
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

          // イベントの再開は最後
          unlockEvent();
        });

      // {
      //   if (g.game.env.hasClient) {
      //     const img = document.createElement("img");
      //     img.src = imageDataUrl;
      //     g.game.env.canvas.parentElement!.prepend(img);
      //   }
      // }
    },
  );

  if (g.game.env.isHost) {
    DragDrop.hook(async e => {
      const file = e.dataTransfer?.files[0];
      if (file == null || file.type.match(/image.*/g) == null) return;
      const imageDataUrl = await fileToImageDataUrl(file);
      console.log(imageDataUrl.split(";")[0]);
      ShareBigText.send("IMAGE", imageDataUrl);

      // const reader = new FileReader();
      // reader.readAsDataURL(file);
      // reader.onload = e => {
      //   ShareBigText.send("IMAGE", e.target!.result as string);
      // };
    });
  }
}
//#endregion 画像を共有するテスト
