import { HttpStatus } from '@nestjs/common';
import { HttpExceptionOptions } from '@nestjs/common/exceptions/http.exception';

import { ErrorCodesEnum } from '@/constants/error-codes';
import { BaseException } from '@/exceptions/base.exception';

/**
 * 400 BadRequest with a structured payload (e.g. for validator output).
 */
export class BadRequestException extends BaseException {
  code = ErrorCodesEnum.BAD_REQUEST;

  constructor(
    message?: string,
    payload?: string | Record<string, unknown> | null,
    options?: HttpExceptionOptions,
  ) {
    super(
      {
        payload,
        message: message ?? 'Bad Request',
        statusCode: HttpStatus.BAD_REQUEST,
      },
      options,
    );
  }
}
