type ObjectToEntries<O extends object> = {
  [K in keyof O]: [K, O[K]];
}[keyof O];

/**
 * Strongly-typed Map preserving key→value relationships defined by an object type.
 * Used by request-scoped storage (req.requestStorage) so guards/strategies/controllers
 * pass typed data instead of `any`.
 */
export interface TypedMap<O extends object> {
  forEach(
    callbackfn: <K extends keyof O>(
      value: O[K],
      key: K,
      map: TypedMap<O>,
    ) => void,
    thisArg?: unknown,
  ): void;
  get<K extends keyof O>(key: K): O[K];
  set<K extends keyof O>(key: K, value: O[K]): this;
  has<K extends keyof O>(key: K): boolean;
  delete<K extends keyof O>(key: K): boolean;
  clear(): void;
  readonly size: number;
  [Symbol.iterator](): IterableIterator<ObjectToEntries<O>>;
  entries(): IterableIterator<ObjectToEntries<O>>;
  keys(): IterableIterator<keyof O>;
  values(): IterableIterator<O[keyof O]>;
  readonly [Symbol.toStringTag]: string;
}
