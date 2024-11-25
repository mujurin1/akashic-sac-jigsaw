import { ForceReleasePiece, HoldPiece, MovePiece, ReleasePiece } from "../../../event/PlayingEvent";
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
export function inputSystemControl(playingState: PlayingState): InputSystemControl {
  const { client } = playingState;

  const sendMoveCount = 5;
  let sendMoveCounter = 0;

  const inputSystemState: InputSystemState = {
    playingState,
    onHold(piece) {
      if (!playingState.isJoined() || !Piece.canHold(piece)) return false;
      playingState.holdPiece = piece;
      sendMoveCounter = 0;
      piece.parent!.append(piece);
      client.sendEvent(new HoldPiece(piece.tag.index));
      return true;
    },
    onMove(point) {
      const piece = playingState.holdPiece;
      if (piece == null || !Piece.canHold(piece)) return false;

      piece.moveTo(point.x, point.y);
      piece.modified();

      if (++sendMoveCounter > sendMoveCount) {
        sendMoveCounter = 0;
        client.sendEvent(new MovePiece(piece.tag.index, point));
      }

      return true;
    },
    onRelease(point) {
      const piece = playingState.holdPiece;
      if (piece == null || !Piece.canHold(piece)) return false;

      if (point == undefined) {
        client.sendEvent(new ReleasePiece(piece.tag.index));
      } else {
        piece.moveTo(point.x, point.y);
        piece.modified();
        client.sendEvent(new ReleasePiece(piece.tag.index, point));
      }

      playingState.holdPiece = undefined;
      return true;
    },
    onCheckFit() {

    },

    toggle: {
      device: () => control.toggle(),
      info: () => {

      },
      preview: () => {

      },
      color: () => {
        return "blue";
      },
      visible: () => {

      },
      ranking: () => {

      },
    }
  };

  const clientEventKeys = [
    // 自分が持っているピースを他人が操作した
    HoldPiece.receive(client, ({ pieceIndex, playerId }) => {
      if (playerId == null || playerId === g.game.selfId) return;
      if (pieceIndex !== playingState.holdPiece?.tag.index) return;

      Piece.hold(playingState.pieces[pieceIndex], playerId);
      playingState.holdPiece = undefined;
    }),
    // 自分が持っているピースを強制開放
    ForceReleasePiece.receive(client, ({ pieceIndex }) => {
      if (playingState.holdPiece?.tag.index !== pieceIndex) return;

      playingState.holdPiece = undefined;
      playingState.pieceOperaterControl.current.forceReleace();
    }),
  ];

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
      inputSystemState.onRelease();
      inputSystems[control.currentType].toggleFeature(false);

      control.currentType = type;
      inputSystems[type].toggleFeature(true);
    },
    destroy() {
      client.removeEventSet(...clientEventKeys);
      for (const type of InputSystemType) {
        inputSystems[type].destroy();
      }
    },
  };

  control.current.toggleFeature(true);

  return control;
}


export interface InputSystem {
  /**
   * この操作モードの有効/無効を切り替える
   * @param enable 
   */
  toggleFeature: (enable: boolean) => void;
  /**
   * 今持っているピースを強制的に放す
   */
  forceReleace: () => void;

  /**
   * 全てのイベントを解除して機能を停止する
   */
  destroy: () => void;
}

/**
 * 各InputSystem (PC,Mobile) に渡す値
 */
export interface InputSystemState {
  readonly playingState: PlayingState;

  /**
   * ピースを持つ
   * @returns ピースを持つことが出来たか
   */
  onHold: (piece: Piece) => boolean;
  /**
   * ピースを動かす
   * @param point 移動先
   * @returns ピースを動かす事が出来たか
   */
  onMove: (point: g.CommonOffset) => boolean;
  /**
   * ピースを放す
   * @returns ピースを放したか (持っている状態から持っていない状態に遷移したか)
   */
  onRelease: (point?: g.CommonOffset) => boolean;
  /**
   * 持っているピースがくっつく/ハマるかを判定する (離さない)
   */
  onCheckFit: () => void;



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
