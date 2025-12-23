
export interface WakuParameterObject extends g.EParameterObject {
  /** 枠の色 */
  cssColor: string;
  /** 枠を除いた幅 */
  width: number;
  /** 枠を除いた高さ */
  height: number;
  /** 枠の太さ */
  borderSize: number;
}

export class Waku extends g.E {
  cssColor: string;
  borderSize: number;


  constructor(param: WakuParameterObject) {
    super(param);

    this.cssColor = param.cssColor;
    this.borderSize = param.borderSize;
  }

  override renderSelf(renderer: g.Renderer): boolean {
    const b = this.borderSize;
    const w = this.width + b * 2;
    const h = this.height + b * 2;

    renderer.save();
    renderer.translate(-b, -b);

    renderer.fillRect(0, 0, w, b, this.cssColor); // 上
    renderer.fillRect(0, b, b, h - b * 2, this.cssColor); // 左
    renderer.fillRect(w - b, b, b, h - b * 2, this.cssColor); // 右
    renderer.fillRect(0, h - b, w, b, this.cssColor); // 下

    renderer.restore();
    return true;
  }
}
