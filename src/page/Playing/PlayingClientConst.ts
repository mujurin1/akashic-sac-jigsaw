
export const BACKGROUND_COLOR = (() => {
  const colors = [
    "#0087CC", "#A900CC", "#CC4300", "#22CC00",
    "#3D738E", "#813D8E", "#8E583D", "#4A8E3D", "transparent",
  ] as const;
  const next = Object.fromEntries(
    colors.map((c, i) => [c, colors[(i + 1) % colors.length]])
  );

  return {
    colors,
    next,
    /** 次の背景色を表示するアイコン用. 透明を半透明で可視化する */
    nextIconBg: { ...next, "#4A8E3D": "rgba(255, 255, 255, 0.5)" } as Record<string, string>,
    getNext: (color: string) => next[color] ?? colors[0],
  } as const;
})();
