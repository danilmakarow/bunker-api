import { Injectable, NestMiddleware } from '@nestjs/common';
import { NextFunction, Request, Response } from 'express';

import { AppLogger } from '@/modules/logger/app-logger';

/**
 * Logs one line per incoming request with method, path, query, and (sanitised) body.
 */
@Injectable()
export class LogRequestMiddleware implements NestMiddleware {
  private fieldsToFilterOut = ['password', 'token'];

  constructor(private logger: AppLogger) {}

  private prepareBodyToLog(body: unknown): Record<string, unknown> | null {
    if (!body || typeof body !== 'object') {
      return null;
    }

    const bodyKeys = Object.keys(body);
    const bodyToLog: Record<string, unknown> = {};

    bodyKeys.forEach((key) => {
      const value = (body as Record<string, unknown>)[key];
      const shouldBeCensored = this.fieldsToFilterOut.includes(key);

      bodyToLog[key] = !shouldBeCensored ? value : '<HIDDEN_FROM_LOGS>';
    });

    return bodyToLog;
  }

  use(req: Request, _: Response, next: NextFunction): void {
    const bodyToLog = this.prepareBodyToLog(req.body);

    this.logger.log(`Request [${req.method}]: ${req.originalUrl}`, {
      query: req.query,
      body: bodyToLog,
      ip: req.ip,
    });

    next();
  }
}
