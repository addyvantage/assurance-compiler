/** A small HTTP client for the control plane: JSON in, JSON out, bounded time and retries. */

export interface ApiResponse {
  readonly status: number;
  readonly body: unknown;
}

export class ApiError extends Error {
  override readonly name = 'ApiError';
  readonly status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

const REQUEST_TIMEOUT_MS = 10_000;
const RETRY_DELAYS_MS = [500, 1500, 4000];

export async function api(
  server: string,
  path: string,
  options: {
    readonly method?: 'GET' | 'POST';
    readonly token?: string | undefined;
    readonly body?: unknown;
    readonly retries?: number;
  } = {},
): Promise<ApiResponse> {
  const retries = options.retries ?? 0;
  let lastError: unknown;
  for (let attempt = 0; attempt <= retries; attempt += 1) {
    try {
      const response = await fetch(`${server}${path}`, {
        method: options.method ?? 'GET',
        headers: {
          accept: 'application/json',
          ...(options.body === undefined ? {} : { 'content-type': 'application/json' }),
          ...(options.token === undefined ? {} : { authorization: `Bearer ${options.token}` }),
        },
        ...(options.body === undefined ? {} : { body: JSON.stringify(options.body) }),
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
        redirect: 'manual',
      });
      const text = await response.text();
      let body: unknown = null;
      try {
        body = text === '' ? null : JSON.parse(text);
      } catch {
        body = null;
      }
      // Server errors may be transient; client errors are final.
      if (response.status >= 500 && attempt < retries) {
        lastError = new ApiError(
          response.status,
          messageOf(body) ?? `HTTP ${String(response.status)}`,
        );
      } else {
        return { status: response.status, body };
      }
    } catch (error) {
      lastError = error;
    }
    await new Promise((resolve) => setTimeout(resolve, RETRY_DELAYS_MS[attempt] ?? 4000));
  }
  throw lastError instanceof Error ? lastError : new Error(String(lastError));
}

/** Throws unless the response is 2xx, with the server's message when it gave one. */
export function expectOk(response: ApiResponse, what: string): unknown {
  if (response.status >= 200 && response.status < 300) return response.body;
  throw new ApiError(
    response.status,
    `${what}: ${messageOf(response.body) ?? `the server answered ${String(response.status)}`}`,
  );
}

export function messageOf(body: unknown): string | undefined {
  if (body !== null && typeof body === 'object') {
    const record = body as { error?: unknown; message?: unknown; error_description?: unknown };
    for (const candidate of [record.error_description, record.message, record.error]) {
      if (typeof candidate === 'string' && candidate !== '') return candidate.slice(0, 300);
    }
  }
  return undefined;
}

export function describeFailure(error: unknown): string {
  if (error instanceof ApiError) return error.message;
  if (error instanceof Error) {
    if (error.name === 'TimeoutError') return 'the server did not answer in time';
    return error.message.replace(/^fetch failed$/, 'the server could not be reached');
  }
  return String(error);
}
