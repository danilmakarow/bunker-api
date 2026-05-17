import { HttpStatus } from '@nestjs/common';
import { HttpExceptionOptions } from '@nestjs/common/exceptions/http.exception';

import { ErrorCodesEnum } from '@/constants/error-codes';
import { BaseException } from '@/exceptions/base.exception';

/**
 * 403 Forbidden — the caller is authenticated but not authorised for this action.
 */
export class ForbiddenException extends BaseException {
  code = ErrorCodesEnum.FORBIDDEN;

  constructor(message?: string, options?: HttpExceptionOptions) {
    super(
      {
        message: message ?? 'Forbidden',
        statusCode: HttpStatus.FORBIDDEN,
      },
      options,
    );
  }
}
