import { Label } from "@akashic-extension/akashic-label";
import { CamerableE, createFont, SacClient } from "akashic-sac";
import { ConnectPiece, FitPiece, ForceReleasePiece, HoldPiece, MovePiece, ReleasePiece } from "../../event/PlayingEvent";
import { GameStart } from "../../event/TitleEvent";
import { sendJoin } from "../../server_client";
import { createPieces } from "../../util/createPieces";
import { createGameState, GameState } from "../../util/GameState";
import { Player, PlayerManager } from "../../util/PlayerManager";
import { PreviewInfo } from "../../util/readAssets";
import { InputSystemControl, inputSystemControl } from "./InputSystem/InputSystem";
import { Piece } from "./Piece";

export interface ClientPlayingState {
  readonly client: SacClient;
  readonly gameState: GameState;
  /**
   * 階層
   * ```
   * scene
   * |-bg
   * |-camerable
   *    |-pieceLimitArea
   *    |-board
   *    |  |-boardPreview
   *    |  |-boardPieceFrame
   *    |-pieceParent
   *       |-Pieces[]
   * ```
   */
  readonly playArea: {
    /** 常に画面に固定の背景 */
    readonly bg: g.FilledRect;
    /** ピースやボードの存在する本当のプレイエリア */
    readonly camerable: CamerableE;
    /** ピースの移動可能な領域 */
    readonly pieceLimitArea: g.CommonArea;
    /** ピースをハメるボード */
    readonly board: g.E;
    /** ボードに表示する完成画像 */
    readonly boardPreview: g.E;
    /** ボードに表示するピース枠線 */
    readonly boardPieceFrame: g.E;
    /** ピースの親 */
    readonly pieceParent: g.E;
  };
  readonly ui: g.E;

  /**
   * 元画像の左上位置のピースから順にインデックス付けられている\
   * この順序を変えてはならない
   */
  readonly pieces: Piece[];

  readonly isJoined: () => boolean;

  /**
   * ゲームスクリーン座標をピースエリア座標に変換する
   */
  readonly toPieceArea: (x: number, y: number) => g.CommonOffset;

  /**
   * ゲームスクリーン座標を元にその場所に存在するピースを取得する  
   * `canHoldOnly:true`の場合は掴めないピースが上にあってもそれを取得します
   * @param x ゲームスクリーンX座標
   * @param y ゲームスクリーンY座標
   * @param canHoldOnly 対象をホールド可能なピースに限定するか @default false
   * @returns `[ピース, 引数(x,y)とピース座標のズレ(ピースエリア座標)]`
   */
  readonly getPieceFromScreenPx: (x: number, y: number, canHoldOnly?: boolean) => { piece: Piece, offset: g.CommonOffset; } | undefined;

  pieceOperatorControl: InputSystemControl;

  /** 自分が掴んでいるピースの情報 */
  holdState: {
    piece: Piece;
    /** ピースを掴んだときのピース座標との誤差 (ピースエリア座標) */
    offset: g.CommonOffset;
  } | undefined;
  /** 累計スコア */
  totalScore: number;
  /** ゲーム終了時刻 */
  finishTime: number | undefined;
}

export async function Playing(client: SacClient, gameStart: GameStart, previewsInfo: PreviewInfo[]) {
  const unlockEvent = client.lockEvent();
  const state = await createPlayingState(client, gameStart, previewsInfo);
  const playerManager = client.env.clientDI.get(PlayerManager);

  // TODO: client.removeEventSets(eventKeys);
  const eventKeys = [
    HoldPiece.receive(client, ({ playerId, pieceIndex }) => {
      // ピースを他人が掴んだ
      if (playerId == null || playerId === g.game.selfId) return;

      const piece = state.pieces[pieceIndex];
      Piece.hold(piece, playerId);

      if (pieceIndex === state.holdState?.piece.tag.index) {
        state.holdState = undefined;
      }
    }),
    MovePiece.receive(client, ({ playerId, pieceIndex, point }) => {
      if (g.game.isSkipping) return;
      // ピースを他人が動かした
      if (playerId == null || playerId === g.game.selfId) return;

      const piece = state.pieces[pieceIndex];
      piece.moveTo(point.x, point.y);
      piece.modified();
    }),
    ReleasePiece.receive(client, ({ pieceIndex, point }) => {
      const piece = state.pieces[pieceIndex];
      Piece.release(piece);

      piece.moveTo(point.x, point.y);
      piece.modified();
    }),
    // 指定したピースを強制開放
    ForceReleasePiece.receive(client, ({ pieceIndex }) => {
      // if (state.holdState?.piece?.tag.index !== pieceIndex) return;

      // state.holdState = undefined;
      // state.pieceOperatorControl.current.forceRelease();

      const piece = state.pieces[pieceIndex];
      Piece.release(piece);
      state.pieceOperatorControl.current.forceRelease();
    }),
    FitPiece.receive(client, ({ playerId, pieceIndex }) => {
      const piece = state.pieces[pieceIndex];
      Piece.fit(piece);
      updateScore(playerId!);
    }),
    ConnectPiece.receive(client, ({ playerId, parentIndex, childIndex }) => {
      const parent = state.pieces[parentIndex];
      const child = state.pieces[childIndex];
      Piece.connect(parent, child, gameStart);
      if (g.game.selfId === playerId) parent.parent.append(parent);
      updateScore(playerId!);
    }),
  ];

  // アンロックは一番最後
  unlockEvent();

  function updateScore(playerId: string) {
    const player = playerManager.get(playerId);
    if (player == null) return;
    state.totalScore += 1;
    player.score += 1;
    playerManager.updateScore();
    // console.log(playerManager.players.map(p => `R:${p.rank}  S:${p.score}  ${p.id}`));
  }
}


