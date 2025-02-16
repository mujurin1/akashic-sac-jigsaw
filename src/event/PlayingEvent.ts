import { SacEvent, SacServer } from "akashic-sac";
import { calcAnswerXY, calcIndexXY, createGameState, GameState, lineupPiece } from "../page/Playing/pieceUtil";
import { PlayerManager } from "../util/PlayerManager";
import { GameStart } from "./TitleEvent";

export class HoldPiece extends SacEvent {
  constructor(readonly pieceIndex: number) { super(); }
}
export class MovePiece extends SacEvent {
  constructor(
    readonly pieceIndex: number,
    readonly point: g.CommonOffset,
  ) { super(); }
}
export class ReleasePiece extends SacEvent {
  constructor(
    readonly pieceIndex: number,
    readonly point?: g.CommonOffset,
  ) { super(); }
}
/** ピースを強制的に放す */
export class ForceReleasePiece extends SacEvent {
  constructor(
    /** -1 の場合は全てのピースを放す */
    readonly pieceIndex: number,
  ) { super(); }
}
/** ピースを離さずにそのピースがハマる/くっつくかを判定する */
export class CheckFitPiece extends SacEvent {
  constructor() { super(); }
}

/** ピースがくっついた */
export class ConnectPiece extends SacEvent {
  constructor(
    readonly parentIndex: number,
    readonly childIndex: number,
  ) { super(); }
}
/** ピースが盤面にハマった */
export class FitPiece extends SacEvent {
  constructor(
    readonly pieceIndex: number,
  ) { super(); }
}


interface PlayingState {
  gameState: GameState;
  clearTime: number | undefined;

  /** `{ [playerId]: VALUE }` */
  holders: Map<string, {
    pieceIndex: number,
    releaseCounter: number,
  }>;
  setHolder(playerId: string, piec: PieceState): void;
  deleteHolder(playerId: string): void;

  pieces: PieceState[];
}

interface PieceState {
  /** ピースIDでもある */
  index: number;
  /** 他のピースの子になっている場合は親からの相対正解座標になる */
  pos: g.CommonOffset;
  /** ハマっているか */
  fited: boolean;
  /**
   * 自分が子になっている場合にくっついている場合の親ピースIndex
   * * ピースの親は必ず自分より若い番号
   * * ピースの関係は親子まで. 2つの親子がくっついた場合は一番若い番号が親になる
   */
  parentId?: number;
  /** ピースを持っているプレイヤーID */
  holderId?: string;
  /**
   * このピースが親になっているピース配列
   */
  children?: PieceState[];
}

type Dir = "top" | "left" | "right" | "bottom";
const Dirs = ["top", "left", "right", "bottom"] as const;
const DirR = {
  top: "bottom",
  bottom: "top",
  left: "right",
  right: "left",
} as const satisfies Record<Dir, Dir>;

// MS * COUNT = ピースを保持出来る時間
const PIECE_RELEASE_MS = 10_0000;
const PIECE_RELEASE_COUNT = 3;
let server: SacServer;
let gameState: GameState;
let state: PlayingState;
/** ピースのくっつく・ハマる誤差 */
let fitMargin: number;
/** その方向へのピースの距離 */
let dirOffset: Record<Dir, g.CommonOffset>;

function initialize(_server: SacServer, _gameStart: GameStart) {
  server = _server;
  gameState = createGameState(_gameStart);
  const boardSize = {
    width: gameState.pieceSize.width * gameState.pieceWH.width,
    height: gameState.pieceSize.height * gameState.pieceWH.height,
  };
  state = {
    gameState,
    clearTime: undefined,

    holders: new Map(),
    setHolder,
    deleteHolder,
    pieces: lineupPiece(
      gameState.seed,
      gameState.pieceWH.width * gameState.pieceWH.height,
      gameState.pieceSize,
      boardSize,
    )
      .map((pos, index) => ({ index, pos, fited: false })),
  };
  fitMargin = (gameState.pieceSize.width + gameState.pieceSize.height) / 8;
  dirOffset = {
    top: { x: 0, y: -gameState.pieceSize.height },
    bottom: { x: 0, y: gameState.pieceSize.height },
    left: { x: -gameState.pieceSize.width, y: 0 },
    right: { x: gameState.pieceSize.width, y: 0 },
  };


  function setHolder(playerId: string, piece: PieceState) {
    state.holders.set(playerId, { pieceIndex: piece.index, releaseCounter: 0 });
    piece.holderId = playerId;
  }
  function deleteHolder(playerId: string) {
    const holdState = state.holders.get(playerId);
    if (holdState == null) return;

    state.holders.delete(playerId);
    state.pieces[holdState.pieceIndex].holderId = undefined;
  }
}

