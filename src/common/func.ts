
export function sumPos(a: g.CommonOffset, b: g.CommonOffset): g.CommonOffset {
  return { x: a.x + b.x, y: a.y + b.y };
}

/**
 * エンティティの表示状態を切り替える
 * @param e 表示を切り替えるエンティティ
 * @param visibleTo `true`: 表示, `false`: 非表示, `undefined`: トグル
 */
export function toggleVisibleTo(e: g.E, visibleTo?: boolean): void {
  visibleTo ??= !e.visible();

  if (visibleTo) e.show();
  else e.hide();
}
