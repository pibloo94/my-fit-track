import { computed, inject, Injectable } from '@angular/core';

import { toAppError } from '../../../core/error/problem-details.mapper';
import { HealthApi } from '../data-access/health.api';

@Injectable()
export class HealthStore {
  private readonly api = inject(HealthApi);

  readonly snapshot = computed(() => this.api.query.value() ?? undefined);
  readonly loading = computed(() => this.api.query.isLoading());
  readonly error = computed(() => {
    const failure = this.api.query.error();
    return failure === undefined ? undefined : toAppError(failure);
  });

  reload(): void {
    this.api.query.reload();
  }
}
