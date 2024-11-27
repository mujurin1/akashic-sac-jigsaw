import { Label } from "@akashic-extension/akashic-label";
import { CamerableE, Client, createFont } from "akashic-sac";
import { ConnectPiece, FitPiece, ForceReleasePiece, HoldPiece, MovePiece, ReleasePiece } from "../../event/PlayingEvent";
import { GameStart } from "../../event/TitleEvent";
import { PlayerManager } from "../../util/PlayerManager";
import { createPieces } from "../../util/createPieces";
import { PreviewInfo } from "../../util/readAssets";
import { sendJoin } from "../share";
import { InputSystemControl, inputSystemControl } from "./InputSystem/InputSystem";
import { Piece } from "./Piece";
import { lineupPiece, MOVE_PIACE_SIZE, PREVIEW_ADJUST } from "./lineupPiece";

export interface PlayingState {
  readonly client: Client;
  readonly gameStart: GameStart;
  readonly layer: {
    readonly bg: g.FilledRect;
    // readonly playAreaCamera: CamerableE;
    readonly playArea: {
      readonly camerable: CamerableE;
      readonly movePieceArea: g.CommonArea;
      readonly board: g.E;
      readonly boardPreview: g.E;
      readonly boardFrame: g.E;
    };
    readonly ui: g.E;
  };
  /**
   * 元画像の左上位置のピースから順にインデックス付けられている\
   * この順序を変えてはならない
   */
  readonly pieces: Piece[];

  readonly isJoined: () => boolean;
  pieceOperaterControl: InputSystemControl;

  holdPiece: Piece | undefined;
  finishTime: number | undefined;
}

export async function Playing(client: Client, gameStart: GameStart, previewsInfo: PreviewInfo[]) {
  const unlockEvent = client.lockEvent();
  const state = await createPlayingState(client, gameStart, previewsInfo);

  // TODO: client.removeEventSet(...eventKeys);
  const eventKeys = [
    HoldPiece.receive(client, ({ playerId, pieceIndex }) => {
      if (playerId == null || playerId === g.game.selfId) return;

      const piece = state.pieces[pieceIndex];
      Piece.hold(piece, playerId);
    }),
    MovePiece.receive(client, ({ playerId, pieceIndex, point }) => {
      if (g.game.isSkipping) return;
      if (playerId == null || playerId === g.game.selfId) return;

      const piece = state.pieces[pieceIndex];
      piece.moveTo(point.x, point.y);
      piece.modified();
    }),
    ReleasePiece.receive(client, ({ pieceIndex, point }) => {
      const piece = state.pieces[pieceIndex];
      Piece.release(piece);

      if (point != null) {
        piece.moveTo(point.x, point.y);
        piece.modified();
      }
    }),
    ForceReleasePiece.receive(client, ({ pieceIndex }) => {
      const piece = state.pieces[pieceIndex];
      Piece.release(piece);
    }),
    FitPiece.receive(client, ({ playerId }) => {
      // const piece = state.pieces[];
      // Piece.fit(piece);
    }),
    ConnectPiece.receive(client, ({ playerId, parentIndex, childIndex }) => {
      const parent = state.pieces[parentIndex];
      const child = state.pieces[childIndex];
      Piece.connect(parent, child, gameStart);
      if (g.game.selfId === playerId)
        parent.parent!.append(parent);
    }),
  ];

  createUi(state);

  // アンロックは一番最後
  unlockEvent();
}


