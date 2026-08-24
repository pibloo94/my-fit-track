import { type DynamicModule, Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';

import { type AppConfig } from './infrastructure/config/app-config';
import { AppConfigModule } from './infrastructure/config/app-config.module';
import { PrismaModule } from './infrastructure/prisma/prisma.module';
import { HealthModule } from './modules/health/health.module';

@Module({})
export class AppModule {
  static forRoot(config: AppConfig): DynamicModule {
    return {
      module: AppModule,
      imports: [
        AppConfigModule.forRoot(config),
        PrismaModule,
        ThrottlerModule.forRoot({
          throttlers: [
            {
              name: 'default',
              ttl: config.rateLimit.ttlMs,
              limit: config.rateLimit.limit,
            },
          ],
        }),
        HealthModule,
      ],
      providers: [{ provide: APP_GUARD, useClass: ThrottlerGuard }],
    };
  }
}
