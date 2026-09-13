import { toNextJsHandler } from 'better-auth/next-js';
import { auth } from '@/lib/auth';

const handler = toNextJsHandler(auth);

/**
 * A CLI token may only sign itself out here. Every other account endpoint (sessions, profile,
 * device approval) needs the browser's cookie session, as pages and server actions do.
 */
const BEARER_PATHS = new Set(['/api/auth/sign-out']);

function cookieOnly(method: (request: Request) => Promise<Response>) {
  return async (request: Request): Promise<Response> => {
    const bearer = (request.headers.get('authorization') ?? '').startsWith('Bearer ');
    if (bearer && !BEARER_PATHS.has(new URL(request.url).pathname)) {
      return Response.json({ error: 'This endpoint needs a browser session.' }, { status: 403 });
    }
    return method(request);
  };
}

export const GET = cookieOnly(handler.GET);
export const POST = cookieOnly(handler.POST);
