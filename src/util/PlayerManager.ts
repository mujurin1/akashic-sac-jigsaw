import { EventTrigger } from "akashic-sac";

export interface Player {
  readonly id: string;
  readonly name: string;
  /** 生ユーザー名かどうか */
  readonly realName: boolean;
  /** ハメた/繋げたピース数 */
  readonly score: number;
  /** 順位 */
  readonly rank: number;
}

export class PlayerManager {
  private readonly _onJoined = new EventTrigger<[Player]>();
  /** 参加または名前が更新された場合に発火 */
  public readonly onJoined = this._onJoined.asSetOnly;

  private readonly _onUpdated = new EventTrigger<[Player]>();
  /** スコアや順位が更新された場合に発火 */
  public readonly onUpdated = this._onUpdated.asSetOnly;

  private readonly _playerMap = new Map<string, Player>();

  /** ランキング順に並んでいる */
  public readonly players: Player[] = [];

  public get length() { return this.players.length; }

  private _totalScore = 0;
  public get totalScore() { return this._totalScore; }

  public upsert(id: string, name: string, realName: boolean): void {
    let player = this.get(id);

    if (player == null) {
      const rank = this.players[this.players.length - 1]?.rank ?? 1;
      player = { id, name, realName, score: 0, rank };
      this.players.push(player);
      this._playerMap.set(id, player);
    } else {
      // } else if (!player.realName && realName) {   // TODO: 名前を変更不可能にする場合
      (<Mutable<Player>>player).name = name;
      (<Mutable<Player>>player).realName = realName;
    }

    this._onJoined.fire(player);
    this._onUpdated.fire(player);
  }

  public get(id?: string): Player | undefined {
    return this._playerMap.get(id!);
  }

  public has(id?: string): id is string {
    return this._playerMap.has(id!);
  }

  public addScore(id: string, delta: number, isUpdateRank = false): void {
    const player = this.get(id);
    if (player == null) throw new Error(`[PlayerManager.ts addScore(${id}, ${delta}, ${isUpdateRank})] Player not found`);
    (<Mutable<Player>>player).score += delta;
    this._totalScore += delta;
    if (isUpdateRank) this.updateRank();

    this._onUpdated.fire(player);
  }

  /**
   * スコアを元に順位を更新する
   */
  public updateRank(): void {
    this.players.sort((a, b) => b.score - a.score);
    let prevRank = -1;
    let rank = 1;
    let skip = 0;

    for (let p of this.players) {
      if (p.score === prevRank) {
        (<Mutable<Player>>p).rank = rank;
        skip++;
      } else {
        rank += skip;
        skip = 1;
        (<Mutable<Player>>p).rank = rank;
        prevRank = p.score;
      }
    }
  }
}
