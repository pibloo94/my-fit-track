import { type DynamicModule, Global, Module } from '@nestjs/common';

import { APP_CONFIG, type AppConfig } from './app-config';

@Global()
@Module({})
export class AppConfigModule {
  static forRoot(config: AppConfig): DynamicModule {
    return {
      module: AppConfigModule,
      global: true,
      providers: [{ provide: APP_CONFIG, useValue: config }],
      exports: [APP_CONFIG],
    };
  }
}
