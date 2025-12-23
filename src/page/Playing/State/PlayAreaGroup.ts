import { Label } from "@akashic-extension/akashic-label";
import { CamerableE, createFont } from "akashic-sac";
import { toggleVisibleTo } from "../../../common/func";
import { BACKGROUND_COLOR } from "../PlayingClientConst";
import { ClientPlaying } from "./ClientPlaying";

/**
 * 階層
 * ```
 * camerable
 * |-pieceLimitArea
 * |-board
 * |  |-boardPreview
 * |  |-boardPieceFrame
 * |-pieceParent
 *    |-Pieces[]
 * ```
 */
export interface PlayAreaGroup {
  /** ピースやボードの存在する本当のプレイエリア */
  readonly camerable: CamerableE;

  /** ピースの移動可能な領域 */
  readonly playarea: g.FilledRect;

  /** ホントの背景 */
  readonly background: g.FilledRect;

  /** ピースをハメるボード */
  readonly board: g.E;
  /** ボードに表示する完成画像 */
  readonly boardPreview: g.E;
  /** ボードに表示するピース枠線 */
  readonly boardPieceFrame: g.E;

  /** ピースの親 */
  readonly pieceParent: g.E;

  /**
   * ボード上の完成画像の表示/非表示を切り替える
   * @param visibleTo `true`: 表示, `false`: 非表示, `undefined`: トグル
   */
  toggleBoardPreview(visibleTo?: boolean): void;
  /**
   * ボード上のピース枠線の表示/非表示を切り替える
   * @param visibleTo `true`: 表示, `false`: 非表示, `undefined`: トグル
   */
  toggleBoardPieceFrame(visibleTo?: boolean): void;

  /**
   * カメラのスケールを相対的に変更する
   * @param per 拡大縮小率
   * @param option.pos 拡大/縮小の中心座標 (画面上の座標) (default: 画面中央)
   */
  scaleBy(per: number, option?: ScaleOption): void;
  /**
   * カメラのスケールを絶対的に変更する
   * @param per 拡大縮小率
   * @param option.pos 拡大/縮小の中心座標 (画面上の座標) (default: 画面中央)
   */
  scaleTo(per: number, option?: ScaleOption): void;

  /**
   * カメラを相対的に動かす
   * @param x X方向の移動量 (カメラスケールの影響を受けます)
   * @param y Y方向の移動量 (カメラスケールの影響を受けます)
   */
  moveBy(x: number, y: number): void;
  /**
   * カメラを絶対的に動かす
   * @param x 画面上のX座標
   * @param y 画面上のY座標
   * @param option.centerPer 移動後のカメラの補正位置割合 (default: 中央)
   * @param option.ignoreScale カメラのスケールを無視して移動するかどうか (default: false)
   */
  moveTo(x: number, y: number, option?: MoveToOption): void;

  /**
   * @returns 次の背景色
   */
  toggleBackColor(): string;

  /**
   * カメラを初期位置にリセットする
   */
  reset(): void;
}

