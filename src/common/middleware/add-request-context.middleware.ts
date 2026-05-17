import { Injectable, NestMiddleware } from '@nestjs/common';
import { NextFunction, Request, Response } from 'express';

/**
 * Initialises req.requestStorage on every incoming request.
 * Strategies populate it (e.g. `user`); decorators and services read from it.
 */
@Injectable()
export class AddRequestContextMiddleware implements NestMiddleware {
  use(req: Request, _: Response, next: NextFunction): void {
    req.requestStorage = new Map();
    next();
  }
}
