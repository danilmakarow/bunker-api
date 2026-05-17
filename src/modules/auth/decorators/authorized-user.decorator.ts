import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { Request } from 'express';

import { InvalidNestjsConfigurationException } from '@/exceptions/invalid-nestjs-configuration.exception';
import { User } from '@/modules/database/entities';

/**
 * Extracts the authenticated user from request-scoped storage.
 * Throws an InvalidNestjsConfigurationException if no upstream guard populated it —
 * this means the developer forgot to apply the cookie-JWT guard.
 */
export const AuthorizedUser = createParamDecorator(
  (_: unknown, ctx: ExecutionContext): User => {
    const request: Request = ctx.switchToHttp().getRequest();
    const { requestStorage } = request;
    const user = requestStorage.has('user') ? requestStorage.get('user') : null;

    if (!user) {
      throw new InvalidNestjsConfigurationException(
        "User wasn't found in request storage. Did you forget to apply the auth guard?",
      );
    }

    return user;
  },
);
