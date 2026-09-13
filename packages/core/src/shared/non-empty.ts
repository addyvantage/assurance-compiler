/** A readonly array statically known to contain at least one element. */
export type NonEmptyReadonlyArray<T> = readonly [T, ...T[]];

export function isNonEmpty<T>(items: readonly T[]): items is NonEmptyReadonlyArray<T> {
  return items.length > 0;
}
