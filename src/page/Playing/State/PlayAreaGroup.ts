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

  /**
   * ボード上の完成画像の表示/非表示を切り替える
   * @param visibleTo `true`: 表示, `false`: 非表示, `undefined`: トグル
   */
  toggleBoardPreview(visibleTo?: boolean): void;
  /**
   * ボード上のピース枠線の表示/非表示を切り替える
   * @param visibleTo `true`: 表示, `false`: 非表示, `undefined`: トグル
   */
  toggleBoardPieceFrame(visibleTo?: boolean): void;

  /**
   * カメラのスケールを変更する
   * @param per 拡大縮小率
   * @param options.isAbsolute 絶対値指定なら`true` (default: `false`)
   * @param options.pos 拡大/縮小の中心座標 (画面上の座標) (default: 画面中央)
   */
  scaleCamera(per: number, options?: ScaleOptions): void;
  /**
   * カメラを相対的に動かす
   * @param dx X方向の移動量
   * @param dy Y方向の移動量
   * @param ignoreScale 移動量をカメラのスケールに影響されない絶対値として扱うなら`true` (default: `false`)
   */
  moveByCamera(dx: number, dy: number, ignoreScale?: boolean): void;
  /**
   * カメラを初期位置にリセットする
   */
  resetCamera(): void;
}

export function createPieceGroup(clientPlaying: ClientPlaying): PieceGroup {
  const scene = g.game.env.scene;
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
    toggleBoardPieceFrame: (value) => toggleVisibleTo(boardPieceFrame, value),

    scaleCamera,
    moveByCamera,
    resetCamera,
  };


  function scaleCamera(_per: number, options?: ScaleOptions) {
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

  function moveByCamera(dx: number, dy: number, ignoreScale = false) {
    const x = ignoreScale ? dx : dx * camerable.scaleX;
    const y = ignoreScale ? dy : dy * camerable.scaleY;
    camerable.moveBy(x, y);
    camerable.modified();
  }

  function resetCamera() {
    // ボードの中央が画面中央に来るように移動
    camerable.moveTo(
      board.x + ((board.width - g.game.width) / 2),
      board.y + ((board.height - g.game.height) / 2),
    );

    // ボード全体が画面に収まるように拡大縮小
    scaleCamera(((board.width + board.height) * 2.5) / (g.game.width + g.game.height), { isAbsolute: true });

    // 画面右上の Info パネルを避けて、大体中央になるように移動
    // > 0.257 = 「右上の Info パネル」が画面の横幅に占める割合 (横幅)
    moveByCamera((g.game.width * 0.257 / 2), 0);
  }
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
  pos?: { x: number; y: number; };
}
