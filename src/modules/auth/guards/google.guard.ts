import { Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

import { StrategiesEnum } from '@/modules/auth/constants/strategies.enum';

/**
 * Wraps the Google OAuth Passport strategy as a Nest guard.
 * Applied to both `/auth/google` (triggers the redirect) and `/auth/google/callback`
 * (consumes the token exchange and surfaces the profile on `req.user`).
 */
@Injectable()
export class GoogleAuthGuard extends AuthGuard(StrategiesEnum.GOOGLE) {}
