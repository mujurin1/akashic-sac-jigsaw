import { SacServer } from "akashic-sac";
import { Mutable } from "../../common/type";
import { GameState, createGameState } from "../../util/GameState";
import { GameStart } from "../TitleEvent";
import { createCheckAndDoFitAndConnect } from "./FitAndConnectCalc";

export interface ServerPieceState {
  /** ピースIDでもある */
  readonly index: number;
  /** 他のピースの子になっている場合は親からの相対正解座標になる */
  pos: g.CommonOffset;
  /** ハマっているか */
  fitted: boolean;
  /**
   * くっついている親ピースIndex
   * * ピースの親は必ず自分より若い番号
   * * ピースの関係は親子まで. 2つの親子がくっついた場合は一番若い番号が親になる
   */
  parentId?: number;
  /** ピースを持っているプレイヤーID */
  holderId?: string;
  /**
   * このピースが親になっているピース配列
   */
  children?: ServerPieceState[];
}

export interface ServerPlayingState {
  readonly server: SacServer;
  readonly gameState: GameState;

  clearTime: number | undefined;

  /** `{ [pId]: VALUE }` */
  readonly holders: Map<string, {
    pieceIndex: number,
    releaseCounter: number,
  }>;

  readonly pieces: ServerPieceState[];

  readonly setHolder: (pId: string, piece: ServerPieceState) => void;
  readonly deleteHolder: (pId: string) => void;

  /**
   * ピースが盤面にハマる/くっつくかをチェックしその後処理を行う
   * @param pieceIndex 必ず親を持たないピース
   * @returns ハマったまたはくっついた
   */
  readonly checkAndDoFitAndConnect: (pieceIndex: number) => boolean;
}

export function createPlayingState(
  server: SacServer,
  gameStart: GameStart,
): ServerPlayingState {
  const gameState: GameState = createGameState(gameStart);

  const state: ServerPlayingState = {
    server,
    gameState,
    holders: new Map(),
    pieces: gameState.piecePositions.map((pos, index) => ({ index, pos, fitted: false })),
    clearTime: undefined,

    setHolder,
    deleteHolder,
    checkAndDoFitAndConnect: null!,
  };
  (<Mutable<ServerPlayingState>>state).checkAndDoFitAndConnect = createCheckAndDoFitAndConnect(state);

  return state;

  function setHolder(pId: string, piece: ServerPieceState) {
    state.holders.set(pId, { pieceIndex: piece.index, releaseCounter: 0 });
    piece.holderId = pId;
  }
  function deleteHolder(pId: string) {
    const holdState = state.holders.get(pId);
    if (holdState == null) return;

    state.holders.delete(pId);
    state.pieces[holdState.pieceIndex].holderId = undefined;
  }
}
