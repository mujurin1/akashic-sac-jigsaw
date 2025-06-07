import { CamerableE } from "akashic-sac";
import { toggleVisibleTo } from "../../../common/func";
import { ClientPlaying } from "./ClientPlaying";

/**
 * 階層
 * ```
 * camerable
 * |-pieceLimitArea
 * |-board
 * |  |-boardPreview
 * |  |-boardPieceFrame
 * |-pieceParent
 *    |-Pieces[]
 * ```
 */
export interface PieceGroup {
  /** ピースやボードの存在する本当のプレイエリア */
  readonly camerable: CamerableE;

  /** ピースの移動可能な領域 */
  readonly pieceLimitArea: g.CommonArea;

  /** ピースをハメるボード */
  readonly board: g.E;
  /** ボードに表示する完成画像 */
  readonly boardPreview: g.E;
  /** ボードに表示するピース枠線 */
  readonly boardPieceFrame: g.E;

  /** ピースの親 */
  readonly pieceParent: g.E;

  toggleBoardPreview(visibleTo?: boolean): void;
  toggleBordPieceFrame(visibleTo?: boolean): void;
}

export function createPieceGroup(clientPlaying: ClientPlaying): PieceGroup {
  const scene = clientPlaying.client.env.scene;
  const parent = clientPlaying.display;
  const {
    gameState,
    piecesResult: { preview, frame: boardPieceFrame },
  } = clientPlaying.playState;

  const camerable = new CamerableE({ scene, parent, anchorX: 0, anchorY: 0 });
  const pieceLimitArea = new g.FilledRect({
    scene, parent: camerable,
    cssColor: "#883f5f",
    width: gameState.pieceAreaLimit.width,
    height: gameState.pieceAreaLimit.height,
  });

  const board = new g.FilledRect({
    scene, parent: camerable,
    cssColor: "#ffffff50",
    width: preview.width, height: preview.height,
    x: gameState.boardArea.x,
    y: gameState.boardArea.y,
  });
  const boardPreview = new g.Sprite({
    scene, parent: board,
    src: preview.src,
    srcX: preview.srcX,
    srcY: preview.srcY,
    width: preview.width, height: preview.height,
    opacity: 0.5,
  });
  board.append(boardPieceFrame);

  const pieceParent = new g.E({ scene, parent: camerable });

  return {
    camerable,
    pieceLimitArea,

    board,
    boardPreview,
    boardPieceFrame,

    pieceParent,

    toggleBoardPreview: (value) => toggleVisibleTo(boardPreview, value),
    toggleBordPieceFrame: (value) => toggleVisibleTo(boardPieceFrame, value),
  };
}
