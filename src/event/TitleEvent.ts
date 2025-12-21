import { SacEvent, SacServer, ShareBigText } from "akashic-sac";
import { JigsawAssets } from "../util/readAssets";
import { serverPlaying } from "./PlayingEvent";

export class ChangePuzzle extends SacEvent() {
  constructor(
    /** 0 ~ パズルの枚数-1 OR -1 (ユーザー投稿) */
    readonly index: number,
  ) { super(); }
}
export class ChangeLevel extends SacEvent() {
  constructor(
    /** 0 ~ 100 */
    readonly level: number,
  ) { super(); }
}
export class GameStart extends SacEvent() {
  constructor(
    readonly seed: number,
    /** `1970-01-01T00:00:00Z`からのミリ秒での経過時刻 */
    readonly startTime: number,
    readonly puzzleIndex: number,
    /** 切り抜く原点（左上） */
    readonly origin: g.CommonOffset,
    /** ピースのサイズ */
    readonly pieceSize: g.CommonSize,
    /** ピースの縦横枚数 */
    readonly pieceWH: g.CommonSize,
  ) { super(); }
}

export function serverTitle(server: SacServer): void {
  const puzzleMaxIndex = JigsawAssets.length - 1;

  ShareBigText.waitingFromSingleUser("IMAGE", g.game.env.hostId, () => true);

  const eventKeys = [
    ChangePuzzle.receive(server, data => {
      if (data.pId !== g.game.env.hostId) return;
      // -1 はカスタム画像
      let puzzleIndex = data.index;

      if (puzzleIndex < -1) puzzleIndex = puzzleMaxIndex;
      else if (puzzleMaxIndex < puzzleIndex) puzzleIndex = -1;

      server.broadcast(new ChangePuzzle(puzzleIndex));
    }),
    ChangeLevel.receive(server, data => {
      if (data.pId !== g.game.env.hostId) return;
      server.broadcast(data);
    }),
    GameStart.receive(server, data => {
      if (data.pId !== g.game.env.hostId) return;

      server.broadcast(data);
      server.removeEventSets(eventKeys);
      serverPlaying(server, data);
    }),
  ];
}
