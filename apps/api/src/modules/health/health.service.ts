import { type HealthResponse } from '@my-fit-track/contracts';
import { Injectable } from '@nestjs/common';

@Injectable()
export class HealthService {
  check(): HealthResponse {
    return {
      status: 'ok',
      version: process.env['APP_VERSION'] ?? 'dev',
      uptimeSeconds: Math.round(process.uptime()),
      checkedAt: new Date().toISOString(),
    };
  }
}
