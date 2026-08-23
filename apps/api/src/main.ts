import 'reflect-metadata';

import { NestFactory } from '@nestjs/core';
import { FastifyAdapter, type NestFastifyApplication } from '@nestjs/platform-fastify';

import { AppModule } from './app.module';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create<NestFastifyApplication>(AppModule, new FastifyAdapter());

  app.setGlobalPrefix('api/v1');

  // Fastify binds to localhost by default, which breaks inside a container.
  await app.listen(Number(process.env['PORT'] ?? 3000), '0.0.0.0');
}

void bootstrap();
