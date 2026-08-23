import { ChangeDetectionStrategy, Component, inject } from '@angular/core';

import { HealthStore } from '../state/health.store';
import { HealthStatus } from '../ui/health-status';

@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [HealthStatus],
  providers: [HealthStore],
  template: `
    <section class="mx-auto max-w-xl space-y-6">
      <header class="space-y-1">
        <h1 class="text-2xl font-semibold">API health</h1>
        <p class="text-sm text-slate-400">
          The first client call, using the shared contract. If this page works, the web app can talk
          to the API.
        </p>
      </header>
      <mft-health-status
        [snapshot]="store.snapshot()"
        [loading]="store.loading()"
        [error]="store.error()"
        (retry)="store.reload()"
      />
    </section>
  `,
})
export class HealthPage {
  readonly store = inject(HealthStore);
}
