import { EventTrigger } from "akashic-sac";

export interface Player {
  readonly id: string;
  name: string;
  /** 生ユーザー名かどうか */
  realName: boolean;
  /** ハメた/繋げたピース数 */
  score: number;
  /** 順位 */
  rank: number;
}

export class PlayerManager {
  private readonly _onJoined = new EventTrigger<[Player]>();
  public readonly onJoined = this._onJoined.asSetOnly;

  private readonly _playerMap = new Map<string, Player>();
  public readonly players: Player[] = [];

  public get length() { return this.players.length; }

  public upsert(id: string, name: string, realName: boolean): void {
    let player = this.get(id);

    if (player == null) {
      const rank = this.players[this.players.length - 1]?.rank || 1;
      player = { id, name, realName, score: 0, rank };
      this.players.push(player);
      this._playerMap.set(id, player);
    } else if (!player.realName && realName) {
      player.name = name;
      player.realName = realName;
    }

    this._onJoined.fire(player);
  }

  public get(id?: string): Player | undefined {
    return this._playerMap.get(id!);
  }

  public has(id?: string): id is string {
    return this._playerMap.has(id!);
  }

  public updateScore(): void {
    this.players.sort((a, b) => b.score - a.score);
    let score = -1;
    let rank = 0;
    let skip = 1;
    for (let p of this.players) {
      if (p.score == score) {
        p.rank = rank;
        skip++;
      } else {
        rank += skip;
        p.rank = rank;
        skip = 1;
        score = p.score;
      }
    }
  }
}
