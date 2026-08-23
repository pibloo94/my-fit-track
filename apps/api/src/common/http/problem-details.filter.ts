import { PROBLEM_CONTENT_TYPE, problemDetailsSchema } from '@my-fit-track/contracts';
import { type ArgumentsHost, Catch, type ExceptionFilter, Logger } from '@nestjs/common';
import { type FastifyReply, type FastifyRequest } from 'fastify';

import { currentTraceId } from '../request-context';
import { toProblemDetails } from './problem-details.mapper';

const REQUEST_ID_HEADER = 'x-request-id';

/**
 * Single translation point from thrown errors to RFC 9457. Every client error
 * path reads this shape; adding a second format later would split that path.
 */
@Catch()
export class ProblemDetailsFilter implements ExceptionFilter {
  private readonly logger = new Logger(ProblemDetailsFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const http = host.switchToHttp();
    const request = http.getRequest<FastifyRequest>();
    const reply = http.getResponse<FastifyReply>();

    const traceId = readTraceId(request);
    const instance = request.url;
    const problem = toProblemDetails({ exception, traceId, instance });

    // The mapper is the source of truth; this parse is a guard against drifting
    // away from the shared contract, not extra business logic.
    const checked = problemDetailsSchema.safeParse(problem);
    const body = checked.success ? checked.data : problem;

    if (body.status >= 500) {
      const stack = exception instanceof Error ? exception.stack : undefined;
      this.logger.error(`${body.title} [${body.code}] ${body.traceId}`, stack);
    } else {
      this.logger.warn(`${body.title} [${body.code}] ${body.traceId}`);
    }

    void reply
      .status(body.status)
      .header('content-type', PROBLEM_CONTENT_TYPE)
      .header(REQUEST_ID_HEADER, body.traceId)
      .send(body);
  }
}

function readTraceId(request: FastifyRequest): string {
  if (typeof request.id === 'string' && request.id.length > 0) {
    return request.id;
  }
  return currentTraceId() ?? 'unknown';
}
