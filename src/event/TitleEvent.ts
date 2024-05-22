import { CommonOffset, CommonSize, SacEvent, Server } from "akashic-sac";
import { serverPlaying } from "./PlayingEvent";
import { readAssets } from "../util/readAssets";

export class ChangePuzzle extends SacEvent {
  constructor(
    /** 0 ~ パズルの枚数-1 OR -1 (ユーザー投稿) */
    readonly index: number,
  ) { super(); }
}
export class ChangeLevel extends SacEvent {
  constructor(
    /** 0 ~ 100 */
    readonly level: number,
  ) { super(); }
}
export class GameStart extends SacEvent {
  constructor(
    readonly seed: number,
    /** `1970-01-01T00:00:00Z`からのミリ秒での経過時刻 */
    readonly startTime: number,
    readonly puzzleIndex: number,
    /** 切り抜く原点（左上） */
    readonly origine: CommonOffset,
    /** ピースのサイズ */
    readonly pieceSize: CommonSize,
    /** ピースの縦横枚数 */
    readonly pieceWH: CommonSize,
  ) { super(); }
}




export function serverTitle(server: Server): void {
  const previewInfo = readAssets(server.env.scene);
  const puzzleMaxIndex = previewInfo.length - 1;


  const eventKeys = [
    ChangePuzzle.receive(server, data => {
      if (data.playerId !== g.game.env.hostId) return;
      // -1 はカスタム画像
      let puzzleIndex = data.index;

      if (puzzleIndex < -1) puzzleIndex = puzzleMaxIndex;
      else if (puzzleMaxIndex < puzzleIndex) puzzleIndex = -1;

      server.broadcast(new ChangePuzzle(puzzleIndex));
    }),
    ChangeLevel.receive(server, data => {
      if (data.playerId !== g.game.env.hostId) return;
      server.broadcast(data);
    }),
    GameStart.receive(server, data => {
      if (data.playerId !== g.game.env.hostId) return;
      server.removeEventSet(...eventKeys);

      server.broadcast(data);

      serverPlaying(server, data);
    }),
  ];
}
