import { toggleVisibleTo } from "../../../common/func";
import { ClientPlaying } from "./ClientPlaying";

export interface RankingGroup {
  readonly panel: g.E;

  /**
   * 表示を切り替える
   * @param visibleTo `true`: 表示, `false`: 非表示, `undefined`: トグル
   */
  toggle(visibleTo?: boolean): void;
}

export function createRankingGroup(clientPlaying: ClientPlaying): RankingGroup {
  const parent = clientPlaying.display;
  const scene = parent.scene;

  const src = scene.asset.getImageById("ranking_view");
  const panel = new g.Sprite({
    scene, parent,
    hidden: true,
    src,
    x: (950 - src.width) / 2, y: (g.game.height - src.height) / 2,
  });

  return {
    panel,
    toggle: value => toggleVisibleTo(panel, value),
  };
}
