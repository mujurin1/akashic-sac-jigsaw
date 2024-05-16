import { CommonOffset } from "akashic-sac";
import { PlayingState } from "./Playing";
import { Piece } from "./Piece";
import { HoldPiece, MovePiece, ReleasePiece, ForceReleasePiece } from "../../event/PlayingEvent";
import { createPad } from "../../util/Pad";


/**
 * デバイス毎の操作方法の管理を行う
 */
export function inputSystemControl(playingState: PlayingState) {
  const { client } = playingState;

  const sendMoveCount = 5;
  let sendMoveCounter = 0;
  // let holdPieceIndex: number | undefined;

  // TODO: removeTouchEvent()
  // const removeTouchEvent = setPieceTouchEvent(playingState);
  const state: InputSystemState = {
    playingState,
    onHold(piece) {
      if (!Piece.canHold(piece)) return false;
      playingState.holdPiece = piece;
      sendMoveCounter = 0;
      client.sendEvent(new HoldPiece(piece.tag.index));
      return true;
    },
    onMove(point) {
      const piece = playingState.holdPiece;
      if (piece == null || !Piece.canHold(piece)) return false;

      piece.moveTo(point.x, point.y);
      piece.modified();

      if (sendMoveCounter++ >= sendMoveCount) {
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
  };

  const inputSystems = [
    PcInputSystem(state),
    MobileInputSystem(state),
  ] as const;

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
      playingState.pieceOperaterControl.currentInputSystem.forceReleace();
    }),
  ];

  let currentOperaterIndex = 1;

  const control = {
    get currentInputSystem() {
      return inputSystems[currentOperaterIndex];
    },
    toggle() {
      state.onRelease();

      inputSystems[currentOperaterIndex].toggleFeature(false);
      currentOperaterIndex += 1;
      if (currentOperaterIndex >= inputSystems.length) {
        currentOperaterIndex = 0;
      }
      inputSystems[currentOperaterIndex].toggleFeature(true);
    },
    destroy() {
      client.removeEventSet(...clientEventKeys);
      for (const operater of inputSystems) {
        operater.destroy();
      }
    },
  };

  control.currentInputSystem.toggleFeature(true);

  return control;
}


export interface InputSystem {
  /**
   * タッチイベントや操作UIの有効/無効を切り替える
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

interface InputSystemState {
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
  onMove: (point: CommonOffset) => boolean;

  /**
   * ピースを放す
   * @returns ピースを放したか (持っている状態から持っていない状態に遷移したか)
   */
  onRelease: (point?: CommonOffset) => void;
}

function PcInputSystem(state: InputSystemState): InputSystem {
  const { playingState, onHold, onMove, onRelease } = state;
  const { client, layer } = playingState;
  const { scene } = client.env;
  let enabled = false;

  layer.bg.onPointMove.add(e => {
    if (!enabled) return;
    const playArea = layer.playArea;
    playArea.moveBy(-e.prevDelta.x * playArea.scaleX, -e.prevDelta.y * playArea.scaleX);
    playArea.modified();
  });

  let touchPoint: CommonOffset = null!;

  const pieceTouch = (e: g.PointDownEvent) => {
    const piece = e.target;
    if (!Piece.isPiece(piece)) return;
    touchPoint = { x: piece.x, y: piece.y };
    onHold(piece);
  };
  const pieceMove = (e: g.PointMoveEvent) => {
    if (touchPoint == null || e.target !== playingState.holdPiece) return;

    onMove({
      x: touchPoint.x + e.startDelta.x * layer.playArea.scaleX,
      y: touchPoint.y + e.startDelta.y * layer.playArea.scaleX,
    });
  };
  const pieceRelease = (e: g.PointUpEvent) => {
    if (touchPoint == null || e.target !== playingState.holdPiece) return;

    onRelease({
      x: touchPoint.x + e.startDelta.x * layer.playArea.scaleX,
      y: touchPoint.y + e.startDelta.y * layer.playArea.scaleX,
    });
  };

  const result: InputSystem = {
    toggleFeature(enable) {
      if (enable === enabled) return;
      enabled = enable;
      if (enable) {
        scene.onPointDownCapture.add(pieceTouch);
        scene.onPointMoveCapture.add(pieceMove);
        scene.onPointUpCapture.add(pieceRelease);
      } else {
        scene.onPointDownCapture.remove(pieceTouch);
        scene.onPointMoveCapture.remove(pieceMove);
        scene.onPointUpCapture.remove(pieceRelease);
      }
    },
    forceReleace() { },
    destroy() {
      result.toggleFeature(false);
    },
  };

  return result;
}

