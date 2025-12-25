
export interface SliderParams extends Omit<g.EParameterObject, "touchable"> {
  /** 最初のつまみの位置 */
  per?: number;
  min?: number;
  max: number;
  /** @default 50 */
  gripWidth?: number;
  width: number;
  height: number;
  /** スライダーの上昇量曲線 */
  quadratic?: number;
  backgroundCssColor?: string;
  barCssColor?: string;
  gripCssColor?: string;
}

export class Slider extends g.FilledRect {
  public onBarDown = new g.Trigger<number>();
  public onSliderMove = new g.Trigger<number>();
  public onSliderUp = new g.Trigger<number>();
  public onValueChange = new g.Trigger<number>();

  public readonly bar: g.FilledRect;
  public readonly grip: g.FilledRect;

  /** スライダーの上昇量曲線 */
  public quadratic: number;

  public per: number;
  public min: number;
  public max: number;
  /** min~max の間のスライダーの値 (小数点有) */
  public value: number;

  /** スライダーの本当の上限値 (%) */
  private _overLimitPer = 1;

  public setOverLimitPer(per: number): void {
    this._overLimitPer = per;
    if (this.per <= this._overLimitPer) return;

    this.per = this._overLimitPer;
    this.grip.x = this.bar.width * this.per;
    this.grip.modified();
    this.value = (this.max - this.min) * Math.pow(this.per, this.quadratic) + this.min;
  }

  constructor(_param: SliderParams) {
    const param = {
      per: 0, min: 0,
      backgroundCssColor: "white",
      barCssColor: "#FFA500a0",
      gripCssColor: "#000a",
      quadratic: 1,
      gripWidth: 50,
      ..._param,
    } satisfies SliderParams;

    super({
      ...param,
      cssColor: param.backgroundCssColor,
    });
    // const display = new g.E({
    //   ...param,
    //   touchable: false
    // });
    // this = display;
    const scene = param.scene;
    this.per = param.per;
    this.min = param.min;
    this.max = param.max;
    this.quadratic = param.quadratic;

    this.bar = new g.FilledRect({
      scene, parent: this,
      anchorY: 0.5,
      cssColor: param.barCssColor,
      x: param.gripWidth / 2,
      y: param.height / 2,
      width: this.width - param.gripWidth,
      height: this.height / 2,
      touchable: true,
    });
    this.grip = new g.FilledRect({
      scene, parent: this,
      cssColor: param.gripCssColor,
      x: this.bar.width * this.per,
      width: param.gripWidth,
      height: this.height,
      touchable: true,
    });

    this.bar.onPointDown.add(e => {
      this.gripMoveTo(e.point.x);
      this.onBarDown.fire(this.value);
      this.onValueChange.fire(this.value);
    });
    this.bar.onPointMove.add(e => {
      this.gripMoveTo(e.point.x + e.startDelta.x);
      this.onBarDown.fire(this.value);
      this.onValueChange.fire(this.value);
    });

    this.grip.onPointMove.add(e => {
      this.gripMoveBy(e.prevDelta.x);
      this.onSliderMove.fire(this.value);
      this.onValueChange.fire(this.value);
    });
    this.grip.onPointUp.add(e => {
      this.onSliderUp.fire(this.value);
    });
  }

  private gripMoveBy(x: number) {
    this.gripMoveTo(this.grip.x + x);
  }

  private gripMoveTo(x: number) {
    this.per = x / this.bar.width;

    if (this.per < 0) {
      this.per = 0;
    } else if (this.per > this._overLimitPer) {
      this.per = this._overLimitPer;
    }

    this.grip.x = this.bar.width * this.per;
    this.grip.modified();
    this.value = (this.max - this.min) * Math.pow(this.per, this.quadratic) + this.min;
  }

  override destroy() {
    super.destroy();

    this.onBarDown.destroy();
    this.onSliderMove.destroy();
    this.onSliderUp.destroy();
    this.onValueChange.destroy();
    this.onBarDown = null!;
    this.onSliderMove = null!;
    this.onSliderUp = null!;
    this.onValueChange = null!;
  }
}