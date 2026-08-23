import { type Routes } from '@angular/router';

export const routes: Routes = [
  {
    path: '',
    loadChildren: () => import('./features/health/health.routes').then((m) => m.healthRoutes),
  },
];
