import { SacEvent } from "akashic-sac";
import { GameStart } from "../event/TitleEvent";

/**
 * プレビューサイズ基準でのピースを動かせる領域のサイズ\
 * TODO: 実際には縦横比をある程度平均化したほうが良い
 */
const MOVE_PIECE_AREA_SIZE = 4;
/**
 * ピースを並べる時の大きさに対するマージン比\
 * ピースの凸が0.25なので余裕を持って0.3
 */
const PIECE_MARGIN_PER = 0.3;

/**
 * サーバーとクライアントで共通なゲームの状態
 */
export interface GameState extends Omit<GameStart, keyof SacEvent> {
  /** ピースがハマるボード */
  readonly boardArea: g.CommonArea;
  /** ピースが移動可能なエリアの制限 */
  readonly pieceAreaLimit: g.CommonSize;
  readonly piecePositions: g.CommonOffset[];
}

export function createGameState(gameStart: GameStart): GameState {
  const boardSize = {
    width: gameStart.pieceSize.width * gameStart.pieceWH.width,
    height: gameStart.pieceSize.height * gameStart.pieceWH.height,
  };
  const [piecePositions, lineup] = lineupPiece(
    gameStart.seed,
    gameStart.pieceWH.width * gameStart.pieceWH.height,
    gameStart.pieceSize,
    boardSize,
  );
  // TODO: lineup 変数を使って適切なボードサイズを計算する
  const movePieceArea: g.CommonSize = {
    width: boardSize.width * MOVE_PIECE_AREA_SIZE,
    height: boardSize.height * MOVE_PIECE_AREA_SIZE,
  };
  return {
    ...gameStart,
    boardArea: {
      ...boardSize,
      // ピースの移動可能な領域は 
      x: (movePieceArea.width - boardSize.width) / 2,
      y: (movePieceArea.height - boardSize.height) / 2,
    },
    pieceAreaLimit: movePieceArea,
    piecePositions,
  };
}

/**
 * ピースを並べる
 * @param seed 
 * @param pieceCount 
 * @param pieceSize 
 * @param boardSize 
 * @returns [ ピース座標の配列, ピースの行列数 ]
 */
function lineupPiece(
  seed: number,
  pieceCount: number,
  pieceSize: g.CommonSize,
  boardSize: g.CommonSize,
): readonly [piecePositions: g.CommonOffset[], lineup: g.CommonSize] {
  // ピースのマージンpx
  const pieceMargin = { w: pieceSize.width * PIECE_MARGIN_PER, h: pieceSize.height * PIECE_MARGIN_PER };
  // ピース１つが使う領域px
  const pieceArea = { w: pieceSize.width + pieceMargin.w * 2, h: pieceSize.height + pieceMargin.h * 2 };
  const pieceDivide = { w: Math.ceil(boardSize.width / pieceArea.w), h: Math.ceil(boardSize.height / pieceArea.h) };

  const lineup = { w: pieceDivide.w + 1, h: pieceDivide.h + 1 };
  const nextPos = {
    x: boardSize.width * 2 - (pieceArea.w * (pieceDivide.w) / 2) + pieceMargin.w,
    y: boardSize.height * 2 - (pieceArea.h * (pieceDivide.h + 2) / 2) + pieceMargin.h,
  };

  let dir: "right" | "bottom" | "left" | "top" = "right";
  let count = { w: 0, h: 0 };

  const positions: g.CommonOffset[] = [];

  for (let i = 0; i < pieceCount; i++) {
    positions.push({ ...nextPos });

    if (dir === "right") {
      nextPos.x += pieceArea.w;
      count.w += 1;
      if (count.w === lineup.w - 1) {
        count.w += 1;
        dir = "bottom";
      }
    } else if (dir === "bottom") {
      nextPos.y += pieceArea.h;
      count.h += 1;
      if (count.h === lineup.h) dir = "left";
    } else if (dir === "left") {
      nextPos.x -= pieceArea.w;
      count.w -= 1;
      if (count.w === 0) dir = "top";
    } else {
      nextPos.y -= pieceArea.h;
      count.h -= 1;
      if (count.h === -1) {
        dir = "right";
        count.w = 0; count.h = 0;
        if (i >= pieceCount) break;
        lineup.w += 2;
        lineup.h += 2;
      }
    }
  }

  // ピースのランダム整列
  // const random = new g.Xorshift(seed);
  // for (let i = positions.length - 1; i > 0; i--) {
  //   const j = Math.floor(random.random() * (i + 1));
  //   [positions[i], positions[j]] = [positions[j], positions[i]];
  // }

  return [positions, { width: lineup.w, height: lineup.h }];
}

export type Dir = "top" | "left" | "right" | "bottom";
export const Dirs = ["top", "left", "right", "bottom"] as const;
export const DirR = {
  top: "bottom",
  bottom: "top",
  left: "right",
  right: "left",
} as const satisfies Record<Dir, Dir>;

/**
 * ピースの正解座標を計算する\
 * プレイエリア全体からの座標
 */
export function calcAnswerXY(index: number, gameState: GameState): g.CommonOffset {
  const pos = calcIndexXY(index, gameState);
  return {
    x: gameState.boardArea.x + gameState.pieceSize.width * pos.x,
    y: gameState.boardArea.y + gameState.pieceSize.height * pos.y,
  };
}

/**
 * インデックスからマス目上の位置を計算する
 */
export function calcIndexXY(index: number, gameState: GameState): g.CommonOffset {
  const x = index % gameState.pieceWH.width;
  const y = Math.floor(index / gameState.pieceWH.width);
  return { x, y };
}