function MobileInputSystem(state: InputSystemState): InputSystem {
  const { playingState, onHold, onMove, onRelease } = state;
  const { client, layer } = playingState;
  const { scene } = client.env;
  let enabled = false;

  layer.bg.onPointMove.add(e => {
    if (!enabled) return;
    const playArea = layer.playArea;
    playArea.moveBy(-e.prevDelta.x * playArea.scaleX, -e.prevDelta.y * playArea.scaleX);
    playArea.modified();

    if (playingState.holdPiece != null) {
      onMove({
        x: playingState.holdPiece.x - e.prevDelta.x * layer.playArea.scaleX,
        y: playingState.holdPiece.y - e.prevDelta.y * layer.playArea.scaleX,
      });
    }
  });

  const getCursorPointPiece = (): {
    relativePoint: CommonOffset, piece: Piece,
  } | undefined => {
    const relativePoint = cursorParent.localToGlobal({ x: pad.cursor.x, y: pad.cursor.y });

    const piece = layer.playArea.findPointSourceByPoint(relativePoint, undefined, true)?.target;
    if (!Piece.isPiece(piece)) return;

    return { relativePoint, piece };
  };

  const holdPieceBtn = new g.FilledRect({
    scene, parent: layer.ui,
    cssColor: "gray",
    width: 150, height: 150,
    x: g.game.width - (150 + 50), y: g.game.height - (150 + 50),
    touchable: true, hidden: true,
  });
  holdPieceBtn.onPointDown.add(() => {
    if (playingState.holdPiece == null) {
      const result = getCursorPointPiece();
      if (result == null) return;
      const { piece } = result;

      onHold(piece);
    } else {
      onRelease();
    }
  });

  const cursorParent = new g.E({
    scene, parent: layer.ui,
    width: g.game.width / 2,
    height: g.game.height / 2,
    x: g.game.width / 2, y: g.game.height / 2,
    anchorX: 0.5, anchorY: 0.5,
    hidden: true,
  });
  const pad = createPad({
    scene, padParent: layer.ui,
    cursorParent,
    x: 40, y: g.game.height - (200 + 40),
    cursorSpeed: 20,
    hidden: true,
  });

  pad.onMoveing.add(({ padDir, moved, cursorRest }) => {
    layer.playArea.moveBy(cursorRest.x * layer.playArea.scaleX, cursorRest.y * layer.playArea.scaleX);
    layer.playArea.modified();

    // const q = getCursorPointPiece();
    // pad.cursor.cssColor = "yellow";
    // if (q != null) {
    //   console.log(q.piece);
    //   pad.cursor.cssColor = "red";
    // }
    // pad.cursor.modified();

    if (playingState.holdPiece != null) {
      onMove({
        x: playingState.holdPiece.x + moved.x * layer.playArea.scaleX,
        y: playingState.holdPiece.y + moved.y * layer.playArea.scaleX,
      });
    }
  });

  const result: InputSystem = {
    toggleFeature(enable) {
      if (enable === enabled) return;
      enabled = enable;
      if (enable) {
        holdPieceBtn.show();
        cursorParent.show();
        pad.pad.show();
      } else {
        holdPieceBtn.hide();
        cursorParent.hide();
        pad.pad.hide();
      }
    },
    forceReleace() {

    },
    destroy() {
      holdPieceBtn.destroy();
      cursorParent.destroy();
      pad.pad.destroy();
    },
  };

  return result;
}
