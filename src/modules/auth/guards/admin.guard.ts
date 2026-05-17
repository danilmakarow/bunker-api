import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Request } from 'express';

import { ForbiddenException } from '@/exceptions/forbidden.exception';
import { User } from '@/modules/database/entities';

/**
 * Allows the request through only if the authenticated user has
 * `isAdmin = true`. Must be applied **after** `CookieJwtGuard` (which is
 * global), so `req.requestStorage.user` is always populated by the time we run.
 */
@Injectable()
export class AdminGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<Request>();
    const user = request.requestStorage.has('user')
      ? (request.requestStorage.get('user') as User)
      : null;

    if (!user?.isAdmin) {
      throw new ForbiddenException('Admin role required');
    }

    return true;
  }
}