async function createPlayingState(client: Client, gameStart: GameStart, previewsInfo: PreviewInfo[]): Promise<PlayingState> {
  const { scene, clientDI } = client.env;
  const playerManager = clientDI.get(PlayerManager);

  const piecesResult = await createPieces({
    scene,
    randomSeed: gameStart.seed,
    imageSrc: previewsInfo[gameStart.puzzleIndex].imageAsset,
    origine: gameStart.origin,
    pieceSize: gameStart.pieceSize,
    pieceWH: gameStart.pieceWH,
  });
  const { preview } = piecesResult;

  const bg = new g.FilledRect({
    scene, parent: scene,
    cssColor: "#0087cc",
    width: g.game.width, height: g.game.height,
    touchable: true,
  });

  const playAreaCamera = new CamerableE({ scene, parent: scene });
  const movePieceArea = new g.FilledRect({
    scene, parent: playAreaCamera,
    cssColor: "#f008",
    width: preview.width * MOVE_PIACE_SIZE,
    height: preview.height * MOVE_PIACE_SIZE,
  });

  const board = new g.FilledRect({
    scene, parent: playAreaCamera,
    cssColor: "#ffffff50",
    width: preview.width, height: preview.height,
    x: preview.width * (1 + PREVIEW_ADJUST),
    y: preview.height * (1 + PREVIEW_ADJUST),
  });
  const boardPreview = new g.Sprite({
    scene, parent: board,
    src: preview.src,
    srcX: preview.srcX,
    srcY: preview.srcY,
    width: preview.width, height: preview.height,
    opacity: 0.5,
  });
  board.append(piecesResult.frame);

  const state: PlayingState = {
    pieces: piecesResult.pieces,
    client,
    gameStart,
    layer: {
      bg,
      playArea: {
        camerable: playAreaCamera,
        movePieceArea,
        board,
        boardPreview,
        boardFrame: piecesResult.frame,
      },
      ui: new g.E({ scene, parent: scene }),
    },

    isJoined() { return playerManager.has(g.game.selfId); },
    pieceOperaterControl: null!,
    holdPiece: undefined,
    finishTime: undefined,
  };

  Piece.pieceParentSetting(state.layer.playArea.camerable);
  state.pieceOperaterControl = inputSystemControl(state);

  return state;
}

function createUi(state: PlayingState) {
  const { gameStart, pieces, layer: { playArea: { camerable, board } } } = state;

  const positions = lineupPiece(gameStart.seed, pieces.length, gameStart.pieceSize, board);
  for (let i = 0; i < pieces.length; i++) {
    const piece = pieces[i];
    const position = positions[i];
    camerable.append(piece);
    piece.moveTo(position.x, position.y);
    piece.modified();
  }

  const parts = createParts(state);
}

/**
 * プレビューやランキングなどのパーツを作る
 */
function createParts(state: PlayingState) {
  const { client, layer: { playArea: { camerable }, ui } } = state;
  const { scene } = client.env;
  const font = createFont({ size: 50 });

  /** 左上の仮UI */
  {
    const zooomIn = new g.Label({
      scene, parent: ui, font, text: "In",
      x: 10, y: 10, touchable: true,
    });
    const zooomOut = new g.Label({
      scene, parent: ui, font, text: "Out",
      x: 90, y: 10, touchable: true,
    });
    const join = new g.Label({
      scene, parent: ui, font, text: "参加",
      x: 210, y: 10, touchable: true,
    });
    const change = new g.Label({
      scene, parent: ui, font, text: "変更",
      x: 330, y: 10, touchable: true,
    });
    zooomIn.onPointDown.add(() => {
      camerable.scale(camerable.scaleX * 0.9);
      camerable.modified();
    });
    zooomOut.onPointDown.add(() => {
      camerable.scale(camerable.scaleX * 1.1);
      camerable.modified();
    });
    join.onPointDown.add(sendJoin);
    change.onPointDown.add(() => state.pieceOperaterControl.toggle());

    const { board } = state.layer.playArea;
    camerable.moveTo(
      board.x + board.width / 2 + 500,
      board.y + board.height / 2,
    );
    camerable.scale(3);
    camerable.modified();
  }

  //#region 右上のやつ
  const infoPanel = new g.FilledRect({
    scene, parent: scene,
    cssColor: "rgba(255,255,255,0.5)",
    width: 300, height: 360,
    x: 950, y: 10,
  });
  const textFont = createFont({ size: 30 });
  const infoPart = {
    title: new Label({
      scene, parent: infoPanel,
      font: createFont({ size: 40 }),
      text: "タイトル",
      textAlign: "center",
      width: infoPanel.width,
      x: 0, y: 10,
    }),
    persent: new Label({
      scene, parent: infoPanel,
      font: textFont, text: "100%",
      textAlign: "right",
      width: 100,
      x: 0, y: 60,
    }),
    fitCount: new Label({
      scene, parent: infoPanel,
      font: textFont, text: "1000/1000",
      textAlign: "center",
      width: 180,
      x: 120, y: 60,
    }),
    time: new Label({
      scene, parent: infoPanel,
      font: textFont, text: "5時55分55秒",
      textAlign: "right",
      width: 280,
      x: 0, y: 100,
    }),
    players: [0, 1, 2, 3, 4].map(i => new Label({
      scene, parent: infoPanel,
      font: textFont, text: `GUEST00${i}    0`,
      // textAlign: "right",
      width: 280,
      x: 10, y: 150 + i * 40,
    })),
  } as const;
  //#endregion 右上のやつ

  return { infoPanel };
}
