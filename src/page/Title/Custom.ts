import { Label } from "@akashic-extension/akashic-label";
import { DragDrop, SacClient, ShareBigText, createFont, fileToImageDataUrl, imageDataUtil } from "akashic-sac";
import { createButton } from "../../common/createButton";
import { Slider } from "../../common/Slider";
import { ChangePuzzle } from "../../event/TitleEvent";
import { setPreviewSprite } from "./Title";

export interface TitleUi {
  previewPanel: g.E;
  levelTextBack: g.FilledRect;
  levelSlider?: Slider;
  startButton?: g.Sprite;
}

export interface CustomImageTitleReturn {
  customSurface: g.Surface | undefined;
  destroy(): void;
}

export function customImageTitle(
  client: SacClient,
  titleUi: TitleUi,
  setChangeLevel: (level?: number) => void,
): CustomImageTitleReturn {
  const scene = client.env.scene;
  const { previewPanel } = titleUi;
  const preview = previewPanel.children![0] as g.Sprite;

  let dropped: { imageDataUrl: string; surface: g.Surface; } | undefined;
  let sharedSurface: g.Surface | undefined;

  function getCustomState() {
    if (sharedSurface != null) return "shared";
    if (dropped != null) return "dropped";
    return "none";
  }


  //#region TEXT
  const customFont = createFont({ size: 50, fontColor: "white" });
  const customTextParent = new g.E({ scene, parent: previewPanel, hidden: true });
  new Label({
    scene, parent: customTextParent,
    x: 0, y: 80,
    width: previewPanel.width,
    font: customFont,
    textAlign: "center",
    text: "好きな画像で遊べます"
  });
  new Label({
    scene, parent: customTextParent,
    x: 0, y: 200,
    width: previewPanel.width,
    font: customFont,
    fontSize: 40,
    textAlign: "center",
    text: "生主がここに画像を\nドラッグ＆ドロップしてね！"
  });
  new Label({
    scene, parent: customTextParent,
    x: 0, y: 380,
    width: previewPanel.width,
    font: customFont,
    fontSize: 30,
    textAlign: "center",
    text: "※PC 専用です※"
  });
  new Label({
    scene, parent: customTextParent,
    x: 0, y: 420,
    width: previewPanel.width,
    font: customFont,
    fontSize: 25,
    textAlign: "center",
    text: "400x400px ~ 2000x2000px 程度の画像がおすすめです"
  });
  //#endregion TEXT

  //#region ドラッグドロップ直後に出るUI
  const shareButton = createButton({
    scene, parent: scene,
    text: "この画像に決定（決定するともう変えられません）",
    font: createFont({ size: 45, fontColor: "white" }),
    x: 25, y: 503,
    hidden: true,
  });
  shareButton.onPointDown.add(() => {
    if (dropped == null) return;

    DragDrop.unhook();
    shareButton.hide();
    ShareBigText.send("IMAGE", dropped.imageDataUrl);
  });
  //#endregion ドラッグドロップ直後に出るUI


  const shareImageUnhook = ShareBigText.waitingFromSingleUser(
    "IMAGE",
    g.game.env.hostId,
    receiveShareImage,
  );

  if (g.game.env.isHost) {
    DragDrop.hook(onDragDrop);
  }

  const eventKeys = [
    ChangePuzzle.receive(client, data => {
      const customState = getCustomState();

      if (data.index === -1) {

        switch (customState) {
          case "none":
            preview.hide();
            customTextParent.show();
            titleUi.levelTextBack.hide();
            titleUi.levelSlider?.hide();
            titleUi.startButton?.hide();
            break;
          case "dropped":
            shareButton.show();
            titleUi.levelTextBack.hide();
            titleUi.levelSlider?.hide();
            titleUi.startButton?.hide();
            setPreviewSprite(preview, dropped!.surface);
            break;
          case "shared":
            setPreviewSprite(preview, sharedSurface!);
            break;
        }
      } else {
        preview.show();
        customTextParent.hide();
        shareButton.hide();

        titleUi.levelTextBack.show();
        titleUi.levelSlider?.show();
        titleUi.startButton?.show();
      }
    }),
  ];

  return {
    destroy() {
      client.removeEventSets(eventKeys);
      DragDrop.unhook();
      shareImageUnhook?.();
    },
    get customSurface() {
      return sharedSurface;
    }
  };


  async function onDragDrop(e: DragEvent) {
    if (sharedSurface != null) return;

    const file = e.dataTransfer?.files[0];
    if (file == null || file.type.match(/image.*/g) == null) return;
    // DragDrop.unhook();

    client.sendEvent(new ChangePuzzle(-1));
    const imageDataUrl = await fileToImageDataUrl(file);
    shareButton.show();

    imageDataUtil.fromImageDataUrl(imageDataUrl)
      .then(imageData => {
        customTextParent.hide();
        const surface = imageDataUtil.toSurface(imageData);
        dropped = { imageDataUrl, surface };
        preview.show();
        setPreviewSprite(preview, dropped.surface);
      });

    // ShareBigText.send("IMAGE", imageDataUrl);
  }

  function receiveShareImage(imageDataUrl: string): true {
    // 非同期処理を行うのでイベントの処理を一時停止
    const unlockEvent = client.lockEvent();

    imageDataUtil.fromImageDataUrl(imageDataUrl)
      .then(imageData => {
        customTextParent.hide();
        titleUi.levelTextBack.show();
        titleUi.levelSlider?.show();
        titleUi.startButton?.show();

        const surface = imageDataUtil.toSurface(imageData);
        sharedSurface = surface;
        preview.show();
        setPreviewSprite(preview, sharedSurface!);

        setChangeLevel();

        if (dropped != null) {
          dropped.surface.destroy();
          dropped = undefined;
        }
      })
      .catch(e => {
        // new g.Label({
        //   scene, parent: scene,
        //   text: (e ? "不明なエラー" : e + ""),
        //   font,
        //   x: 100,
        //   y: 200,
        // });
      })
      .finally(unlockEvent);      // イベントの再開は最後

    return true;
  }
}
