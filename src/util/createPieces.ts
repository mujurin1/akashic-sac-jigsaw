import { CommonOffset, CommonRect, CommonSize, createImageDataFromSVGText, createSpriteFromImageData } from "akashic-sac";
import { CustomSprite } from "./CustomSprite";
import { Piece } from "../page/Playing/Piece";

export interface CreatePiecesParam {
  scene: g.Scene;

  /** 使用する乱数のシード値 */
  randomSeed: number;

  /** 切り抜く画像 */
  imageSrc: g.ImageAsset | g.Surface;
  /** 切り抜く原点（左上） */
  origine: CommonOffset;

  /** ピースのサイズ */
  pieceSize: CommonSize;
  /** ピースの縦横枚数 */
  pieceWH: CommonSize;
}

export interface CreatePiecesResult {
  preview: g.Sprite;
  frame: g.Sprite;
  pieces: Piece[];
}

/**
 * ピース枠の仕様
 * ・300x300 px 上下左右50px が他のピースの範囲（出っ張る部分）
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
<path d="M 0 50 L 75 50 A 29 29 0 1 1 125 50 L 200 50"
  stroke="red" stroke-width="12px" fill="transparent" stroke-linejoin="bevel" />
</svg>`;

/**
 * ピースを生成する\
 * サーバー環境で呼び出してはダメ
 * @param param 
 * @returns 
 */
