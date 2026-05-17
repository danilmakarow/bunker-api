import { HttpStatus } from '@nestjs/common';
import { HttpExceptionOptions } from '@nestjs/common/exceptions/http.exception';

import { ErrorCodesEnum } from '@/constants/error-codes';
import { BaseException } from '@/exceptions/base.exception';

/**
 * 409 Conflict — the request is well-formed but contradicts the current resource state
 * (e.g. trying to start a room that isn't in LOBBY, joining a full room).
 */
export class ConflictException extends BaseException {
  code = ErrorCodesEnum.CONFLICT;

  constructor(message?: string, options?: HttpExceptionOptions) {
    super(
      {
        message: message ?? 'Conflict',
        statusCode: HttpStatus.CONFLICT,
      },
      options,
    );
  }
}
