import { createFont } from "akashic-sac";
import { createButton } from "../../../common/createButton";
import { ClientPlaying } from "./ClientPlaying";

export interface OptionGroup {
  /**
   * 表示を切り替える
   * @param visibleTo `true`: 表示, `false`: 非表示, `undefined`: トグル
   */
  toggle(visibleTo?: boolean): void;
}

export function createOptionGroup(clientPlaying: ClientPlaying): OptionGroup {
  const display = createOptionUi(clientPlaying.display);

  const optionGroup = {
    toggle,
  } satisfies OptionGroup;

  return optionGroup;


  function toggle(visibleTo?: boolean): void {
    visibleTo ??= !display.visible();
    if (visibleTo) display.show();
    else display.hide();

    const playArea = clientPlaying.uiGroups.playArea;
    if (visibleTo) {
      clientPlaying.inputSystem.setInputEnabled(false);

      // ボードサイズに応じた倍率設定
      const scale = ((playArea.board.width + playArea.board.height) * 5.8) / (g.game.width + g.game.height);
      playArea.scaleTo(scale);

      // Info パネルの右下の中央辺りの座標
      const baseX = -g.game.width * 0.86 * playArea.camerable.scaleX;
      const baseY = -g.game.height * 0.76 * playArea.camerable.scaleY;
      const limit = clientPlaying.playState.gameState.pieceAreaLimit;
      playArea.moveTo(
        baseX + (limit.width / 2),
        baseY + (limit.height / 2),
        { centerPer: { x: 0, y: 0 } }
      );
    } else {
      clientPlaying.inputSystem.setInputEnabled(true);
      playArea.reset();
    }
  }


  function createOptionUi(parent: g.E): g.E {
    const scene = g.game.env.scene;

    const display = new g.FilledRect({
      scene, parent,
      hidden: true,
      cssColor: "brown",
      width: 900, height: 680,
      x: 20, y: 20,
      opacity: 0.9,
    });

    const closeBtn = createButton({
      scene, parent: display,
      text: "閉じる", fontSize: 50,
      x: 20, y: display.height - 120,
      width: 180, height: 100,
      action: () => toggle()
    });

    {
      const font = createFont({ size: 80, fontColor: "white" });

      // TODO: オプションのUI
      new g.Label({
        scene, parent: display,
        text: "オプションUI（未実装）",
        font,
        x: 30, y: 300,
      });
    }

    return display;
  }
}
