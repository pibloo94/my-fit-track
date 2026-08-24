import { Inject, Injectable, type OnModuleDestroy } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

import { APP_CONFIG, type AppConfig } from '../config/app-config';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleDestroy {
  constructor(@Inject(APP_CONFIG) config: AppConfig) {
    super({
      datasources: {
        db: { url: config.databaseUrl },
      },
    });
  }

  async onModuleDestroy(): Promise<void> {
    await this.$disconnect();
  }

  /**
   * Liveness of the database, not of this process. Used by `/health`.
   * Connects lazily: HTTP tests that boot the app without Postgres must not hang
   * on module init.
   */
  async ping(): Promise<boolean> {
    try {
      const rows = await this.$queryRaw<{ ok: number }[]>`SELECT 1 AS ok`;
      return rows.length > 0;
    } catch {
      return false;
    }
  }
}
