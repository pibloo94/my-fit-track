import { Injectable } from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';

import { clientIpOf } from './client-ip';

/** Rate-limits by the real client address resolved in {@link attachClientIp}. */
@Injectable()
export class ClientIpThrottlerGuard extends ThrottlerGuard {
  protected override getTracker(request: Record<string, unknown>): Promise<string> {
    const ip = typeof request['ip'] === 'string' ? request['ip'] : 'unknown';
    return Promise.resolve(clientIpOf(request, ip));
  }
}
