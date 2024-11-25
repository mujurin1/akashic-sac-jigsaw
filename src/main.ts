import { binaryBase64ToImageData, Client, createSpriteFromImageData, DragDrop, SacEvent, sacInitializedStart, Server, ShareBigText } from "akashic-sac";
import { clientStart } from "./page/share";
import { serverStart } from "./server";

export = (gameMainParam: g.GameMainParameterObject) => {
  if (gameMainParam.snapshot != null) {
    console.log(gameMainParam.snapshot);
  }

  sacInitializedStart({
    gameMainParam,
    serverStart,
    clientStart,
    // serverStart: _imageShareServer,
    // clientStart: _imageShareSample,
    options: {
      sceneParam: {
        assetIds: [
          "default_frame", "title_back", "sanka_nin",
          "ico_ban", "ico_device", "ico_info", "ico_preview", "ico_ranking", "ico_more", "ico_visible",
        ],
        assetPaths: ["/assets/**/*"]
      }
    }
  });
};



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
    base64 => {
      console.log(`receuve size: ${base64.length / 1000} KB`);

      // 非同期処理を行うのでイベントの処理を一時停止
      const unlockEvent = client.lockEvent();

      void binaryBase64ToImageData(base64)
        .then(imageData => {
          createSpriteFromImageData(
            imageData,
            {
              scene, parent: g.game.env.scene,
              x: 110,
            });

          ChangeColor.receive(client, data => {
            rect.cssColor = data.color;
            rect.modified();
          });

          unlockEvent();
        });
    },
  );

  if (g.game.env.isHost) {
    DragDrop.dragDropedFile(e => {
      const file = e.dataTransfer?.files[0];
      if (file == null || file.type.match(/image.*/g) == null) return;

      DragDrop.unhookDragDropEvent();

      const fr = new FileReader();
      fr.readAsDataURL(file);
      fr.onload = e => {
        let imageBase64 = e.target?.result;
        if (typeof imageBase64 !== "string") return;
        imageBase64 = imageBase64.substring(imageBase64.indexOf(",") + 1);
        console.log(`send size: ${imageBase64.length / 1000} KB`);

        ShareBigText.send("IMAGE", imageBase64);
      };
    });
  }
}

class ChangeColor extends SacEvent {
  constructor(
    public readonly color: string
  ) { super(); }
}
