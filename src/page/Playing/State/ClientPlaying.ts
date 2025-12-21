import { SacClient } from "akashic-sac";
import { ConnectPiece, FitPiece, ForceReleasePiece, GameClear, HoldPiece, MovePiece, ReleasePiece } from "../../../event/PlayingEvent";
import { GameStart } from "../../../event/TitleEvent";
import { createGameState } from "../../../share/GameState";
import { PlayerManager } from "../../../util/PlayerManager";
import { inputSystemControl, InputSystemControl } from "../InputSystem/InputSystem";
import { Piece } from "../Piece";
import { BgGroup, createBgGroup } from "./BgGroup";
import { createInfoGroup, InfoGroup } from "./InfoGroup";
import { createOptionGroup, OptionGroup } from "./OptionGroup";
import { createPieceGroup as createPlayAreaGroup, PieceGroup as PlayAreaGroup } from "./PlayAreaGroup";
import { createPlayState, PlayState } from "./PlayState";
import { createPreviewGroup, PreviewGroup } from "./PreviewGroup";
import { createRankingGroup, RankingGroup } from "./RankingGroup";

export interface ClientPlaying {
  readonly client: SacClient;
  readonly playState: PlayState;

  /** 画面に表示される全てのエンティティの親/祖先 */
  readonly display: g.E;

  readonly uiGroups: {
    /** 背景 */
    readonly bg: BgGroup;
    /** カメラ・ピース・ボードなど */
    readonly playArea: PlayAreaGroup;
    /** 右上の Info パネル */
    readonly info: InfoGroup;

    // 普段は非表示の要素
    readonly ranking: RankingGroup;
    readonly preview: PreviewGroup;
    readonly option: OptionGroup;
  };

  /** 操作方法の管理 */
  readonly inputSystem: InputSystemControl;


  /** プレイヤーが参加しているか */
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
  surface: g.Surface | g.ImageAsset,
): Promise<ClientPlaying> {
  const scene = client.env.scene;
  const playerManager = client.env.clientDI.get(PlayerManager);

  const display = new g.E({ scene, parent: scene });
  const clientPlaying: ClientPlaying = {
    client,
    get playState() { return playState; },
    display,
    uiGroups: {
      get bg() { return bgGroup; },
      get playArea() { return playAreaGroup; },

      // プレイヤーに情報を表示する/操作する要素
      get info() { return infoGroup; },

      // 普段は非表示の要素
      get ranking() { return rankingGroup; },
      get preview() { return preview; },
      get option() { return optionGroup; },
    },
    get inputSystem() { return inputSystem; },

    isJoined,
    toPieceArea,
    getPieceFromScreenPx,
  };

  const playState = await createPlayState(
    clientPlaying,
    createGameState(gameStart),
    surface
  );

  const bgGroup = createBgGroup(clientPlaying);
  const playAreaGroup = createPlayAreaGroup(clientPlaying);
  const infoGroup = createInfoGroup(clientPlaying);

  const inputSystem = inputSystemControl(clientPlaying);

  const rankingGroup = createRankingGroup(clientPlaying);
  const preview = createPreviewGroup(clientPlaying);
  const optionGroup = createOptionGroup(clientPlaying);

  // ピースの初期化
  Piece.pieceParentSetting(clientPlaying);
  for (let i = 0; i < clientPlaying.playState.piecesResult.pieces.length; i++) {
    const piece = clientPlaying.playState.piecesResult.pieces[i];
    const position = clientPlaying.playState.gameState.piecePositions[i];
    playAreaGroup.pieceParent.append(piece);
    piece.moveTo(position.x, position.y);
    piece.modified();
  }

  // TODO: client.removeEventSets(eventKeys);
  setEvents(clientPlaying);

  playAreaGroup.reset();

  return clientPlaying;


  function isJoined() {
    return playerManager.has(g.game.selfId);
  }

  function toPieceArea(x: number, y: number) {
    return {
      x: playAreaGroup.camerable.x + playAreaGroup.camerable.scaleX * x,
      y: playAreaGroup.camerable.y + playAreaGroup.camerable.scaleY * y,
    };
  }

  function getPieceFromScreenPx(x: number, y: number, canHold = false) {
    if (!isJoined()) return;

    const playAreaX = playAreaGroup.camerable.x + playAreaGroup.camerable.scaleX * x;
    const playAreaY = playAreaGroup.camerable.y + playAreaGroup.camerable.scaleY * y;
    const piece = Piece.getParentOrSelf(Piece.getFromPoint(playAreaX, playAreaY, canHold));
    if (piece == null) return;

    return {
      piece,
      offset: { x: piece.x - playAreaX, y: piece.y - playAreaY },
    };
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
          (<any>clientPlaying.playState).holdState = undefined;
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
        inputSystem.current.forceRelease();
      }),
      FitPiece.receive(client, ({ pId, pieceIndex }) => {
        const piece = pieces[pieceIndex];
        Piece.fit(piece);
        playerManager.addScore(pId!, 1, true);
      }),
      ConnectPiece.receive(client, ({ pId, parentIndex, childIndex }) => {
        const parent = pieces[parentIndex];
        const child = pieces[childIndex];
        Piece.connect(parent, child, clientPlaying.playState.gameState);
        if (g.game.selfId === pId) parent.parent.append(parent);
        playerManager.addScore(pId!, 1, true);
      }),
      GameClear.receive(client, clientPlaying.playState.gameClear),
    ];
  }
}
