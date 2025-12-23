
const AssetInfo = {
  ASSET_DIR: "/assets",
  SETTING_TXT: `/assets/!.txt`,
} as const;

export interface PreviewInfo {
  readonly title: string;
  readonly imageAsset: g.Surface | g.ImageAsset;
}

export const JigsawAssets = [
  { name: "komadori.png", title: "コマドリ" },
  { name: "simaenaga.jpg", title: "シマエナガ" },
  { name: "christmas-dog.jpg", title: "クリスマス犬" },
  { name: "duck.jpg", title: "カモ" },
  { name: "inko.jpg", title: "インコ" },
  { name: "horse.jpg", title: "馬" },
  { name: "tibi.jpg", title: "ちび" },

  { name: "plum.jpg", title: "うめ" },
  { name: "fog.jpg", title: "霧" },
  { name: "world-tree.jpg", title: "世界樹" },

  { name: "tree.png", title: "ツリー" },
  { name: "cave.png", title: "洞窟" },
  { name: "landscape-painting.png", title: "風景画" },

  { name: "city.jpg", title: "街" },
  { name: "daiseidou.png", title: "大聖堂" },
  { name: "steel-bridge.png", title: "鉄橋" },

  { name: "moon.jpg", title: "月" },
  { name: "galaxy.jpg", title: "銀河" },

  { name: "kotoyomi-nia.png", title: "琴詠ニア" },

  { name: "cookie-doll.jpg", title: "クッキー人形" },
  { name: "okonomi.jpg", title: "お好み焼き" },

  { name: "e.jpg", title: "えっ" },
] as const;

export function readAssets(scene: g.Scene): PreviewInfo[] {
  return JigsawAssets
    .map(x => ({
      title: x.title,
      imageAsset: scene.asset.getImage(`${AssetInfo.ASSET_DIR}/${x.name}`),
    }));
  // const pictureInfo =
  //   scene.asset.getText(AssetInfo.SETTING_TXT).data.split("\r\n")
  //     .map(x => x.split(" "))
  //     .map(x => ({
  //       title: x[1],
  //       imageAsset: scene.asset.getImage(`${AssetInfo.ASSET_DIR}/${x[0]}.jpg`),
  //     }));
  // return pictureInfo;
}
