import { type HealthResponse } from '@my-fit-track/contracts';

import { type HealthSnapshot } from '../domain/health';

export function toHealthSnapshot(dto: HealthResponse): HealthSnapshot {
  return {
    status: dto.status,
    version: dto.version,
    uptimeSeconds: dto.uptimeSeconds,
    checkedAt: new Date(dto.checkedAt),
  };
}
