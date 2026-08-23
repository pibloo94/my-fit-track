import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';

@Component({
  selector: 'mft-app-shell',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, RouterLinkActive, RouterOutlet],
  template: `
    <div class="mx-auto flex min-h-screen max-w-3xl flex-col px-4 py-8">
      <header class="mb-10 flex items-baseline justify-between gap-4">
        <a routerLink="/" class="text-lg font-semibold tracking-tight">My Fit Tracker</a>
        <nav class="text-sm text-slate-400">
          <a
            routerLink="/"
            routerLinkActive="text-slate-100"
            [routerLinkActiveOptions]="{ exact: true }"
            >Health</a
          >
        </nav>
      </header>
      <main class="flex-1">
        <router-outlet />
      </main>
    </div>
  `,
})
export class AppShell {}
