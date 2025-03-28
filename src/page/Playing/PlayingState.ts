import { CamerableE, SacClient } from "akashic-sac";
import { Mutable } from "../../common/type";
import { ConnectPiece, FitPiece, ForceReleasePiece, HoldPiece, MovePiece, ReleasePiece } from "../../event/PlayingEvent";
import { GameStart } from "../../event/TitleEvent";
import { createPieces } from "../../util/createPieces";
import { createGameState, GameState } from "../../util/GameState";
import { PlayerManager } from "../../util/PlayerManager";
import { PreviewInfo } from "../../util/readAssets";
import { InputSystemControl, inputSystemControl } from "./InputSystem/InputSystem";
import { Piece } from "./Piece";
import { createUi, PlayingUi as PlayUi, setPartsEvent } from "./PlayingUi";

export const BACKGROUND_COLOR = (() => {
  const colors = [
    "#0087CC", "#A900CC", "#CC4300", "#22CC00",
    "#3D738E", "#813D8E", "#8E583D", "#4A8E3D", "transparent",
  ] as const;
  const next = Object.fromEntries(
    colors.map((c, i) => [c, colors[(i + 1) % colors.length]])
  );

  return {
    colors,
    next,
    /** 次の背景色を表示するアイコン用. 透明を半透明で可視化する */
    nextIconBg: { ...next, "#4A8E3D": "rgba(255, 255, 255, 0.5)" } as Record<string, string>,
    getNext: (color: string) => next[color] ?? colors[0],
  } as const;
})();

export interface ClientPlayingState {
  readonly client: SacClient;
  readonly gameState: GameState;

  /**
   * プレイ中の全エンティティの親
   */
  readonly display: g.E;
  readonly playUi: PlayUi;
  /**
   * 階層
   * ```
   * scene
   * |-bg
   * |-camerable
   *    |-pieceLimitArea
   *    |-board
   *    |  |-boardPreview
   *    |  |-boardPieceFrame
   *    |-pieceParent
   *       |-Pieces[]
   * ```
   */
  readonly playArea: {
    /** 常に画面に固定の背景 */
    readonly bg: g.FilledRect;
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
  };

  /**
   * 元画像の左上位置のピースから順にインデックス付けられている\
   * この順序を変えてはならない
   */
  readonly pieces: Piece[];

  readonly isJoined: () => boolean;

  /**
   * ゲームスクリーン座標をピースエリア座標に変換する
   */
  readonly toPieceArea: (x: number, y: number) => g.CommonOffset;

  /**
   * ゲームスクリーン座標を元にその場所に存在するピースを取得する  
   * `canHoldOnly:true`の場合は掴めないピースが上にあってもそれを取得します
   * @param x ゲームスクリーンX座標
   * @param y ゲームスクリーンY座標
   * @param canHoldOnly 対象をホールド可能なピースに限定するか @default false
   * @returns `[ピース, 引数(x,y)とピース座標のズレ(ピースエリア座標)]`
   */
  readonly getPieceFromScreenPx: (x: number, y: number, canHoldOnly?: boolean) => { piece: Piece, offset: g.CommonOffset; } | undefined;

  pieceOperatorControl: InputSystemControl;

  /** 自分が掴んでいるピースの情報 */
  holdState: {
    piece: Piece;
    /** ピースを掴んだときのピース座標との誤差 (ピースエリア座標) */
    offset: g.CommonOffset;
  } | undefined;
  /** 累計スコア */
  totalScore: number;
  /** ゲーム終了時刻 */
  finishTime: number | undefined;
}

export async function Playing(client: SacClient, gameStart: GameStart, previewsInfo: PreviewInfo[]) {
  const unlockEvent = client.lockEvent();
  const state = await createPlayingState(client, gameStart, previewsInfo);
  const playerManager = client.env.clientDI.get(PlayerManager);

  // TODO: client.removeEventSets(eventKeys);
  const eventKeys = [
    HoldPiece.receive(client, ({ pId, pieceIndex }) => {
      // ピースを他人が掴んだ
      if (pId == null || pId === g.game.selfId) return;

      const piece = state.pieces[pieceIndex];
      Piece.hold(piece, pId);

      if (pieceIndex === state.holdState?.piece.tag.index) {
        state.holdState = undefined;
      }
    }),
    MovePiece.receive(client, ({ pId, pieceIndex, point }) => {
      if (g.game.isSkipping) return;
      // ピースを他人が動かした
      if (pId == null || pId === g.game.selfId) return;

      const piece = state.pieces[pieceIndex];
      piece.moveTo(point.x, point.y);
      piece.modified();
    }),
    ReleasePiece.receive(client, ({ pieceIndex, point }) => {
      const piece = state.pieces[pieceIndex];
      Piece.release(piece);

      piece.moveTo(point.x, point.y);
      piece.modified();
    }),
    // 指定したピースを強制開放
    ForceReleasePiece.receive(client, ({ pieceIndex }) => {
      // if (state.holdState?.piece?.tag.index !== pieceIndex) return;

      // state.holdState = undefined;
      // state.pieceOperatorControl.current.forceRelease();

      const piece = state.pieces[pieceIndex];
      Piece.release(piece);
      state.pieceOperatorControl.current.forceRelease();
    }),
    FitPiece.receive(client, ({ pId, pieceIndex }) => {
      const piece = state.pieces[pieceIndex];
      Piece.fit(piece);
      updateScore(pId!);
    }),
    ConnectPiece.receive(client, ({ pId, parentIndex, childIndex }) => {
      const parent = state.pieces[parentIndex];
      const child = state.pieces[childIndex];
      Piece.connect(parent, child, gameStart);
      if (g.game.selfId === pId) parent.parent.append(parent);
      updateScore(pId!);
    }),
  ];

  // アンロックは一番最後
  unlockEvent();

  function updateScore(pId: string) {
    const player = playerManager.get(pId);
    if (player == null) return;
    state.totalScore += 1;
    player.score += 1;
    playerManager.updateScore();
    // console.log(playerManager.players.map(p => `R:${p.rank}  S:${p.score}  ${p.id}`));
  }
}


