import { SacEvent } from "akashic-sac";
import { GameStart } from "../../event/TitleEvent";

/**
 * プレビューサイズ基準でのピースを動かせる領域のサイズ\
 * TODO: 実際には縦横比をある程度平均化したほうが良い
 */
export const MOVE_PIACE_AREA_SIZE = 4;
export const PREVIEW_ADJUST = (MOVE_PIACE_AREA_SIZE - 3) / 2;

/**
 * ピースを並べる\
 * この関数はクライアントとサーバーで共有している
 * @param seed 
 * @param pieceCount 
 * @param pieceSize 
 * @param boardSize 
 * @returns 
 */
export function lineupPiece(
  seed: number,
  pieceCount: number,
  pieceSize: g.CommonSize,
  boardSize: g.CommonSize,
): g.CommonOffset[] {
  // 0.3 はピース枠の凸のサイズが0.25なので重ならないようにするマージン分
  const margine = { w: pieceSize.width * 0.3, h: pieceSize.height * 0.3 };
  const size = { w: pieceSize.width + margine.w * 2, h: pieceSize.height + margine.h * 2 };
  const pieceDivide = { w: boardSize.width / size.w, h: boardSize.height / size.h };
  const pieceCnt = { w: Math.floor(pieceDivide.w), h: Math.floor(pieceDivide.h) };

  const lineup = { w: pieceCnt.w + 2, h: pieceCnt.h + 2 };
  const nextPos = {
    x: (boardSize.width * PREVIEW_ADJUST) + boardSize.width - size.w * ((1 - (pieceDivide.w - pieceCnt.w)) / 2) + margine.w,
    y: (boardSize.height * PREVIEW_ADJUST) + boardSize.height - size.h * ((1 - (pieceDivide.h - pieceCnt.h)) / 2) + margine.h - size.h,
  };
  let dir: "right" | "bottom" | "left" | "top" = "right";
  let count = { w: 0, h: 0 };

  const positions: g.CommonOffset[] = [];

  for (let i = 0; i < pieceCount; i++) {
    positions.push({ ...nextPos });

    if (dir === "right") {
      nextPos.x += size.w;
      count.w += 1;
      if (count.w === lineup.w - 1) {
        count.w += 1;
        dir = "bottom";
      }
    } else if (dir === "bottom") {
      nextPos.y += size.h;
      count.h += 1;
      if (count.h === lineup.h) dir = "left";
    } else if (dir === "left") {
      nextPos.x -= size.w;
      count.w -= 1;
      if (count.w === 0) dir = "top";
    } else {
      nextPos.y -= size.h;
      count.h -= 1;
      if (count.h === -1) {
        dir = "right";
        count = { w: 0, h: 0 };
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

  return positions;
}

export interface GameState extends Omit<GameStart, keyof SacEvent> {
  /** ピースがハマるボード */
  board: g.CommonArea;
  /** ピースが移動可能なエリアの制限 */
  movePieceArea: g.CommonOffset;
}

export function createGameState(gameStart: GameStart): GameState {
  const boardSize = {
    width: gameStart.pieceSize.width * gameStart.pieceWH.width,
    height: gameStart.pieceSize.height * gameStart.pieceWH.height,
  };
  return {
    ...gameStart,
    board: {
      x: boardSize.width * (1 + PREVIEW_ADJUST),
      y: boardSize.height * (1 + PREVIEW_ADJUST),
      ...boardSize,
    },
    movePieceArea: {
      x: boardSize.width * MOVE_PIACE_AREA_SIZE,
      y: boardSize.height * MOVE_PIACE_AREA_SIZE,
    }
  };
}

/**
 * ピースの正解座標を計算する\
 * プレイエリア全体からの座標
 */
export function calcAnswerXY(index: number, gameState: GameState): g.CommonOffset {
  const pos = calcIndexXY(index, gameState);
  return {
    x: gameState.board.x + gameState.pieceSize.width * pos.x,
    y: gameState.board.y + gameState.pieceSize.height * pos.y,
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
