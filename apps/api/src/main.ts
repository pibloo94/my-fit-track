import 'reflect-metadata';

import { createApp } from './create-app';
import { InvalidAppConfigError, loadAppConfig } from './infrastructure/config/load-app-config';

async function bootstrap(): Promise<void> {
  let config;
  try {
    config = loadAppConfig();
  } catch (error) {
    if (error instanceof InvalidAppConfigError) {
      process.stderr.write(`${error.message}\n`);
      process.exitCode = 1;
      return;
    }
    throw error;
  }

  const app = await createApp(config);
  await app.listen({ port: config.port, host: config.host });
}

void bootstrap();
