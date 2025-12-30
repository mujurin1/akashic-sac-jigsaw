import { toggleVisibleTo } from "../../../common/func";
import { Slider } from "../../../common/Slider";
import { ClientPlaying } from "./ClientPlaying";

export interface PreviewGroup {
  readonly display: g.E;

  /**
   * 表示を切り替える
   * @param visibleTo `true`: 表示, `false`: 非表示, `undefined`: トグル
   */
  toggle(visibleTo?: boolean): void;
}

const enum PREVIEW {
  W = 850,
  H = 500,
  W_HALF = PREVIEW.W / 2,
  H_HALF = PREVIEW.H / 2,
}

export function createPreviewGroup(clientPlaying: ClientPlaying): PreviewGroup {
  const scene = g.game.env.scene;

  const display = new g.E({ scene, parent: clientPlaying.display, hidden: true });

  const imageSrc = clientPlaying.playState.piecesResult.preview.src;
  const wPer = PREVIEW.W / imageSrc.width;
  const hPer = PREVIEW.H / imageSrc.height;

  const overflowDir = wPer < hPer ? "w" : "y";
  const baseScale = overflowDir === "w" ? wPer : hPer;

  // 初期の黒帯サイズを計算（baseScale時の余白）
  const initialImageWidth = imageSrc.width * baseScale;
  const initialImageHeight = imageSrc.height * baseScale;
  const initialBlackBandX = (PREVIEW.W - initialImageWidth) / 2;
  const initialBlackBandY = (PREVIEW.H - initialImageHeight) / 2;

  const pane = new g.Pane({
    scene, parent: display,
    x: (950 - PREVIEW.W) / 2, y: (950 - PREVIEW.W) / 2,
    width: PREVIEW.W, height: PREVIEW.H,
  });
  const previewArea = new g.FilledRect({
    scene, parent: pane,
    cssColor: "rgba(0, 0, 0, 0.4)",
    width: PREVIEW.W, height: PREVIEW.H,
    touchable: true,
  });

  const image = new g.Sprite({
    scene, parent: previewArea,
    src: imageSrc,
    x: PREVIEW.W_HALF - imageSrc.width * baseScale / 2,
    y: PREVIEW.H_HALF - imageSrc.height * baseScale / 2,
    scaleX: baseScale, scaleY: baseScale,
  });


  const slider = new Slider({
    scene, parent: display,
    x: 100,
    y: pane.y + previewArea.height + 50,
    height: 80, width: PREVIEW.W - 200,
    backgroundCssColor: "#FFF8",
    quadratic: 2,
    min: 1, max: 10,
  });
  slider.onValueChange.add(upScale => scaleImageTo(upScale));
  previewArea.onPointMove.add(({ prevDelta }) => moveImageBy(prevDelta.x, prevDelta.y));

  // 枠と、その枠に収まる画像があります
  // 枠は panel 大きさ：W,Hを持っています
  // 画像は image 座標：X,Yと大きさ：W,Hを持っています

  return {
    display,
    toggle: value => toggleVisibleTo(display, value),
  };


  function scaleImageTo(per: number, cx = 0.5, cy = 0.5) {
    const newScale = baseScale * per;
    const scaleRatio = newScale / image.scaleX;

    // 見えている範囲の中心
    const viewCenterX = PREVIEW.W * cx;
    const viewCenterY = PREVIEW.H * cy;

    // 現在の画像中心から見える範囲の中心への差分を、拡大率に応じて調整
    const deltaX = (image.x - viewCenterX) * scaleRatio;
    const deltaY = (image.y - viewCenterY) * scaleRatio;

    image.scale(newScale);
    moveImageTo(viewCenterX + deltaX, viewCenterY + deltaY);
  }

  function moveImageBy(dx: number, dy: number) {
    moveImageTo(image.x + dx, image.y + dy);
  }

  function moveImageTo(x: number, y: number) {
    // 画像の実際のサイズ（スケール適用後）
    const imageWidth = imageSrc.width * image.scaleX;
    const imageHeight = imageSrc.height * image.scaleY;

    // 移動可能範囲を計算（常に初期黒帯分を確保、拡大時は移動範囲が広がる）
    // 左端：画像左端が初期黒帯分より右に来ないよう制限
    const minX = Math.min(initialBlackBandX, PREVIEW.W - imageWidth - initialBlackBandX);
    // 右端：画像右端が初期黒帯分より左に来ないよう制限
    const maxX = Math.max(initialBlackBandX, PREVIEW.W - imageWidth - initialBlackBandX);
    // 上端：画像上端が初期黒帯分より下に来ないよう制限
    const minY = Math.min(initialBlackBandY, PREVIEW.H - imageHeight - initialBlackBandY);
    // 下端：画像下端が初期黒帯分より上に来ないよう制限
    const maxY = Math.max(initialBlackBandY, PREVIEW.H - imageHeight - initialBlackBandY);

    // 座標を制限内にクランプ
    image.x = Math.max(minX, Math.min(maxX, x));
    image.y = Math.max(minY, Math.min(maxY, y));
    image.modified();
  }
}
