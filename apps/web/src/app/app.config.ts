import { provideHttpClient, withInterceptors } from '@angular/common/http';
import {
  type ApplicationConfig,
  provideAppInitializer,
  provideBrowserGlobalErrorListeners,
  provideZonelessChangeDetection,
} from '@angular/core';
import { provideRouter } from '@angular/router';

import { routes } from './app.routes';
import { APP_CONFIG } from './core/config/app-config';
import { getRuntimeAppConfig, loadRuntimeAppConfig } from './core/config/load-runtime-app-config';
import { problemDetailsInterceptor } from './core/http/problem-details.interceptor';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideZonelessChangeDetection(),
    provideRouter(routes),
    provideHttpClient(withInterceptors([problemDetailsInterceptor])),
    provideAppInitializer(() => loadRuntimeAppConfig()),
    { provide: APP_CONFIG, useFactory: () => getRuntimeAppConfig() },
  ],
};
