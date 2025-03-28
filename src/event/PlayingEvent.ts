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

// MS * COUNT = ピースを保持出来る時間
const PIECE_RELEASE_MS = 10_000;
const PIECE_RELEASE_COUNT = 3;

export function serverPlaying(server: SacServer, gameStart: GameStart): void {
  const state = createPlayingState(server, gameStart);
  const playerManager = server.env.serverDI.get(PlayerManager);
  const holders = state.holders;

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
      const { pId, pieceIndex, point: position } = data;
      // ゲームに参加していないプレイヤー
      if (!playerManager.has(pId)) return;
      const piece = state.pieces[pieceIndex];
      // ハマっている or 親がいる
      if (piece.fitted || piece.parentId != null) return;
      // そのプレイヤーが持っていないピース
      if (holders.get(pId)?.pieceIndex !== pieceIndex) return;

      piece.pos = position;

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

      piece.pos = point;
      if (!state.checkAndDoFitAndConnect(data.pieceIndex)) {
        player.score += 1;
        playerManager.updateScore();
        server.broadcast(data);
      }
      state.deleteHolder(player.id);
    }),
    // TODO: ホストがピースを[指定して/全て]放す機能は未実装
    ForceReleasePiece.receive(server, data => {
      if (data.pId !== g.game.env.hostId) return;
    }),
    CheckFitPiece.receive(server, data => {
      const { pId } = data;
      if (
        !playerManager.has(pId) ||
        holders.has(pId)
      ) return;
    })
  ];

  // ピースを一定時間で放す
  // TODO: g.game.env.scene.clearInterval
  const _autoReleaseIntervalKey = g.game.env.scene.setInterval(() => {
    for (const [pId, value] of holders) {
      value.releaseCounter++;

      if (value.releaseCounter >= PIECE_RELEASE_COUNT) {
        state.deleteHolder(pId);
        server.broadcast(new ForceReleasePiece(value.pieceIndex), pId);
      }
    }
  }, PIECE_RELEASE_MS);
}
