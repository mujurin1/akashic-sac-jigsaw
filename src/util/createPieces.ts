import { imageDataUtil } from "akashic-sac";
import { CustomSprite } from "../common/CustomSprite";
import { Piece } from "../page/Playing/Piece";
import { GameState } from "../share/GameState";

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

interface WH { readonly w: number; readonly h: number; }
interface XY { readonly x: number; readonly y: number; }

interface Numbers {
  readonly piece: WH;
  readonly pieceSize: WH;
  readonly boardArea: WH;
  readonly origin: XY;

  // 計算後の値
  readonly margin: WH;
  readonly waku: WH;
}

function createNumbers(gameState: GameState): Numbers {
  const piece = {
    w: gameState.pieceWH.width,
    h: gameState.pieceWH.height
  };
  const pieceSize = {
    w: gameState.pieceSize.width,
    h: gameState.pieceSize.height
  };
  const boardArea = {
    w: gameState.boardArea.width,
    h: gameState.boardArea.height
  };
  const origin = {
    x: gameState.origin.x,
    y: gameState.origin.y
  };

  const margin = {
    w: pieceSize.w * 0.25,
    h: pieceSize.h * 0.25
  };
  const waku = {
    w: pieceSize.w + margin.w * 2,
    h: pieceSize.h + margin.h * 2
  };

  return {
    piece,
    pieceSize,
    boardArea,
    origin,

    margin,
    waku,
  };
}

export interface PieceParameter {
  readonly imageSrc: g.ImageAsset | g.Surface;
  readonly random: g.Xorshift;
  readonly numbers: Numbers;

  // ピースの凸凹 (その向きの面が凸か凹か)
  readonly rightOXs: WakuType[][];
  readonly bottomOXs: WakuType[][];
}


/**
 * この関数及び派生した関数はサーバー環境で呼び出してはダメ
 */
export function createPieceParameter(
  gameState: GameState,
  imageSrc: g.ImageAsset | g.Surface,
): PieceParameter {
  const random = new g.Xorshift(gameState.seed);
  const numbers = createNumbers(gameState);

  const rightOXs: WakuType[][] = [];
  const bottomOXs: WakuType[][] = [];

  for (let a = 0; a < numbers.piece.h; a++) {
    const ary: WakuType[] = ["_"];
    for (let b = 0; b < numbers.piece.w - 1; b++)
      ary.push(randomBool(random) ? "O" : "X");
    ary.push("_");
    rightOXs.push(ary);
  }
  for (let a = 0; a < numbers.piece.w; a++) {
    const ary: WakuType[] = ["_"];
    for (let b = 0; b < numbers.piece.h - 1; b++)
      ary.push(randomBool(random) ? "O" : "X");
    ary.push("_");
    bottomOXs.push(ary);
  }

  return {
    imageSrc,
    random,
    numbers,
    rightOXs,
    bottomOXs,
  };
}

export async function createPieces__(param: PieceParameter): Promise<Piece[]> {
  const { numbers, imageSrc, rightOXs, bottomOXs } = param;
  const scene = g.game.env.scene;

  const marginW = numbers.pieceSize.w * 0.25;
  const marginH = numbers.pieceSize.h * 0.25;
  const wakuW = numbers.pieceSize.w + marginW * 2;
  const wakuH = numbers.pieceSize.h + marginH * 2;
  const boardW = numbers.boardArea.w;
  const boardH = numbers.boardArea.h;

  const [dekoImgData, bokoImgData] = await Promise.all([
    imageDataUtil.fromSvgText(pieceDeko, wakuW, wakuH),
    imageDataUtil.fromSvgText(pieceBoko, wakuW, wakuH),
  ]);

  const preview = new g.Sprite({
    scene,
    src: imageSrc,
    srcX: numbers.origin.x,
    srcY: numbers.origin.y,
    width: boardW, height: boardH,
  });
  const tmpE = new g.E({ scene, width: numbers.pieceSize.w, height: numbers.pieceSize.h });
  tmpE.append(preview);
  const waku4Dirs = {
    O: createWaku4Dir("O"),
    X: createWaku4Dir("X"),
  } as const;

  const drawOffset: g.CommonRect = { left: marginW, top: marginH, right: marginW, bottom: marginH };

  const pieces: Piece[] = [];

  for (let h = 0; h < numbers.piece.h; h++) {
    for (let w = 0; w < numbers.piece.w; w++) {
      const p = stamp(
        w, h,
        WakuReverse[rightOXs[h][w]],
        WakuReverse[bottomOXs[w][h]],
        rightOXs[h][w + 1],
        bottomOXs[w][h + 1],
      );
      Piece.setTag(p, h * numbers.piece.w + w);
      pieces.push(p);
    }
  }

  preview.destroy();
  tmpE.destroy();
  for (const waku of waku4Dirs.O) waku.destroy();
  for (const waku of waku4Dirs.X) waku.destroy();

  return pieces;


  /**
   * ピースを生成する
   * @param w 左からw個目のピース
   * @param h 上からh個目のピース
   * @param wakuTypes [左,上,右,下]
   */
  function stamp(w: number, h: number, ...wakuTypes: [WakuType, WakuType, WakuType, WakuType]): Piece {
    preview.x = marginW - numbers.pieceSize.w * w;
    preview.y = marginH - numbers.pieceSize.h * h;
    // preview.modified();  // 無くても良いみたい

    const addedWakus: g.Sprite[] = [];
    for (const i of [0, 1, 2, 3]) {
      const waku = wakuTypes[i];
      if (waku === "_") continue;
      const wakuE = waku4Dirs[waku][i];
      tmpE.append(wakuE);
      addedWakus.push(wakuE);
    }

    const s = createCustomSpriteFromE(scene, tmpE, drawOffset);
    for (const waku of addedWakus) waku.remove();
    return s as Piece;
  }

  function createWaku4Dir(type: WakuType) {
    const imgData = type === "O" ? dekoImgData : bokoImgData;
    const params = {
      compositeOperation: "destination-out",
      scene, anchorX: null,
    } as const;

    return [270, 0, 90, 180].map(angle =>
      imageDataUtil.toSprite(imgData, { ...params, angle })
    );
  }
}