export function createPlayAreaGroup(clientPlaying: ClientPlaying): PlayAreaGroup {
  const scene = g.game.env.scene;
  const parent = clientPlaying.display;
  const {
    gameState,
    piecesResult: { preview, frame: boardPieceFrame },
  } = clientPlaying.playState;

  //#region MEMO: 背景 (昔の BgGroup 相当)
  const background = new g.FilledRect({
    scene, parent,
    cssColor: "rgba(255, 255, 255, 0.8)",
    width: g.game.width, height: g.game.height,
  });
  new g.Label({
    scene, parent: background,
    font: createFont({ size: 30 }),
    text: "パズルの領域から遠く離れると説明を読めます",
  });
  //#endregion

  const camerable = new CamerableE({ scene, parent, anchorX: 0, anchorY: 0 });
  // const pieceLimitArea = new g.E({
  //   scene, parent: camerable,
  //   width: gameState.pieceAreaLimit.width,
  //   height: gameState.pieceAreaLimit.height,
  // });

  const playarea = new g.FilledRect({
    scene, parent: camerable,
    cssColor: BACKGROUND_COLOR.colors[0],
    width: gameState.pieceAreaLimit.width,
    height: gameState.pieceAreaLimit.height,
  });

  const board = new g.FilledRect({
    scene, parent: camerable,
    cssColor: "#ffffff50",
    width: preview.width, height: preview.height,
    x: gameState.boardArea.x,
    y: gameState.boardArea.y,
  });
  const boardPreview = new g.Sprite({
    scene, parent: board,
    src: preview.src,
    srcX: preview.srcX,
    srcY: preview.srcY,
    width: preview.width, height: preview.height,
    opacity: 0.5,
  });
  board.append(boardPieceFrame);

  const pieceParent = new g.E({ scene, parent: camerable });


  const displayResult = createDisplay(clientPlaying, background);


  return {
    camerable,
    playarea,
    background,

    board,
    boardPreview,
    boardPieceFrame,

    pieceParent,

    toggleBoardPreview: (value) => toggleVisibleTo(boardPreview, value),
    toggleBoardPieceFrame: (value) => toggleVisibleTo(boardPieceFrame, value),

    scaleBy, scaleTo,
    moveBy, moveTo,

    toggleBackColor,

    reset,
  };

  function scaleBy(_per: number, option?: ScaleOption) {
    scaleTo(camerable.scaleX * _per, option);
  }
  function scaleTo(per: number, option?: ScaleOption) {
    const posX = option?.pos?.x ?? g.game.width * 0.5;
    const posY = option?.pos?.y ?? g.game.height * 0.5;

    const prevScale = camerable.scaleX;
    camerable.scale(per);

    const cx = posX / g.game.width;
    const cy = posY / g.game.height;
    const scaleW = camerable.width * prevScale;
    const scaleH = camerable.height * prevScale;
    const offsetX = cx * scaleW * (1 - per / prevScale);
    const offsetY = cy * scaleH * (1 - per / prevScale);
    camerable.moveBy(offsetX, offsetY);

    camerable.modified();

    cameraMoved();
  }

  function moveBy(dx: number, dy: number) {
    const x = dx * camerable.scaleX;
    const y = dy * camerable.scaleY;
    camerable.moveBy(x, y);
    camerable.modified();

    cameraMoved();
  }
  function moveTo(x: number, y: number, option?: MoveToOption) {
    const centerPer = option?.centerPer ?? { x: 0.5, y: 0.5 };
    const offsetX = g.game.width * camerable.scaleX * centerPer.x;
    const offsetY = g.game.height * camerable.scaleY * centerPer.y;
    camerable.moveTo(
      x * (option?.ignoreScale ? camerable.scaleX : 1) - offsetX,
      y * (option?.ignoreScale ? camerable.scaleY : 1) - offsetY,
    );
    camerable.modified();

    cameraMoved();
  }

  function reset() {
    // ボードの中央が画面中央に来るように移動
    const pieceAreaLimit = clientPlaying.playState.gameState.pieceAreaLimit;
    moveTo(pieceAreaLimit.width / 2, pieceAreaLimit.height / 2);

    // ボード全体が画面に収まるように拡大縮小
    scaleTo(((board.width + board.height) * 2.5) / (g.game.width + g.game.height));

    // 画面右上の Info パネルを避けて、大体中央になるように移動
    // > 0.257 = 「右上の Info パネル」が画面の横幅に占める割合 (横幅)
    moveBy((g.game.width * 0.257 / 2), 0);
  }

  function toggleBackColor(): string {
    const color = BACKGROUND_COLOR.nextColorMap[playarea.cssColor];
    playarea.cssColor = color;
    playarea.modified();

    if (color === "transparent") {
      background.hide();
    } else if (!background.visible()) {
      background.show();
    }

    return BACKGROUND_COLOR.nextColorMapIcon[color];
  }


  function cameraMoved() {
    if (cameraOverd()) {
      displayResult.switchJigsawViewOut(true);
    } else {
      displayResult.switchJigsawViewOut(false);
    }
  }

  /** カメラがジグソーの外にあるか判定する */
  function cameraOverd(): boolean {
    const x = camerable.x;
    const y = camerable.y;

    const leftTopX = g.game.width * camerable.scaleX;
    const leftTopY = g.game.height * camerable.scaleY;
    const rightBottom = clientPlaying.playState.gameState.pieceAreaLimit;
    return x < -leftTopX || rightBottom.width < x ||
      y < -leftTopY || rightBottom.height < y;
  }
}


interface ScaleOption {
  /**
   * 拡大/縮小の中心座標 (画面上の座標)
   * @default 画面中央
   */
  pos?: { x: number; y: number; };
}

interface MoveToOption {
  /**
   * 移動後のカメラの補正位置割合\
   * `0`: 左上  `1`: 右下
   * @default {x:0.5,y:0.5}  (中央) 
   */
  centerPer?: { x: number; y: number; };

  /**
   * カメラのスケールを無視して移動するかどうか
   * @default false
   */
  ignoreScale?: boolean;
}



function createDisplay(clientPlaying: ClientPlaying, background: g.FilledRect): {
  switchJigsawViewOut(visible: boolean): void;
} {
  const scene = g.game.env.scene;
  const parent = new g.E({ scene, parent: background, hidden: true });

  const updates = new Label({
    scene, parent,
    font: createFont({ size: 30 }),
    x: 10,
    text: `

＝＝＝＝　機能など　＝＝＝＝
・マウスホイールで拡大縮小 (Ctrl を押しながらで高速)
`,
    width: 940,
  });

  const helpText = new g.Label({
    scene, parent,
    x: 0, y: 650,
    width: 900,
    widthAutoAdjust: false,
    textAlign: "right",
    text: "歯車で画面位置をリセットできます↗",
    font: createFont({ size: 40 }),
  });

  return {
    switchJigsawViewOut(outside: boolean) {
      if (outside === parent.visible()) return;
      if (outside) parent.show();
      else parent.hide();
    },
  };
}
