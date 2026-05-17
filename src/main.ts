// Sentry must be initialised first.
import './config/sentry.config';

import { NestApplicationOptions } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import cookieParser from 'cookie-parser';

import { AppModule } from './app.module';
import { EnvironmentVariables } from '@/config/env.config';
import { initializeSwagger } from '@/config/swagger.config';
import { AppLogger } from '@/modules/logger/app-logger';

/**
 * Boots the Nest app: cookie-parser, CORS for the FE origin, Swagger at /docs.
 */
const bootstrap = async () => {
  const nestConfig: NestApplicationOptions = {
    logger: new AppLogger(),
  };

  const app = await NestFactory.create(AppModule, nestConfig);

  const configService = app.get(ConfigService<EnvironmentVariables>);
  const logger = app.get(AppLogger);
  const port = configService.get('PORT', { infer: true }) ?? 3000;
  const frontendUrl = configService.get('FRONTEND_URL', { infer: true })!;

  app.setGlobalPrefix('api');
  app.use(cookieParser());
  app.enableCors({ origin: frontendUrl, credentials: true });

  initializeSwagger(app);

  await app.listen(port);

  logger.log(
    `Bunker API listening on http://127.0.0.1:${port} in ${configService.get('NODE_ENV')} mode`,
  );
  logger.log(`Swagger docs at http://127.0.0.1:${port}/docs`);
};

void bootstrap();
