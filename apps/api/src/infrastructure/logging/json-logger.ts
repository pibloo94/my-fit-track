import { type LoggerService } from '@nestjs/common';

import { currentTraceId } from '../../common/request-context';

/**
 * JSON lines to stdout. Fastify already logs the HTTP request via Pino; this
 * covers Nest's own lifecycle messages so they share the same shape and, when
 * a request is in flight, the same `traceId`.
 */
export class JsonLogger implements LoggerService {
  log(message: string, context?: string): void {
    this.write('info', message, context);
  }

  error(message: string, ...optional: unknown[]): void {
    const last = optional.at(-1);
    const context = typeof last === 'string' ? last : undefined;
    this.write('error', message, context);
  }

  warn(message: string, context?: string): void {
    this.write('warn', message, context);
  }

  debug(message: string, context?: string): void {
    this.write('debug', message, context);
  }

  verbose(message: string, context?: string): void {
    this.write('debug', message, context);
  }

  private write(level: string, message: string, context?: string): void {
    const line = {
      level,
      time: new Date().toISOString(),
      msg: message,
      ...(context === undefined ? {} : { context }),
      ...(currentTraceId() === undefined ? {} : { traceId: currentTraceId() }),
    };
    process.stdout.write(`${JSON.stringify(line)}\n`);
  }
}
