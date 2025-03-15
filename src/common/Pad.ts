
export interface PadParam {
  scene: g.Scene;
  parent: g.E;
  cursorArea: g.CommonRect,
  x: number; y: number;
  cursorSpeed: number;
  hidden?: boolean;
}

export type Pad = ReturnType<typeof createPad>;

export function createPad({ scene, parent, cursorArea, x, y, cursorSpeed, hidden }: PadParam) {
  const width = 200, height = 200;

  let padDir: g.CommonOffset | undefined;

  const pad = new g.FilledRect({
    scene, parent,
    cssColor: "red",
    height, width,
    x, y,
    touchable: true, hidden,
  });
  const padPointer = new g.FilledRect({
    scene, parent: pad,
    cssColor: "blue",
    height: 30, width: 30,
    x: width / 2, y: height / 2,
    anchorX: 0.5, anchorY: 0.5,
  });

  pad.onPointDown.add(({ point: { x, y } }) => {
    padPointer.moveTo(x, y);
    padPointer.modified();

    padDir = {
      x: (x / (width / 2)) - 1,
      y: (y / (height / 2)) - 1,
    };
  });
  pad.onPointMove.add(data => {
    const x = Math.max(0, Math.min(data.point.x + data.startDelta.x, pad.width));
    const y = Math.max(0, Math.min(data.point.y + data.startDelta.y, pad.height));

    padPointer.moveTo(x, y);
    padPointer.modified();

    padDir = {
      x: (x / (width / 2)) - 1,
      y: (y / (height / 2)) - 1,
    };
  });
  pad.onPointUp.add(() => {
    padDir = undefined;
    padPointer.moveTo(width / 2, height / 2);
    padPointer.modified();
    result.onRelease.fire();
  });

  pad.onUpdate.add(() => {
    if (padDir == null) return;

    const moved = { x: padDir.x * cursorSpeed, y: padDir.y * cursorSpeed };
    const cursorRest: g.CommonOffset = { x: 0, y: 0 };
    const newPos = { x: cursor.x + moved.x, y: cursor.y + moved.y };

    if (newPos.x < cursorArea.left) {
      cursorRest.x = newPos.x - cursorArea.left;
      newPos.x = cursorArea.left;
    } else {
      if (cursorArea.right < newPos.x) {
        cursorRest.x = newPos.x - cursorArea.right;
        newPos.x = cursorArea.right;
      }
    }
    if (newPos.y < cursorArea.top) {
      cursorRest.y = newPos.y - cursorArea.top;
      newPos.y = cursorArea.top;
    } else {
      if (cursorArea.bottom < newPos.y) {
        cursorRest.y = newPos.y - cursorArea.bottom;
        newPos.y = cursorArea.bottom;
      }
    }

    if (!result.cursorLock) {
      cursor.moveTo(newPos.x, newPos.y);
      cursor.modified();
    }

    result.onMoving.fire({ padDir, moved, cursorRest });
  });

  const cursor = new g.FilledRect({
    scene, parent,
    cssColor: "yellow",
    width: 50, height: 50,
    x: cursorArea.left + (cursorArea.right - cursorArea.left) / 2,
    y: cursorArea.top + (cursorArea.bottom - cursorArea.top) / 2,
    hidden,
  });

  const result = {
    pad,
    cursor,
    cursorLock: false,
    cursorSpeed,
    onMoving: new g.Trigger<CursorMovePoint>(),
    onRelease: new g.Trigger(),
    show: () => {
      pad.show();
      cursor.show();
    },
    hide: () => {
      pad.hide();
      cursor.hide();
    },
    destroy: () => {
      pad.destroy();
      cursor.destroy();
      result.onMoving.destroy();
      result.onRelease.destroy();
    }
  };

  return result;
}

export interface CursorMovePoint {
  /** パッドの傾き (-1 ~ 1) */
  padDir: g.CommonOffset;
  /** パッドに依る移動量 (傾き * 速度) */
  moved: g.CommonOffset;
  /** カーソルが画面端に接して移動しなかった量 */
  cursorRest: g.CommonOffset;
}
