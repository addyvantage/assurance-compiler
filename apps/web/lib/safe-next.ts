const ORIGIN = 'http://assure.invalid';

/**
 * A same-origin path to continue to after sign-in, or the fallback. The value is parsed as a
 * URL the way a browser would, so tabs, backslashes and protocol-relative forms cannot leave.
 */
export function safeNext(value: string | undefined, fallback = '/repositories'): string {
  if (value?.startsWith('/') !== true) return fallback;
  try {
    const url = new URL(value, ORIGIN);
    return url.origin === ORIGIN ? `${url.pathname}${url.search}${url.hash}` : fallback;
  } catch {
    return fallback;
  }
}
