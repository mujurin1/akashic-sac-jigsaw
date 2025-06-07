import { createFont } from "akashic-sac";
import { ClientPlayingState } from "../../PlayingState";

export interface OptionState {
  readonly optionUi: g.E;
  readonly visible: boolean;
  show(hide?: boolean): void;
}

export function createOptionUi(state: ClientPlayingState): OptionState {
  const playingState = state.pieceOperatorControl.inputSystemState.playingState;
  const { client: { env: { scene } } } = playingState;

  const optionUi = new g.FilledRect({
    scene, parent: playingState.display,
    width: scene.game.width,
    height: scene.game.height,
    cssColor: "rgba(0,0,0,0.5)",
    touchable: true,
  });

  const back = backArea(scene, optionUi);
  const closeButton = closeBtn(scene, optionUi);
  closeButton.onPointDown.add(() => {
    optionUi.hide();
  });

  return {
    optionUi,
    get visible() { return optionUi.visible(); },
    show,
  };

  function show(hide: boolean = false): void {
    if (hide) {
      optionUi.hide();
    } else {
      optionUi.show();
    }
  }
}

function backArea(scene: g.Scene, parent: g.E): g.E {
  return new g.FilledRect({
    scene, parent,
    width: scene.game.width - 60,
    height: scene.game.height - 60,
    x: 30, y: 30,
    cssColor: "rgb(185, 185, 185)",
  });
}

function closeBtn(scene: g.Scene, parent: g.E): g.E {
  const closeButton = new g.FilledRect({
    scene, parent,
    width: 130,
    height: 60,
    cssColor: "white",
    x: scene.game.width - (130 + 30),
    y: scene.game.height - (60 + 30),
    touchable: true,
  });

  new g.Label({
    scene, parent: closeButton,
    text: "閉じる",
    font: createFont({ size: 40 }),
    x: 5,
    y: 5,
  });

  return closeButton;
}
