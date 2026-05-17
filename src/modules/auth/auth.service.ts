import { Injectable } from '@nestjs/common';

import { MeResponseDto } from './dto';
import { JwtService } from './services/jwt.service';
import { GoogleProfilePayload } from './types/google-profile.type';
import { User } from '@/modules/database/entities';
import { UserDatabaseService } from '@/modules/database/services';

/**
 * Outcome of a Google OAuth login — both the user we resolved and a freshly minted session JWT.
 * The controller turns this into an HttpOnly cookie + redirect.
 */
export interface OAuthLoginResult {
  user: User;
  token: string;
  expireMs: number;
}

/**
 * Business logic for the Google OAuth login flow and the /auth/me endpoint.
 */
@Injectable()
export class AuthService {
  constructor(
    private readonly userService: UserDatabaseService,
    private readonly jwtService: JwtService,
  ) {}

  /**
   * Upserts the user matching the supplied Google profile.
   * Profile fields (name/email/avatar) are refreshed on each login so renames flow through.
   */
  private async upsertUserFromGoogleProfile(
    profile: GoogleProfilePayload,
  ): Promise<User> {
    const existing = await this.userService.findByGoogleId(profile.googleId);

    if (existing) {
      return this.userService.update(existing, {
        email: profile.email,
        name: profile.name,
        avatarUrl: profile.avatarUrl,
      });
    }

    return this.userService.create({
      googleId: profile.googleId,
      email: profile.email,
      name: profile.name,
      avatarUrl: profile.avatarUrl,
    });
  }

  /**
   * Completes a Google OAuth handshake: upsert user, mint session JWT.
   * Cookie issuance and redirect happen in the controller.
   */
  async handleGoogleLogin(
    profile: GoogleProfilePayload,
  ): Promise<OAuthLoginResult> {
    const user = await this.upsertUserFromGoogleProfile(profile);
    const token = await this.jwtService.signSessionAsync(user.id);
    const expireMs = this.jwtService.getExpireMs();

    return { user, token, expireMs };
  }

  /**
   * Returns the public-facing identity surface for the currently logged-in user.
   */
  getMe(user: User): MeResponseDto {
    return {
      id: user.id,
      name: user.name,
      email: user.email,
      avatarUrl: user.avatarUrl,
    };
  }
}
