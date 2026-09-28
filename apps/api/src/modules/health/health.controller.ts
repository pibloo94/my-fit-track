import { type HealthResponse, type LivenessResponse } from '@my-fit-track/contracts';
import { Controller, Get } from '@nestjs/common';
import { SkipThrottle } from '@nestjs/throttler';

import { HealthService } from './health.service';

@Controller('health')
export class HealthController {
  // Constructor injection without an explicit token: resolution depends entirely
  // on the parameter type metadata emitted by emitDecoratorMetadata.
  constructor(private readonly health: HealthService) {}

  @Get()
  check(): Promise<HealthResponse> {
    return this.health.check();
  }

  /**
   * For the platform health check, which polls every few seconds. Touches nothing,
   * so it neither wakes the database nor spends the caller's rate limit.
   */
  @Get('live')
  @SkipThrottle()
  live(): LivenessResponse {
    return { status: 'alive' };
  }
}
