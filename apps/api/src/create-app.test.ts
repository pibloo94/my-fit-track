import {
  healthResponseSchema,
  PROBLEM_CONTENT_TYPE,
  problemDetailsSchema,
} from '@my-fit-track/contracts';
import { Body, Controller, Module, Post } from '@nestjs/common';
import { FastifyAdapter, type NestFastifyApplication } from '@nestjs/platform-fastify';
import { Test } from '@nestjs/testing';
import { afterEach, describe, expect, it } from 'vitest';
import { z } from 'zod';

import { AppModule } from './app.module';
import { ZodValidationPipe } from './common/http/zod-validation.pipe';
import { configureApp } from './configure-app';
import { createApp } from './create-app';
import { loadAppConfig } from './infrastructure/config/load-app-config';

const probeSchema = z.strictObject({ name: z.string().min(1) });

@Controller('probe')
class ProbeController {
  @Post()
  echo(@Body(new ZodValidationPipe(probeSchema)) body: z.infer<typeof probeSchema>) {
    return body;
  }
}

@Module({ controllers: [ProbeController] })
class ProbeModule {}

const testEnv = {
  NODE_ENV: 'test',
  APP_VERSION: 'test-1.0.0',
  CORS_ORIGINS: 'http://localhost:4200',
  RATE_LIMIT_LIMIT: '1000',
} satisfies NodeJS.ProcessEnv;

describe('HTTP application', () => {
  let app: NestFastifyApplication | undefined;

  afterEach(async () => {
    if (app !== undefined) {
      await app.close();
      app = undefined;
    }
  });

  it('returns a health payload that matches the shared contract', async () => {
    app = await createApp(loadAppConfig(testEnv));
    const response = await app.inject({ method: 'GET', url: '/api/v1/health' });
    const body: unknown = response.json();

    expect(response.statusCode).toBe(200);
    expect(healthResponseSchema.parse(body)).toMatchObject({
      status: 'ok',
      version: 'test-1.0.0',
    });
    expect(response.headers['x-request-id']).toEqual(expect.any(String));
  });

  it('reuses a well-formed inbound request id', async () => {
    app = await createApp(loadAppConfig(testEnv));
    const response = await app.inject({
      method: 'GET',
      url: '/api/v1/health',
      headers: { 'x-request-id': 'client-trace-99' },
    });

    expect(response.headers['x-request-id']).toBe('client-trace-99');
  });

  it("returns RFC 9457 for an unknown route, not Nest's default JSON", async () => {
    app = await createApp(loadAppConfig(testEnv));
    const response = await app.inject({ method: 'GET', url: '/api/v1/does-not-exist' });
    const body = problemDetailsSchema.parse(response.json());

    expect(response.statusCode).toBe(404);
    expect(response.headers['content-type']).toContain(PROBLEM_CONTENT_TYPE);
    expect(body.code).toBe('NOT_FOUND');
    expect(body.traceId.length).toBeGreaterThan(0);
  });

  it('validates a request body through the shared pipe', async () => {
    const config = loadAppConfig(testEnv);
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule.forRoot(config), ProbeModule],
    }).compile();

    app = moduleRef.createNestApplication<NestFastifyApplication>(
      new FastifyAdapter({ logger: false }),
    );
    await configureApp(app, config);
    await app.init();
    await app.getHttpAdapter().getInstance().ready();

    const rejected = await app.inject({
      method: 'POST',
      url: '/api/v1/probe',
      payload: { extra: true },
    });
    const accepted = await app.inject({
      method: 'POST',
      url: '/api/v1/probe',
      payload: { name: 'squat' },
    });

    expect(rejected.statusCode).toBe(422);
    expect(rejected.headers['content-type']).toContain(PROBLEM_CONTENT_TYPE);
    expect(problemDetailsSchema.parse(rejected.json()).code).toBe('VALIDATION_FAILED');
    expect(accepted.statusCode).toBe(201);
    expect(accepted.json()).toEqual({ name: 'squat' });
  });

  it('sets Helmet headers and answers a CORS preflight from an allowed origin', async () => {
    app = await createApp(loadAppConfig(testEnv));
    const headers = await app.inject({ method: 'GET', url: '/api/v1/health' });
    const preflight = await app.inject({
      method: 'OPTIONS',
      url: '/api/v1/health',
      headers: {
        origin: 'http://localhost:4200',
        'access-control-request-method': 'GET',
      },
    });

    expect(headers.headers['x-content-type-options']).toBe('nosniff');
    expect(preflight.statusCode).toBe(204);
    expect(preflight.headers['access-control-allow-origin']).toBe('http://localhost:4200');
    expect(String(preflight.headers['access-control-allow-methods'])).toContain('PATCH');
  });

  it('rate-limits a client that exceeds the configured ceiling', async () => {
    app = await createApp(
      loadAppConfig({
        ...testEnv,
        RATE_LIMIT_LIMIT: '1',
        RATE_LIMIT_TTL_MS: '60000',
      }),
    );

    const first = await app.inject({ method: 'GET', url: '/api/v1/health' });
    const second = await app.inject({ method: 'GET', url: '/api/v1/health' });

    expect(first.statusCode).toBe(200);
    expect(second.statusCode).toBe(429);
    expect(problemDetailsSchema.parse(second.json()).code).toBe('RATE_LIMITED');
    expect(second.headers['content-type']).toContain(PROBLEM_CONTENT_TYPE);
  });
});
