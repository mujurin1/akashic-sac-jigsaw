import { CommonOffset } from "akashic-sac";
import { CustomSprite } from "../../util/CustomSprite";

export interface Piece extends CustomSprite { tag: PieceTag; }

export interface PieceTag {
  type: "piece";
  index: number;
  fited: boolean;
  /** 自分以外のプレイヤーが持っているときだけフィールドが存在する */
  holdPlayerId?: string;
}

export const Piece = {
  _pieceParent: null! as g.E,
  opacity: { default: 1, holded: 0.4 },
  // touchableAll: true,
  getFromGlobalPoint(point: CommonOffset): Piece | undefined {
    // https://github.com/akashic-games/akashic-engine/blob/dafc3e60341722db9584231fc326852090808c1c/src/entities/E.ts#L626
    // MEMO: _pieceParen.parent が Scene でない場合はその親を遡って m を計算する必要がある
    const matrix = Piece._pieceParent.getMatrix();

    // for (const piece of pieces) {
    for (const piece of Piece._pieceParent.children!) {
      const p = matrix
        .multiplyNew(piece.getMatrix())
        .multiplyInverseForPoint(point);
      // 逆行列をポイントにかけた結果がEにヒットしているかを計算
      if (0 <= p.x && piece.width > p.x && 0 <= p.y && piece.height > p.y) {
        if (Piece.isPiece(piece)) return piece;
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
  fit(piece: Piece) {
    piece.tag.fited = true;
    delete piece.tag.holdPlayerId;

    // TODO: piece.moveTo fit position
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
