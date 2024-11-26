import { GameStart } from "../../event/TitleEvent";
import { CustomSprite } from "../../util/CustomSprite";

export interface Piece extends CustomSprite { tag: PieceTag; }

export interface PieceTag {
  type: "piece";
  index: number;
  fited: boolean;
  parent?: Piece;
  /** 自分以外のプレイヤーが持っているときだけフィールドが存在する */
  holdPlayerId?: string;
}

export const Piece = {
  _pieceParent: null! as g.E,
  opacity: { default: 1, holded: 0.4 },
  // touchableAll: true,
  /**
   * プレイ画面座標からその座標のピースを取得する\
   * 子の場合は親ピースを返す
   * @param point プレイ画面上の座標軸
   * @returns 
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
        for (const childPiece of piece.children as Piece[]) {
          const newP = { x: p.x - childPiece.x, y: p.y - childPiece.y };
          if (0 <= newP.x && childPiece.width > newP.x && 0 <= newP.y && childPiece.height > newP.y) {
            return piece;
          }
        }
      }
    }

    return undefined;
  },
  /** ピースの親要素に必要な設定を行う */
  pieceParentSetting(pieceParent: g.E) {
    Piece._pieceParent = pieceParent;
    // pieceParent.onPointMove.add
  },
  hold(piece: Piece, playerId: string) {
    piece.tag.holdPlayerId = playerId;
    piece.opacity = Piece.opacity.holded;
    piece.modified();
  },
  release(piece: Piece) {
    delete piece.tag.holdPlayerId;
    piece.opacity = Piece.opacity.default;
    piece.modified();
  },
  fit(piece: Piece, gameStart: GameStart) {
    piece.tag.fited = true;
    delete piece.tag.holdPlayerId;

    // TODO: piece.moveTo fit position
  },
  connect(parent: Piece, child: Piece, gameStart: GameStart) {
    Piece.release(parent);
    Piece.release(child);
    normalizeConnectPieceAll(parent, child, gameStart);
  },
  isPiece(piece?: g.E): piece is Piece {
    return (<Piece>piece)?.tag?.type === "piece";
  },
  canHold(piece?: g.E): piece is Piece {
    return Piece.isPiece(piece) &&
      piece.opacity === Piece.opacity.default &&
      !piece.tag.fited;
  },
  setTag(e: g.E, index: number) {
    e.tag = {
      type: "piece",
      index,
      fited: false,
    } satisfies PieceTag;
  },
};

function normalizeConnectPieceAll(parent: Piece, child: Piece, gameStart: GameStart) {
  const children = child.children?.slice(0);
  normalizeConnectPiece(parent, child, gameStart);

  if (children != null) {
    for (const childPiece of children as Piece[]) {
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
