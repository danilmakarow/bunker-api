import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { Request } from 'express';
import { Strategy } from 'passport-jwt';

import { EnvironmentVariables } from '@/config/env.config';
import { UnauthorizedException } from '@/exceptions/unauthorized.exception';
import { StrategiesEnum } from '@/modules/auth/constants/strategies.enum';
import { ITokenData } from '@/modules/auth/types/jwt.types';
import { UserDatabaseService } from '@/modules/database/services';

/**
 * Validates the session JWT extracted from the HttpOnly cookie.
 * On success the resolved User is parked in request-scoped storage for downstream consumers.
 */
@Injectable()
export class CookieJwtStrategy extends PassportStrategy(
  Strategy,
  StrategiesEnum.COOKIE_JWT,
) {
  constructor(
    configService: ConfigService<EnvironmentVariables>,
    private userService: UserDatabaseService,
  ) {
    const cookieName = configService.get('COOKIE_NAME', { infer: true })!;

    super({
      jwtFromRequest: (req: Request): string | null => {
        const cookies = (req?.cookies ?? {}) as Record<string, string>;

        return cookies[cookieName] ?? null;
      },
      secretOrKey: configService.get('JWT_SECRET', { infer: true })!,
      passReqToCallback: true,
    });
  }

  /**
   * Looks up the user by `sub` claim and parks it on the request.
   */
  async validate(request: Request, payload: ITokenData) {
    const user = await this.userService.findOneBy({ id: payload.sub });

    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    request.requestStorage.set('user', user);

    return user;
  }
}
