/* eslint-disable @typescript-eslint/unbound-method */
import { CommonRect } from "akashic-sac";

export interface CustomSpriteParameterObject extends g.SpriteParameterObject {
  /**
   * エンティティの領域から描画位置をずらす値\
   * それぞれの値分それぞれの方向に広がる
   */
  drawOffset: CommonRect;
}

/**
 * エンティティの領域から描画位置をずらせるスプライト
 */
export class CustomSprite extends g.E {
  drawOffset: CommonRect;

  constructor(param: CustomSpriteParameterObject) {
    super(param);
    this.drawOffset = param.drawOffset;

    this.src = param.src;
    if ("_drawable" in param.src) {
      this._surface = param.src;
    } else {
      this._surface = g.SurfaceUtil.asSurface(param.src)!;
    }
    if (param.width == null) this.width = this._surface.width;
    if (param.height == null) this.height = this._surface.height;
    this.srcWidth = param.srcWidth != null ? param.srcWidth : this.width;
    this.srcHeight = param.srcHeight != null ? param.srcHeight : this.height;
    this.srcX = param.srcX || 0;
    this.srcY = param.srcY || 0;
    this._stretchMatrix = undefined;
    this._beforeSrc = this.src;
    this._invalidateSelf();
  }

  override renderSelf(renderer: g.Renderer, _camera?: g.Camera): boolean {
    // if (this.srcWidth <= 0 || this.srcHeight <= 0) {
    // 	return true;
    // }

    renderer.save();
    if (this._stretchMatrix) {
      // renderer.save();
      renderer.transform(this._stretchMatrix._matrix);
    }

    renderer.translate(-this.drawOffset.left, -this.drawOffset.top);

    renderer.drawImage(
      this._surface,
      this.srcX,
      this.srcY,
      // this.width + this.drawOffset.left + this.drawOffset.right,
      // this.height + this.drawOffset.top + this.drawOffset.bottom,
      this._surface.width,
      this._surface.height,
      0, 0);

    renderer.restore();
    // if (this._stretchMatrix) renderer.restore();

    return true;   // false を返すと子孫を描画しない
  }

  private _invalidateSelf(): void {
    // const drawW = this.width + this.drawOffset.left + this.drawOffset.right;
    // const drawH = this.width + this.drawOffset.left + this.drawOffset.right;

    // if (drawW === this.srcWidth && drawH === this.srcHeight) {
    //   this._stretchMatrix = undefined;
    // } else {
    //   this._stretchMatrix = new g.PlainMatrix();
    // 	this._stretchMatrix.scale(drawW / this.srcWidth, drawH / this.srcHeight);
    // }
    if (this.src !== this._beforeSrc) {
      this._beforeSrc = this.src;
      if ("_drawable" in this.src) {
        this._surface = this.src;
      } else {
        this._surface = g.SurfaceUtil.asSurface(this.src)!;
      }
    }
  }



  /**
   * 描画する `Surface` または `ImageAsset` 。
   * `srcX` ・ `srcY` ・ `srcWidth` ・ `srcHeight` の作る矩形がこの画像の範囲外を示す場合、描画結果は保証されない。
   * この値を変更した場合、 `this.invalidate()` を呼び出す必要がある。
   */
  src: g.Surface | g.ImageAsset;

  /**
   * `surface` の描画対象部分の幅。
   * 描画はこの値を `this.width` に拡大または縮小する形で行われる。
   * この値を変更した場合、 `this.invalidate()` を呼び出す必要がある。
   */
  srcWidth: number;

  /**
   * `surface` の描画対象部分の高さ。
   * 描画はこの値を `this.height` に拡大または縮小する形で行われる。
   * この値を変更した場合、 `this.invalidate()` を呼び出す必要がある。
   */
  srcHeight: number;

  /**
   * `surface` の描画対象部分の左端。
   * この値を変更した場合、 `this.invalidate()` を呼び出す必要がある。
   */
  srcX: number;

  /**
   * `surface` の描画対象部分の上端。
   * この値を変更した場合、 `this.invalidate()` を呼び出す必要がある。
   */
  srcY: number;

  /**
   * @private
   */
  _surface: g.Surface;

  /**
   * @private
   */
  _stretchMatrix: g.Matrix | undefined;

  /**
   * @private
   */
  _beforeSrc: g.Surface | g.ImageAsset | undefined;


  /**
   * このエンティティの描画キャッシュ無効化をエンジンに通知する。
   * このメソッドを呼び出し後、描画キャッシュの再構築が行われ、各 `Renderer` に描画内容の変更が反映される。
   */
  invalidate(): void {
    this._invalidateSelf();
    this.modified();
  }

  /**
   * このエンティティを破棄する。
   * デフォルトでは利用している `Surface` の破棄は行わない点に注意。
   * @param destroySurface trueを指定した場合、このエンティティが抱える `Surface` も合わせて破棄する
   */
  override destroy(destroySurface?: boolean): void {
    if (this._surface && !this._surface.destroyed() && destroySurface) {
      this._surface.destroy();
    }
    this.src = undefined!;
    this._beforeSrc = undefined;
    this._surface = undefined!;
    super.destroy();
  }
}
