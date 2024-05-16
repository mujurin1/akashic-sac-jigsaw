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
  opacity: { default: 1, holded: 0.4 },
  hold(piece: Piece, playerId: string) {
    piece.tag.holdPlayerId = playerId;
    piece.opacity = Piece.opacity.holded;
    piece.touchable = false;
    piece.modified();
  },
  release(piece: Piece) {
    delete piece.tag.holdPlayerId;
    piece.opacity = Piece.opacity.default;
    piece.touchable = true;
    piece.modified();
  },
  fit(piece: Piece) {
    piece.tag.fited = true;
    delete piece.tag.holdPlayerId;
    piece.touchable = false;

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
} as const;
