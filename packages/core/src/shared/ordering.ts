/**
 * Compares strings by UTF-16 code unit order.
 *
 * Unlike `localeCompare`, the result never depends on the host locale, which keeps
 * plans byte-for-byte reproducible across machines.
 */
export function compareOrdinal(a: string, b: string): number {
  if (a < b) return -1;
  if (a > b) return 1;
  return 0;
}

/** Returns a comparator that orders values by their position in a canonical list. */
export function byCanonicalOrder<T>(canonical: readonly T[]): (a: T, b: T) => number {
  return (a, b) => canonical.indexOf(a) - canonical.indexOf(b);
}
