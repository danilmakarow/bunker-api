import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { Profile, Strategy, VerifyCallback } from 'passport-google-oauth20';

import { EnvironmentVariables } from '@/config/env.config';
import { StrategiesEnum } from '@/modules/auth/constants/strategies.enum';
import { GoogleProfilePayload } from '@/modules/auth/types/google-profile.type';

/**
 * Passport strategy for `GET /api/auth/google` and `/auth/google/callback`.
 * Verifies the OAuth handshake and forwards a normalised profile to the auth controller.
 * Cookie/JWT issuance happens in the controller's callback handler, not here.
 */
@Injectable()
export class GoogleStrategy extends PassportStrategy(
  Strategy,
  StrategiesEnum.GOOGLE,
) {
  constructor(configService: ConfigService<EnvironmentVariables>) {
    super({
      clientID: configService.get('GOOGLE_CLIENT_ID', { infer: true })!,
      clientSecret: configService.get('GOOGLE_CLIENT_SECRET', { infer: true })!,
      callbackURL: configService.get('GOOGLE_CALLBACK_URL', { infer: true })!,
      scope: ['email', 'profile'],
    });
  }

  /**
   * Maps a Google OAuth `Profile` to our internal `GoogleProfilePayload`.
   * Called by passport-google-oauth20 after the token exchange succeeds.
   */
  validate(
    _accessToken: string,
    _refreshToken: string,
    profile: Profile,
    done: VerifyCallback,
  ): void {
    const email = profile.emails?.[0]?.value;

    if (!email) {
      done(new Error('Google profile is missing an email address'), false);

      return;
    }

    const payload: GoogleProfilePayload = {
      googleId: profile.id,
      email,
      name: profile.displayName || email,
      avatarUrl: profile.photos?.[0]?.value ?? null,
    };

    done(null, payload);
  }
}
