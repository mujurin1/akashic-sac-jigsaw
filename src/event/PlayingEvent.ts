import { SacEvent, SacServer } from "akashic-sac";
import { PlayerManager } from "../util/PlayerManager";
import { GameStart } from "./TitleEvent";
import { createPlayingState } from "./server/ServerState";

export class HoldPiece extends SacEvent() {
  constructor(
    /** 必ず親を持たないピース */
    readonly pieceIndex: number
  ) { super(); }
}
export class MovePiece extends SacEvent() {
  constructor(
    /** 必ず親を持たないピース */
    readonly pieceIndex: number,
    readonly point: g.CommonOffset,
  ) { super(); }
}
export class ReleasePiece extends SacEvent() {
  constructor(
    /** 必ず親を持たないピース */
    readonly pieceIndex: number,
    readonly point: g.CommonOffset,
  ) { super(); }
}
/** ピースを強制的に放す */
export class ForceReleasePiece extends SacEvent() {
  constructor(
    /** -1 の場合は全てのピースを放す */
    readonly pieceIndex: number,
  ) { super(); }
}
/** ピースを離さずにそのピースがハマる/くっつくかを判定する */
export class CheckFitPiece extends SacEvent() {
  constructor() { super(); }
}

/** ピースがくっついた */
export class ConnectPiece extends SacEvent() {
  constructor(
    readonly parentIndex: number,
    readonly childIndex: number,
  ) { super(); }
}
/** ピースが盤面にハマった */
export class FitPiece extends SacEvent() {
  constructor(
    readonly pieceIndex: number,
  ) { super(); }
}

//#region Options
export class BoardPreview extends SacEvent() {
  constructor(
    readonly visible: boolean,
  ) { super(); }
}
export class BoardPieceFrame extends SacEvent() {
  constructor(
    readonly visible: boolean,
  ) { super(); }
}
//#endregion Options

/** ゲームクリア */
export class GameClear extends SacEvent() {
  constructor(
    readonly finishTime: number,
    readonly finishPlayerId: string,
  ) { super(); }
}

// MS * COUNT = ピースを保持出来る時間
const enum PIECE_RELEASE {
  MS = 10_000,
  COUNT = 3,
}

export function serverPlaying(server: SacServer, gameStart: GameStart): void {
  const state = createPlayingState(server, gameStart);
  const playerManager = server.env.serverDI.get(PlayerManager);
  const holders = state.holders;

  let totalScore = 0;

  // TODO: server.removeEventSets(eventKeys);
  const eventKeys = [
    HoldPiece.receive(server, data => {
      const { pId, pieceIndex } = data;
      // ゲームに参加していないプレイヤー
      if (!playerManager.has(pId)) return;
      const piece = state.pieces[pieceIndex];
      // ハマっている or 親がいる
      if (piece.fitted || piece.parentId != null) return;
      // 他のプレイヤーが持っている
      if (piece.holderId != null) return;

      // 既に持っているピースを放す
      const oldHold = holders.get(pId);
      if (oldHold != null) {
        state.deleteHolder(pId);
        server.broadcast(new ForceReleasePiece(oldHold.pieceIndex));
      }

      state.setHolder(pId, piece);

      server.broadcast(data);
    }),
    MovePiece.receive(server, data => {
      const { pId, pieceIndex, point } = data;
      // ゲームに参加していないプレイヤー
      if (!playerManager.has(pId)) return;
      const piece = state.pieces[pieceIndex];
      // ハマっている or 親がいる
      if (piece.fitted || piece.parentId != null) return;
      // そのプレイヤーが持っていないピース
      if (holders.get(pId)?.pieceIndex !== pieceIndex) return;

      piece.pos = point;

      server.broadcast(data);
    }),
    ReleasePiece.receive(server, data => {
      const { pId, pieceIndex, point } = data;
      const player = playerManager.get(pId);
      // ゲームに参加していないプレイヤー
      if (player == null) return;
      const piece = state.pieces[pieceIndex];
      // ハマっている or 親がいる
      if (piece.fitted || piece.parentId != null) return;
      // そのプレイヤーが持っていないピース
      if (holders.get(player.id)?.pieceIndex !== pieceIndex) return;

      piece.pos = clampPiecePosition(point);
      if (state.checkAndDoFitAndConnect(data.pieceIndex)) {
        playerManager.addScore(player.id, 1, true);
        totalScore += 1;

        if (totalScore >= state.pieces.length) {
          server.broadcast(new GameClear(g.game.getCurrentTime(), player.id));
        }
      } else {
        const newData: ReleasePiece = { ...data, point: piece.pos };
        server.broadcast(newData);
      }
      state.deleteHolder(player.id);
    }),
    // TODO: ホストがピースを[指定して/全て]放す機能は未実装
    ForceReleasePiece.receive(server, data => {
      if (data.pId !== g.game.env.hostId) return;
    }),
    CheckFitPiece.receive(server, data => {
      const { pId } = data;
      // TODO: ピースがハマっているかチェックする機能は未実装
      if (
        !playerManager.has(pId) ||
        holders.has(pId)
      ) return;
    }),
    BoardPreview.receive(server, server.broadcast_bind),
    BoardPieceFrame.receive(server, server.broadcast_bind),
  ];

  // ピースを一定時間で放す
  // TODO: g.game.env.scene.clearInterval
  const _autoReleaseIntervalKey = g.game.env.scene.setInterval(() => {
    for (const [pId, value] of holders) {
      value.releaseCounter++;

      if (value.releaseCounter >= PIECE_RELEASE.COUNT) {
        state.deleteHolder(pId);
        server.broadcast(new ForceReleasePiece(value.pieceIndex), pId);
      }
    }
  }, PIECE_RELEASE.MS);


  function clampPiecePosition(point: g.CommonOffset): g.CommonOffset {
    const limitX = state.gameState.pieceAreaLimit.width -
      state.gameState.pieceSize.width;
    const limitY = state.gameState.pieceAreaLimit.height -
      state.gameState.pieceSize.height;
    const x =
      point.x < 0 ? 0
        : point.x > limitX ? limitX
          : point.x;
    const y =
      point.y < 0 ? 0
        : point.y > limitY ? limitY
          : point.y;
    return { x, y };
  }
}
