import helmet from '@fastify/helmet';
import { type NestFastifyApplication } from '@nestjs/platform-fastify';

import { ProblemDetailsFilter } from './common/http/problem-details.filter';
import { type AppConfig } from './infrastructure/config/app-config';
import { attachRequestContext } from './infrastructure/logging/request-id';

/**
 * HTTP wiring shared by `main` and the tests. If a plugin is registered only in
 * `main.ts`, the tests would be proving a different server than the one we run.
 */
export async function configureApp(app: NestFastifyApplication, config: AppConfig): Promise<void> {
  app.setGlobalPrefix('api/v1');

  // Helmet first: Fastify only applies a plugin to routes registered after it.
  await app.register(helmet, {
    // This is a JSON API, not an HTML document. CSP would block nothing useful
    // here and would collide with the later Angular app's own policy.
    contentSecurityPolicy: false,
  });

  app.enableCors({
    origin: [...config.corsOrigins],
    // Fastify v5 allows only the CORS safelist by default; mutating methods
    // have to be named or PATCH/PUT/DELETE preflights fail.
    methods: ['GET', 'HEAD', 'POST', 'PUT', 'PATCH', 'DELETE'],
    allowedHeaders: ['Content-Type', 'Authorization', 'Idempotency-Key', 'X-Request-Id'],
    exposedHeaders: ['X-Request-Id'],
    credentials: true,
  });

  app.useGlobalFilters(new ProblemDetailsFilter());
  attachRequestContext(app);
  app.enableShutdownHooks();
}
