import { BACKGROUND_COLOR } from "../PlayingClientConst";
import { ClientPlaying } from "./ClientPlaying";

export interface BgGroup {
  readonly color: g.FilledRect;

  /**
   * @returns 次の背景色
   */
  toggleColor(): string;
}

export function createBgGroup(clientPlaying: ClientPlaying): BgGroup {
  const bgGroup = {
    color: create.bg(clientPlaying.display),
    toggleColor,
  } satisfies BgGroup;

  return bgGroup;

  function toggleColor(): string {
    const color = BACKGROUND_COLOR.nextColorMap[bgGroup.color.cssColor];
    bgGroup.color.cssColor = color;
    bgGroup.color.modified();

    return BACKGROUND_COLOR.nextColorMapIcon[color];
  }
}


const create = {
  bg: (parent: g.E): g.FilledRect => {
    return new g.FilledRect({
      scene: parent.scene, parent,
      cssColor: BACKGROUND_COLOR.colors[0],
      width: g.game.width, height: g.game.height,
      touchable: true,
    });
  }
} as const;
