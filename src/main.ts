import { Client, DragDrop, ShareBigText, binaryBase64ToImageData, createSpriteFromImageData, sacInitializedStart } from "akashic-sac";
import { ChangeColor, TextMessage } from "./Events";
import { serverStart } from "./server";
import { clientStart } from "./page/share";
import { Renderer, Camera } from "@akashic/akashic-engine/lib";

export = (gameMainParam: g.GameMainParameterObject) => {
  if (gameMainParam.snapshot != null) {
    console.log(gameMainParam.snapshot);
  }

  sacInitializedStart({
    gameMainParam,
    serverStart,
    clientStart,
    // clientStart: clientSeart___,
    // clientStart: imageShareSample,
    options: {
      sceneParam: {
        assetIds: ["default_frame", "fox", "title_back", "level1", "level2", "level3", "sanka_nin"],
        assetPaths: ["/assets/**/*"]
      }
    }
  });
};


class FloorE extends g.E {
  override render(renderer: Renderer, camera?: Camera | undefined): void {
    super.render(renderer, camera);
  }

  override renderSelf(renderer: Renderer): boolean {
    renderer.save();

    // renderer.translate(this.x, this.y);

    // const size = 50;
    // const _x = 10, _y = 10;
    // for (let x = 0; x < _x; x++) {
    //   for (let y = 0; y < _y; y++) {
    //     if ((x + y) % 2 === 0) continue;
    //     renderer.fillRect(
    //       x * size, y * size,
    //       size, size,
    //       "red");
    //   }
    // }


    this.scaleY = 0.5;
    this.modified();
    renderer.transform(this.getMatrix()._matrix);
    // renderer.transform([1, 0, 0, 1, 0, 0]);

    renderer.fillRect(0, 0, this.width, this.height, "red");



    renderer.restore();

    return false;
  }
}

function clientSeart___(client: Client) {
  const { scene } = client.env;

  const floor = new FloorE({
    scene, parent: scene,
    x: 100, y: 100,
    width: 100, height: 100,
  });


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
    touchable: true,
  });

  rect.onPointDown.add(() => {
    client.sendEvent(new TextMessage("クリック"));
  });

  ChangeColor.receive(client, data => {
    rect.cssColor = data.color;
    rect.modified();
  });



  ShareBigText.waitingFromSingleUser(
    "IMAGE",
    g.game.env.hostId,
    (base64) => {
      const unlockFn = client.lockEvent();

      void binaryBase64ToImageData(base64)
        .then(imageData => {
          createSpriteFromImageData(
            imageData,
            {
              scene, parent: g.game.env.scene,
              x: 110,
            });

          unlockFn();
        });
    });

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
        console.log(`size: ${imageBase64.length / 1000} KB`);

        ShareBigText.send("IMAGE", imageBase64);
      };
    });
  }
}
