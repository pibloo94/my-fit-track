import { createHash, timingSafeEqual } from 'node:crypto';

import { type NestFastifyApplication } from '@nestjs/platform-fastify';

/** Set by the Cloudflare Pages proxy from `CF-Connecting-IP`. */
export const CLIENT_IP_HEADER = 'x-client-ip';

/** Proves the request came through our proxy, so {@link CLIENT_IP_HEADER} can be believed. */
export const PROXY_SECRET_HEADER = 'x-proxy-secret';

const clientIps = new WeakMap<object, string>();

function firstValue(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

function digest(value: string): Buffer {
  return createHash('sha256').update(value).digest();
}

/** Hashing first gives equal lengths, which `timingSafeEqual` requires. */
export function isTrustedProxy(presented: string | undefined, secret: string | undefined): boolean {
  if (presented === undefined || secret === undefined) {
    return false;
  }
  return timingSafeEqual(digest(presented), digest(secret));
}

/**
 * Behind the Pages proxy every request arrives from a Cloudflare address, so
 * `request.ip` would put all users in one rate-limit bucket. The forwarded client
 * address is used only when the shared secret proves the proxy sent it; anyone
 * else could simply set the header.
 */
export function attachClientIp(app: NestFastifyApplication, proxySecret: string | undefined): void {
  const instance = app.getHttpAdapter().getInstance();
  instance.addHook('onRequest', (request, _reply, done) => {
    const forwarded = firstValue(request.headers[CLIENT_IP_HEADER])?.trim();
    const trusted = isTrustedProxy(firstValue(request.headers[PROXY_SECRET_HEADER]), proxySecret);
    clientIps.set(request, trusted && forwarded ? forwarded : request.ip);
    done();
  });
}

export function clientIpOf(request: object, fallback: string): string {
  return clientIps.get(request) ?? fallback;
}
