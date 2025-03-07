import { GameStart } from "../../event/TitleEvent";
import { CustomSprite } from "../../util/CustomSprite";
import { calcAnswerXY } from "./pieceUtil";
import { PlayingState } from "./Playing";

export interface Piece extends CustomSprite {
  tag: PieceTag;
  children: Piece[] | undefined;
  parent: g.E;
}

export interface PieceTag {
  type: "piece";
  index: number;
  fitted: boolean;
  parent?: Piece;
  holdPlayerId?: string;
}

export const Piece = {
  _state: null! as PlayingState,
  _pieceParent: null! as g.E,

  /**
   * プレイ画面座標からその座標のピースを取得する\
   * 子の場合は親ピースを返す
   * @param point プレイ画面上の座標軸
   * @returns 
   * @deprecated もう不要のはず
   */
  getFromGlobalPoint(point: g.CommonOffset): Piece | undefined {
    // https://github.com/akashic-games/akashic-engine/blob/dafc3e60341722db9584231fc326852090808c1c/src/entities/E.ts#L626
    // MEMO: _pieceParen.parent が Scene でない場合はその親を遡って matrix を計算する必要がある
    const matrix = Piece._pieceParent.getMatrix();

    // for (const piece of Piece._pieceParent.children!) {
    for (let pieceId = Piece._pieceParent.children!.length - 1; pieceId >= 0; pieceId--) {
      const piece = Piece._pieceParent.children![pieceId];
      if (!Piece.isPiece(piece)) continue;

      const p = matrix
        .multiplyNew(piece.getMatrix())
        .multiplyInverseForPoint(point);
      // 逆行列をポイントにかけた結果がEにヒットしているかを計算
      if (0 <= p.x && piece.width > p.x && 0 <= p.y && piece.height > p.y)
        return piece;
      if (piece.children != null) {
        for (const childPiece of piece.children) {
          const newP = { x: p.x - childPiece.x, y: p.y - childPiece.y };
          if (0 <= newP.x && childPiece.width > newP.x && 0 <= newP.y && childPiece.height > newP.y) {
            return piece;
          }
        }
      }
    }

    return undefined;
  },
  getFromPoint(x: number, y: number, canHold = false): Piece | undefined {
    for (let pieceId = Piece._pieceParent.children!.length - 1; pieceId >= 0; pieceId--) {
      const piece = Piece._pieceParent.children![pieceId];
      if (!Piece.isPiece(piece)) continue;
      if (canHold && !Piece.canHold(piece)) continue;

      const px = piece.x + piece.width;
      const py = piece.y + piece.height;
      if (
        piece.x <= x && x <= px &&
        piece.y <= y && y <= py
      ) return piece;
      if (piece.children == null) continue;

      for (const childPiece of piece.children) {
        if (canHold && !Piece.canHold(piece)) continue;
        const px = piece.x + childPiece.x + childPiece.width;
        const py = piece.y + childPiece.y + childPiece.height;
        if (
          piece.x + childPiece.x <= x && x <= px &&
          piece.y + childPiece.y <= y && y <= py
        ) return childPiece;
      }
    }
    return undefined;
  },
  /**
   * 親ピースがいる場合は親を、ない場合は自身を返す
   * @param piece `Piece`
   * @returns 親または`piece`
   */
  getParentOrSelf(piece: Piece | undefined): Piece | undefined {
    return piece?.tag.parent ?? piece;
  },
  /**
   * ピースの親要素に必要な設定を行う
   */
  pieceParentSetting(state: PlayingState) {
    Piece._state = state;
    Piece._pieceParent = Piece._state.playArea.pieceParent;
  },
  hold(piece: Piece, playerId: string) {
    shiftTop(piece);
    piece.tag.holdPlayerId = playerId;
    setOpacity(piece, false);
  },
  release(piece: Piece) {
    piece.tag.holdPlayerId = undefined;
    setOpacity(piece, true);
  },
  fit(piece: Piece) {
    piece.tag.fitted = true;
    delete piece.tag.holdPlayerId;

    const pos = calcAnswerXY(piece.tag.index, Piece._state.gameState);
    shiftBottom(piece);
    setOpacityPos(piece, true, pos);

  },
  connect(parent: Piece, child: Piece, gameStart: GameStart) {
    shiftTop(parent);
    Piece.release(parent);
    Piece.release(child);
    normalizeConnectPieceAll(parent, child, gameStart);
  },
  isPiece(piece: g.E): piece is Piece {
    return (<PieceTag | undefined>piece.tag)?.type === "piece";
  },
  canHold(piece: g.E): piece is Piece {
    return Piece.isPiece(piece) &&
      piece.tag.holdPlayerId == null &&
      !piece.tag.fitted;
  },
  setTag(e: g.E, index: number) {
    e.tag = {
      type: "piece",
      index,
      fitted: false,
    } satisfies PieceTag;
  },
};

function shiftTop(piece: Piece): void {
  if (Piece._state.holdState != null) {
    piece.parent.insertBefore(piece, Piece._state.holdState.piece);
  } else {
    piece.parent.append(piece);
  }
}
function shiftBottom(piece: Piece): void {
  piece.parent.insertBefore(piece, Piece._pieceParent.children![0]);
}

function setOpacity(piece: Piece, isDefault: boolean): void {
  piece.opacity = isDefault ? 1 : 0.4;
  piece.modified();
}
function setOpacityPos(piece: Piece, isDefault: boolean, pos: g.CommonOffset): void {
  piece.opacity = isDefault ? 1 : 0.4;
  piece.moveTo(pos.x, pos.y);
  piece.modified();
}

function normalizeConnectPieceAll(parent: Piece, child: Piece, gameStart: GameStart) {
  const children = child.children?.slice(0);
  normalizeConnectPiece(parent, child, gameStart);

  if (children != null) {
    for (const childPiece of children) {
      normalizeConnectPiece(parent, childPiece, gameStart);
    }
  }
}
function normalizeConnectPiece(parent: Piece, child: Piece, gameStart: GameStart): void {
  child.tag.parent = parent;
  const pos = calcRelativePosAtoB(parent.tag.index, child.tag.index, gameStart.pieceWH.width);
  child.x = pos.x * gameStart.pieceSize.width;
  child.y = pos.y * gameStart.pieceSize.height;
  child.modified();
  parent.append(child);
}

function calcRelativePosAtoB(a: number, b: number, width: number): g.CommonOffset {
  const coordA = calcIndexXY(a, width);
  const coordB = calcIndexXY(b, width);

  return {
    x: coordB.x - coordA.x,
    y: coordB.y - coordA.y,
  };
}

function calcIndexXY(index: number, width: number): { x: number, y: number; } {
  const x = index % width;
  const y = Math.floor(index / width);
  return { x, y };
}
