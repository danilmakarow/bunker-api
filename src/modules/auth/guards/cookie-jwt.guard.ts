import { ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuthGuard } from '@nestjs/passport';

import { UnauthorizedException } from '@/exceptions/unauthorized.exception';
import { StrategiesEnum } from '@/modules/auth/constants/strategies.enum';
import { publicMetadataSymbol } from '@/modules/auth/decorators/public.decorator';
import { User } from '@/modules/database/entities';

/**
 * Globally-applied guard that protects every route by default.
 * Routes/controllers marked with @Public() bypass authentication.
 */
@Injectable()
export class CookieJwtGuard extends AuthGuard(StrategiesEnum.COOKIE_JWT) {
  constructor(private reflector: Reflector) {
    super();
  }

  canActivate(context: ExecutionContext) {
    const isPublic = this.reflector.getAllAndOverride<
      typeof publicMetadataSymbol
    >(publicMetadataSymbol, [context.getHandler(), context.getClass()]);

    if (isPublic) {
      return true;
    }

    return super.canActivate(context);
  }

  /**
   * Re-throws Passport auth failures as our typed UnauthorizedException so the
   * response envelope carries our stable E_UNAUTHORIZED error code.
   */
  handleRequest<TUser = User>(err: unknown, user: TUser | false): TUser {
    if (err || !user) {
      throw new UnauthorizedException('Authentication required');
    }

    return user;
  }
}
