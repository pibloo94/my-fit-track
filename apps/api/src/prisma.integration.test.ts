import { execFile } from 'node:child_process';
import { createRequire } from 'node:module';
import path from 'node:path';
import { promisify } from 'node:util';

import { healthResponseSchema } from '@my-fit-track/contracts';
import { type NestFastifyApplication } from '@nestjs/platform-fastify';
import { PrismaClient } from '@prisma/client';
import { PostgreSqlContainer, type StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import { afterEach, describe, expect, it } from 'vitest';

import { createApp } from './create-app';
import { loadAppConfig } from './infrastructure/config/load-app-config';

const execFileAsync = promisify(execFile);
// Vitest and npm workspace scripts run with cwd = apps/api. createRequire needs a
// filename; import.meta is illegal in this package's CommonJS emit.
const apiRoot = process.cwd();
const require = createRequire(path.join(apiRoot, 'package.json'));
const prismaCli = path.join(path.dirname(require.resolve('prisma/package.json')), 'build/index.js');

async function migrateDeploy(databaseUrl: string): Promise<void> {
  await execFileAsync(process.execPath, [prismaCli, 'migrate', 'deploy'], {
    cwd: apiRoot,
    env: { ...process.env, DATABASE_URL: databaseUrl },
  });
}

describe('Prisma against PostgreSQL', () => {
  let app: NestFastifyApplication | undefined;

  afterEach(async () => {
    if (app !== undefined) {
      await app.close();
      app = undefined;
    }
  });

  it(
    'applies committed migrations, round-trips a probe row, and reports health ok',
    { timeout: 180_000 },
    async (context) => {
      let container: StartedPostgreSqlContainer | undefined;
      try {
        container = await new PostgreSqlContainer('postgres:17-alpine')
          .withDatabase('myfittrack')
          .withUsername('myfittrack')
          .withPassword('myfittrack')
          .start();
      } catch {
        context.skip();
        return;
      }

      if (container === undefined) {
        context.skip();
        return;
      }

      const databaseUrl = container.getConnectionUri();
      const prisma = new PrismaClient({ datasources: { db: { url: databaseUrl } } });

      try {
        await migrateDeploy(databaseUrl);

        const created = await prisma.migrationProbe.create({
          data: { note: 'phase-1-migration-probe' },
        });
        const found = await prisma.migrationProbe.findUnique({ where: { id: created.id } });

        expect(found?.note).toBe('phase-1-migration-probe');

        app = await createApp(
          loadAppConfig({
            NODE_ENV: 'test',
            APP_VERSION: 'test-1.0.0',
            CORS_ORIGINS: 'http://localhost:4200',
            DATABASE_URL: databaseUrl,
            RATE_LIMIT_LIMIT: '1000',
          }),
        );
        const response = await app.inject({ method: 'GET', url: '/api/v1/health' });

        expect(response.statusCode).toBe(200);
        expect(healthResponseSchema.parse(response.json())).toMatchObject({
          status: 'ok',
          version: 'test-1.0.0',
        });
      } finally {
        await prisma.$disconnect();
        await container.stop();
      }
    },
  );
});
