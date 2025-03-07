import { HoldPiece, MovePiece, ReleasePiece } from "../../../event/PlayingEvent";
import { Piece } from "../Piece";
import { PlayingState } from "../Playing";
import { MobileInputSystem } from "./MobileInputSystem";
import { PcInputSystem } from "./PcInputSystem";

/** 入力方式の種類 */
export const InputSystemType = ["pc", "mobile"] as const;
export type InputSystemType = typeof InputSystemType[number];

export interface InputSystemControl {
  currentType: InputSystemType;
  current: InputSystem;
  toggle: (type?: InputSystemType) => void;
  destroy: () => void;
}

/**
 * デバイス毎の操作方法の管理を行う
 */
export function inputSystemControl(state: PlayingState): InputSystemControl {
  const { client, playArea: { camerable } } = state;

  const sendMoveCount = 5;
  let sendMoveCounter = 0;

  const inputSystemState: InputSystemState = {
    playingState: state,
    hold,
    move,
    release,
    checkFit,

    scale,

    toggle: {
      device: () => control.toggle(),
      info: () => { },
      preview: () => { },
      color: () => {
        return "blue";
      },
      visible: () => { },
      ranking: () => { },
    }
  };

  const inputSystems = {
    "pc": PcInputSystem(inputSystemState),
    "mobile": MobileInputSystem(inputSystemState),
  } as const satisfies Record<InputSystemType, InputSystem>;

  const control: InputSystemControl = {
    currentType: "pc" as InputSystemType,
    get current() { return inputSystems[control.currentType]; },
    toggle(type?: InputSystemType) {
      if (type == null) type = control.currentType === "mobile" ? "pc" : "mobile";
      if (type === control.currentType) return;
      inputSystemState.release();
      inputSystems[control.currentType].toggleFeature(false);

      control.currentType = type;
      inputSystems[type].toggleFeature(true);
    },
    destroy() {
      for (const type of InputSystemType) {
        inputSystems[type].destroy();
      }
    },
  };

  control.current.toggleFeature(true);

  return control;

  function hold(x: number, y: number): boolean {
    state.holdState = state.getPieceFromScreenPx(x, y, true);
    if (state.holdState == null) return false;

    sendMoveCounter = 0;
    const piece = state.holdState.piece;
    piece.parent.append(piece);
    client.sendEvent(new HoldPiece(piece.tag.index));
    return true;
  }
  function move(x: number, y: number): boolean {
    const holdState = state.holdState;
    if (holdState == null || !Piece.canHold(holdState.piece)) {
      state.holdState = undefined;
      return false;
    }
    const _point = state.toPieceArea(x, y);
    const point = { x: _point.x + holdState.offset.x, y: _point.y + holdState.offset.y };
    holdState.piece.moveTo(point.x, point.y);
    holdState.piece.modified();

    if (++sendMoveCounter > sendMoveCount) {
      sendMoveCounter = 0;
      client.sendEvent(new MovePiece(holdState.piece.tag.index, point));
    }
    return true;
  }
  function release(x?: number, y?: number): boolean {
    const holdState = state.holdState;
    if (holdState == null || !Piece.canHold(holdState.piece)) {
      state.holdState = undefined;
      return false;
    }

    let point: g.CommonOffset;
    if (x == null || y == null) {
      point = { x: holdState.piece.x, y: holdState.piece.y };
    } else {
      const _point = state.toPieceArea(x, y);
      point = { x: _point.x + holdState.offset.x, y: _point.y + holdState.offset.y };
      holdState.piece.moveTo(point.x, point.y);
      holdState.piece.modified();
    }
    client.sendEvent(new ReleasePiece(holdState.piece.tag.index, point));

    state.holdState = undefined;
    return true;
  }
  function checkFit() {
    // ピースを離さずにハマるかチェックし、ハマるならハメる
  }
  function scale(_per: number, isAbsolute = false) {
    const per = isAbsolute ? _per : camerable.scaleX * _per;
    camerable.scale(per);
    camerable.modified();
  }
}


export interface InputSystem {
  /**
   * この操作モードが有効/無効になったことを伝える
   * @param enable 
   */
  toggleFeature: (enable: boolean) => void;
  /**
   * 今持っているピースを強制的に放す
   */
  forceRelease: () => void;

  /**
   * 全てのイベントを解除して機能を停止する
   */
  destroy: () => void;
}

/**
 * 各InputSystem (PC,Mobile) に渡す値
 * 
 * ピースに対する操作は画面上の座標で行う\
 * `InputSystem`側でピース領域スケールへ変換する
 */
export interface InputSystemState {
  readonly playingState: PlayingState;

  /**
   * 指定座標に存在するピースを持つ
   * @returns ピースを持つことが出来たか
   */
  hold: (x: number, y: number) => boolean;
  /**
   * ピースを絶対値で動かす
   * @param x 絶対移動量
   * @param y 絶対移動量
   * @returns ピースを動かす事が出来たか
   */
  move: (x: number, y: number) => boolean;
  /**
   * ピースを放す\
   * x,yを指定しない場合は今のピースの座標で離す
   * @param x 絶対移動量
   * @param y 絶対移動量
   * @returns ピースを放したか (持っている状態から持っていない状態に遷移したか)
   */
  release(x: number, y: number): boolean;
  release(): boolean;
  /**
   * 持っているピースがくっつく/ハマるかを判定する (離さない)\
   * TODO: 判定が`true`ならくっつけるのか?
   */
  checkFit: () => void;

  /**
   * 拡大縮小 相対指定
   * @param per 拡大縮小率
   * @param isAbsolute 絶対値指定なら`true` @default `false`
   */
  scale: (per: number, isAbsolute?: boolean) => void;


  toggle: {
    device: () => void;
    info: () => void;
    preview: () => void;
    /** @returns 次の背景色 */
    color: () => string;
    visible: () => void;
    ranking: () => void;
  };
}
