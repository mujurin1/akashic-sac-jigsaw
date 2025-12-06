import { Label } from "@akashic-extension/akashic-label";
import { createFont } from "akashic-sac";
import { toggleVisibleTo } from "../../../common/func";
import { ClientPlaying } from "./ClientPlaying";

export interface PreviewGroup {
  readonly panel: g.E;

  /**
   * 表示を切り替える
   * @param visibleTo `true`: 表示, `false`: 非表示, `undefined`: トグル
   */
  toggle(visibleTo?: boolean): void;
}

const PREVIEW_WIDTH = 850;
const PREVIEW_HEIGHT = 500;

export function createPreviewGroup(clientPlaying: ClientPlaying): PreviewGroup {
  const parent = clientPlaying.display;
  const scene = parent.scene;

  const panel = new g.FilledRect({
    scene, parent,
    hidden: true,
    cssColor: "rgba(0, 0, 0, 0.8)",
    x: (950 - PREVIEW_WIDTH) / 2, y: (950 - PREVIEW_WIDTH) / 2,
    width: PREVIEW_WIDTH, height: PREVIEW_HEIGHT,
    touchable: true,
  });

  new Label({
    scene, parent: panel,
    text: "完成画像\nプレビュー\n未実装",
    width: panel.width,
    font: createFont({ size: 100, fontColor: "white" }),
    widthAutoAdjust: false,
    textAlign: "center",
    y: 70,
  });

  return {
    panel,
    toggle: value => toggleVisibleTo(panel, value),
  };
}