export async function createFrames(param: PieceParameter): Promise<g.Sprite> {
  const { numbers, imageSrc, rightOXs, bottomOXs } = param;
  const scene = g.game.env.scene;

  const marginW = numbers.pieceSize.w * 0.25;
  const marginH = numbers.pieceSize.h * 0.25;
  const boardW = numbers.boardArea.w;
  const boardH = numbers.boardArea.h;

  const frameE = new g.E({ scene, width: boardW, height: boardH });
  const lineParam: Parameters<typeof imageDataUtil.toSprite>[1] = {
    scene, parent: frameE, anchorX: null
  };

  const lineImgData = await imageDataUtil.fromSvgText(pieceLine, numbers.pieceSize.w, numbers.pieceSize.h);

  let baseX = 0;
  for (let w = 0; w < numbers.piece.w; w++) {
    let baseY = 0;
    for (let h = 0; h < numbers.piece.h; h++) {
      stampRight(rightOXs[h][w + 1], baseX, baseY);
      stampBottom(bottomOXs[w][h + 1], baseX, baseY);

      baseY += numbers.pieceSize.h;
    }
    baseX += numbers.pieceSize.w;
  }


  const preview = new g.Sprite({
    scene,
    src: imageSrc,
    srcX: numbers.origin.x,
    srcY: numbers.origin.y,
    width: boardW, height: boardH,
  });

  const frame = g.SpriteFactory.createSpriteFromE(scene, frameE);
  frame.opacity = 0.5;
  frame.compositeOperation = "destination-out";
  frame.moveTo(preview.x, preview.y);
  frame.modified();

  frameE.destroy();
  preview.destroy();

  // TODO: createSpriteFactory する。でないと透過される
  return frame;

  // TODO: 下２つの関数 imageDataUtil.toSprite を無くす (canvas で生成する)

  function stampRight(type: WakuType, baseX: number, baseY: number): void {
    if (type === "_") return;

    lineParam.y = baseY;
    if (type === "X") {
      lineParam.x = baseX + marginW;
      lineParam.angle = 90;
    } else {
      lineParam.x = baseX + numbers.pieceSize.w - marginW;
      lineParam.angle = 270;
    }

    imageDataUtil.toSprite(lineImgData, lineParam);
  }

  function stampBottom(type: WakuType, baseX: number, baseY: number): void {
    if (type === "_") return;

    lineParam.x = baseX;
    if (type === "X") {
      lineParam.y = baseY + marginH;
      lineParam.angle = 180;
    } else {
      lineParam.y = baseY + numbers.pieceSize.h - marginH;
      lineParam.angle = 0;
    }

    imageDataUtil.toSprite(lineImgData, lineParam);
  }
}





export interface CreatePiecesResult {
  /**
   * @deprecated できればこれはこれを使う場所で生成したい
   */
  readonly preview: g.Sprite;
  /**
   * @deprecated できればこれはこれを使う場所で生成したい
   */
  readonly frame: g.Sprite;
  readonly pieces: Piece[];
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
