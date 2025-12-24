import { Label } from "@akashic-extension/akashic-label";
import { createFont } from "akashic-sac";

const margin = 15;

export interface ButtonSwitchParam {
  scene: g.Scene;
  parent?: g.Scene | g.E;
  x: number;
  y: number;

  width?: number;
  height?: number;

  /** @default false */
  isEnabled?: boolean;
  textEnable: string;
  textDisable: string;

  font?: g.Font;
  /** @default 65 */
  fontSize?: number;

  /** @default true */
  touchable?: boolean;

  /** デフォルトは`"left"`だが`width`を指定した場合のデフォルトは`"center"` */
  textAlign?: g.TextAlignString;

  /** このエンティティの表示状態 **/
  hidden?: boolean;

  action?: (e: g.PointDownEvent | undefined, toEnable: boolean) => void;
}

export interface SwitchButton {
  button: g.Sprite;
  /** 有効化を切り替える. 未指定時は逆に切り替える */
  toggle(e: g.PointDownEvent | undefined, toEnable?: boolean): void;
  getEnabled(): boolean;
}

export function createSwitchButton(param: ButtonSwitchParam): SwitchButton {
  const { scene, width, height } = param;
  const font = param.font ?? createFont({ size: param.fontSize ?? 65, fontColor: "white" });

  let isEnabled = param.isEnabled ?? false;

  const label = new Label({
    scene,
    font,
    textColor: "white",
    width: width ?? 0,
    height,
    textAlign: param.textAlign != null ? param.textAlign : width == null ? "left" : "center",
    widthAutoAdjust: width == null,
    lineBreak: false,
    text: isEnabled ? param.textEnable : param.textDisable,
    x: width == null ? margin : 0, y: margin - 5,
  });

  const measureEnable = font.measureText(param.textEnable);
  const measureDisable = font.measureText(param.textDisable);

  const labelW = Math.max(measureEnable.width, measureDisable.width);
  const labelH = label.height;

  if (height != null) {
    label.y = (height - labelH) / 2 - 5;
    label.modified();
  }

  const destSurface = g.game.resourceFactory.createSurface(
    width ?? labelW + margin * 2,
    height ?? labelH + margin * 2,
  );
  g.SurfaceUtil.drawNinePatch(
    destSurface,
    g.SurfaceUtil.asSurface(scene.asset.getImageById("default_frame"))!,
    margin,
  );
  const button = new g.Sprite({
    scene,
    parent: param.parent,
    src: destSurface,
    x: param.x,
    y: param.y,
    touchable: param.touchable !== false,
    hidden: param.hidden ?? false,
  });

  button.append(label);
  button.onPointDown.add(e => toggle(e));

  return {
    button,
    toggle,
    getEnabled: () => isEnabled,
  };

  function toggle(e: g.PointDownEvent | undefined, toEnable?: boolean): void {
    isEnabled = toEnable ?? !isEnabled;
    if (isEnabled) {
      label.text = param.textEnable;
    } else {
      label.text = param.textDisable;
    }
    label.invalidate();

    param.action?.(e, isEnabled);
  }
}
