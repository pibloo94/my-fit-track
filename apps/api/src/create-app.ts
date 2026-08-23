import { NestFactory } from '@nestjs/core';
import { FastifyAdapter, type NestFastifyApplication } from '@nestjs/platform-fastify';

import { AppModule } from './app.module';
import { configureApp } from './configure-app';
import { type AppConfig } from './infrastructure/config/app-config';
import { JsonLogger } from './infrastructure/logging/json-logger';
import { createRequestIdGenerator, REQUEST_ID_HEADER } from './infrastructure/logging/request-id';

export async function createApp(config: AppConfig): Promise<NestFastifyApplication> {
  const adapter = new FastifyAdapter({
    logger:
      config.nodeEnv === 'test'
        ? false
        : {
            level: config.logLevel,
            redact: {
              paths: ['req.headers.authorization', 'req.headers.cookie'],
              remove: true,
            },
          },
    requestIdHeader: REQUEST_ID_HEADER,
    genReqId: createRequestIdGenerator(),
  });

  const app = await NestFactory.create<NestFastifyApplication>(AppModule.forRoot(config), adapter, {
    logger: config.nodeEnv === 'test' ? false : new JsonLogger(),
  });

  await configureApp(app, config);
  await app.init();
  await app.getHttpAdapter().getInstance().ready();
  return app;
}
