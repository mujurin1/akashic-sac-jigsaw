
const AssetInfo = {
  ASSET_DIR: "/assets",
  SETTING_TXT: `/assets/!.txt`,
} as const;

export interface PreviewInfo {
  readonly title: string;
  readonly imageAsset: g.ImageAsset;
}

export const JigsawAssets = [
  { name: "fox", title: "狐" },
  { name: "duck", title: "アヒルの家族" },
  { name: "excavators", title: "自走式掘削機" },
  { name: "cake", title: "ブルーベリーケーキ" },
  { name: "latte-art", title: "ラテアート" },
  { name: "firewood", title: "薪" },
  { name: "frangipani", title: "プルメリア" },
  { name: "beach", title: "波のトンネル" },
  { name: "antelope", title: "レイヨウの渓谷" },
  { name: "paraglider", title: "パラグライダー" },
  { name: "skyscrapers", title: "香港の夜景" },
  { name: "supreme", title: "ライヒ裁判所" },
  { name: "noodle-soup", title: "ラーメン" },
  { name: "audience", title: "スタジアム" },
  { name: "japan", title: "八坂神社" },
  { name: "color-fan", title: "色見本" },
  { name: "watch", title: "腕時計" },
  { name: "cockpit", title: "コックピット" },
  { name: "living-room", title: "リビング" },
  { name: "architecture", title: "高速道路" },
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
