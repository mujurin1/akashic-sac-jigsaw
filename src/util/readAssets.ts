
const AssetInfo = {
  ASSET_DIR: "/assets",
  SETTING_TXT: `/assets/!.txt`,
} as const;

export interface PreviewInfo {
  readonly title: string;
  readonly imageAsset: g.Surface | g.ImageAsset;
}

export const JigsawAssets = [
  { name: "zunda", title: "ずんだ" },
  { name: "roulette", title: "ルーレット" },
  { name: "okonomi", title: "お好み焼き" },
  { name: "roulette", title: "ルーレット" },
  { name: "tibi", title: "ちび" },

  { name: "galaxy", title: "銀河" },
  { name: "moon", title: "月" },
  { name: "tree", title: "ツリー" },
  { name: "plum", title: "うめ" },
  { name: "horse", title: "馬" },
  { name: "city", title: "街" },
  { name: "christmas-dog", title: "クリスマス犬" },
  { name: "cookie-doll", title: "クッキー人形" },
  { name: "duck", title: "カモ" },
] as const;

export function readAssets(scene: g.Scene): PreviewInfo[] {
  return JigsawAssets
    .map(x => ({
      title: x.title,
      imageAsset: scene.asset.getImage(`${AssetInfo.ASSET_DIR}/${x.name}.jpg`),
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
