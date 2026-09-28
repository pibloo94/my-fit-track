/**
 * Forwards `/api/*` from the Pages origin to the API, so the browser only ever talks
 * to one origin: no CORS for the web app, and a first-party session cookie (ADR-015,
 * ADR-016). A pass-through on purpose — method, path, query, headers and body go
 * unchanged, and the response comes back untouched, `Set-Cookie` included.
 */

interface ProxyEnv {
  /** API origin, e.g. `https://my-fit-track-api.koyeb.app`. No trailing slash needed. */
  readonly API_ORIGIN?: string;
  /** Shared with the API (`API_PROXY_SECRET`) so it trusts the forwarded client address. */
  readonly API_PROXY_SECRET?: string;
}

interface ProxyContext {
  readonly request: Request;
  readonly env: ProxyEnv;
}

const CLIENT_IP_HEADER = 'x-client-ip';
const PROXY_SECRET_HEADER = 'x-proxy-secret';

function serviceUnavailable(request: Request, detail: string): Response {
  const traceId = crypto.randomUUID();
  const body = {
    type: 'https://api.myfittracker.app/problems/service-unavailable',
    title: 'Service unavailable',
    status: 502,
    detail,
    instance: new URL(request.url).pathname,
    code: 'SERVICE_UNAVAILABLE',
    traceId,
  };
  return new Response(JSON.stringify(body), {
    status: 502,
    headers: { 'content-type': 'application/problem+json', 'x-request-id': traceId },
  });
}

export async function onRequest({ request, env }: ProxyContext): Promise<Response> {
  const apiOrigin = env.API_ORIGIN?.trim().replace(/\/+$/, '');
  if (!apiOrigin) {
    return serviceUnavailable(request, 'The API origin is not configured.');
  }

  const incoming = new URL(request.url);
  const target = new URL(incoming.pathname + incoming.search, apiOrigin);

  const headers = new Headers(request.headers);
  // The API is reached by its own host name, not the Pages one.
  headers.delete('host');
  // Never pass through a client-supplied value: only the proxy may assert these.
  headers.delete(CLIENT_IP_HEADER);
  headers.delete(PROXY_SECRET_HEADER);
  const clientIp = request.headers.get('cf-connecting-ip');
  if (env.API_PROXY_SECRET && clientIp) {
    headers.set(CLIENT_IP_HEADER, clientIp);
    headers.set(PROXY_SECRET_HEADER, env.API_PROXY_SECRET);
  }

  // Buffered rather than streamed: request bodies are small JSON, and a buffered
  // body behaves the same in every fetch implementation.
  const hasBody = request.method !== 'GET' && request.method !== 'HEAD';
  const body = hasBody ? await request.arrayBuffer() : undefined;

  try {
    return await fetch(target, { method: request.method, headers, body, redirect: 'manual' });
  } catch {
    // Most likely the free instance is still waking up, or the API is down.
    return serviceUnavailable(request, 'The API could not be reached. Try again shortly.');
  }
}
