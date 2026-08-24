import { type HealthResponse } from '@my-fit-track/contracts';
import { Inject, Injectable } from '@nestjs/common';

import { APP_CONFIG, type AppConfig } from '../../infrastructure/config/app-config';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';

@Injectable()
export class HealthService {
  constructor(
    @Inject(APP_CONFIG) private readonly config: AppConfig,
    private readonly prisma: PrismaService,
  ) {}

  async check(): Promise<HealthResponse> {
    const databaseReachable = await this.prisma.ping();

    return {
      status: databaseReachable ? 'ok' : 'degraded',
      version: this.config.appVersion,
      uptimeSeconds: Math.round(process.uptime()),
      checkedAt: new Date().toISOString(),
    };
  }
}
