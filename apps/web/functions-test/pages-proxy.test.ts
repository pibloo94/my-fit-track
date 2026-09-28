import { PROBLEM_CONTENT_TYPE, problemDetailsSchema } from '@my-fit-track/contracts';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { onRequest } from '../functions/api/[[path]]';

const secret = 's'.repeat(32);
const env = { API_ORIGIN: 'https://api.example.test/', API_PROXY_SECRET: secret };

function stubUpstream(response = new Response('{}', { status: 200 })) {
  const upstream = vi.fn((input: URL | RequestInfo, init?: RequestInit) => {
    void input;
    void init;
    return Promise.resolve(response);
  });
  vi.stubGlobal('fetch', upstream);
  return upstream;
}

function forwardedCall(upstream: ReturnType<typeof stubUpstream>) {
  const call = upstream.mock.calls[0];
  if (call === undefined) {
    throw new Error('the proxy did not call the API');
  }
  const [input, init] = call;
  const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
  return { url, init: init ?? {}, headers: new Headers(init?.headers) };
}

describe('Pages /api proxy', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('forwards method, path, query and body to the API origin', async () => {
    const upstream = stubUpstream();
    const request = new Request('https://web.example.test/api/v1/probe?limit=5', {
      method: 'POST',
      headers: { 'content-type': 'application/json', host: 'web.example.test' },
      body: JSON.stringify({ name: 'squat' }),
    });

    await onRequest({ request, env });

    const { url, init, headers } = forwardedCall(upstream);
    expect(url).toBe('https://api.example.test/api/v1/probe?limit=5');
    expect(init.method).toBe('POST');
    expect(new TextDecoder().decode(init.body as ArrayBuffer)).toBe('{"name":"squat"}');
    expect(headers.get('content-type')).toBe('application/json');
    expect(headers.has('host')).toBe(false);
  });

  it('returns the API response untouched, cookies included', async () => {
    stubUpstream(
      new Response('{"ok":true}', { status: 201, headers: { 'set-cookie': '__Host-session=x' } }),
    );

    const response = await onRequest({
      request: new Request('https://web.example.test/api/v1/auth/login', { method: 'POST' }),
      env,
    });

    expect(response.status).toBe(201);
    expect(response.headers.get('set-cookie')).toBe('__Host-session=x');
  });

  it('asserts the client address from Cloudflare and drops client-supplied values', async () => {
    const upstream = stubUpstream();
    const request = new Request('https://web.example.test/api/v1/health', {
      headers: {
        'cf-connecting-ip': '203.0.113.9',
        'x-client-ip': '198.51.100.1',
        'x-proxy-secret': 'guessed',
      },
    });

    await onRequest({ request, env });

    const { headers } = forwardedCall(upstream);
    expect(headers.get('x-client-ip')).toBe('203.0.113.9');
    expect(headers.get('x-proxy-secret')).toBe(secret);
  });

  it('forwards no client address at all when no secret is configured', async () => {
    const upstream = stubUpstream();
    const request = new Request('https://web.example.test/api/v1/health', {
      headers: { 'cf-connecting-ip': '203.0.113.9', 'x-client-ip': '198.51.100.1' },
    });

    await onRequest({ request, env: { API_ORIGIN: env.API_ORIGIN } });

    const { headers } = forwardedCall(upstream);
    expect(headers.has('x-client-ip')).toBe(false);
    expect(headers.has('x-proxy-secret')).toBe(false);
  });

  it('answers 502 problem+json when the API cannot be reached', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(() => Promise.reject(new TypeError('connect failed'))),
    );

    const response = await onRequest({
      request: new Request('https://web.example.test/api/v1/health'),
      env,
    });
    // The web app's error interceptor parses this, so it must satisfy the shared contract.
    const body = problemDetailsSchema.parse(await response.json());

    expect(response.status).toBe(502);
    expect(response.headers.get('content-type')).toBe(PROBLEM_CONTENT_TYPE);
    expect(body).toMatchObject({ code: 'SERVICE_UNAVAILABLE', instance: '/api/v1/health' });
  });

  it('answers 502 when the API origin is not configured', async () => {
    const upstream = stubUpstream();

    const response = await onRequest({
      request: new Request('https://web.example.test/api/v1/health'),
      env: {},
    });

    expect(response.status).toBe(502);
    expect(upstream).not.toHaveBeenCalled();
  });
});
