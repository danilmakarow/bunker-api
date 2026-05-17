import { ConfigModule } from '@nestjs/config';
import { z } from 'zod';

/**
 * Coerces a string-or-boolean value into a strict boolean.
 */
const booleanValidator = z.preprocess((val) => {
  if (typeof val === 'boolean') {
    return val;
  }

  if (!val || typeof val !== 'string' || !['true', 'false'].includes(val)) {
    return undefined;
  }

  return val === 'true';
}, z.boolean());

/**
 * Schema for required environment variables.
 * Validated on application boot; failing fast on misconfiguration.
 */
export const environmentSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']),
  PORT: z.coerce.number(),

  FRONTEND_URL: z.string(),
  COOKIE_DOMAIN: z.string(),

  DB_HOST: z.string(),
  DB_PORT: z.coerce.number(),
  DB_USERNAME: z.string(),
  DB_PASSWORD: z.string(),
  DB_DATABASE: z.string(),
  DB_SYNCHRONIZE: booleanValidator,
  DB_RUN_MIGRATIONS: booleanValidator,
  DB_LOGGING: booleanValidator,
  DB_DISABLE_SSL_AUTH: booleanValidator,

  JWT_SECRET: z.string(),
  JWT_EXPIRE: z.string(),
  COOKIE_NAME: z.string(),

  GOOGLE_CLIENT_ID: z.string(),
  GOOGLE_CLIENT_SECRET: z.string(),
  GOOGLE_CALLBACK_URL: z.string(),

  SENTRY_DSN: z.string().optional(),
  SENTRY_ENABLE: booleanValidator,
});

export type EnvironmentVariables = z.infer<typeof environmentSchema>;

/**
 * Validates `process.env` against `environmentSchema`. Throws on failure.
 */
export const validateEnvs = (config: Record<string, unknown>) => {
  const result = environmentSchema.safeParse(config);

  if (!result.success) {
    throw new Error(
      `Environment validation failed: ${result.error.issues
        .map((issue) => `${issue.path.join('.')}: ${issue.message}`)
        .join(', ')}`,
    );
  }

  return result.data;
};

/**
 * Builds the global ConfigModule used by both the Nest app and CLI tooling.
 */
export const getConfigModule = () =>
  ConfigModule.forRoot({
    isGlobal: true,
    validate: validateEnvs,
    envFilePath: ['.env.local', '.env'],
  });
