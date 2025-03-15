
export type DeepReadonly<T> = {
  readonly [K in keyof T]: T[K] extends object ? DeepReadonly<T[K]> : T[K];
};

/** `[ {a:1, b:2}, {c:3} ] => { a:1, b:2, c:3 }` */
export type Flatten<T> = {
  [K in keyof T]: T[K] extends { [key: string]: infer U; } ? U : never;
};

/** 完全に展開された型を得るためのヘルパー型 */
export type ExpandRecursively<T> = T extends object
  ? T extends infer O ? { [K in keyof O]: O[K] }
  : never : T;

/**
```ts
type Base = [
  ["A", "Id1", number],
  ["A", "Id2", boolean, number],
  ["B", "Id3", string, string],
];
type Result = {
  A: {
    Id1: number;
    Id2: [boolean, number];
  };
  B: {
    Id3: [string, string];
  };
} satisfies TupleMapToRecord<Base>;
```
 */
export type TupleMapToRecord<
  T extends [string, string, ...any[]][],
  /** Tになくても持っていて欲しいキーを明示する用 */
  Key extends T[number][0] = T[number][0],
> = {
  // T[number] によりタプルのユニオン型に変換し、各タプルの 0 番目の要素をキーとして抽出
  [K in T[number]as K[0]]: {
    // 同じく T[number] から、K と同じ Key を持つタプルの 1 番目の要素をプロパティ名に、
    // タプルの残り部分をその値に割り当てる
    [U in T[number]as U[0] extends K[0] ? U[1] : never]:
    U extends [string, string, ...infer R] ? R : never
  }
} & { [K in Key]: {} };

type UnionToIntersection<U> =
  (U extends any ? (x: U) => any : never) extends (x: infer I) => any ? I : never;
type Last<U> =
  UnionToIntersection<U extends any ? (x: U) => any : never> extends (x: infer L) => any ? L : never;

/** `{ a:_, b:_ } => [ ["a", "b"] ] */
export type UnionToTuple<U, T extends any[] = []> =
  [U] extends [never] ? T : UnionToTuple<Exclude<U, Last<U>>, [Last<U>, ...T]>;

/** `{ a:1, b:2 } => [ ["a",1], ["b",2] ]` */
export type ObjectEntries<T extends Record<string, any>> =
  UnionToTuple<keyof T> extends infer K extends Extract<keyof T, string>[]
  ? { readonly [I in keyof K]: readonly [K[I], T[K[I]]] }
  : never;

/** `[ ["a",_], ["b",_] ] => ["a","b"]` */
export type Keysx<T extends readonly (readonly [any, ...any[]])[]> = {
  readonly [K in keyof T]: T[K] extends readonly [infer Key, ...any[]] ? Key : never;
};
export type Keys<T extends readonly any[]> = {
  readonly [K in keyof T]: T[K][0];
};

/** `[["a",1], ["b",2]] => { a:1, b:2 }` */
export type FromEntries<T extends readonly (readonly [string, any])[]> = {
  readonly [E in T[number]as E[0]]:
  E extends readonly [any, infer V] ? V : never;
};

/** `[["a",1], ["b",2]] => { a:["a",1] , b:["b",2] } */
export type TupleToObject<T extends readonly (readonly [string, any])[]> = {
  readonly [K in T[number]as K[0]]: Extract<T[number], [K[0], any]>
};


type A = { a: any; b: any; };

// Aのキーをユニオンからタプルに変換し、readonly指定
type B = UnionToTuple<keyof A>;