
export function lineupPiece(
  seed: number,
  pieceCount: number,
  pieceSize: g.CommonSize,
  boardSize: g.CommonSize,
): g.CommonOffset[] {
  // 0.3 はピース枠の凸のサイズが0.25なので重ならないようにするマージン分
  const margine = { w: pieceSize.width * 0.3, h: pieceSize.height * 0.3 };
  const size = { w: pieceSize.width + margine.w * 2, h: pieceSize.height + margine.h * 2 };
  const tmp = { w: boardSize.width / size.w, h: boardSize.height / size.h };
  const int = { w: Math.floor(tmp.w), h: Math.floor(tmp.h) };
  const decimal = { w: tmp.w - int.w, h: tmp.h - int.h };

  const lineup = { w: int.w + 2, h: int.h + 2 };
  const nextPos = {
    x: boardSize.width - (size.w * ((1 - decimal.w) / 2)) + margine.w,
    y: boardSize.height - (size.h * ((1 - decimal.h) / 2)) + margine.h - size.h,
  };
  let dir: "right" | "bottom" | "left" | "top" = "right";
  let count = { w: 0, h: 0 };

  const positions: g.CommonOffset[] = [];

  for (let i = 0; i < pieceCount; i++) {
    positions.push({ ...nextPos });

    if (dir === "right") {
      nextPos.x += size.w;
      count.w += 1;
      if (count.w === lineup.w - 1) {
        count.w += 1;
        dir = "bottom";
      }
    } else if (dir === "bottom") {
      nextPos.y += size.h;
      count.h += 1;
      if (count.h === lineup.h) dir = "left";
    } else if (dir === "left") {
      nextPos.x -= size.w;
      count.w -= 1;
      if (count.w === 0) dir = "top";
    } else {
      nextPos.y -= size.h;
      count.h -= 1;
      if (count.h === -1) {
        dir = "right";
        count = { w: 0, h: 0 };
        lineup.w += 2;
        lineup.h += 2;
      }
    }
  }

  const random = new g.Xorshift(seed);
  for (let i = positions.length - 1; i > 0; i--) {
    const j = Math.floor(random.random() * (i + 1));
    [positions[i], positions[j]] = [positions[j], positions[i]];
  }

  return positions;
}
