import { Label } from "@akashic-extension/akashic-label";
import { createFont } from "akashic-sac";

const defaultFont = createFont({ size: 100, fontColor: "white" });
const margin = 15;

export interface ButtonParam {
  scene: g.Scene,
  parent?: g.Scene | g.E,
  x: number,
  y: number,

  width?: number,
  height?: number,

  text: string,

  font?: g.Font,
  /** @default 65 */
  fontSize?: number,

  /** @default true */
  touchable?: boolean,
}

export function createButton(param: ButtonParam): g.Sprite {
  const { scene, width, height } = param;
  const label = new Label({
    scene,
    text: param.text,
    font: param.font ?? defaultFont,
    textColor: "white",
    width: width ?? 0,
    height,
    textAlign: width == null ? "left" : "center",
    widthAutoAdjust: width == null,
    lineBreak: false,
    fontSize: param.fontSize ?? 65,
    x: width == null ? margin : 0, y: margin - 5,
  });
  if (height != null) {
    label.y = (height - label.height) / 2 - 5;
    label.modified();
  }

  const destSurface = g.game.resourceFactory.createSurface(
    width ?? label.width + margin * 2,
    height ?? label.height + margin * 2,
  );
  g.SurfaceUtil.drawNinePatch(
    destSurface,
    g.SurfaceUtil.asSurface(scene.asset.getImageById("default_frame"))!,
    margin,
  );
  const sprite = new g.Sprite({
    scene,
    parent: param.parent,
    src: destSurface,
    x: param.x,
    y: param.y,
    touchable: param.touchable !== false,
  });

  sprite.append(label);

  return sprite;
}
