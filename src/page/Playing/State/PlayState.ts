import { HoldPiece, MovePiece, ReleasePiece } from "../../../event/PlayingEvent";
import { GameState } from "../../../share/GameState";
import { createPieces, CreatePiecesResult } from "../../../util/createPieces";
import { PreviewInfo } from "../../../util/readAssets";
import { Piece } from "../Piece";
import { ClientPlaying } from "./ClientPlaying";

export interface PlayState {
  /**
   * 元画像の左上位置のピースから順にインデックス付けられている\
   * この順序を変えてはならない
   */
  readonly pieces: Piece[];

  /** 自分が掴んでいるピースの情報 */
  readonly holdState: Readonly<HoldState> | undefined;
  readonly totalScore: number;
  readonly finishTime: number | undefined;


  // TODO: これらは後で場所を動かすかも
  readonly gameState: GameState;
  readonly piecesResult: CreatePiecesResult;


  /**
   * 指定座標に存在するピースを持つ
   * @returns ピースを持つことが出来たか
   */
  hold(x: number, y: number): boolean;
  /**
   * ピースを絶対値で動かす
   * @param x 絶対移動量
   * @param y 絶対移動量
   * @returns ピースを動かす事が出来たか
   */
  move(x: number, y: number): boolean;
  /**
   * ピースを放す\
   * x,yを指定しない場合は今のピースの座標で離す
   * @param x 絶対移動量
   * @param y 絶対移動量
   * @returns ピースを放したか (持っている状態から持っていない状態に遷移したか)
   */
  release(x: number, y: number): boolean;
  release(): boolean;
  /**
   * 持っているピースがくっつく/ハマるかを判定する (離さない)\
   * TODO: 判定が`true`ならくっつけるのか?
   */
  checkFit: () => void;

  /**
   * 拡大縮小 相対指定
   * @param per 拡大縮小率
   * @param options オプション
   */
  scale: (per: number, options?: ScaleOptions) => void;
}

interface HoldState {
  piece: Piece;
  /** ピースを掴んだときのピース座標との誤差 (ピースエリア座標) */
  offset: g.CommonOffset;
}

export async function createPlayState(
  clientPlaying: ClientPlaying,
  gameState: GameState,
  previewInfo: PreviewInfo,
): Promise<PlayState> {
  const piecesResult = await createPieces(
    clientPlaying.client.env.scene,
    gameState,
    previewInfo.imageAsset,
  );

  let holdState: HoldState | undefined = undefined;
  let totalScore = 0;
  let finishTime: number | undefined = undefined;

  // 内部状態用
  const sendMoveCount = 5;
  let sendMoveCounter = 0;


  return {
    pieces: piecesResult.pieces,
    get holdState() { return holdState; },
    get totalScore() { return totalScore; },
    get finishTime() { return finishTime; },

    // TODO: これらは後で場所を動かすかも
    gameState, piecesResult,

    hold,
    move,
    release,
    checkFit,
    scale,
  };


  function hold(x: number, y: number): boolean {
    holdState = clientPlaying.getPieceFromScreenPx(x, y, true);
    if (holdState == null) return false;

    sendMoveCounter = 0;
    const piece = holdState.piece;
    piece.parent.append(piece);
    clientPlaying.client.sendEvent(new HoldPiece(piece.tag.index));
    return true;
  }

  function move(x: number, y: number): boolean {
    if (holdState == null || !Piece.canHold(holdState.piece)) {
      holdState = undefined;
      return false;
    }
    const _point = clientPlaying.toPieceArea(x, y);
    const point = { x: _point.x + holdState.offset.x, y: _point.y + holdState.offset.y };
    holdState.piece.moveTo(point.x, point.y);
    holdState.piece.modified();

    if (++sendMoveCounter > sendMoveCount) {
      sendMoveCounter = 0;
      clientPlaying.client.sendEvent(new MovePiece(holdState.piece.tag.index, point));
    }
    return true;
  }

  function release(x?: number, y?: number): boolean {
    if (holdState == null || !Piece.canHold(holdState.piece)) {
      holdState = undefined;
      return false;
    }

    let point: g.CommonOffset;
    if (x == null || y == null) {
      point = { x: holdState.piece.x, y: holdState.piece.y };
    } else {
      const _point = clientPlaying.toPieceArea(x, y);
      point = { x: _point.x + holdState.offset.x, y: _point.y + holdState.offset.y };
      holdState.piece.moveTo(point.x, point.y);
      holdState.piece.modified();
    }
    clientPlaying.client.sendEvent(new ReleasePiece(holdState.piece.tag.index, point));

    holdState = undefined;
    return true;
  }

  function checkFit() {
    // ピースを離さずにハマるかチェックし、ハマるならハメる
  }

  function scale(_per: number, options?: ScaleOptions) {
    const { camerable } = clientPlaying.uiGroups.piece;
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
  pos: { x: number; y: number; };
}
