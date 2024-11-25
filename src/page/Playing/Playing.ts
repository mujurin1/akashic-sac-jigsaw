import { Label } from "@akashic-extension/akashic-label";
import { CamerableE, Client, createFont } from "akashic-sac";
import { ForceReleasePiece, HoldPiece, MovePiece, ReleasePiece } from "../../event/PlayingEvent";
import { GameStart } from "../../event/TitleEvent";
import { PlayerManager } from "../../util/PlayerManager";
import { createPieces } from "../../util/createPieces";
import { PreviewInfo } from "../../util/readAssets";
import { sendJoin } from "../share";
import { InputSystemControl, inputSystemControl } from "./InputSystem/InputSystem";
import { Piece } from "./Piece";
import { lineupPiece } from "./lineupPiece";

export interface PlayingState {
  readonly client: Client;
  readonly gameStart: GameStart;
  readonly preview: g.Sprite;
  readonly frame: g.Sprite;
  /**
   * 元画像の左上位置のピースから順にインデックス付けられている. この順序を変えてはならない
   */
  readonly pieces: readonly Piece[];
  readonly playAreaSize: g.CommonSize;
  readonly layer: {
    readonly bg: g.FilledRect;
    readonly playArea: CamerableE;
    readonly ui: g.E;
  };

  isJoined: () => boolean;
  pieceOperaterControl: InputSystemControl;

  holdPiece: Piece | undefined;
  finishTime: number | undefined;
}

export async function Playing(client: Client, gameStart: GameStart, previewsInfo: PreviewInfo[]) {
  const { scene, clientDI } = client.env;
  const playerManager = clientDI.get(PlayerManager);
  const unlockEvent = client.lockEvent();

  const result = await createPieces({
    scene,
    randomSeed: gameStart.seed,
    imageSrc: previewsInfo[gameStart.puzzleIndex].imageAsset,
    origine: gameStart.origin,
    pieceSize: gameStart.pieceSize,
    pieceWH: gameStart.pieceWH,
  });

  const state: PlayingState = {
    ...result,
    client,
    gameStart,
    playAreaSize: { width: result.preview.width * 3, height: result.preview.height * 3 },
    layer: {
      bg: new g.FilledRect({
        scene, parent: scene,
        cssColor: "#0087cc",
        width: g.game.width, height: g.game.height,
        touchable: true,
      }),
      playArea: new CamerableE({ scene, parent: scene }),
      ui: new g.E({ scene, parent: scene }),
    },

    isJoined() { return playerManager.has(g.game.selfId); },
    pieceOperaterControl: null!,
    holdPiece: undefined,
    finishTime: undefined,
  };

  // ピースを動かせるエリア
  new g.FilledRect({
    scene, parent: state.layer.playArea,
    cssColor: "#f008",
    width: state.preview.width * 3,
    height: state.preview.height * 3,
  });

  Piece.pieceParentSetting(state.layer.playArea);
  state.pieceOperaterControl = inputSystemControl(state);

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
      // if (playerId == null || playerId === g.game.selfId) return;

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
  ];

  createUi(state);
  const parts = createParts(state);


  // アンロックは一番最後
  unlockEvent();
}


function createUi(state: PlayingState) {
  const { client, gameStart, preview, layer: { playArea }, frame, pieces } = state;
  const { scene } = client.env;


  const board = new g.FilledRect({
    scene, parent: playArea,
    cssColor: "#ffffff50",
    width: preview.width, height: preview.height,
    x: preview.width, y: preview.height,
  });

  preview.opacity = 0.5;
  preview.modified();
  board.append(preview);
  board.append(frame);

  const positions = lineupPiece(gameStart.seed, pieces.length, gameStart.pieceSize, board);
  for (let i = 0; i < pieces.length; i++) {
    const piece = pieces[i];
    const position = positions[i];
    playArea.append(piece);
    piece.moveTo(position.x, position.y);
    piece.modified();
  }
}

/**
 * プレビューやランキングなどのパーツを作る
 */
function createParts(state: PlayingState) {
  const { client, layer: { playArea, ui } } = state;
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
      playArea.scale(playArea.scaleX * 0.9);
      playArea.modified();
    });
    zooomOut.onPointDown.add(() => {
      playArea.scale(playArea.scaleX * 1.1);
      playArea.modified();
    });
    join.onPointDown.add(sendJoin);
    change.onPointDown.add(() => state.pieceOperaterControl.toggle());
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
