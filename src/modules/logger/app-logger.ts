import { inspect } from 'util';

import { Injectable, LoggerService } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { createSentryWinstonTransport } from '@sentry/node';
import { utilities as nestWinstonModuleUtilities } from 'nest-winston';
import winston, { createLogger, Logger as WinstonLogger } from 'winston';
import * as Transport from 'winston-transport';
import TransportStream from 'winston-transport';

/**
 * Winston-backed Nest logger with optional Sentry transport.
 * Mirrors the AppLogger from the ownership-monitor-api project so log shape stays familiar.
 */
@Injectable()
export class AppLogger implements LoggerService {
  private logger: WinstonLogger;

  constructor() {
    const transports: Transport[] = [];

    ConfigModule.forRoot();

    transports.push(
      new winston.transports.Console({
        format: winston.format.combine(
          winston.format.timestamp(),
          winston.format.ms(),
          nestWinstonModuleUtilities.format.nestLike('Bunker', {
            colors: true,
            prettyPrint: true,
            processId: true,
            appName: true,
          }),
        ),
      }),
    );

    if (process.env.SENTRY_DSN && process.env.SENTRY_ENABLE === 'true') {
      const SentryWinstonTransport =
        createSentryWinstonTransport(TransportStream);

      transports.push(new SentryWinstonTransport());
    }

    this.logger = createLogger({
      transports,
      level: 'debug',
    });
  }

  log(message: unknown, ...meta: unknown[]): void {
    this.logger.log('info', message as string, ...(meta as []));
  }

  info(message: unknown, ...meta: unknown[]): void {
    this.logger.log('info', message as string, ...(meta as []));
  }

  error(message: unknown, ...meta: unknown[]): void {
    this.logger.log('error', message as string, ...(meta as []));
  }

  warn(message: unknown, ...meta: unknown[]): void {
    this.logger.log('warn', message as string, ...(meta as []));
  }

  debug(message: unknown, ...meta: unknown[]): void {
    this.logger.log('debug', message as string, ...(meta as []));
  }

  verbose(message: unknown, ...meta: unknown[]): void {
    this.logger.log('verbose', message as string, ...(meta as []));
  }

  fatal(message: unknown, ...meta: unknown[]): void {
    this.logger.log('error', message as string, ...(meta as []));
  }

  inspect(payload: unknown, message: string, level: string = 'info'): void {
    this.logger.log(level, `${message}: ${inspect(payload)}`);
  }

  inspectInfo(payload: unknown, message: string): void {
    this.inspect(payload, message, 'info');
  }

  inspectError(payload: unknown, message: string): void {
    this.inspect(payload, message, 'error');
  }

  inspectWarn(payload: unknown, message: string): void {
    this.inspect(payload, message, 'warn');
  }

  inspectDebug(payload: unknown, message: string): void {
    this.inspect(payload, message, 'debug');
  }
}

export const logger = new AppLogger();
