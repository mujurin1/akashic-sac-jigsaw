import { createPad, Pad } from "../../../common/Pad";
import { pieMenuBuilder } from "../../../common/PieMenu";
import { ClientPlayingState } from "../PlayingState";
import { InputSystem, InputSystemState } from "./InputSystem";

export function MobileInputSystem(state: InputSystemState): InputSystem {
  const { playingState } = state;
  const { client, playArea } = playingState;
  const { camerable } = playArea;
  const { scene } = client.env;

  const mobileUi = createUi(state);

  let enabled = false;
  return { toggleFeature, forceRelease, destroy };

  function toggleFeature(enable: boolean) {
    if (enabled === enable) return;
    enabled = enable;
    if (enable) {
      scene.onPointMoveCapture.add(moveCamera);
      mobileUi.show();
    } else {
      scene.onPointMoveCapture.remove(moveCamera);
      mobileUi.hide();
    }
  }
  function forceRelease() {
    mobileUi.pad.cursor.cssColor = "red";
    mobileUi.pad.cursor.modified();
  }
  function destroy() {
    toggleFeature(false);
    mobileUi.destroy();
  }

  function moveCamera(e: g.PointMoveEvent) {
    if (e.target !== playArea.bg) return;

    camerable.moveBy(-e.prevDelta.x * camerable.scaleX, -e.prevDelta.y * camerable.scaleX);
    camerable.modified();

    if (playingState.holdState == null) {
      setCursorColor(mobileUi.pad, playingState);
    } else {
      state.move(mobileUi.pad.cursor.x, mobileUi.pad.cursor.y);
    }
  }
}

function createUi(state: InputSystemState) {
  const { playingState } = state;
  const { client, playArea, ui } = playingState;
  const { camerable } = playArea;
  const { scene } = client.env;

  const holdPieceBtn = new g.FilledRect({
    scene, parent: ui,
    cssColor: "gray",
    width: 190, height: 190,
    x: g.game.width - (190 + 30), y: g.game.height - (190 + 30),
    touchable: true, hidden: true,
  });
  const checkFitBtn = new g.FilledRect({
    scene, parent: ui,
    cssColor: "yellow",
    width: 300, height: 100,
    x: 950, y: 385,
    touchable: true, hidden: true,
  });
  const zoomInBtn = new g.FilledRect({
    scene, parent: ui,
    cssColor: "#00F",
    x: 950, y: 470,
    width: 100, height: 100,
    touchable: true, hidden: true,
  });
  const zoomOutBtn = new g.FilledRect({
    scene, parent: ui,
    cssColor: "#00F8",
    x: 950, y: 590,
    width: 100, height: 100,
    touchable: true, hidden: true,
  });

  holdPieceBtn.onPointDown.add(() => {
    if (playingState.holdState == null) {
      if (state.hold(pad.cursor.x, pad.cursor.y)) {
        pad.cursor.cssColor = "rgba(255,0,0,0.4)";
        pad.cursor.modified();
      }
    } else {
      if (state.release()) {
        pad.cursor.cssColor = "red";
        pad.cursor.modified();
      }
    }
  });
  checkFitBtn.onPointDown.add(() => {
    state.checkFit();
  });
  zoomInBtn.onPointDown.add(() => {
    state.scale(0.9);
    if (playingState.holdState != null) {
      state.move(pad.cursor.x, pad.cursor.y);
    }
  });
  zoomOutBtn.onPointDown.add(() => {
    state.scale(1.1);
    if (playingState.holdState != null) {
      state.move(pad.cursor.x, pad.cursor.y);
    }
  });

  const pad = createPad({
    scene, parent: ui,
    cursorArea: {
      left: 320,
      top: 180,
      right: 960,
      bottom: 540,
    },
    x: 40, y: g.game.height - (200 + 40),
    cursorSpeed: 17,
    hidden: true,
  });
  pad.onMoving.add(({ padDir, moved, cursorRest }) => {
    if (pieMenu.entity.visible()) {
      pieMenu.target(padDir);
    } else {
      camerable.moveBy(cursorRest.x * camerable.scaleX, cursorRest.y * camerable.scaleX);
      camerable.modified();

      if (playingState.holdState != null) {
        state.move(pad.cursor.x, pad.cursor.y);
      }

      setCursorColor(pad, playingState);
      pad.cursor.modified();
    }
  });

  //#region PieMenu
  const pieMenu = pieMenuBuilder(
    100,
    () => pieMenuVisible(false),
  )
    .addIcon("ico_info", state.toggle.info)
    .addIcon("ico_preview", state.toggle.preview)
    .addIcon("ico_visible", state.toggle.visible)
    .addIcon("ico_ranking", state.toggle.ranking)
    .addIcon("ico_device", state.toggle.device)
    .addIcon_Rect("color", "blue", e => {
      const nextColor = state.toggle.color();
    })
    .build({
      x: g.game.width / 2,
      y: g.game.height / 2,
      hidden: true,
    });

  ui.append(pieMenu.entity);
  const pieMenuToggle = new g.FilledRect({
    scene, parent: ui,
    cssColor: "yellow",
    width: 200, height: 100,
    x: 40, y: 300,
    touchable: true, hidden: true,
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

  const showHideDestroyParts = [holdPieceBtn, checkFitBtn, zoomInBtn, zoomOutBtn, pieMenuToggle, pad] as const;

  return { pad, show, hide, destroy };

  function show() {
    for (const part of showHideDestroyParts) part.show();
  }
  function hide() {
    for (const part of showHideDestroyParts) part.hide();
    pieMenu.entity.hide();
    pad.cursorLock = false;
  }
  function destroy() {
    for (const part of showHideDestroyParts) part.destroy();
    pieMenu.entity.destroy();
  }
}

function setCursorColor(pad: Pad, playingState: ClientPlayingState) {
  pad.cursor.cssColor =
    playingState.holdState != null
      ? "rgba(255,0,0,0.4)"
      : playingState.getPieceFromScreenPx(pad.cursor.x, pad.cursor.y, true) != null
        ? "red"
        : "yellow";
}
