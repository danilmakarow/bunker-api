import { MiddlewareConsumer, Module, ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { APP_FILTER, APP_GUARD, APP_INTERCEPTOR, APP_PIPE } from '@nestjs/core';
import { ThrottlerModule } from '@nestjs/throttler';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SentryModule } from '@sentry/nestjs/setup';

import { AppController } from './app.controller';
import { AuthModule } from './modules/auth/auth.module';
import { DatabaseModule } from './modules/database/database.module';
import { GameModule } from './modules/game/game.module';
import { LoggerModule } from './modules/logger/logger.module';
import { RoomsModule } from './modules/rooms/rooms.module';
import { GlobalExceptionFilter } from '@/common/exception-filters/global.exception-filter';
import { UserThrottlerGuard } from '@/common/guards/user-throttler.guard';
import {
  AddRequestContextMiddleware,
  LogRequestMiddleware,
} from '@/common/middleware';
import { getConfigModule } from '@/config/env.config';
import { getDatabaseConfig, getDataSource } from '@/config/typeorm.config';
import { ValidationException } from '@/exceptions/validation.exception';
import { ResponseWrapperInterceptor } from '@/interceptors/response-wrapper.interceptor';
import { CookieJwtGuard } from '@/modules/auth/guards/cookie-jwt.guard';
import { UnifyResponseService } from '@/services/unify-response.service';

@Module({
  imports: [
    SentryModule.forRoot(),
    getConfigModule(),
    LoggerModule,
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: getDatabaseConfig,
      dataSourceFactory: getDataSource,
    }),
    // Generous default cap so a runaway poller is throttled without breaking
    // the 1 Hz lobby+game poll loop (≈ 2 req/s/user steady state).
    ThrottlerModule.forRoot({
      throttlers: [{ ttl: 1000, limit: 10 }],
    }),
    DatabaseModule,
    AuthModule,
    RoomsModule,
    GameModule,
  ],
  controllers: [AppController],
  providers: [
    UnifyResponseService,
    { provide: APP_GUARD, useClass: CookieJwtGuard },
    { provide: APP_GUARD, useClass: UserThrottlerGuard },
    {
      provide: APP_PIPE,
      useValue: new ValidationPipe({
        transform: true,
        whitelist: true,
        exceptionFactory: (errors) => {
          const response: Record<string, string[]> = {};

          errors.forEach((error) => {
            const errorMessages = Object.values(error.constraints ?? {});

            if (!errorMessages.length) {
              return;
            }

            response[error.property] = errorMessages;
          });

          return new ValidationException(
            'Failed to validate the request body/params',
            response,
          );
        },
      }),
    },
    { provide: APP_FILTER, useClass: GlobalExceptionFilter },
    { provide: APP_INTERCEPTOR, useClass: ResponseWrapperInterceptor },
  ],
})
export class AppModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(AddRequestContextMiddleware).forRoutes('*');
    consumer.apply(LogRequestMiddleware).forRoutes('*');
  }
}
