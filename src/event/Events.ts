import { SacEvent } from "akashic-sac";

export class JoinPlayer extends SacEvent() {
  constructor(
    readonly name: string,
    /** 生ユーザー名かどうか */
    readonly realName: boolean,
  ) { super(); }
}
