// Sentry must be initialised first.
import '../dist/config/sentry.config';

import type { IncomingMessage, ServerResponse } from 'http';

import { NestApplicationOptions } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import cookieParser from 'cookie-parser';
import { DataSource } from 'typeorm';

import { AppModule } from '../dist/app.module';
import { EnvironmentVariables } from '../dist/config/env.config';
import { initializeSwagger } from '../dist/config/swagger.config';
import { AppLogger } from '../dist/modules/logger/app-logger';

type ExpressHandler = (req: IncomingMessage, res: ServerResponse) => void;

let cachedHandler: ExpressHandler | null = null;
let bootstrapPromise: Promise<ExpressHandler> | null = null;

/**
 * Bootstraps the Nest app once and exposes its underlying Express instance as
 * a request handler. Mirrors the wiring in `src/main.ts` (global `/api`
 * prefix, cookie-parser, CORS, Swagger) but skips `app.listen` since Vercel
 * owns the HTTP server.
 */
const bootstrap = async (): Promise<ExpressHandler> => {
  const nestConfig: NestApplicationOptions = {
    logger: new AppLogger(),
  };

  const app = await NestFactory.create<NestExpressApplication>(
    AppModule,
    nestConfig,
  );

  const configService = app.get(ConfigService<EnvironmentVariables>);
  const frontendUrl = configService.get('FRONTEND_URL', { infer: true })!;
  const logger = app.get(AppLogger);

  app.setGlobalPrefix('api');
  app.use(cookieParser());
  app.enableCors({ origin: frontendUrl, credentials: true });

  initializeSwagger(app);

  await app.init();

  await runPendingMigrations(app.get(DataSource), logger);

  logger.log(`Bunker API started in ${configService.get('NODE_ENV')} mode`);

  return app.getHttpAdapter().getInstance() as ExpressHandler;
};

/**
 * Runs any pending TypeORM migrations against the live DataSource.
 * Called once per cold start (since `bootstrap()` is cached). Neon's advisory
 * locks make concurrent starts safe — at most one applies, the rest see "none
 * pending". Throws on failure so the function crashes instead of serving
 * requests against a half-migrated schema.
 */
const runPendingMigrations = async (
  dataSource: DataSource,
  logger: AppLogger,
): Promise<void> => {
  try {
    const applied = await dataSource.runMigrations({ transaction: 'each' });

    if (applied.length === 0) {
      logger.log('No pending migrations');

      return;
    }

    logger.log(
      `Applied ${applied.length} migration(s): ${applied.map((m) => m.name).join(', ')}`,
    );
  } catch (error) {
    logger.error('Migration run failed', error);
    throw error;
  }
};

/**
 * Lazily bootstraps the Nest app and reuses it across warm invocations.
 * Concurrent cold-start requests share the same bootstrap promise to avoid
 * spinning up two Nest instances on the same worker.
 */
const getHandler = async (): Promise<ExpressHandler> => {
  if (cachedHandler) {
    return cachedHandler;
  }

  if (!bootstrapPromise) {
    bootstrapPromise = bootstrap().then((handler) => {
      cachedHandler = handler;

      return handler;
    });
  }

  return bootstrapPromise;
};

/**
 * Vercel serverless entry point. Delegates every request to the cached Nest
 * Express handler.
 */
export default async (
  req: IncomingMessage,
  res: ServerResponse,
): Promise<void> => {
  const handler = await getHandler();

  handler(req, res);
};
