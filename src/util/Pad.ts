import { CommonOffset } from "akashic-sac";

export interface PadParam {
  scene: g.Scene;
  padParent: g.E;
  cursorParent: g.E;
  x: number; y: number;
  cursorSpeed: number;
  hidden?: boolean;
}

export function createPad({ scene, padParent, cursorParent, x, y, cursorSpeed, hidden }: PadParam) {
  const width = 200, height = 200;

  let padDir: CommonOffset | undefined;

  const pad = new g.FilledRect({
    scene, parent: padParent,
    cssColor: "red",
    height, width,
    x, y,
    touchable: true,
    hidden,
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
    result.onStop.fire();
  });

  pad.onUpdate.add(() => {
    if (padDir == null) return;

    const moved = { x: padDir.x * cursorSpeed, y: padDir.y * cursorSpeed };
    const cursorRest = { x: 0, y: 0 };
    const newPos = { x: cursor.x + moved.x, y: cursor.y + moved.y };

    if (newPos.x < 0) {
      cursorRest.x = newPos.x;
      newPos.x = 0;
    } else if (cursorParent.width < newPos.x) {
      cursorRest.x = newPos.x - cursorParent.width;
      newPos.x = cursorParent.width;
    }
    if (newPos.y < 0) {
      cursorRest.y = newPos.y;
      newPos.y = 0;
    } else if (cursorParent.height < newPos.y) {
      cursorRest.y = newPos.y - cursorParent.height;
      newPos.y = cursorParent.height;
    }

    cursor.moveTo(newPos.x, newPos.y);
    cursor.modified();

    result.onMoveing.fire({ padDir, moved, cursorRest });
  });

  const cursor = new g.FilledRect({
    scene, parent: cursorParent,
    cssColor: "yellow",
    width: 50, height: 50,
    // anchorX: 0.5, anchorY: 0.5,
    x: cursorParent.width / 2, y: cursorParent.height / 2,
  });

  const result = {
    pad,
    cursor,
    cursorSpeed,
    onMoveing: new g.Trigger<CursorMovePoint>(),
    onStop: new g.Trigger(),
  };

  return result;
}

export interface CursorMovePoint {
  /** パッドの傾き (-1 ~ 1) */
  padDir: CommonOffset;
  /** パッドに依る移動量 (傾き * 速度) */
  moved: CommonOffset;
  /** カーソルが画面端に接して移動しなかった量 */
  cursorRest: CommonOffset;
}
