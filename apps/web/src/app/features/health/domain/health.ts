export type HealthStatus = 'ok' | 'degraded';

/**
 * UI-facing snapshot. Dates are `Date` here; the wire format stays ISO in the
 * contract and is converted in the mapper, not in the template.
 */
export interface HealthSnapshot {
  readonly status: HealthStatus;
  readonly version: string;
  readonly uptimeSeconds: number;
  readonly checkedAt: Date;
}
