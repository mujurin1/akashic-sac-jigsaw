export { };

declare global {
  type Mutable<T> = { -readonly [K in keyof T]: T[K] };

  type Fn<Args extends any[] = [], R = void> = (...args: Args) => R;
}
