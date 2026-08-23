import { type HealthResponse } from '@my-fit-track/contracts';
import { Controller, Get } from '@nestjs/common';

import { HealthService } from './health.service';

@Controller('health')
export class HealthController {
  // Constructor injection without an explicit token: resolution depends entirely
  // on the parameter type metadata emitted by emitDecoratorMetadata.
  constructor(private readonly health: HealthService) {}

  @Get()
  check(): HealthResponse {
    return this.health.check();
  }
}
