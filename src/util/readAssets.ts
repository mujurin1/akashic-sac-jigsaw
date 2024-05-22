
const AssetInfo = {
  ASSET_DIR: "/assets",
  SETTING_TXT: `/assets/!.txt`,
} as const;

export interface PreviewInfo {
  title: string;
  imageAsset: g.ImageAsset;
}

export function readAssets(scene: g.Scene): PreviewInfo[] {
  const pictureInfo =
    scene.asset.getText(AssetInfo.SETTING_TXT).data.split("\r\n")
      .map(x => x.split(" "))
      .map(x => ({
        title: x[1],
        imageAsset: scene.asset.getImage(`${AssetInfo.ASSET_DIR}/${x[0]}.jpg`),
      }));
  return pictureInfo;
}
