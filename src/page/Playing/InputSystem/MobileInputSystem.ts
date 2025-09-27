import { createPad, Pad } from "../../../common/Pad";
import { pieMenuBuilder } from "../../../common/PieMenu";
import { ClientPlaying } from "../State/ClientPlaying";
import { InputSystem } from "./InputSystem";

export function MobileInputSystem(
  clientPlaying: ClientPlaying,
  inputUiParent: g.E,
): InputSystem {
  const scene = g.game.env.scene;
  // const { playingState } = clientPlaying.playState;
  // const { client, playArea } = playingState;
  // const { camerable } = playArea;
  // const { scene } = client.env;

  const mobileUi = createMobileUi(clientPlaying, inputUiParent);

  const result: InputSystem = {
    disable: () => {
      if (!mobileUi.visible()) return;
      scene.onPointMoveCapture.remove(moveCamera);
      mobileUi.hide();
    },
    enable: (newUiState) => {
      if (mobileUi.visible()) return;
      scene.onPointMoveCapture.add(moveCamera);
      mobileUi.show(newUiState.nextBgColor);
    },
    forceRelease: () => {
      mobileUi.pad.cursor.cssColor = "red";
      mobileUi.pad.cursor.modified();
    },
    destroy: () => {
      result.disable();
    },
  };

  return result;

  function moveCamera(e: g.PointMoveEvent) {
    if (e.target !== clientPlaying.uiGroups.bg.color) return;

    const playArea = clientPlaying.uiGroups.playArea;
    playArea.moveByCamera(-e.prevDelta.x, -e.prevDelta.y);

    if (clientPlaying.playState.holdState == null) {
      setCursorColor(mobileUi.pad, clientPlaying);
    } else {
      clientPlaying.playState.move(mobileUi.pad.cursor.x, mobileUi.pad.cursor.y);
    }
  }
}

function createMobileUi(
  clientPlaying: ClientPlaying,
  inputUiParent: g.E,
) {
  const scene = g.game.env.scene;
  // const { playingState } = clientPlaying.playState;
  // const { client: { env: { scene } }, playArea: { camerable } } = playingState;

  const mobileUiParent = new g.E({
    scene, parent: inputUiParent,
    hidden: true,
  });

  const mobileUiParts = {
    holdPieceBtn: new g.FilledRect({
      scene, parent: mobileUiParent,
      cssColor: "gray",
      width: 190, height: 190,
      x: g.game.width - (190 + 30), y: g.game.height - (190 + 30),
      touchable: true,
    }),
    checkFitBtn: new g.FilledRect({
      scene, parent: mobileUiParent,
      cssColor: "yellow",
      width: 300, height: 100,
      x: 950, y: 385,
      touchable: true,
    }),
    zoomInBtn: new g.FilledRect({
      scene, parent: mobileUiParent,
      cssColor: "#00F",
      x: 950, y: 470,
      width: 100, height: 100,
      touchable: true,
    }),
    zoomOutBtn: new g.FilledRect({
      scene, parent: mobileUiParent,
      cssColor: "#00F8",
      x: 950, y: 590,
      width: 100, height: 100,
      touchable: true,
    }),
  } as const;

  mobileUiParts.holdPieceBtn.onPointDown.add(() => {
    if (clientPlaying.playState.holdState == null) {
      if (clientPlaying.playState.hold(pad.cursor.x, pad.cursor.y)) {
        pad.cursor.cssColor = "rgba(255,0,0,0.4)";
        pad.cursor.modified();
      }
    } else {
      if (clientPlaying.playState.release()) {
        pad.cursor.cssColor = "red";
        pad.cursor.modified();
      }
    }
  });
  mobileUiParts.checkFitBtn.onPointDown.add(() => {
    clientPlaying.playState.checkFit();
  });
  mobileUiParts.zoomInBtn.onPointDown.add(() => {
    clientPlaying.uiGroups.playArea.scaleCamera(0.9);
    if (clientPlaying.playState.holdState != null) {
      clientPlaying.playState.move(pad.cursor.x, pad.cursor.y);
    }
  });
  mobileUiParts.zoomOutBtn.onPointDown.add(() => {
    clientPlaying.uiGroups.playArea.scaleCamera(1.1);
    if (clientPlaying.playState.holdState != null) {
      clientPlaying.playState.move(pad.cursor.x, pad.cursor.y);
    }
  });

  const pad = createPad({
    scene, parent: mobileUiParent,
    cursorArea: {
      left: 320,
      top: 180,
      right: 960,
      bottom: 540,
    },
    x: 40, y: g.game.height - (200 + 40),
    cursorSpeed: 17,
  });
  pad.onMoving.add(({ padDir, moved, cursorRest }) => {
    console.log(cursorRest.x, cursorRest.y);
    if (pieMenu.entity.visible()) {
      pieMenu.target(padDir);
    } else {
      const playArea = clientPlaying.uiGroups.playArea;
      playArea.moveByCamera(cursorRest.x, cursorRest.y);

      if (clientPlaying.playState.holdState != null) {
        clientPlaying.playState.move(pad.cursor.x, pad.cursor.y);
      }

      setCursorColor(pad, clientPlaying);
      pad.cursor.modified();
    }
  });

  //#region PieMenu
  const pieMenu = pieMenuBuilder(
    100,
    () => pieMenuVisible(false),
  )
    .addIcon("ico_info", () => clientPlaying.uiGroups.info.toggle())
    .addIcon("ico_preview", () => clientPlaying.uiGroups.preview.toggle())
    .addIcon("ico_setting", () => clientPlaying.uiGroups.option.toggle())
    .addIcon("ico_ranking", () => clientPlaying.uiGroups.ranking.toggle())
    .addIcon("ico_device", () => clientPlaying.uiGroups.inputSystem.toggleInputSystem())
    .addIcon_Rect("color", "blue", e => {
      pieMenu.icons.color.cssColor = clientPlaying.uiGroups.bg.toggleColor();
      pieMenu.icons.color.modified();
    })
    .build({
      parent: mobileUiParent,
      x: g.game.width / 2,
      y: g.game.height / 2,
      hidden: true,
    });

  const pieMenuToggle = new g.FilledRect({
    scene, parent: mobileUiParent,
    cssColor: "yellow",
    width: 200, height: 100,
    x: 40, y: 300,
    touchable: true,
  });
  pieMenuToggle.onPointDown.add(() => {
    pieMenuVisible(!pieMenu.entity.visible());
  });
  pad.onRelease.add(e => {
    pieMenu.fire();
    pieMenu.target({ x: 0, y: 0 });
  });

  function pieMenuVisible(visibility: boolean) {
    if (visibility) {
      pieMenu.entity.show();
      pad.cursorLock = true;
    } else {
      pieMenu.entity.hide();
      pad.cursorLock = false;
    }
  }
  //#endregion PieMenu

  return {
    pad,
    show: (nextBgColor: string) => {
      mobileUiParent.show();
      pieMenu.icons.color.cssColor = nextBgColor;
      pieMenu.icons.color.modified();
    },
    hide: () => {
      mobileUiParent.hide();
      pieMenuVisible(false);
    },
    visible: () => mobileUiParent.visible(),
  };
}

function setCursorColor(pad: Pad, clientPlaying: ClientPlaying) {
  pad.cursor.cssColor =
    clientPlaying.playState.holdState != null
      ? "rgba(255,0,0,0.4)"
      : clientPlaying.getPieceFromScreenPx(pad.cursor.x, pad.cursor.y, true) != null
        ? "red"
        : "yellow";
  pad.cursor.modified();
}
