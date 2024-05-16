import { SacEvent } from "akashic-sac";

export class TextMessage extends SacEvent {
  constructor(
    public readonly text: string
  ) { super(); }
}

export class ChangeColor extends SacEvent {
  constructor(
    public readonly color: string
  ) { super(); }
}

