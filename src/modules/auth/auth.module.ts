import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';

import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { JwtService } from './services/jwt.service';
import { CookieJwtStrategy } from './strategies/cookie-jwt.strategy';
import { GoogleStrategy } from './strategies/google.strategy';
import { DatabaseModule } from '@/modules/database/database.module';

@Module({
  imports: [DatabaseModule, PassportModule, JwtModule.register({})],
  controllers: [AuthController],
  providers: [AuthService, JwtService, GoogleStrategy, CookieJwtStrategy],
  exports: [AuthService, JwtService],
})
export class AuthModule {}
