
export const BACKGROUND_COLOR = (() => {
  const colors = [
    "#0087CC", "#A900CC", "#CC4300", "#22CC00",
    "#3D738E", "#813D8E", "#8E583D", "#4A8E3D", "transparent",
  ] as const;
  const next = Object.fromEntries(
    colors.map((c, i) => [c, colors[(i + 1) % colors.length]])
  );

  return {
    /** 背景色のリスト */
    colors,
    /** 背景色から次の色へのマップ */
    nextColorMap: next as Readonly<Record<string, typeof colors[number]>>,
    /** 背景色から次の色へのマップ (アイコン用) */
    nextColorMapIcon: { ...next, "#4A8E3D": "rgba(255, 255, 255, 0.5)" } as Readonly<Record<string, string>>,
  } as const;
})();