async function createPlayingState(client: SacClient, gameStart: GameStart, previewsInfo: PreviewInfo[]): Promise<ClientPlayingState> {
  const { scene, clientDI } = client.env;
  const playerManager = clientDI.get(PlayerManager);
  const gameState = createGameState(gameStart);

  const piecesResult = await createPieces(
    scene,
    gameState,
    previewsInfo[gameState.puzzleIndex].imageAsset,
  );
  const { preview } = piecesResult;

  //#region Entity の作成
  const bg = new g.FilledRect({
    scene, parent: scene,
    cssColor: "#0087cc",
    width: g.game.width, height: g.game.height,
    touchable: true,
  });

  const playAreaCamera = new CamerableE({ scene, parent: scene });
  const pieceLimitArea = new g.FilledRect({
    scene, parent: playAreaCamera,
    cssColor: "#f008",
    width: gameState.movePieceArea.width,
    height: gameState.movePieceArea.height,
  });

  const board = new g.FilledRect({
    scene, parent: playAreaCamera,
    cssColor: "#ffffff50",
    width: preview.width, height: preview.height,
    x: gameState.board.x,
    y: gameState.board.y,
  });
  const boardPreview = new g.Sprite({
    scene, parent: board,
    src: preview.src,
    srcX: preview.srcX,
    srcY: preview.srcY,
    width: preview.width, height: preview.height,
    opacity: 0.5,
  });
  const boardPieceFrame = piecesResult.frame;
  board.append(boardPieceFrame);
  const pieceParent = new g.E({ scene, parent: playAreaCamera });
  //#endregion Entity の作成

  // ピースを配置
  for (let i = 0; i < piecesResult.pieces.length; i++) {
    const piece = piecesResult.pieces[i];
    const position = gameState.piecePositions[i];
    pieceParent.append(piece);
    piece.moveTo(position.x, position.y);
    piece.modified();
  }

  const CAMERABLE_W_HALF = playAreaCamera.width / 2;
  const CAMERABLE_H_HALF = playAreaCamera.height / 2;

  const state: ClientPlayingState = {
    pieces: piecesResult.pieces,
    client,
    gameState,
    playArea: {
      bg,
      camerable: playAreaCamera,
      pieceLimitArea,
      board,
      boardPreview,
      boardPieceFrame,
      pieceParent,
    },
    ui: new g.E({ scene, parent: scene }),

    isJoined: () => playerManager.has(g.game.selfId),
    toPieceArea: (x, y) => ({
      x: playAreaCamera.x + playAreaCamera.scaleX * (x - CAMERABLE_W_HALF),
      y: playAreaCamera.y + playAreaCamera.scaleY * (y - CAMERABLE_H_HALF),
    }),
    getPieceFromScreenPx: (x, y, canHold = false) => {
      if (!state.isJoined()) return;

      const playAreaX = playAreaCamera.x + playAreaCamera.scaleX * (x - CAMERABLE_W_HALF);
      const playAreaY = playAreaCamera.y + playAreaCamera.scaleY * (y - CAMERABLE_H_HALF);
      const piece = Piece.getParentOrSelf(Piece.getFromPoint(playAreaX, playAreaY, canHold));
      if (piece == null) return;

      return {
        piece,
        offset: { x: piece.x - playAreaX, y: piece.y - playAreaY },
      };
    },

    pieceOperatorControl: null!,
    holdState: undefined,

    totalScore: 0,
    finishTime: undefined,
  };

  Piece.pieceParentSetting(state);
  state.pieceOperatorControl = inputSystemControl(state);

  const parts = createParts(state);
  setPartsEvent(state, parts);

  return state;
}

