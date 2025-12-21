import { Confetti, Fin } from "./kamihubuki-js";

// prettier-ignore
const colors = [
  "blue", "navy", "teal", "green",
  "lime", "aqua", "yellow", "red",
  "fuchsia", "olive", "purple", "maroon"
];
let colorIndex: number;

let frameRate: number;
// 重力 X,Y 方向
let gravityX = 0;
let gravityY = 200;
/** 生成した紙吹雪のエンティティ */
let kamihubukis: (readonly [g.FilledRect, Confetti])[] = [];
/** 紙吹雪に画面端への衝突判定をするか */

/** 演出を表示するレイヤー */
let display: g.E;
/** 紙吹雪を生成する間隔 (ms) */
let generatedTime: number;

export interface KamihubukiEffectParam {
  parent?: g.E;
  /** @default true */
  autoCreate?: boolean;

  /** 紙吹雪レイヤーの幅 */
  width: number;
  /** 紙吹雪レイヤーの高さ */
  height: number;
  /** １秒間に生成する紙吹雪の数 */
  generatedPerSeccond: number;
}

export interface KamihubukiEffectResult {
  /** 紙吹雪を表示するレイヤー */
  display: g.E;

  /** 紙吹雪の自動生成を変更する */
  setAutoCreate: (enable: boolean) => void;
}

export const createKamihubukiEffect = (param: KamihubukiEffectParam): KamihubukiEffectResult => {
  colorIndex = 0;
  frameRate = 1 / g.game.fps;

  display = new g.E({
    scene: g.game.env.scene,
    parent: param.parent,
    width: param.width,
    height: param.height,
  });
  generatedTime = 1000 / param.generatedPerSeccond;

  g.game.env.scene.onUpdate.add(update);

  setAutoCreate(param.autoCreate ?? true);

  return {
    display,
    setAutoCreate,
  };
};

/** タイマーを解除するための値 */
let timerIdentifier: g.TimerIdentifier;

const setAutoCreate = (enable: boolean) => {
  if (enable && (timerIdentifier == null || timerIdentifier.destroyed())) {
    timerIdentifier = g.game.env.scene.setInterval(() => {
      const confetti = createConfetti(random(0, g.game.width), -5);
      const kamihubuki = createKamihubuki(confetti);
      kamihubukis.push([kamihubuki, confetti]);
      display.append(kamihubuki);
    }, generatedTime);
  } else if (timerIdentifier != null && !timerIdentifier.destroyed()) {
    g.game.env.scene.clearInterval(timerIdentifier);
  }
};

/**
 * `紙吹雪のエンティティ` を生成する
 */
const createKamihubuki = (confetti: Confetti): g.FilledRect => {
  const rect = new g.FilledRect({
    scene: g.game.env.scene,
    width: 20,
    height: 10,
    x: confetti.x - 10,
    y: confetti.y - 5,
    cssColor: colors[colorIndex],
  });

  colorIndex = (colorIndex + 1) % colors.length;

  return rect;
};

/**
 * `紙吹雪の実体` を生成する
 */
const createConfetti = (x: number, y: number): Confetti => {
  const angle = (random(0, 100) / 100) * Math.PI;

  const fins: Fin[] = [
    {
      angle: (random(-100, 100) / 100) * (Math.PI / 2),
      size: 30,
      armAngle: 0,
      armLength: 1,
    },
    {
      angle: (random(-100, 100) / 100) * (Math.PI / 2),
      size: 30,
      armAngle: (random(50, 100) / 100) * Math.PI,
      armLength: 1,
    },
  ];

  //prettier-ignore
  return new Confetti({
    x, y, angle, fins,
    vx: 0, vy: 200, av: 0, M: 0.5,
    K: 0.02, I: 3, RD: 0.99,
  });
};

/**
 * 紙吹雪を更新する
 */
const update = () => {
  for (let i = 0; i < kamihubukis.length; i++) {
    const rect: g.FilledRect = kamihubukis[i][0];
    const confetti: Confetti = kamihubukis[i][1];

    confetti.update(frameRate, 0, 0, gravityX, gravityY);

    if (confetti.x < 0 || confetti.x > g.game.width || confetti.y > g.game.height) {
      rect.destroy();
      const temp = kamihubukis[i];
      kamihubukis[i] = kamihubukis[kamihubukis.length - 1];
      kamihubukis[kamihubukis.length - 1] = temp;
      kamihubukis.length = kamihubukis.length - 1;
    }

    // 画面外に出ようとすると跳ねさせる場合は上のif文を消してこれを実行
    // const k = 0.5;
    // if (confetti.x < 0) {
    //   confetti.x = 0;
    //   confetti.vx = Math.abs(confetti.vx) * k;
    // } else if (confetti.x > g.game.width) {
    //   confetti.x = g.game.width;
    //   confetti.vx = -Math.abs(confetti.vx) * k;
    // }
    // if (confetti.y < -g.game.height) {
    //   confetti.y = -g.game.height;
    //   confetti.vy = 0;
    // } else if (confetti.y > g.game.height) {
    //   confetti.y = g.game.height;
    //   confetti.vy = -Math.abs(confetti.vy) * k;
    // }

    rect.x = confetti.x - 10;
    rect.y = confetti.y - 5;
    rect.angle = (-confetti.angle / Math.PI) * 180;
    rect.modified();
  }
};



/**
 * `min` 以上 `max` 以下の乱数を返す。\
 * 乱数は環境によって変わるので、グローバルでは使うな。
 * @param min 最低値
 * @param max 最高値
 */
export const random = (min: number, max: number): number => {
  const range = max - min + 1;
  return Math.floor(Math.random() * range) + min;
};
