import { HttpException } from '@nestjs/common';
import { HttpExceptionOptions } from '@nestjs/common/exceptions/http.exception';

import { ErrorCodesEnum } from '@/constants/error-codes';

export interface BaseExceptionOptions {
  message?: string;
  code?: ErrorCodesEnum;
  payload?: unknown;
  statusCode?: number;
}

/**
 * Base class for application exceptions. Carries a stable error code in addition
 * to the standard HttpException fields so the unified response envelope can render it.
 */
export class BaseException extends HttpException {
  declare code: ErrorCodesEnum;

  declare message: string;

  constructor(
    options: BaseExceptionOptions,
    httpOptions?: HttpExceptionOptions,
  ) {
    super(
      options.payload ?? options.message ?? 'Unknown server error',
      options.statusCode ?? 500,
      httpOptions,
    );

    this.message = options.message ?? 'Unknown server error';
    this.code = this.code ?? options.code ?? ErrorCodesEnum.UNKNOWN;
  }
}
