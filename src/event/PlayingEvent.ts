import { SacEvent, SacServer } from "akashic-sac";
import { PlayerManager } from "../common/PlayerManager";
import { GameStart } from "./TitleEvent";
import { createPlayingState } from "./server/ServerState";

export class HoldPiece extends SacEvent {
  constructor(
    /** 必ず親を持たないピース */
    readonly pieceIndex: number
  ) { super(); }
}
export class MovePiece extends SacEvent {
  constructor(
    /** 必ず親を持たないピース */
    readonly pieceIndex: number,
    readonly point: g.CommonOffset,
  ) { super(); }
}
export class ReleasePiece extends SacEvent {
  constructor(
    /** 必ず親を持たないピース */
    readonly pieceIndex: number,
    readonly point: g.CommonOffset,
  ) { super(); }
}
/** ピースを強制的に放す */
export class ForceReleasePiece extends SacEvent {
  constructor(
    /** -1 の場合は全てのピースを放す */
    readonly pieceIndex: number,
  ) { super(); }
}
/** ピースを離さずにそのピースがハマる/くっつくかを判定する */
export class CheckFitPiece extends SacEvent {
  constructor() { super(); }
}

/** ピースがくっついた */
export class ConnectPiece extends SacEvent {
  constructor(
    readonly parentIndex: number,
    readonly childIndex: number,
  ) { super(); }
}
/** ピースが盤面にハマった */
export class FitPiece extends SacEvent {
  constructor(
    readonly pieceIndex: number,
  ) { super(); }
}

// MS * COUNT = ピースを保持出来る時間
const PIECE_RELEASE_MS = 10_0000;
const PIECE_RELEASE_COUNT = 3;

export function serverPlaying(server: SacServer, gameStart: GameStart): void {
  const state = createPlayingState(server, gameStart);
  const playerManager = server.env.serverDI.get(PlayerManager);
  const holders = state.holders;

  // TODO: server.removeEventSets(eventKeys);
  const eventKeys = [
    HoldPiece.receive(server, data => {
      const { playerId, pieceIndex } = data;
      // ゲームに参加していないプレイヤー
      if (!playerManager.has(playerId)) return;
      const piece = state.pieces[pieceIndex];
      // ハマっている or 親がいる
      if (piece.fitted || piece.parentId != null) return;
      // 他のプレイヤーが持っている
      if (piece.holderId != null) return;

      // 既に持っているピースを放す
      const oldHold = holders.get(playerId);
      if (oldHold != null) {
        state.deleteHolder(playerId);
        server.broadcast(new ForceReleasePiece(oldHold.pieceIndex));
      }

      state.setHolder(playerId, piece);

      server.broadcast(data);
    }),
    MovePiece.receive(server, data => {
      const { playerId, pieceIndex, point: position } = data;
      // ゲームに参加していないプレイヤー
      if (!playerManager.has(playerId)) return;
      const piece = state.pieces[pieceIndex];
      // ハマっている or 親がいる
      if (piece.fitted || piece.parentId != null) return;
      // そのプレイヤーが持っていないピース
      if (holders.get(playerId)?.pieceIndex !== pieceIndex) return;

      piece.pos = position;

      server.broadcast(data);
    }),
    ReleasePiece.receive(server, data => {
      const { playerId, pieceIndex, point } = data;
      // ゲームに参加していないプレイヤー
      if (!playerManager.has(playerId)) return;
      const piece = state.pieces[pieceIndex];
      // ハマっている or 親がいる
      if (piece.fitted || piece.parentId != null) return;
      // そのプレイヤーが持っていないピース
      if (holders.get(playerId)?.pieceIndex !== pieceIndex) return;

      piece.pos = point;
      state.deleteHolder(playerId);
      if (!state.checkAndDoFitAndConnect(data.pieceIndex)) {
        server.broadcast(data);
      }
    }),
    // TODO: ホストがピースを[指定して/全て]放す機能は未実装
    ForceReleasePiece.receive(server, data => {
      if (data.playerId !== g.game.env.hostId) return;
    }),
    CheckFitPiece.receive(server, data => {
      const { playerId } = data;
      if (
        !playerManager.has(playerId) ||
        holders.has(playerId)
      ) return;
    })
  ];

  // ピースを一定時間で放す
  // TODO: g.game.env.scene.clearInterval
  const _autoReleaseIntervalKey = g.game.env.scene.setInterval(() => {
    for (const [playerId, value] of holders) {
      value.releaseCounter++;

      if (value.releaseCounter >= PIECE_RELEASE_COUNT) {
        state.deleteHolder(playerId);
        server.broadcast(new ForceReleasePiece(value.pieceIndex), playerId);
      }
    }
  }, PIECE_RELEASE_MS);
}
