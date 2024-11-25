import { SacEvent, Server } from "akashic-sac";
import { lineupPiece } from "../page/Playing/lineupPiece";
import { PlayerManager } from "../util/PlayerManager";
import { GameStart } from "./TitleEvent";

export class HoldPiece extends SacEvent {
  constructor(readonly pieceIndex: number) { super(); }
}
export class MovePiece extends SacEvent {
  constructor(
    readonly pieceIndex: number,
    readonly point: g.CommonOffset,
  ) { super(); }
}
export class ReleasePiece extends SacEvent {
  constructor(
    readonly pieceIndex: number,
    readonly point?: g.CommonOffset,
  ) { super(); }
}
/** ピースを強制的に放す */
export class ForceReleasePiece extends SacEvent {
  constructor(
    /** -1 の場合は全てのピースを放す */
    readonly pieceIndex: number,
  ) { super(); }
}
/** ピースを離さずに持っているピースがくっつく/ハマるかを判定する */
export class CheckFitPiece extends SacEvent {
  constructor() { super(); }
}

/** ピースがくっついた */
export class ConnectPiece extends SacEvent {
  constructor(
    // TODO
  ) { super(); }
}
/** ピースが盤面にハマった */
export class FitPiece extends SacEvent {
  constructor(
    // TODO
  ) { super(); }
}


interface PlayingState {
  gameStart: GameStart;
  clearTime: number | undefined;

  holders: Map<string, {
    pieceIndex: number,
    releaseCounter: number,
  }>;
  pieces: { pos: g.CommonOffset; fited: boolean; }[];
}

export function serverPlaying(server: Server, gameStart: GameStart): void {
  const playerManager = server.env.serverDI.get(PlayerManager);

  const boardSize = {
    width: gameStart.pieceSize.width * gameStart.pieceWH.width,
    height: gameStart.pieceSize.height * gameStart.pieceWH.height,
  };
  const state: PlayingState = {
    gameStart,
    clearTime: undefined,

    holders: new Map(),
    pieces: lineupPiece(
      gameStart.seed,
      gameStart.pieceWH.width * gameStart.pieceWH.height,
      gameStart.pieceSize,
      boardSize,
    )
      .map(pos => ({ pos, fited: false })),
  };

  const holders = state.holders;

  // TODO: server.removeEventSet(...eventKeys);
  const eventKeys = [
    HoldPiece.receive(server, data => {
      const { playerId, pieceIndex } = data;

      if (!playerManager.has(playerId)) return;
      for (const hold of holders.values()) if (hold.pieceIndex === pieceIndex) return;
      const oldHold = holders.get(playerId);
      if (oldHold != null)
        server.broadcast(new ForceReleasePiece(oldHold.pieceIndex));

      holders.set(playerId, { pieceIndex, releaseCounter: 0 });

      server.broadcast(data);
    }),
    MovePiece.receive(server, data => {
      const { playerId, pieceIndex, point: position } = data;
      if (
        !playerManager.has(playerId) ||
        holders.get(playerId)?.pieceIndex !== pieceIndex
      ) return;

      state.pieces[pieceIndex].pos = position;

      server.broadcast(data);
    }),
    ReleasePiece.receive(server, data => {
      const { playerId, pieceIndex, point } = data;
      if (
        !playerManager.has(playerId) ||
        holders.get(playerId)?.pieceIndex !== pieceIndex
      ) return;

      if (point != null)
        state.pieces[pieceIndex].pos = point;
      holders.delete(playerId);

      server.broadcast(data);
    }),
    // TODO: ホストがピースを[指定して/全ての]ピースを放す機能は未実装
    // ForceReleasePiece.receive(server, data => {
    //   if(data.playerId !== g.game.env.hostId) return;
    // }),
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
  const autoReleaseIntervalKey = g.game.env.scene.setInterval(() => {
    for (const [playerId, value] of holders) {
      value.releaseCounter++;

      if (value.releaseCounter >= 3) {
        holders.delete(playerId);
        server.broadcast(new ForceReleasePiece(value.pieceIndex), playerId);
      }
    }
    // }, 1000 * 1);
  }, 1000 * 10);
}
