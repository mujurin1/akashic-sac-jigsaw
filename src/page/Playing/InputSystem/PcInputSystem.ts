import { ClientPlaying } from "../State/ClientPlaying";
import { InputSystem } from "./InputSystem";

export function PcInputSystem(
  clientPlaying: ClientPlaying,
  inputUiParent: g.E,
): InputSystem {
  const scene = g.game.env.scene;

  const pcUi = createIcons(clientPlaying, inputUiParent);
  const eventManager = customWheelEvent(clientPlaying);

  const result: InputSystem = {
    disable: () => {
      if (!pcUi.visible()) return;
      pcUi.hide();
      eventManager.disable();
      scene.onPointMoveCapture.remove(moveCamera);
      scene.onPointDownCapture.remove(pieceTouch);
      scene.onPointMoveCapture.remove(pieceMove);
      scene.onPointUpCapture.remove(pieceRelease);
    },
    enable: (newUiState) => {
      if (pcUi.visible()) return;
      pcUi.show(newUiState.nextBgColor);
      eventManager.enable();
      scene.onPointMoveCapture.add(moveCamera);
      scene.onPointDownCapture.add(pieceTouch);
      scene.onPointMoveCapture.add(pieceMove);
      scene.onPointUpCapture.add(pieceRelease);
    },
    forceRelease() { },
    destroy() {
      result.disable();
    },
  };

  return result;


  function moveCamera({ target, prevDelta }: g.PointMoveEvent) {
    if (
      clientPlaying.playState.holdState != null ||
      target !== clientPlaying.uiGroups.bg.color
    ) return;

    const playArea = clientPlaying.uiGroups.playArea;
    playArea.moveByCamera(-prevDelta.x, -prevDelta.y);
  }

  function pieceTouch(e: g.PointDownEvent) {
    if (e.target !== clientPlaying.uiGroups.bg.color) return;
    clientPlaying.playState.hold(e.point.x, e.point.y);
  }

  function pieceMove(e: g.PointMoveEvent) {
    if (clientPlaying.playState.holdState == null) return;
    clientPlaying.playState.move(e.point.x + e.startDelta.x, e.point.y + e.startDelta.y);
  }

  function pieceRelease(e: g.PointUpEvent) {
    if (clientPlaying.playState.holdState == null) return;
    clientPlaying.playState.release(e.point.x + e.startDelta.x, e.point.y + e.startDelta.y);
  }
}

function createIcons(clientPlaying: ClientPlaying, inputUiParent: g.E) {
  const scene = g.game.env.scene;

  const pcUiParent = new g.E({
    scene, parent: inputUiParent,
    hidden: true,
  });
  const iconParent = new g.E({
    scene, parent: pcUiParent,
  });

  const icons = {
    deviceIcon: createIcon("ico_device", [0, 2]),
    optionIcon: createIcon("ico_setting", [1, 2]),
    rankingIcon: createIcon("ico_ranking", [2, 2]),
    infoIcon: createIcon("ico_info", [0, 1]),
    previewIcon: createIcon("ico_preview", [1, 1]),
    colorIcon: createIcon(undefined, [2, 1]),
  } as const;

  icons.deviceIcon.onPointDown.add(() => clientPlaying.uiGroups.inputSystem.toggleInputSystem());
  icons.optionIcon.onPointDown.add(() => clientPlaying.uiGroups.option.toggle());
  icons.rankingIcon.onPointDown.add(() => clientPlaying.uiGroups.ranking.toggle());
  icons.infoIcon.onPointDown.add(() => clientPlaying.uiGroups.info.toggle());
  icons.previewIcon.onPointDown.add(() => clientPlaying.uiGroups.preview.toggle());
  icons.colorIcon.onPointDown.add(() => {
    icons.colorIcon.cssColor = clientPlaying.uiGroups.bg.toggleColor();
    icons.colorIcon.modified();
  });

  const moreIcon = createIcon("ico_more", [0, 0]);
  pcUiParent.append(moreIcon);
  moreIcon.opacity = 1;
  moreIcon.modified();

  moreIcon.onPointDown.add(() => {
    if (iconParent.visible()) {
      iconParent.hide();
      moreIcon.opacity = 0.7;
    } else {
      iconParent.show();
      moreIcon.opacity = 1;
    }
    moreIcon.modified();
  });


  return {
    show: (nextBgColor: string) => {
      pcUiParent.show();
      icons.colorIcon.cssColor = nextBgColor;
      icons.colorIcon.modified();
    },
    hide: () => {
      pcUiParent.hide();
    },
    visible: () => pcUiParent.visible(),
  };

  /**
   * @param iconName アイコンの名前
   * @param param1 右下から左上に向けての位置
   * @returns 
   */
  function createIcon(iconName: string | undefined, [x, y]: [x: number, y: number]): g.FilledRect {
    const scene = g.game.env.scene;
    const baseX = g.game.width - (90 + 30);
    const baseY = 600;

    const back = new g.FilledRect({
      scene, parent: iconParent,
      cssColor: "rgba(255, 255, 255, 0.3)",
      width: 90, height: 90,
      x: baseX - 105 * x,
      y: baseY - 105 * y,
      touchable: true,
    });

    if (iconName != null) {
      const icon = new g.Sprite({
        scene, parent: back,
        src: scene.asset.getImageById(iconName),
      });
      icon.scaleX = back.width / icon.width;
      icon.scaleY = back.height / icon.height;
      icon.modified();
    }

    return back;
  }
}

function customWheelEvent(clientPlaying: ClientPlaying) {

  return {
    enable: () => {
      if (!g.game.env.hasClient) return;
      g.game.env.view.addEventListener("wheel", wheelEvent, { passive: false });
    },
    disable: () => {
      if (!g.game.env.hasClient) return;
      g.game.env.view.removeEventListener("wheel", wheelEvent);
    },
  };

  function wheelEvent(e: WheelEvent) {
    // TODO: オプションUIが開いているときは無効にする
    // if (clientPlaying.uiGroups.option.visible) return;

    e.preventDefault();

    const scale = e.deltaY < 0
      ? e.ctrlKey ? 0.8 : 0.9
      : e.ctrlKey ? 1.2 : 1.1;
    const pos = { x: e.offsetX, y: e.offsetY };

    clientPlaying.uiGroups.playArea.scaleCamera(scale, { pos });
  }
}
