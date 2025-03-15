import { EventTrigger } from "akashic-sac";

export interface Player {
  id: string;
  name: string;
  /** 生ユーザー名かどうか */
  realName: boolean;
}

export class PlayerManager {
  private readonly _onUpdate = new EventTrigger<[Player]>();
  public readonly onUpdate = this._onUpdate.asSetOnly;

  readonly players = new Map<string, Player>();

  private _length = 0;
  get length() { return this._length; }

  constructor() { }

  public upsert(id: string, name: string, realName: boolean): void {
    let player = this.get(id);

    if (player == null) {
      player = { id, name, realName };
      this.players.set(id, player);
      this._length += 1;
    } else if (!player.realName && realName) {
      player.name = name;
      player.realName = realName;
    }

    this._onUpdate.fire(player);
  }

  public get(id?: string): Player | undefined {
    return this.players.get(id!);
  }

  public has(id?: string): id is string {
    return this.players.has(id!);
  }

  public hasRealName(id: string): boolean {
    return this.get(id)?.realName ?? false;
  }
}
