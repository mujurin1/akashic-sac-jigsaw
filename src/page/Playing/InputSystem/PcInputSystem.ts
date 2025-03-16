import { InputSystem, InputSystemState } from "./InputSystem";

export function PcInputSystem(state: InputSystemState): InputSystem {
  const { playingState } = state;
  const { client, playArea } = playingState;
  const { camerable } = playArea;
  const { scene } = client.env;

  const pcUi = createIcons(state);

  const moveCamera = (e: g.PointMoveEvent) => {
    if (playingState.holdState != null || e.target !== playArea.bg) return;
    camerable.moveBy(-e.prevDelta.x * camerable.scaleX, -e.prevDelta.y * camerable.scaleX);
    camerable.modified();
  };
  const pieceTouch = (e: g.PointDownEvent) => {
    if (e.target !== playArea.bg) return;
    state.hold(e.point.x, e.point.y);
  };
  const pieceMove = (e: g.PointMoveEvent) => {
    if (playingState.holdState == null) return;
    state.move(e.point.x + e.startDelta.x, e.point.y + e.startDelta.y);
  };
  const pieceRelease = (e: g.PointUpEvent) => {
    if (playingState.holdState == null) return;
    state.release(e.point.x + e.startDelta.x, e.point.y + e.startDelta.y);
  };

  const result: InputSystem = {
    disable: () => {
      if (!pcUi.visible()) return;
      pcUi.hide();
      scene.onPointMoveCapture.remove(moveCamera);
      scene.onPointDownCapture.remove(pieceTouch);
      scene.onPointMoveCapture.remove(pieceMove);
      scene.onPointUpCapture.remove(pieceRelease);
    },
    enable: (newUiState) => {
      if (pcUi.visible()) return;
      pcUi.show(newUiState.nextBgColor);
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
}

function createIcons(state: InputSystemState) {
  const { client: { env: { scene } } } = state.playingState;

  const pcUiParent = new g.E({
    scene, parent: state.playingState.display,
    hidden: true,
  });

  const pcUiParts = {
    deviceBtn: createIcon("ico_device", [0, 2]),
    visibleBtn: createIcon("ico_visible", [1, 2]),
    rankingBtn: createIcon("ico_ranking", [2, 2]),
    infoBtn: createIcon("ico_info", [0, 1]),
    previewBtn: createIcon("ico_preview", [1, 1]),
    colorBtn: createIcon(undefined, [2, 1]),
  } as const;

  pcUiParts.deviceBtn.onPointDown.add(() => state.toggle.device());
  pcUiParts.visibleBtn.onPointDown.add(() => state.toggle.visible());
  pcUiParts.rankingBtn.onPointDown.add(() => state.toggle.ranking());
  pcUiParts.infoBtn.onPointDown.add(() => state.toggle.info());
  pcUiParts.previewBtn.onPointDown.add(() => state.toggle.preview());
  pcUiParts.colorBtn.onPointDown.add(() => {
    pcUiParts.colorBtn.cssColor = state.toggle.color();
    pcUiParts.colorBtn.modified();
  });

  const moreBtn = createIcon("ico_more", [0, 0]);
  moreBtn.opacity = 0.7;
  moreBtn.modified();

  moreBtn.onPointDown.add(() => {
    pcUiParent.hide();
    pcUiParent.show();
  });


  return {
    show: (nextBgColor: string) => {
      pcUiParent.show();
      pcUiParts.colorBtn.cssColor = nextBgColor;
      pcUiParts.colorBtn.modified();
    },
    hide: () => {
      pcUiParent.hide();
    },
    visible: () => pcUiParent.visible(),
  };
  // return [moreBtn, ...icons] as const;

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
      scene, parent: pcUiParent,
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
