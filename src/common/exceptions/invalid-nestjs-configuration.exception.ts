import { HttpStatus } from '@nestjs/common';

import { ErrorCodesEnum } from '@/constants/error-codes';
import { BaseException } from '@/exceptions/base.exception';

/**
 * 500-class developer error: a Nest decorator or guard was used incorrectly
 * (e.g. expecting an authorised user without applying an auth guard upstream).
 */
export class InvalidNestjsConfigurationException extends BaseException {
  code = ErrorCodesEnum.INTERNAL_SERVER_ERROR;

  constructor(message?: string) {
    super({
      message: message ?? 'Invalid NestJS configuration',
      statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
    });
  }
}