export function serverPlaying(server: SacServer, gameStart: GameStart): void {
  initialize(server, gameStart);
  const playerManager = server.env.serverDI.get(PlayerManager);
  const holders = state.holders;

  // TODO: server.removeEventSets(eventKeys);
  const eventKeys = [
    HoldPiece.receive(server, data => {
      const { playerId, pieceIndex } = data;
      const piece = state.pieces[pieceIndex];
      if (piece.fited || piece.parentId != null) return;
      if (!playerManager.has(playerId)) return;
      if (piece.holderId != null) return;
      const oldHold = holders.get(playerId);
      if (oldHold != null) server.broadcast(new ForceReleasePiece(oldHold.pieceIndex));

      state.setHolder(playerId, piece);

      server.broadcast(data);
    }),
    MovePiece.receive(server, data => {
      const { playerId, pieceIndex, point: position } = data;
      const piece = state.pieces[pieceIndex];
      if (piece.fited || piece.parentId != null) return;
      if (!playerManager.has(playerId)) return;
      if (holders.get(playerId)?.pieceIndex !== pieceIndex) return;

      piece.pos = position;

      server.broadcast(data);
    }),
    ReleasePiece.receive(server, data => {
      const { playerId, pieceIndex, point } = data;
      const piece = state.pieces[pieceIndex];
      if (piece.fited || piece.parentId != null) return;
      if (!playerManager.has(playerId)) return;
      if (holders.get(playerId)?.pieceIndex !== pieceIndex) return;

      if (point != null) piece.pos = point;
      state.deleteHolder(playerId);
      if (!checkFitAndConnect(data.pieceIndex)) {
        server.broadcast(data);
      }
    }),
    // TODO: ホストがピースを[指定して/全て]放す機能は未実装
    ForceReleasePiece.receive(server, data => {
      if (data.playerId !== g.game.env.hostId) return;
    }),
    CheckFitPiece.receive(server, data => {
      const { playerId } = data;
      if (
        !playerManager.has(playerId) ||
        holders.has(playerId)
      ) return;
    })
  ];

  // ピースを一定時間で放す
  // TODO: g.game.env.scene.clearInterval
  const _autoReleaseIntervalKey = g.game.env.scene.setInterval(() => {
    for (const [playerId, value] of holders) {
      value.releaseCounter++;

      if (value.releaseCounter >= PIECE_RELEASE_COUNT) {
        state.deleteHolder(playerId);
        server.broadcast(new ForceReleasePiece(value.pieceIndex), playerId);
      }
    }
  }, PIECE_RELEASE_MS);
}

/**
 * ピースが盤面にハマる/くっつくかをチェックしその後処理を行う
 * @param pieceIndex
 * @returns ハマったまたはくっついた
 */
function checkFitAndConnect(pieceIndex: number): boolean {
  const piece = state.pieces[pieceIndex];

  // ピースがくっつくかチェックする
  const pair = checkConnectPieceAll(piece);
  if (pair != null) {
    const [parent, child] = toParentChild(piece, pair);
    normalizeConnectPieceAll(parent, child);

    server.broadcast(new ConnectPiece(parent.index, child.index));
    return true;
  }

  // ピースがハマるかチェックする
  if (checkFitPiece(piece)) {
    server.broadcast(new FitPiece(piece.index));
    return true;
  }

  return false;
}

/**
 * ピースがハマるかチェックする
 */
function checkFitPiece(piece: PieceState): boolean {
  piece = piece.parentId == null ? piece : state.pieces[piece.parentId];

  const pos = calcAnswerXY(piece.index, gameState);
  const x = piece.pos.x - pos.x;
  const y = piece.pos.y - pos.y;

  return (
    -fitMargin <= x && x <= fitMargin &&
    -fitMargin <= y && y <= fitMargin
  );
}


/**
 * ピースがくっつくか子供までチェックする
 * @returns くっつく相手ピース. 現時点で親を持たないピース
 */
