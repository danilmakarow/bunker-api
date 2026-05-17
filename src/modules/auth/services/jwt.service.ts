import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService as NestJwtService } from '@nestjs/jwt';
import ms, { StringValue } from 'ms';

import { EnvironmentVariables } from '@/config/env.config';
import { ITokenPayload } from '@/modules/auth/types/jwt.types';

/**
 * Mints and verifies the session JWT. HS256, single long-lived token (30d default),
 * no refresh flow — see TASK.md §8.
 */
@Injectable()
export class JwtService {
  private readonly secret: string;

  private readonly expireMs: number;

  constructor(
    private readonly nestJwtService: NestJwtService,
    configService: ConfigService<EnvironmentVariables>,
  ) {
    this.secret = configService.get('JWT_SECRET', { infer: true })!;

    const rawExpire = configService.get('JWT_EXPIRE', { infer: true })!;

    this.expireMs = ms(rawExpire as StringValue);
  }

  /**
   * Returns the configured token lifetime in milliseconds.
   * Used by the auth service to set the matching cookie Max-Age.
   */
  getExpireMs(): number {
    return this.expireMs;
  }

  /**
   * Signs a session JWT for the given user id.
   */
  signSessionAsync(userId: string): Promise<string> {
    const payload: ITokenPayload = { sub: userId };

    return this.nestJwtService.signAsync(payload, {
      secret: this.secret,
      expiresIn: Math.round(this.expireMs / 1000),
    });
  }
}
