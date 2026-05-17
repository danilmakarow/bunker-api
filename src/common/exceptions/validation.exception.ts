import { ErrorCodesEnum } from '@/constants/error-codes';
import { BadRequestException } from '@/exceptions/bad-request.exception';

/**
 * 400 BadRequest specialization used by the global ValidationPipe.
 */
export class ValidationException extends BadRequestException {
  code = ErrorCodesEnum.VALIDATION;
}
