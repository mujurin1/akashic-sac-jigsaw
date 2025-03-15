import { createFont } from "akashic-sac";

//#region アイコン型定義
export type PieIcons<T extends PieIconSrc[]> = {
  [K in T[number]["name"]]: Parameters<Extract<T[number], PieIconSrc<K>>["event"]>[0]
};
export type PieIconSrc<Name extends string = string> = PieIconSrc_Image<Name> | PieIconSrc_Rect<Name>;
export interface PieIconSrc_Base<Name extends string, E extends g.E> {
  type: string;
  name: Name;
  event(e: E): void;
}
export interface PieIconSrc_Image<Name extends string = string> extends PieIconSrc_Base<Name, g.Sprite> {
  type: "image";
}
export interface PieIconSrc_Rect<Name extends string = string> extends PieIconSrc_Base<Name, g.FilledRect> {
  type: "rect";
  firstColor: string;
}

type ToNames<Icons extends PieIconSrc[]> = {
  [K in keyof Icons]: Icons[K]["name"]
};
//#endregion アイコン型定義

export interface PieMenuParam<Icons extends PieIconSrc[]> {
  /** 中央の時のイベント */
  centerFn(e: g.E): void;
  icons: Icons;
  iconSize: number;
}

export interface PieMenu<Icons extends PieIconSrc[]> {
  entity: g.E;
  icons: PieIcons<Icons>;

  /** 選択中のアイコン名. 真ん中なら`undefined` */
  selectIcon: ToNames<Icons>[number] | undefined;

  /**
   * @param point x,y は -1~1
   */
  target(point: g.CommonOffset): ToNames<Icons>[number] | undefined;
  /**
   * 現在選択されているアイコンのイベントを実行する
   */
  fire(): void;
}

export interface PieMenuBuilder<Icons extends PieIconSrc[]> {
  /**
   * @param params パイメニューエンティティの生成時引数
   */
  build(params?: Parameters<typeof createPieMenu>[3]): PieMenu<Icons>;

  addIcon<T extends string>(name: T, event: (e: g.Sprite) => void):
    PieMenuBuilder<[...Icons, PieIconSrc_Image<T>]>;
  addIcon_Rect<T extends string>(name: T, firstColor: string, event: (e: g.FilledRect) => void):
    PieMenuBuilder<[...Icons, PieIconSrc_Rect<T>]>;
}



export function pieMenuBuilder(
  iconSize: number,
  /** 中央の時のイベント */
  centerFn: (e: g.E) => void,
): PieMenuBuilder<[]> {
  const icons: PieIconSrc[] = [];

  const builder: PieMenuBuilder<[]> = { build, addIcon, addIcon_Rect };
  return builder;

  function build(params?: Parameters<PieMenuBuilder<any>["build"]>[0]) {
    return createPieMenu(iconSize, icons, centerFn, params) as any;
  }

  /**
   * 画像アイコンを追加する
   * @param name アイコン名. この値は画像アセット名として使用されます
   * @param event 選択されたときのイベント
   */
  function addIcon<T extends string>(name: T, event: (e: g.Sprite) => void) {
    icons.push({ type: "image", name, event });
    return builder as any;
  }

  /**
   * 矩形アイコンを追加する
   * @param name アイコン名
   * @param name 矩形の色
   * @param event 選択されたときのイベント
   */
  function addIcon_Rect<T extends string>(name: T, firstColor: string, event: (e: g.FilledRect) => void) {
    icons.push({ type: "rect", name, event, firstColor });
    return builder as any;
  }
}

