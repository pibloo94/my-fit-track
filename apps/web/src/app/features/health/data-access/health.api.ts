import { healthResponseSchema } from '@my-fit-track/contracts';
import { httpResource } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';

import { APP_CONFIG } from '../../../core/config/app-config';
import { type HealthSnapshot } from '../domain/health';
import { toHealthSnapshot } from './health.mapper';

@Injectable({ providedIn: 'root' })
export class HealthApi {
  private readonly config = inject(APP_CONFIG);

  /**
   * Server state for `/health`. The store holds this resource; pages do not
   * call HttpClient.
   */
  readonly query = httpResource<HealthSnapshot>(() => `${this.config.apiBaseUrl}/api/v1/health`, {
    parse: (raw: unknown) => toHealthSnapshot(healthResponseSchema.parse(raw)),
  });
}
