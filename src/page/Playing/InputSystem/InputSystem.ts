import { HoldPiece, MovePiece, ReleasePiece } from "../../../event/PlayingEvent";
import { Piece } from "../Piece";
import { BACKGROUND_COLOR, ClientPlayingState } from "../PlayingState";
import { MobileInputSystem } from "./MobileInputSystem";
import { PcInputSystem } from "./PcInputSystem";

/**
 * 各InputSystem (PC,Mobile) に渡す値
 * 
 * ピースに対する操作は画面上の座標で行う\
 * `InputSystem`側でピース領域スケールへ変換する
 */
export interface InputSystemState {
  readonly playingState: ClientPlayingState;

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
   * @param options オプション
   */
  scale: (per: number, options?: ScaleOptions) => void;

  toggle: {
    device: () => void;
    info: () => void;
    preview: () => void;
    /** @returns 次の背景色 */
    color: () => string;
    option: () => void;
    ranking: () => void;
  };
}

interface ScaleOptions {
  /**
   * 絶対値指定なら`true`
   * @default `false`
   */
  isAbsolute?: boolean;

  /**
   * 拡大/縮小の中心座標 (画面上の座標)
   * @default 画面中央
   */
  pos: { x: number; y: number; };
}

/** 入力方式の種類 */
export const InputSystemType = ["pc", "mobile"] as const;
export type InputSystemType = typeof InputSystemType[number];

export interface InputSystemControl {
  readonly currentType: InputSystemType;
  readonly current: InputSystem;
  readonly inputSystemState: InputSystemState;

  toggle(type?: InputSystemType): void;
  destroy(): void;
}

/**
 * デバイス毎の操作方法の管理を行う
 */
export function inputSystemControl(state: ClientPlayingState): InputSystemControl {
  const { client, playArea, playUi } = state;
  const { camerable } = playArea;

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
      info: () => {
        if (playUi.info.panel.visible()) {
          playUi.info.panel.hide();
        } else {
          playUi.info.panel.show();
        }
      },
      preview: () => { },
      color: () => {
        const nextColor = BACKGROUND_COLOR.getNext(playArea.bg.cssColor);
        playArea.bg.cssColor = nextColor;
        playArea.bg.modified();
        return BACKGROUND_COLOR.nextIconBg[nextColor];
      },
      option: () => {
        state.option.show();
      },
      ranking: () => { },
    }
  };

  let currentType: InputSystemType = "pc";
  const inputSystems = {
    "pc": PcInputSystem(inputSystemState),
    "mobile": MobileInputSystem(inputSystemState),
  } as const satisfies Record<InputSystemType, InputSystem>;

  const control: InputSystemControl = {
    get currentType() { return currentType; },
    get current() { return inputSystems[currentType]; },
    inputSystemState,

    toggle(type?: InputSystemType) {
      if (type == null) type = currentType === "mobile" ? "pc" : "mobile";
      if (type === currentType) return;
      inputSystemState.release();
      inputSystems[currentType].disable();

      currentType = type;
      inputSystems[type].enable(createNewUiState());
    },
    destroy() {
      for (const type of InputSystemType) {
        inputSystems[type].destroy();
      }
    },
  };
  inputSystems.pc.enable(createNewUiState());

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
  function scale(_per: number, options?: ScaleOptions) {
    const scale = options?.isAbsolute ? _per : camerable.scaleX * _per;
    const posX = options?.pos?.x ?? g.game.width * 0.5;
    const posY = options?.pos?.y ?? g.game.height * 0.5;

    const prevScale = camerable.scaleX;
    camerable.scale(scale);

    const cx = posX / g.game.width;
    const cy = posY / g.game.height;
    const scaleW = camerable.width * prevScale;
    const scaleH = camerable.height * prevScale;
    const offsetX = cx * scaleW * (1 - scale / prevScale);
    const offsetY = cy * scaleH * (1 - scale / prevScale);
    camerable.moveBy(offsetX, offsetY);

    camerable.modified();
  }

  function createNewUiState(): NewUiState {
    return {
      nextBgColor: BACKGROUND_COLOR.nextIconBg[playArea.bg.cssColor],
    };
  }
}

interface NewUiState {
  readonly nextBgColor: string;
}


export interface InputSystem {
  /**
   * このモードが無効になったことを伝える
   */
  disable: () => void;
  /**
   * このモードが有効になったことを伝える
   * @param newUiState 新しいUIの状態
   */
  enable: (newUiState: NewUiState) => void;
  /**
   * 今持っているピースを強制的に放す
   */
  forceRelease: () => void;

  /**
   * 全てのイベントを解除して機能を停止する
   */
  destroy: () => void;
}