export async function createPieces(param: CreatePiecesParam): Promise<CreatePiecesResult> {
  const { scene, } = param;
  // O:凸 X:凹 (見やすいように)
  type WakuType = "_" | "O" | "X";
  const wakuReverse = (w: WakuType) => w === "O" ? "X" : w === "X" ? "O" : "_";

  const margineW = param.pieceSize.width * 0.25;
  const margineH = param.pieceSize.height * 0.25;
  const wakuW = param.pieceSize.width + margineW * 2;
  const wakuH = param.pieceSize.height + margineH * 2;
  const boardW = param.pieceSize.width * param.pieceWH.width;
  const boardH = param.pieceSize.height * param.pieceWH.height;

  const preview = new g.Sprite({
    scene,
    src: param.imageSrc,
    srcX: param.origine.x,
    srcY: param.origine.y,
    width: boardW, height: boardH,
  });

  const [dekoImgData, bokoImgData, lineImgData] = await Promise.all([
    createImageDataFromSVGText(pieceDeko, wakuW, wakuH),
    createImageDataFromSVGText(pieceBoko, wakuW, wakuH),
    createImageDataFromSVGText(pieceLine, param.pieceSize.width, param.pieceSize.height),
    // TODO: ピースの縦横比が1:1でない場合は更に倍の通り作る必要がある
    // createImageDataFromSVGText(pieceDeko, wakuH, wakuW),
    // createImageDataFromSVGText(pieceBoko, wakuH, wakuW),
    // createImageDataFromSVGText(pieceLine, param.pieceSize.height, param.pieceSize.width),
  ]);

  const createWaku = (type: WakuType, angle: number): g.Sprite => {
    return createSpriteFromImageData(
      type === "O" ? dekoImgData : bokoImgData,
      {
        compositeOperation: "destination-out",
        scene, anchorX: null, angle,
      }
    );
  };

  const allWakus = {
    O: [270, 0, 90, 180].map(angle => createWaku("O", angle)),
    X: [270, 0, 90, 180].map(angle => createWaku("X", angle)),
  } as const;

  const tmpE = new g.E({ scene, ...param.pieceSize });
  tmpE.append(preview);
  const drawOffset: CommonRect = { left: margineW, top: margineH, right: margineW, bottom: margineH };

  /**
   * @param w 左からw個目のピース
   * @param h 上からh個目のピース
   * @param wakuTypes [左,上,右,下]
   */
  const stamp = (w: number, h: number, ...wakuTypes: [WakuType, WakuType, WakuType, WakuType]) => {
    preview.x = margineW - param.pieceSize.width * w;
    preview.y = margineH - param.pieceSize.height * h;
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
    return s;
  };

  const random = new g.Xorshift(param.randomSeed);

  // ピースの凸凹を作る (左/上から見たときに凸か凹か)
  const wOXs: WakuType[][] = [];
  const hOXs: WakuType[][] = [];

  for (let a = 0; a < param.pieceWH.width; a++) {
    const ary: WakuType[] = ["_"];
    for (let b = 0; b < param.pieceWH.height - 1; b++)
      ary.push(randomBool(random) ? "O" : "X");
    ary.push("_");
    wOXs.push(ary);
  }
  for (let a = 0; a < param.pieceWH.height; a++) {
    const ary: WakuType[] = ["_"];
    for (let b = 0; b < param.pieceWH.width - 1; b++)
      ary.push(randomBool(random) ? "O" : "X");
    ary.push("_");
    hOXs.push(ary);
  }

  // ピースを作る
  const pieces: Piece[] = [];

  for (let h = 0; h < param.pieceWH.height; h++) {
    for (let w = 0; w < param.pieceWH.width; w++) {
      const p = stamp(
        w, h,
        wakuReverse(wOXs[h][w]),
        wakuReverse(hOXs[w][h]),
        wOXs[h][w + 1],
        hOXs[w][h + 1],
      );
      Piece.setTag(p, h * param.pieceWH.height + w);
      pieces.push(p);
    }
  }

  // ピースの枠を作る
  const frameE = new g.E({ scene, width: boardW, height: boardH });
  const lineParam: Parameters<typeof createSpriteFromImageData>[1] = {
    scene, parent: frameE, anchorX: null
  };

  // TODO: ここの createSpriteFromImageData を無くす (canvas で生成する)
  for (let w = 0; w < param.pieceWH.width; w++) {
    for (let h = 0; h < param.pieceWH.height; h++) {
      // 右側
      const lineW = wOXs[h][w + 1];
      if (lineW !== "_") {
        lineParam.x = w * param.pieceSize.width + margineW;
        lineParam.y = h * param.pieceSize.height;
        lineParam.angle = 90;
        if (lineW === "X") {
          lineParam.angle += 180;
          lineParam.x += param.pieceSize.width - margineW * 2;
        }
        createSpriteFromImageData(lineImgData, lineParam);
      }
      // 下側
      const lineH = hOXs[w][h + 1];
      if (lineH !== "_") {
        lineParam.x = w * param.pieceSize.width;
        lineParam.y = h * param.pieceSize.height + margineH;
        lineParam.angle = 180;
        if (lineH === "X") {
          lineParam.angle += 180;
          lineParam.y += param.pieceSize.height - margineH * 2;
        }
        createSpriteFromImageData(lineImgData, lineParam);
      }
    }
  }

  const frame = g.SpriteFactory.createSpriteFromE(scene, frameE);
  frame.opacity = 0.5;
  frame.compositeOperation = "destination-out";
  frame.modified();

  for (const s of [...frameE.children!]) (<g.Sprite>s).destroy(true);

  preview.moveTo(0, 0);
  preview.modified();

  return {
    preview,
    pieces,
    frame,
  };
}

/**
 * e の描画内容を持つ CustomSprite を生成する\
 * 参照: https://github.com/akashic-games/akashic-engine/blob/0954383/src/SpriteFactory.ts#L14
 * @param scene 
 * @param e 生成元のエンティティ
 * @param drawOffset e の x,y,width,height から CustomSprite.drawOffset をどれくらいずらすか
 * @returns 
 */
function createCustomSpriteFromE(scene: g.Scene, e: g.E, drawOffset: CommonRect): CustomSprite {
  // 再描画フラグを立てたくないために e._matrix を直接触っている
  if (e._matrix) e._matrix._modified = true;

  const surfaceW = e.width + drawOffset.left + drawOffset.right;
  const surfaceH = e.height + drawOffset.top + drawOffset.bottom;

  const surface = scene.game.resourceFactory.createSurface(Math.ceil(surfaceW), Math.ceil(surfaceH));
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
