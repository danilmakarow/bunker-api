import { ConfigService } from '@nestjs/config';
import { default as Sentry } from '@sentry/nestjs';
import { eventLoopBlockIntegration } from '@sentry/node-native';
import { nodeProfilingIntegration } from '@sentry/profiling-node';

import { getConfigModule } from './env.config';
import { logger } from '../modules/logger/app-logger';

getConfigModule();

const configService = new ConfigService();
const sentryDsn = configService.get<string>('SENTRY_DSN');
const isSentryEnabled = configService.get('SENTRY_ENABLE') === 'true';

if (sentryDsn && isSentryEnabled) {
  logger.log('Sentry is initialized');

  Sentry.init({
    dsn: sentryDsn,
    integrations: [
      nodeProfilingIntegration(),
      Sentry.postgresIntegration(),
      Sentry.httpIntegration(),
      eventLoopBlockIntegration({ threshold: 1000 }),
      Sentry.consoleLoggingIntegration({
        levels: ['debug', 'info', 'warn', 'error', 'log', 'assert', 'trace'],
      }),
    ],

    sendDefaultPii: true,
    tracesSampleRate: 1.0,
    profilesSampleRate: 1.0,
    enableLogs: true,
  });
} else {
  logger.log('Sentry is disabled by configuration');
}

export { Sentry };
