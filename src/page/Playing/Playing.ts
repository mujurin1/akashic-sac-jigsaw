import { CamerableE, Client, CommonSize, createFont } from "akashic-sac";
import { createPieces } from "../../util/createPieces";
import { lineupPiece } from "./lineupPiece";
import { GameStart } from "../../event/TitleEvent";
import { ForceReleasePiece, HoldPiece, MovePiece, ReleasePiece } from "../../event/PlayingEvent";
import { Piece } from "./Piece";
import { sendJoin } from "../share";
import { InputSystemControl, inputSystemControl } from "./InputSystem";
import { PlayerManager } from "../../util/PlayerManager";

export interface PlayingState {
  readonly client: Client;
  readonly gameStart: GameStart;
  readonly preview: g.Sprite;
  readonly frame: g.Sprite;
  /**
   * 左上から順にインデックス付けられている. この順序を変えてはならない\
   * ただし、piece.parent の中での順序やピースの存在は変化する可能性がある
   */
  readonly pieces: readonly Piece[];
  readonly playAreaSize: CommonSize;
  readonly layer: {
    readonly bg: g.FilledRect;
    readonly playArea: CamerableE;
    readonly ui: g.E;
  };

  isJoined(): boolean;
  pieceOperaterControl: InputSystemControl;

  holdPiece: Piece | undefined;
  finishTime: number | undefined;
}

export async function Playing(client: Client, gameStart: GameStart) {
  const { scene, clientDI } = client.env;
  const playerManager = clientDI.get(PlayerManager);
  const unlockEvent = client.lockEvent();

  const result = await createPieces({
    scene,
    randomSeed: gameStart.seed,
    imageSrc: scene.asset.getImageById("fox"),
    origine: gameStart.origine,
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


  // アンロックは一番最後
  unlockEvent();
}

/**
 * 画面UIを生成する
 * @param state 
 */
function createUi(state: PlayingState) {
  const { client, gameStart, preview, layer: { playArea, ui }, frame, pieces } = state;
  const { scene } = client.env;

  const font = createFont({ size: 50 });

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

  // 仮UI
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
    change.onPointDown.add(() => {
      state.pieceOperaterControl.toggle(
        state.pieceOperaterControl.currentType === "mobile" ? "pc" : "mobile"
      );
    });
  }

  const positions = lineupPiece(gameStart.seed, pieces.length, gameStart.pieceSize, board);
  for (let i = 0; i < pieces.length; i++) {
    const piece = pieces[i];
    const position = positions[i];
    playArea.append(piece);
    piece.moveTo(position.x, position.y);
    piece.modified();
  }
}