/** プレビューやランキングなどのパーツを作る */
function createParts(state: ClientPlayingState) {
  const { client, playArea: { camerable }, ui } = state;
  const { scene } = client.env;
  const font = createFont({ size: 50 });

  /** 左上の仮UI */
  {
    const zoomIn = new g.Label({
      scene, parent: ui, font, text: "In",
      x: 10, y: 10, touchable: true,
    });
    const zoomOut = new g.Label({
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
    zoomIn.onPointDown.add(() => {
      camerable.scale(camerable.scaleX * 0.9);
      camerable.modified();
    });
    zoomOut.onPointDown.add(() => {
      camerable.scale(camerable.scaleX * 1.1);
      camerable.modified();
    });
    join.onPointDown.add(sendJoin);
    change.onPointDown.add(() => state.pieceOperatorControl.toggle());

    const { board } = state.playArea;
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
    percent: new Label({
      scene, parent: infoPanel,
      font: textFont, text: "100%",
      textAlign: "right",
      width: 100,
      x: 0, y: 60,
    }),
    fitCount: new Label({
      scene, parent: infoPanel,
      font: textFont, text: "1000/1000",
      textAlign: "right",
      width: 180,
      x: 100, y: 60,
    }),
    time: new Label({
      scene, parent: infoPanel,
      font: textFont, text: "5時55分55秒",
      textAlign: "right",
      width: 280,
      x: 0, y: 100,
    }),
    players: [0, 1, 2, 3, 4].map(i => {
      const y = 150 + i * 40;
      return [
        new Label({
          scene, parent: infoPanel,
          font: textFont, text: `GUEST00${i}`,
          textAlign: "left",
          lineBreak: false,
          width: 200,
          x: 10, y,
        }),
        new Label({
          scene, parent: infoPanel,
          font: textFont, text: `2000`,
          textAlign: "right",
          width: 80,
          x: 210, y,
        }),
      ] as const;
    }),
  } as const;
  //#endregion 右上のやつ

  return { infoPanel, infoPart };
}

/**
 * プレビューやランキングなどの更新
 * @returns 終了後の削除関数
 */
function setPartsEvent(
  state: ClientPlayingState,
  { infoPanel, infoPart }: ReturnType<typeof createParts>,
) {
  const { clientDI, scene } = state.client.env;
  const playerManager = clientDI.get(PlayerManager);

  let counter = g.game.fps;
  let lastUpdatedPiece = -1;
  scene.onUpdate.add(update);

  // 通常は毎秒/スキップ中は5分毎
  const updateCountNormal = g.game.fps;
  const updateCountSkipping = g.game.fps * 300;

  return () => {
    scene.onUpdate.remove(update);
  };

  function update() {
    if (!infoPanel.visible()) return;

    counter += 1;
    const updateCount = g.game.isSkipping ? updateCountSkipping : updateCountNormal;
    if (counter < updateCount) return;
    counter = 0;

    // 累計スコアが更新された時のみ更新
    if (lastUpdatedPiece !== state.pieces.length) {
      lastUpdatedPiece = state.totalScore;
      updateScore();
      updatePlayer();
    }
    updateTime();
  }

  /** 完成率/ピース数表記 */
  function updateScore() {
    const per = Math.round(state.totalScore / state.pieces.length);
    infoPart.percent.text = `${per}%`;
    infoPart.percent.invalidate();

    infoPart.fitCount.text = `${state.totalScore}/${state.pieces.length}`;
    infoPart.fitCount.invalidate();
  }
  /** 時刻 */
  function updateTime() {
    infoPart.time.text = createElapsedTimeText(state.gameState.startTime);
    infoPart.time.invalidate();
  }
  /** プレイヤー */
  function updatePlayer() {
    let players: Player[];
    if (playerManager.players.length <= 5) {
      players = playerManager.players;
    } else {
      players = playerManager.players.slice(0, 5);
      if (
        players.every(p => p.id !== g.game.selfId) &&
        playerManager.has(g.game.selfId)
      ) {
        players[4] = playerManager.get(g.game.selfId)!;
      }
    }

    // プレイヤー毎に予め名前テキストを作りすげ替えると効率が上がる
    // 便利に作るにはキャッシュ強化版Labelを作ると良いが面倒なので‥
    for (let i = 0; i < players.length; i++) {
      const p = players[i];
      const isSelf = p.id === g.game.selfId;
      // const color = isSelf ? "#7345ff" : "black";
      const color = isSelf ? "blue" : "black";
      const [name, score] = infoPart.players[i];
      if (name.text != p.name) {
        name.text = p.name;
        name.textColor = color;
        name.invalidate();
      }
      // if (score.text != p.score as unknown as string) {
      score.text = p.score + "";
      score.textColor = color;
      score.invalidate();
      // }
    }
  }
}

const inv3600 = 1 / 3600;
const inv60 = 1 / 60;

/**
 * `startTime`から現在時刻までの経過時間をテキストで返す
 * @param startTime 開始時刻
 */
function createElapsedTimeText(startTime: number): string {
  // scene.local が `interpolate-local` のため正確でないことがある
  // 最後に受信したイベント以降はローカルの経過tick数で計算されるため
  // (新しくイベントを受信すれば正しい時刻になる)
  let time = Math.floor((g.game.getCurrentTime() - startTime) / 1000);
  // const hour = Math.floor(time / 3600);
  // const minute = Math.floor(time / 60) % 60;
  // const second = time % 60;
  const hour = (time * inv3600) | 0;
  time -= hour * 3600;  // 残り秒数から時間分を差し引く
  const minute = (time * inv60) | 0;
  const second = time - minute * 60;

  if (hour === 0) {
    return `${minute}分${second}秒`;
  }
  return `${hour}時${minute}分${second}秒`;
}
