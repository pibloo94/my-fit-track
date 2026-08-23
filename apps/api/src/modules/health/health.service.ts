import { type HealthResponse } from '@my-fit-track/contracts';
import { Inject, Injectable } from '@nestjs/common';

import { APP_CONFIG, type AppConfig } from '../../infrastructure/config/app-config';

@Injectable()
export class HealthService {
  constructor(@Inject(APP_CONFIG) private readonly config: AppConfig) {}

  check(): HealthResponse {
    return {
      status: 'ok',
      version: this.config.appVersion,
      uptimeSeconds: Math.round(process.uptime()),
      checkedAt: new Date().toISOString(),
    };
  }
}
