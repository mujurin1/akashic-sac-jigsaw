import { InputSystem, InputSystemState } from "./InputSystem";

export function PcInputSystem(state: InputSystemState): InputSystem {
  const { playingState } = state;
  const { client, playArea } = playingState;
  const { camerable } = playArea;
  const { scene } = client.env;

  const icons = createIcons(state);

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
    toggleFeature(enable) {
      if (icons[0].visible() === enable) return;
      if (enable) {
        for (const icon of icons) icon.show();
        scene.onPointMoveCapture.add(moveCamera);
        scene.onPointDownCapture.add(pieceTouch);
        scene.onPointMoveCapture.add(pieceMove);
        scene.onPointUpCapture.add(pieceRelease);
      } else {
        for (const icon of icons) icon.hide();
        scene.onPointMoveCapture.remove(moveCamera);
        scene.onPointDownCapture.remove(pieceTouch);
        scene.onPointMoveCapture.remove(pieceMove);
        scene.onPointUpCapture.remove(pieceRelease);
      }
    },
    forceRelease() { },
    destroy() {
      result.toggleFeature(false);
    },
  };

  return result;
}

function createIcons(state: InputSystemState) {
  const { ui } = state.playingState;

  const deviceBtn = createIcon("ico_device", 0, 2);
  const visibleBtn = createIcon("ico_visible", 1, 2);
  const rankingBtn = createIcon("ico_ranking", 2, 2);
  const infoBtn = createIcon("ico_info", 0, 1);
  const previewBtn = createIcon("ico_preview", 1, 1);
  const colorBtn = createIcon(undefined, 2, 1);

  const icons = [deviceBtn, visibleBtn, rankingBtn, infoBtn, previewBtn, colorBtn] as const;

  colorBtn.cssColor = "red";
  colorBtn.modified();

  deviceBtn.onPointDown.add(() => state.toggle.device());
  visibleBtn.onPointDown.add(() => state.toggle.visible());
  rankingBtn.onPointDown.add(() => state.toggle.ranking());
  infoBtn.onPointDown.add(() => state.toggle.info());
  previewBtn.onPointDown.add(() => state.toggle.preview());
  colorBtn.onPointDown.add(() => {
    colorBtn.cssColor = state.toggle.color();
    colorBtn.modified();
  });

  const moreBtn = createIcon("ico_more", 0, 0);
  moreBtn.opacity = 0.7;
  moreBtn.modified();

  moreBtn.onPointDown.add(() => {
    if (icons[0].visible()) for (const icon of icons) icon.hide();
    else for (const icon of icons) icon.show();
  });

  return [moreBtn, ...icons] as const;

  /**
   * 
   * @param iconName アイコンの名前
   * @param x 右からのインデックス
   * @param y 下からのインデックス
   */
  function createIcon(iconName: string | undefined, x: number, y: number): g.FilledRect {
    const scene = g.game.env.scene;
    const baseX = g.game.width - (90 + 30);
    const baseY = 600;

    const back = new g.FilledRect({
      scene, parent: ui,
      cssColor: "rgba(255,255,255,0.3)",
      width: 90, height: 90,
      x: baseX - 105 * x,
      y: baseY - 105 * y,
      touchable: true, hidden: true,
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
