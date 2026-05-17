import {
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Request, Response } from 'express';

import { AuthService } from './auth.service';
import { MeResponseDto } from './dto';
import { GoogleProfilePayload } from './types/google-profile.type';
import { EnvironmentVariables } from '@/config/env.config';
import { AuthorizedUser } from '@/modules/auth/decorators/authorized-user.decorator';
import { Public } from '@/modules/auth/decorators/public.decorator';
import { GoogleAuthGuard } from '@/modules/auth/guards/google.guard';
import { User } from '@/modules/database/entities';

@ApiTags('Auth')
@Controller('auth')
export class AuthController {
  private readonly cookieName: string;

  private readonly cookieDomain: string;

  private readonly frontendUrl: string;

  private readonly isProduction: boolean;

  constructor(
    private readonly authService: AuthService,
    configService: ConfigService<EnvironmentVariables>,
  ) {
    this.cookieName = configService.get('COOKIE_NAME', { infer: true })!;
    this.cookieDomain = configService.get('COOKIE_DOMAIN', { infer: true })!;
    this.frontendUrl = configService.get('FRONTEND_URL', { infer: true })!;
    this.isProduction =
      configService.get('NODE_ENV', { infer: true }) === 'production';
  }

  /**
   * Writes the session cookie on the response. Settings follow TASK.md §8:
   * HttpOnly, SameSite=Lax, Secure in prod, Domain scoped to the shared parent.
   */
  private setSessionCookie(
    response: Response,
    token: string,
    expireMs: number,
  ): void {
    response.cookie(this.cookieName, token, {
      httpOnly: true,
      secure: this.isProduction,
      sameSite: 'lax',
      domain: this.cookieDomain,
      path: '/',
      maxAge: expireMs,
    });
  }

  /**
   * Step 1 of the OAuth flow: Passport redirects to Google's consent screen.
   * No body needed — the guard handles everything.
   */
  @Public()
  @UseGuards(GoogleAuthGuard)
  @Get('google')
  @ApiOperation({ summary: 'Begin Google OAuth handshake (302 to Google).' })
  googleLogin(): void {
    // Intentionally empty: the GoogleAuthGuard performs the redirect.
  }

  /**
   * Step 2: Google redirects back here. The Passport strategy attaches the
   * normalised profile to req.user; we upsert the user, sign a JWT, set the
   * HttpOnly cookie, and bounce to the FE.
   */
  @Public()
  @UseGuards(GoogleAuthGuard)
  @Get('google/callback')
  @ApiOperation({
    summary:
      'Google OAuth callback. Upserts user, sets bunker_session cookie, redirects to FE.',
  })
  async googleCallback(
    @Req() request: Request,
    @Res({ passthrough: false }) response: Response,
  ): Promise<void> {
    const profile = request.user as GoogleProfilePayload;
    const { token, expireMs } =
      await this.authService.handleGoogleLogin(profile);

    this.setSessionCookie(response, token, expireMs);
    response.redirect(`${this.frontendUrl}/home`);
  }

  /**
   * Clears the session cookie. Idempotent.
   */
  @Public()
  @Post('logout')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Clear the session cookie.' })
  logout(@Res({ passthrough: true }) response: Response): void {
    response.cookie(this.cookieName, '', {
      httpOnly: true,
      secure: this.isProduction,
      sameSite: 'lax',
      domain: this.cookieDomain,
      path: '/',
      maxAge: 0,
    });
  }

  /**
   * Returns the currently signed-in user's identity.
   */
  @Get('me')
  @ApiOperation({ summary: 'Get the authenticated user.' })
  @ApiOkResponse({ type: MeResponseDto })
  getMe(@AuthorizedUser() user: User): MeResponseDto {
    return this.authService.getMe(user);
  }
}
