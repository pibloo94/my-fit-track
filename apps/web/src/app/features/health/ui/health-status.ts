import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';

import { type AppError } from '../../../core/error/app-error';
import { type HealthSnapshot } from '../domain/health';

@Component({
  selector: 'mft-health-status',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [DatePipe],
  template: `
    @if (loading()) {
      <p data-testid="health-loading">Checking the API…</p>
    } @else if (error(); as failure) {
      <div data-testid="health-error" class="space-y-2">
        <p class="font-medium text-red-300">{{ failure.title }}</p>
        @if (failure.detail) {
          <p class="text-sm text-slate-400">{{ failure.detail }}</p>
        }
        @if (failure.traceId) {
          <p class="font-mono text-xs text-slate-500">trace {{ failure.traceId }}</p>
        }
        <button
          type="button"
          class="rounded border border-slate-600 px-3 py-1 text-sm hover:border-slate-400"
          (click)="retry.emit()"
        >
          Try again
        </button>
      </div>
    } @else if (snapshot(); as health) {
      <dl data-testid="health-ok" class="grid gap-2 sm:grid-cols-2">
        <div>
          <dt class="text-xs uppercase tracking-wide text-slate-500">Status</dt>
          <dd class="text-lg font-medium text-emerald-300">{{ health.status }}</dd>
        </div>
        <div>
          <dt class="text-xs uppercase tracking-wide text-slate-500">Version</dt>
          <dd>{{ health.version }}</dd>
        </div>
        <div>
          <dt class="text-xs uppercase tracking-wide text-slate-500">Uptime</dt>
          <dd>{{ health.uptimeSeconds }}s</dd>
        </div>
        <div>
          <dt class="text-xs uppercase tracking-wide text-slate-500">Checked</dt>
          <dd>{{ health.checkedAt | date: 'medium' }}</dd>
        </div>
      </dl>
    }
  `,
})
export class HealthStatus {
  readonly snapshot = input<HealthSnapshot | undefined>();
  readonly loading = input(false);
  readonly error = input<AppError | undefined>();
  readonly retry = output();
}
