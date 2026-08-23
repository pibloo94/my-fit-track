import { type IncomingHttpHeaders } from 'node:http';
import { randomUUID } from 'node:crypto';

import { type NestFastifyApplication } from '@nestjs/platform-fastify';

import { requestContext } from '../../common/request-context';

export const REQUEST_ID_HEADER = 'x-request-id';

const REQUEST_ID_PATTERN = /^[\w.:-]{1,128}$/;

/**
 * Reuses a client-supplied id when it is a short token we can safely put in
 * logs. Anything else is replaced: a 4 KB header must not become every log line.
 */
export function createRequestIdGenerator() {
  return (req: { headers: IncomingHttpHeaders }): string => {
    const raw = req.headers[REQUEST_ID_HEADER];
    const value = Array.isArray(raw) ? raw[0] : raw;
    if (value !== undefined && REQUEST_ID_PATTERN.test(value)) {
      return value;
    }
    return randomUUID();
  };
}

export function attachRequestContext(app: NestFastifyApplication): void {
  const instance = app.getHttpAdapter().getInstance();
  instance.addHook('onRequest', (request, reply, done) => {
    const traceId = String(request.id);
    void reply.header(REQUEST_ID_HEADER, traceId);
    requestContext.run({ traceId }, done);
  });
}