async function createPlayingState(
  client: SacClient,
  gameStart: GameStart,
  previewsInfo: PreviewInfo[],
): Promise<ClientPlayingState> {
  const { scene, clientDI } = client.env;
  const playerManager = clientDI.get(PlayerManager);
  const gameState = createGameState(gameStart);

  const piecesResult = await createPieces(
    scene,
    gameState,
    previewsInfo[gameState.puzzleIndex].imageAsset,
  );
  const { preview } = piecesResult;

  const display = new g.E({ scene, parent: scene });

  //#region Entity の作成
  const bg = new g.FilledRect({
    scene, parent: display,
    cssColor: BACKGROUND_COLOR.colors[0],
    width: g.game.width, height: g.game.height,
    touchable: true,
  });

  const playAreaCamera = new CamerableE({ scene, parent: display });
  const pieceLimitArea = new g.FilledRect({
    scene, parent: playAreaCamera,
    cssColor: "#883f5f",
    width: gameState.movePieceArea.width,
    height: gameState.movePieceArea.height,
  });

  const board = new g.FilledRect({
    scene, parent: playAreaCamera,
    cssColor: "#ffffff50",
    width: preview.width, height: preview.height,
    x: gameState.board.x,
    y: gameState.board.y,
  });
  const boardPreview = new g.Sprite({
    scene, parent: board,
    src: preview.src,
    srcX: preview.srcX,
    srcY: preview.srcY,
    width: preview.width, height: preview.height,
    opacity: 0.5,
  });
  const boardPieceFrame = piecesResult.frame;
  board.append(boardPieceFrame);
  const pieceParent = new g.E({ scene, parent: playAreaCamera });
  //#endregion Entity の作成

  // ピースを配置
  for (let i = 0; i < piecesResult.pieces.length; i++) {
    const piece = piecesResult.pieces[i];
    const position = gameState.piecePositions[i];
    pieceParent.append(piece);
    piece.moveTo(position.x, position.y);
    piece.modified();
  }

  const CAMERABLE_W_HALF = playAreaCamera.width / 2;
  const CAMERABLE_H_HALF = playAreaCamera.height / 2;

  const state: ClientPlayingState = {
    pieces: piecesResult.pieces,
    client,
    gameState,
    display,
    playArea: {
      bg,
      camerable: playAreaCamera,
      pieceLimitArea,
      board,
      boardPreview,
      boardPieceFrame,
      pieceParent,
    },
    playUi: null!,

    isJoined: () => playerManager.has(g.game.selfId),
    toPieceArea: (x, y) => ({
      x: playAreaCamera.x + playAreaCamera.scaleX * (x - CAMERABLE_W_HALF),
      y: playAreaCamera.y + playAreaCamera.scaleY * (y - CAMERABLE_H_HALF),
    }),
    getPieceFromScreenPx: (x, y, canHold = false) => {
      if (!state.isJoined()) return;

      const playAreaX = playAreaCamera.x + playAreaCamera.scaleX * (x - CAMERABLE_W_HALF);
      const playAreaY = playAreaCamera.y + playAreaCamera.scaleY * (y - CAMERABLE_H_HALF);
      const piece = Piece.getParentOrSelf(Piece.getFromPoint(playAreaX, playAreaY, canHold));
      if (piece == null) return;

      return {
        piece,
        offset: { x: piece.x - playAreaX, y: piece.y - playAreaY },
      };
    },

    pieceOperatorControl: null!,
    holdState: undefined,

    totalScore: 0,
    finishTime: undefined,
  };

  (<Mutable<ClientPlayingState>>state).playUi = createUi(state);
  setPartsEvent(state);

  Piece.pieceParentSetting(state);
  state.pieceOperatorControl = inputSystemControl(state);

  return state;
}
