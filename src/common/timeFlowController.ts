
/**
 * 一定時間中の呼び出しを無効化し、最後の呼び出し時の引数で実行する\
 * 1. `locked:false`時に呼び出すと`fn`が実行され`locked:true`にする
 * 2. `locked:true`中の呼び出しで`fn`は実行されず、引数がキャッシュされる
 * 3. `ms`経過後にキャッシュされた引数があればそれで`fn`を実行し`locked:false`に戻る
 * @param ms 呼び出しを纏める時間 (ミリ秒)
 * @param fn 実行する関数
 */
export function timeFlowController<T extends any[]>(
  ms: number,
  fn: (...args: T) => void,
) {
  let locked = false;
  let cacheArgs: T | undefined;
  let timerId: number;

  return {
    /** 現在ロックされているか */
    get locked() { return locked; },
    /** `locked:false`なら実行し`locked:true`なら実行せず引数をキャッシュする */
    do: (...args: T) => {
      if (locked) {
        cacheArgs = args;
        return;
      }

      fn(...args);
      lock();
    },
    /** 状態を初期化する. キャッシュされている場合はそれは実行されない */
    reset: () => {
      locked = false;
      cacheArgs = undefined;
      clearTimeout(timerId);
    },
  } as const;

  function lock() {
    locked = true;
    timerId = setTimeout(() => {
      locked = false;
      if (cacheArgs != null) fn(...cacheArgs);
      cacheArgs = undefined;
    }, ms);
  }
}
