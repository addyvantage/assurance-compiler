import { problem } from './session';

/** Reads a JSON body no larger than `limit` bytes, or explains why it could not. */
export async function readJson(
  request: Request,
  limit: number,
): Promise<{ ok: true; value: unknown } | { ok: false; response: Response }> {
  const declared = Number(request.headers.get('content-length') ?? '0');
  if (declared > limit) return { ok: false, response: problem(413, 'The payload is too large.') };
  const text = await request.text();
  if (new TextEncoder().encode(text).byteLength > limit) {
    return { ok: false, response: problem(413, 'The payload is too large.') };
  }
  try {
    return { ok: true, value: JSON.parse(text) as unknown };
  } catch {
    return { ok: false, response: problem(400, 'The body is not valid JSON.') };
  }
}

export function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

export function optionalString(value: unknown, max: number): string | undefined {
  return typeof value === 'string' &&
    value.length > 0 &&
    value.length <= max &&
    // eslint-disable-next-line no-control-regex
    !/[\u0000-\u001F\u007F]/.test(value)
    ? value
    : undefined;
}