function checkConnectPieceAll(piece: PieceState): PieceState | undefined {
  const pair = checkConnectPiece(piece);
  if (pair != null) return pair;

  if (piece.children != null) {
    for (const child of piece.children) {
      const pair = checkConnectPiece(child);
      if (pair != null) return pair;
    }
  }

  return undefined;
}
/**
 * ピースがくっつくかチェックする\
 * 直接くっつく相手が親を持つ場合、その親ピースを返す
 * @returns くっつく相手ピース. 必ず親を持たないピース
 */
function checkConnectPiece(piece: PieceState): PieceState | undefined {
  const pairs = calcConnectPieceIndexes(piece);

  for (const dir of Dirs) {
    const pairIndex = pairs[dir];
    if (pairIndex == null) continue;
    const pair = state.pieces[pairIndex];

    if (
      pair.fited ||
      pair.holderId != null ||
      pair.parentId === piece.index ||
      pair.index === piece.parentId ||
      pair.parentId != null && pair.parentId === piece.parentId
    ) continue;
    if (checkConnect(piece, pair, dir)) {
      if (pair.parentId == null) return pair;
      return state.pieces[pair.parentId];
    }
  }

  return undefined;
}


/**
 * 2つのピースが許容範囲内で接続されるかチェックする
 * @param dir Aから見たBの方向
 * @returns 
 */
function checkConnect(pieceA: PieceState, pieceB: PieceState, dir: Dir): boolean {
  const posA = sumPos(calcGroundPos(pieceA), dirOffset[dir]);
  const posB = calcGroundPos(pieceB);
  const x = posA.x - posB.x;
  const y = posA.y - posB.y;

  return (
    -fitMargin <= x && x <= fitMargin &&
    -fitMargin <= y && y <= fitMargin
  );
}

/**
 * ピースの親子関係を正規化する
 * @param parent 親にするピース. 必ず親を持たないピースであるべき
 * @param child 子にするピース. 必ず親を持たないピースであるべき
 */
function normalizeConnectPieceAll(parent: PieceState, child: PieceState): void {
  if (parent.children == null) parent.children = [];
  const children = child.children;
  normalizeConnectPiece(parent, child);

  if (children != null) {
    for (const childPiece of children) {
      normalizeConnectPiece(parent, childPiece);
    }
  }
}
function normalizeConnectPiece(parent: PieceState, child: PieceState): void {
  parent.children!.push(child);
  child.parentId = parent.index;
  child.children = undefined;
  const pos = calcRelativePosAtoB(parent.index, child.index);
  child.pos = {
    x: pos.x * gameState.pieceSize.width,
    y: pos.y * gameState.pieceSize.height,
  };
}

/**
 * ピースの座標を親子関係を考慮して計算する
 */
function calcGroundPos(piece: PieceState): g.CommonOffset {
  if (piece.parentId == null) return piece.pos;

  const parent = state.pieces[piece.parentId];
  return {
    x: parent.pos.x + piece.pos.x,
    y: parent.pos.y + piece.pos.y,
  };
}

/**
 * ピースIDとくっつくピースのIDを取得する
 */
function calcConnectPieceIndexes({ index }: PieceState): Record<Dir, number | undefined> {
  const { width, height } = gameState.pieceWH;
  const row = Math.floor(index / width);
  const col = index % width;
  const record: Record<Dir, number | undefined> = {
    top: undefined,
    right: undefined,
    bottom: undefined,
    left: undefined,
  };

  if (row > 0) record.top = index - width;
  if (col > 0) record.left = index - 1;
  if (col < width - 1) record.right = index + 1;
  if (row < height - 1) record.bottom = index + width;

  return record;
}

/**
 * 2つのピースを番号が[小さい、大きい]で並べて、a-bが反対の場合にdirを反対にして返す
 */
function toParentChild(a: PieceState, b: PieceState): [PieceState, PieceState] {
  if (a.index < b.index) return [a, b];
  return [b, a];
}

/**
 * 2つのピースIDからマス目上の距離を計算する
 */
function calcRelativePosAtoB(a: number, b: number): g.CommonOffset {
  const coordA = calcIndexXY(a, gameState);
  const coordB = calcIndexXY(b, gameState);

  return {
    x: coordB.x - coordA.x,
    y: coordB.y - coordA.y,
  };
}

function sumPos(a: g.CommonOffset, b: g.CommonOffset): g.CommonOffset {
  return { x: a.x + b.x, y: a.y + b.y };
}
