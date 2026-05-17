import * as path from 'node:path';

import { ConfigService } from '@nestjs/config';
import { DataSource, DataSourceOptions } from 'typeorm';
import { PostgresConnectionOptions } from 'typeorm/driver/postgres/PostgresConnectionOptions';

import { EnvironmentVariables } from './env.config';

/**
 * Builds the Postgres TypeORM config from environment variables.
 * Migrations are the only way schema changes land — `synchronize` is driven by env but
 * production deployments should always set DB_SYNCHRONIZE=false.
 */
export const getDatabaseConfig = (
  configService: ConfigService<EnvironmentVariables>,
): PostgresConnectionOptions => {
  const config: PostgresConnectionOptions = {
    type: 'postgres',
    host: configService.get('DB_HOST', { infer: true }),
    port: configService.get('DB_PORT', { infer: true }),
    username: configService.get('DB_USERNAME', { infer: true }),
    password: configService.get('DB_PASSWORD', { infer: true }),
    database: configService.get('DB_DATABASE', { infer: true }),

    migrations: [path.resolve(__dirname, '../', 'migrations', '*{.ts,.js}')],
    entities: [path.resolve(__dirname, '../', '**', '*.entity{.ts,.js}')],
    migrationsRun: configService.get('DB_RUN_MIGRATIONS', { infer: true }),
    synchronize: configService.get('DB_SYNCHRONIZE', { infer: true }),
    logging: configService.get('DB_LOGGING', { infer: true }),
  };

  const disableSsl = configService.get('DB_DISABLE_SSL_AUTH', { infer: true });

  if (disableSsl) {
    // Local/dev Postgres rarely supports SSL — skip it entirely.
    // @ts-expect-error TypeORM types don't expose ssl on PostgresConnectionOptions cleanly.
    config.ssl = false;
  } else {
    // @ts-expect-error TypeORM types don't expose ssl on PostgresConnectionOptions cleanly.
    config.ssl = { rejectUnauthorized: false };
  }

  return config;
};

/**
 * Async factory for the Nest TypeOrmModule. Throws if no options provided.
 */
export const getDataSource = (options?: DataSourceOptions) => {
  if (!options) {
    throw new Error('No DataSourceOptions passed');
  }

  return Promise.resolve(new DataSource(options));
};
