import { imageDataUtil } from "akashic-sac";
import { CustomSprite } from "../common/CustomSprite";
import { Piece } from "../page/Playing/Piece";
import { GameState } from "./GameState";

/**
 * ピース枠の仕様
 * * 300x300 px 上下左右50px が他のピースの範囲（出っ張る部分）
 */
const pieceDeko = `
<svg width="300" height="300" version="1.1" xmlns="http://www.w3.org/2000/svg">
<path d="M 0 0 L 0 50 L 125 50 A 31 31 0 1 1 175 50 L 300 50 L 300 0 Z" />
</svg>`;
const pieceBoko = `
<svg width="300" height="300" version="1.1" xmlns="http://www.w3.org/2000/svg">
<path d="M 0 0 L 0 50 L 125 50 A 31 31 0 1 0 175 50 L 300 50 L 300 0 Z" />
</svg>`;
const pieceLine = `
<svg width="200" height="200" version="1.1" xmlns="http://www.w3.org/2000/svg">
<path d="M 0 50 L 75 50 A 31 31 0 1 0 125 50 L 200 50"
  stroke="red" stroke-width="12px" fill="transparent" stroke-linejoin="bevel" />
</svg>`;

// O:凸 X:凹 _:壁
type WakuType = "_" | "O" | "X";
const WakuReverse = { O: "X", X: "O", _: "_" } as const;

export interface CreatePiecesResult {
  readonly preview: g.Sprite;
  readonly frame: g.Sprite;
  readonly pieces: Piece[];
}

/**
 * ピースを生成する\
 * サーバー環境で呼び出してはダメ
 */
