import { createFont } from "akashic-sac";
import { createButton } from "../../../common/createButton";
import { ButtonSwitchParam, createSwitchButton, SwitchButton } from "../../../common/createSwitchButton";
import { BoardPieceFrame, BoardPreview } from "../../../event/PlayingEvent";
import { ClientPlaying } from "./ClientPlaying";

export interface OptionGroup {
  /**
   * 表示を切り替える
   * @param visibleTo `true`: 表示, `false`: 非表示, `undefined`: トグル
   */
  toggle(visibleTo?: boolean): void;
  dispose(): void;
}

export function createOptionGroup(clientPlaying: ClientPlaying): OptionGroup {
  const scene = g.game.env.scene;
  const client = clientPlaying.client;
  const playArea = clientPlaying.uiGroups.playArea;

  const display = new g.FilledRect({
    scene, parent: clientPlaying.display,
    hidden: true,
    cssColor: "brown",
    width: 900, height: 680,
    x: 20, y: 20,
    opacity: 0.9,
  });


  const result = createOptionUi(clientPlaying.display);

  const optionGroup = {
    toggle,
    dispose: result.dispose,
  } satisfies OptionGroup;

  return optionGroup;


  function toggle(visibleTo?: boolean): void {
    visibleTo ??= !display.visible();
    if (visibleTo) display.show();
    else display.hide();

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


  function createOptionUi(parent: g.E): { dispose: () => void; } {
    const closeBtn = createButton({
      scene, parent: display,
      text: "閉じる", fontSize: 50,
      x: 20, y: display.height - 120,
      width: 180, height: 100,
      action: () => toggle()
    });


    createOption({
      display, top: 0,
      text: "背景プレビュー", hostOnly: true,
      isEnabled: playArea.boardPreview.visible(),
      action: (e, toEnable) => client.sendEvent(new BoardPreview(toEnable)),
    });
    createOption({
      display, top: 1,
      text: "ピース枠線", hostOnly: true,
      isEnabled: playArea.boardPieceFrame.visible(),
      action: (e, toEnable) => client.sendEvent(new BoardPieceFrame(toEnable)),
    });

    const removeKeys = [
      BoardPreview.receive(client, ({ visible }) => {
        playArea.toggleBoardPreview(visible);
      }),
      BoardPieceFrame.receive(client, ({ visible }) => {
        playArea.toggleBoardPieceFrame(visible);
      }),
    ];

    return {
      dispose: () => {
        client.removeEventSets(removeKeys);
      },
    };
  }
}

const font = createFont({ size: 60, fontColor: "white" });
const labelX = 60;
const buttonX = 660;

const startY = 30;
const yLabelOffset = 5;
const yGap = 100;

function createOption(params: {
  display: g.E;
  top: number;
  text: string;
  isEnabled?: boolean;
  hostOnly?: boolean;
  action?: ButtonSwitchParam["action"];
}): SwitchButton {
  const { display, top, text, isEnabled, hostOnly, action } = params;
  const scene = display.scene;
  const y = startY + top * yGap;

  new g.Label({
    scene, parent: display,
    x: labelX, y: y + yLabelOffset,
    font, text,
  });

  return createSwitchButton({
    scene, parent: display,
    x: buttonX, y,
    textEnable: "有効", textDisable: "無効",
    isEnabled, action, fontSize: 50,
    touchable: hostOnly ? g.game.env.isHost : true,
  });
}
