import { sumPos } from "../../common/func";
import { calcAnswerXY, calcIndexXY, Dir, Dirs } from "../../share/GameState";
import { ConnectPiece, FitPiece } from "../PlayingEvent";
import { ServerPieceState, ServerPlayingState } from "./ServerState";

/**
 * ピースが盤面にハマる/くっつくかをチェックしその後処理を行う
 * @param pieceIndex 必ず親を持たないピース
 * @returns ハマったまたはくっついた
 */
type CheckAndDoFitAndConnect = (pieceIndex: number) => boolean;

export function createCheckAndDoFitAndConnect(
  state: ServerPlayingState,
): CheckAndDoFitAndConnect {
  const { gameState, server } = state;

  const connectMargin = (gameState.pieceSize.width + gameState.pieceSize.height) / 8;
  const fitMargin = (gameState.pieceSize.width + gameState.pieceSize.height) / 6;
  const dirOffset = {
    top: { x: 0, y: -gameState.pieceSize.height },
    bottom: { x: 0, y: gameState.pieceSize.height },
    left: { x: -gameState.pieceSize.width, y: 0 },
    right: { x: gameState.pieceSize.width, y: 0 },
  } as const;

  return checkAndDoFitAndConnect;

  /**
   * ピースが盤面にハマる/くっつくかをチェックしその後処理を行う
   * @param pieceIndex 必ず親を持たないピース
   * @returns ハマったまたはくっついた
   */
  function checkAndDoFitAndConnect(pieceIndex: number): boolean {
    const piece = state.pieces[pieceIndex];

    // ピースがくっつくかチェックする
    const pair = checkConnectPieceAll(piece);
    if (pair != null) {
      const [parent, child] = toParentChild(piece, pair);
      normalizeConnectPieceAll(parent, child);

      server.broadcast(new ConnectPiece(parent.index, child.index), piece.holderId);
      return true;
    }

    // ピースがハマるかチェックする
    if (checkFitPiece(piece)) {
      piece.fitted = true;
      server.broadcast(new FitPiece(piece.index), piece.holderId);
      return true;
    }

    return false;
  }

  /**
   * ピースがハマるかチェックする
   * @param piece 必ず親を持たないピース
   */
  function checkFitPiece(piece: ServerPieceState): boolean {
    piece = piece.parentId == null ? piece : state.pieces[piece.parentId];

    const pos = calcAnswerXY(piece.index, gameState);
    const x = piece.pos.x - pos.x;
    const y = piece.pos.y - pos.y;

    return (
      -fitMargin <= x && x <= fitMargin &&
      -fitMargin <= y && y <= fitMargin
    );
  }


  /**
   * ピースがくっつくか子供までチェックする
   * @returns くっつく相手ピース. 現時点で親を持たないピース
   */
  function checkConnectPieceAll(piece: ServerPieceState): ServerPieceState | undefined {
    const pair = checkConnectPiece(piece);
    if (pair != null) return pair;

    if (piece.children != null) {
      for (const child of piece.children) {
        const pair = checkConnectPiece(child);
        if (pair != null) return pair;
      }
    }

    return undefined;
  }
  /**
   * ピースがくっつくかチェックする\
   * 直接くっつく相手が親を持つ場合、その親ピースを返す
   * @param piece 必ず親を持たないピース
   * @returns くっつく相手ピース. 必ず親を持たないピース
   */
  function checkConnectPiece(piece: ServerPieceState): ServerPieceState | undefined {
    const pairs = calcConnectPieceIndexes(piece);

    for (const dir of Dirs) {
      const pairIndex = pairs[dir];
      if (pairIndex == null) continue;
      const pair = state.pieces[pairIndex];

      if (
        pair.fitted || // 既にハマっている (除外済み)
        pair.holderId != null || // 誰かに持たれている (除外済み)
        // 親子関係にある
        pair.parentId === piece.index || pair.index === piece.parentId ||
        // 同じ親の子
        pair.parentId != null && pair.parentId === piece.parentId
      ) continue;
      if (checkConnect(piece, pair, dir)) {
        if (pair.parentId == null) return pair;
        return state.pieces[pair.parentId];
      }
    }

    return undefined;
  }


  /**
   * 2つのピースが許容範囲内で接続されるかチェックする
   * @param dir Aから見たBの方向
   * @returns 
   */
  function checkConnect(pieceA: ServerPieceState, pieceB: ServerPieceState, dir: Dir): boolean {
    const posA = sumPos(calcGroundPos(pieceA), dirOffset[dir]);
    const posB = calcGroundPos(pieceB);
    const x = posA.x - posB.x;
    const y = posA.y - posB.y;

    return (
      -connectMargin <= x && x <= connectMargin &&
      -connectMargin <= y && y <= connectMargin
    );
  }

  /**
   * ピースの親子関係を正規化する
   * @param parent 親にするピース. 必ず親を持たないピースであるべき
   * @param child 子にするピース. 必ず親を持たないピースであるべき
   */
  function normalizeConnectPieceAll(parent: ServerPieceState, child: ServerPieceState): void {
    if (parent.children == null) parent.children = [];
    const children = child.children;
    normalizeConnectPiece(parent, child);

    if (children != null) {
      for (const childPiece of children) {
        normalizeConnectPiece(parent, childPiece);
      }
    }
  }
  function normalizeConnectPiece(parent: ServerPieceState, child: ServerPieceState): void {
    parent.children!.push(child);
    child.parentId = parent.index;
    child.children = undefined;
    const pos = calcRelativePosAtoB(parent.index, child.index);
    child.pos = {
      x: pos.x * gameState.pieceSize.width,
      y: pos.y * gameState.pieceSize.height,
    };
  }

  /**
   * ピースの座標を親子関係を考慮して計算する
   */
  function calcGroundPos(piece: ServerPieceState): g.CommonOffset {
    if (piece.parentId == null) return piece.pos;

    const parent = state.pieces[piece.parentId];
    return {
      x: parent.pos.x + piece.pos.x,
      y: parent.pos.y + piece.pos.y,
    };
  }

  /**
   * ピースIDとくっつくピースのIDを取得する
   */
  function calcConnectPieceIndexes({ index }: ServerPieceState): Record<Dir, number | undefined> {
    const { width, height } = gameState.pieceWH;
    const row = Math.floor(index / width);
    const col = index % width;
    const record: Record<Dir, number | undefined> = {
      top: undefined,
      right: undefined,
      bottom: undefined,
      left: undefined,
    };

    // 上段
    if (row === 0) record.bottom = index + width;
    else {
      record.top = index - width;
      // 下端以外
      if (row < height - 1) record.bottom = index + width;
    }

    // 左端
    if (col === 0) record.right = index + 1;
    else {
      record.left = index - 1;
      // 右端以外
      if (col < width - 1) record.right = index + 1;
    }

    return record;
  }

  /**
   * 2つのピースを番号が[小さい、大きい]で並べて、a-bが反対の場合にdirを反対にして返す
   */
  function toParentChild(a: ServerPieceState, b: ServerPieceState): [ServerPieceState, ServerPieceState] {
    if (a.index < b.index) return [a, b];
    return [b, a];
  }

  /**
   * 2つのピースIDからマス目上の距離を計算する
   */
  function calcRelativePosAtoB(a: number, b: number): g.CommonOffset {
    const coordA = calcIndexXY(a, gameState);
    const coordB = calcIndexXY(b, gameState);

    return {
      x: coordB.x - coordA.x,
      y: coordB.y - coordA.y,
    };
  }
}
