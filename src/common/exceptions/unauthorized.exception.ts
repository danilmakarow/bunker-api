import { HttpStatus } from '@nestjs/common';
import { HttpExceptionOptions } from '@nestjs/common/exceptions/http.exception';

import { ErrorCodesEnum } from '@/constants/error-codes';
import { BaseException } from '@/exceptions/base.exception';

/**
 * 401 Unauthorized — missing or invalid session cookie / JWT.
 */
export class UnauthorizedException extends BaseException {
  code = ErrorCodesEnum.UNAUTHORIZED;

  constructor(message?: string, options?: HttpExceptionOptions) {
    super(
      {
        message: message ?? 'Unauthorized',
        statusCode: HttpStatus.UNAUTHORIZED,
      },
      options,
    );
  }
}