export async function createPieces(
  scene: g.Scene,
  gameState: GameState,
  imageSrc: g.ImageAsset | g.Surface,
): Promise<CreatePiecesResult> {
  const marginW = gameState.pieceSize.width * 0.25;
  const marginH = gameState.pieceSize.height * 0.25;
  const wakuW = gameState.pieceSize.width + marginW * 2;
  const wakuH = gameState.pieceSize.height + marginH * 2;
  const boardW = gameState.board.width;
  const boardH = gameState.board.height;

  const preview = new g.Sprite({
    scene,
    src: imageSrc,
    srcX: gameState.origin.x,
    srcY: gameState.origin.y,
    width: boardW, height: boardH,
  });

  const [dekoImgData, bokoImgData, lineImgData] = await Promise.all([
    imageDataUtil.fromSvgText(pieceDeko, wakuW, wakuH),
    imageDataUtil.fromSvgText(pieceBoko, wakuW, wakuH),
    imageDataUtil.fromSvgText(pieceLine, gameState.pieceSize.width, gameState.pieceSize.height),
    // TODO: ピースの縦横比が1:1でない場合は更に倍の通り作る必要がある
    // imageDataUtil.fromSvgText(pieceDeko, wakuH, wakuW),
    // imageDataUtil.fromSvgText(pieceBoko, wakuH, wakuW),
    // imageDataUtil.fromSvgText(pieceLine, param.pieceSize.height, param.pieceSize.width),
  ]);

  const allWakus = {
    O: createWaku("O"),
    X: createWaku("X"),
  } as const;

  const tmpE = new g.E({ scene, ...gameState.pieceSize });
  tmpE.append(preview);
  const drawOffset: g.CommonRect = { left: marginW, top: marginH, right: marginW, bottom: marginH };
  const random = new g.Xorshift(gameState.seed);

  // ピースの凸凹を作る (左/上から見たときに凸か凹か)
  const wOXs: WakuType[][] = [];
  const hOXs: WakuType[][] = [];

  for (let a = 0; a < gameState.pieceWH.height; a++) {
    const ary: WakuType[] = ["_"];
    for (let b = 0; b < gameState.pieceWH.width - 1; b++)
      ary.push(randomBool(random) ? "O" : "X");
    ary.push("_");
    wOXs.push(ary);
  }
  for (let a = 0; a < gameState.pieceWH.width; a++) {
    const ary: WakuType[] = ["_"];
    for (let b = 0; b < gameState.pieceWH.height - 1; b++)
      ary.push(randomBool(random) ? "O" : "X");
    ary.push("_");
    hOXs.push(ary);
  }

  // ピースを作る
  const pieces: Piece[] = [];

  for (let h = 0; h < gameState.pieceWH.height; h++) {
    for (let w = 0; w < gameState.pieceWH.width; w++) {
      const p = stamp(
        w, h,
        WakuReverse[wOXs[h][w]],
        WakuReverse[hOXs[w][h]],
        wOXs[h][w + 1],
        hOXs[w][h + 1],
      );
      Piece.setTag(p, h * gameState.pieceWH.width + w);
      pieces.push(p);
    }
  }

  // ピースの枠を作る
  const frameE = new g.E({ scene, width: boardW, height: boardH });
  const lineParam: Parameters<typeof imageDataUtil.toSprite>[1] = {
    scene, parent: frameE, anchorX: null
  };

  // TODO: ここの imageDataUtil.toSprite を無くす (canvas で生成する)
  let baseX = 0;
  for (let w = 0; w < gameState.pieceWH.width; w++) {
    let baseY = 0;
    for (let h = 0; h < gameState.pieceWH.height; h++) {
      // 右側
      const lineW = wOXs[h][w + 1];
      if (lineW !== "_") {
        lineParam.x = baseX + gameState.pieceSize.width - marginW;
        lineParam.y = baseY;
        lineParam.angle = 270;
        if (lineW === "X") {
          lineParam.x = baseX + marginW;
          lineParam.angle = 90;
        }
        imageDataUtil.toSprite(lineImgData, lineParam);
      }
      // 下側
      const lineH = hOXs[w][h + 1];
      if (lineH !== "_") {
        lineParam.x = baseX;
        lineParam.y = baseY + gameState.pieceSize.height - marginH;
        lineParam.angle = 0;
        if (lineH === "X") {
          lineParam.y = baseY + marginH;
          lineParam.angle = 180;
        }
        imageDataUtil.toSprite(lineImgData, lineParam);
      }

      baseY += gameState.pieceSize.height;
    }
    baseX += gameState.pieceSize.width;
  }

  preview.moveTo(0, 0);
  preview.modified();

  const frame = g.SpriteFactory.createSpriteFromE(scene, frameE);
  frame.opacity = 0.5;
  frame.compositeOperation = "destination-out";
  frame.moveTo(preview.x, preview.y);
  frame.modified();

  for (const s of [...frameE.children!]) (<g.Sprite>s).destroy(true);

  return { preview, pieces, frame };

  /**
   * ピースを生成する
   * @param w 左からw個目のピース
   * @param h 上からh個目のピース
   * @param wakuTypes [左,上,右,下]
   */
  function stamp(w: number, h: number, ...wakuTypes: [WakuType, WakuType, WakuType, WakuType]): Piece {
    preview.x = marginW - gameState.pieceSize.width * w;
    preview.y = marginH - gameState.pieceSize.height * h;
    // preview.modified();  // 無くても良いみたい

    const wakus: g.Sprite[] = [];
    for (const i of [0, 1, 2, 3]) {
      const waku = wakuTypes[i];
      if (waku === "_") continue;
      const wakuE = allWakus[waku][i];
      tmpE.append(wakuE);
      wakus.push(wakuE);
    }

    const s = createCustomSpriteFromE(scene, tmpE, drawOffset);
    for (const waku of wakus) waku.remove();
    return s as Piece;
  }

  function createWaku(type: WakuType) {
    const ary: g.Sprite[] = [];
    for (const angle of [270, 0, 90, 180]) {
      ary.push(
        imageDataUtil.toSprite(
          type === "O" ? dekoImgData : bokoImgData,
          {
            compositeOperation: "destination-out",
            scene, anchorX: null, angle,
          }
        )
      );
    }
    return ary;
  }
}

/**
 * e の描画内容を持つ CustomSprite を生成する\
 * 参照: https://github.com/akashic-games/akashic-engine/blob/0954383/src/SpriteFactory.ts#L14
 * @param scene 
 * @param e 生成元のエンティティ
 * @param drawOffset e の x,y,width,height から CustomSprite.drawOffset をどれくらいずらすか
 * @returns 
 */
function createCustomSpriteFromE(scene: g.Scene, e: g.E, drawOffset: g.CommonRect): CustomSprite {
  // 再描画フラグを立てたくないために e._matrix を直接触っている
  if (e._matrix) e._matrix._modified = true;

  const surfaceW = e.width + drawOffset.left + drawOffset.right;
  const surfaceH = e.height + drawOffset.top + drawOffset.bottom;

  const surface = scene.game.resourceFactory.createSurface(Math.floor(surfaceW), Math.floor(surfaceH));
  const renderer = surface.renderer();
  renderer.begin();
  e.render(renderer);
  renderer.end();

  const s = new CustomSprite({
    scene: scene,
    src: surface,
    width: e.width,
    height: e.height,
    drawOffset,
  });

  if (e._matrix) e._matrix._modified = true;

  return s;
}

function randomBool(random: g.Xorshift): boolean {
  const [a, b] = random.randomInt();
  return a < b;
}
