import { SacClient } from "akashic-sac";
import { ConnectPiece, FitPiece, ForceReleasePiece, HoldPiece, MovePiece, ReleasePiece } from "../../../event/PlayingEvent";
import { GameStart } from "../../../event/TitleEvent";
import { createGameState } from "../../../share/GameState";
import { PlayerManager } from "../../../util/PlayerManager";
import { PreviewInfo } from "../../../util/readAssets";
import { inputSystemControl, InputSystemControl } from "../InputSystem/InputSystem";
import { Piece } from "../Piece";
import { BgGroup, createBgGroup } from "./BgGroup";
import { createInfoGroup, InfoGroup } from "./InfoGroup";
import { createPieceGroup, PieceGroup } from "./PieceGroup";
import { createPlayState, PlayState } from "./PlayState";

export interface ClientPlaying {
  readonly client: SacClient;
  readonly playState: PlayState;

  /** 画面に表示される全てのエンティティの親/祖先 */
  readonly display: g.E;

  readonly uiGroups: {
    readonly bg: BgGroup;
    readonly piece: PieceGroup;

    // プレイヤーに情報を表示する/操作する要素
    readonly info: InfoGroup;
    readonly inputSystem: InputSystemControl;

    // 普段は非表示の要素
    readonly ranking: any;
    readonly preview: any;
    readonly option: any;
  };


  isJoined(): boolean;

  /**
   * ゲームスクリーン座標をピースエリア座標に変換する
   */
  toPieceArea(x: number, y: number): g.CommonOffset;

  /**
   * ゲームスクリーン座標を元にその場所に存在するピースを取得する  
   * `canHoldOnly:true`の場合は掴めないピースが上にあってもそれを取得します
   * @param x ゲームスクリーンX座標
   * @param y ゲームスクリーンY座標
   * @param canHoldOnly 対象をホールド可能なピースに限定するか @default false
   * @returns `[ピース, 引数(x,y)とピース座標のズレ(ピースエリア座標)]`
   */
  getPieceFromScreenPx(x: number, y: number, canHoldOnly?: boolean): { piece: Piece, offset: g.CommonOffset; } | undefined;


}

export async function createClientPlaying(
  client: SacClient,
  gameStart: GameStart,
  previewInfo: PreviewInfo,
): Promise<ClientPlaying> {
  const { scene, clientDI } = client.env;
  const playerManager = clientDI.get(PlayerManager);

  const display = new g.E({ scene, parent: scene });
  const clientPlaying: ClientPlaying = {
    client,
    get playState() { return playState; },
    display,
    uiGroups: {
      get bg() { return bgGroup; },
      get piece() { return pieceGroup; },

      // プレイヤーに情報を表示する/操作する要素
      get info() { return infoGroup; },
      get inputSystem() { return inputSystem; },

      // 普段は非表示の要素
      get ranking() { return rankingGroup; },
      get preview() { return preview; },
      get option() { return optionGroup; },
    },

    isJoined,
    toPieceArea,
    getPieceFromScreenPx,
  };

  const playState = await createPlayState(
    clientPlaying,
    createGameState(gameStart),
    previewInfo
  );

  const bgGroup = createBgGroup(clientPlaying);
  const pieceGroup = createPieceGroup(clientPlaying);

  const infoGroup = createInfoGroup(clientPlaying);
  const inputSystem = inputSystemControl(clientPlaying);

  const rankingGroup = null;
  const preview = null;
  const optionGroup = null;

  // ピースの初期化
  Piece.pieceParentSetting(clientPlaying);
  for (let i = 0; i < clientPlaying.playState.piecesResult.pieces.length; i++) {
    const piece = clientPlaying.playState.piecesResult.pieces[i];
    const position = clientPlaying.playState.gameState.piecePositions[i];
    clientPlaying.uiGroups.piece.pieceParent.append(piece);
    piece.moveTo(position.x, position.y);
    piece.modified();
  }

  // TODO: client.removeEventSets(eventKeys);
  setEvents(clientPlaying);


  return clientPlaying;


  //#region 純粋関数
  function isJoined() {
    return playerManager.has(g.game.selfId);
  }

  function toPieceArea(x: number, y: number) {
    return {
      x: pieceGroup.camerable.x + pieceGroup.camerable.scaleX * x,
      y: pieceGroup.camerable.y + pieceGroup.camerable.scaleY * y,
    };
  }

  function getPieceFromScreenPx(x: number, y: number, canHold = false) {
    if (!isJoined()) return;

    const playAreaX = pieceGroup.camerable.x + pieceGroup.camerable.scaleX * x;
    const playAreaY = pieceGroup.camerable.y + pieceGroup.camerable.scaleY * y;
    const piece = Piece.getParentOrSelf(Piece.getFromPoint(playAreaX, playAreaY, canHold));
    if (piece == null) return;

    return {
      piece,
      offset: { x: piece.x - playAreaX, y: piece.y - playAreaY },
    };
  }
  //#endregion 純粋関数
}

function setEvents(clientPlaying: ClientPlaying) {
  const client = clientPlaying.client;

  const pieces = clientPlaying.playState.piecesResult.pieces;

  return [
    HoldPiece.receive(client, ({ pId, pieceIndex }) => {
      // ピースを他人が掴んだ
      if (pId == null || pId === g.game.selfId) return;

      const piece = pieces[pieceIndex];
      Piece.hold(piece, pId);

      if (pieceIndex === clientPlaying.playState.holdState?.piece.tag.index) {
        clientPlaying.playState.holdState = undefined;
      }
    }),
    MovePiece.receive(client, ({ pId, pieceIndex, point }) => {
      if (g.game.isSkipping) return;
      // ピースを他人が動かした
      if (pId == null || pId === g.game.selfId) return;

      const piece = pieces[pieceIndex];
      piece.moveTo(point.x, point.y);
      piece.modified();
    }),
    ReleasePiece.receive(client, ({ pieceIndex, point }) => {
      const piece = pieces[pieceIndex];
      Piece.release(piece);

      piece.moveTo(point.x, point.y);
      piece.modified();
    }),
    // 指定したピースを強制開放
    ForceReleasePiece.receive(client, ({ pieceIndex }) => {
      // if (clientPlaying.playState?.piece?.tag.index !== pieceIndex) return;

      // clientPlaying.playState = undefined;
      // state.pieceOperatorControl.current.forceRelease();

      const piece = pieces[pieceIndex];
      Piece.release(piece);
      clientPlaying.uiGroups.inputSystem.current.forceRelease();
    }),
    FitPiece.receive(client, ({ pId, pieceIndex }) => {
      const piece = pieces[pieceIndex];
      Piece.fit(piece);
      // updateScore(pId!);
    }),
    ConnectPiece.receive(client, ({ pId, parentIndex, childIndex }) => {
      const parent = pieces[parentIndex];
      const child = pieces[childIndex];
      Piece.connect(parent, child, clientPlaying.playState.gameState);
      if (g.game.selfId === pId) parent.parent.append(parent);
      // updateScore(pId!);
    }),
  ];
}