export function createPieMenu<Icons extends PieIconSrc[]>(
  iconSize: number,
  icons: Icons,
  /** 中央の時のイベント */
  centerFn: (e: g.E) => void,
  /** パイメニューエンティティの生成時引数 */
  params?: Partial<Omit<
    g.FilledRectParameterObject,
    "scene" | "width" | "height" | "anchorX" | "anchorY"
  >>,
): PieMenu<Icons> {
  const pi2 = Math.PI * 2;
  const offsetRad = -Math.PI / 2;
  const scene = g.game.env.scene;
  const radius = iconSize + 50;
  const intervalRadian = pi2 / icons.length;

  const entity = new g.FilledRect({
    scene,
    cssColor: "rgba(212, 172, 132, 0.8)",
    width: radius * 2 + iconSize,
    height: radius * 2 + iconSize,
    anchorX: 0.5, anchorY: 0.5,
    ...params,
  });

  const centerIcon = new g.Label({
    scene, parent: entity,
    font: createFont({ size: 30 }),
    text: "閉じる",
    x: entity.width / 2, y: entity.height / 2 - 3,
    anchorX: 0.5, anchorY: 0.5,
    scaleX: 1.3, scaleY: 1.3,
  });

  const iconEntities = {} as PieIcons<Icons>;
  for (let i = 0; i < icons.length; i++) {
    (<any>iconEntities)[icons[i].name] = createEntity(i);
  }

  const pointer = new g.FilledRect({
    scene, parent: entity,
    cssColor: "rgba(255,0,0,1)",
    x: entity.width / 2, y: entity.height / 2,
    width: 25, height: 25,
    anchorX: 0.5, anchorY: 0.5,
  });

  const pieMenu: PieMenu<Icons> = {
    entity,
    icons: iconEntities,
    selectIcon: undefined,
    target,
    fire,
  };

  let selectIndex = -1;

  return pieMenu;

  function target(point: g.CommonOffset) {
    const oldIndex = pieMenu.selectIcon;
    const pointToRad = Math.atan2(point.y, point.x);

    if (
      -0.4 < point.x && point.x < 0.4 &&
      -0.4 < point.y && point.y < 0.4
    ) {
      pieMenu.selectIcon = undefined;
    } else {
      const offset = offsetRad - intervalRadian / 2;
      let rad = pointToRad - offset;
      rad = (rad + pi2) % pi2;
      // １つ目の左端の位置に揃える
      // rad = rad - ((Math.PI / 2) + intervalRadian / 2);
      selectIndex = Math.floor(rad / intervalRadian);
      pieMenu.selectIcon = icons[selectIndex].name;
    }

    if (oldIndex !== pieMenu.selectIcon) {
      if (oldIndex !== undefined) {
        iconEntities[oldIndex].scale(1);
        iconEntities[oldIndex].modified();
      } else {
        centerIcon.scale(1);
        centerIcon.modified();
      }
      if (pieMenu.selectIcon !== undefined) {
        iconEntities[pieMenu.selectIcon].scale(1.3);
        iconEntities[pieMenu.selectIcon].modified();
      } else {
        centerIcon.scale(1.3);
        centerIcon.modified();
      }
    }

    pointer.moveTo(
      (point.x / 2 + 0.5) * entity.width,
      (point.y / 2 + 0.5) * entity.height,
    );
    pointer.modified();

    return pieMenu.selectIcon;
  }

  function fire() {
    if (pieMenu.selectIcon === undefined) centerFn(centerIcon);
    else icons[selectIndex].event(iconEntities[pieMenu.selectIcon] as any);
  }


  function createEntity(i: number) {
    const iconSrc = icons[i];
    if (iconSrc.type === "image") {
      const src = scene.asset.getImageById(iconSrc.name);
      return new g.Sprite({
        scene, parent: entity,
        src,
        srcWidth: src.width, srcHeight: src.height,
        width: iconSize, height: iconSize,
        x: Math.cos(offsetRad + intervalRadian * i) * radius + (radius + iconSize / 2),
        y: Math.sin(offsetRad + intervalRadian * i) * radius + (radius + iconSize / 2),
        anchorX: 0.5, anchorY: 0.5,
      });
    } else {
      return new g.FilledRect({
        scene, parent: entity,
        cssColor: iconSrc.firstColor,
        x: Math.cos(offsetRad + intervalRadian * i) * radius + (radius + iconSize / 2),
        y: Math.sin(offsetRad + intervalRadian * i) * radius + (radius + iconSize / 2),
        width: iconSize * 0.7, height: iconSize * 0.7,
        anchorX: 0.5, anchorY: 0.5,
      });
    }
  }
}
