import { HttpStatus, Injectable } from '@nestjs/common';

import { ErrorCodesEnum } from '@/constants/error-codes';
import { ExceptionUnifiedError } from '@/exceptions/exception-unified.error';

/**
 * Wire-format envelope returned by every endpoint (and the global exception filter).
 * Keeping every response in this shape lets the FE branch on `status` once.
 */
export interface StandardResponse<T = unknown> {
  status: 'Success' | 'Error';
  hasData: boolean;
  data: T;
  errorCode?: ErrorCodesEnum;
  errorStatusCode?: HttpStatus;
  errorMessage?: string;
  stack?: string;
}

@Injectable()
export class UnifyResponseService {
  /**
   * Wraps either a successful controller return value or a unified exception
   * into the StandardResponse envelope.
   */
  public unify(response: unknown): StandardResponse {
    if (response instanceof ExceptionUnifiedError) {
      return {
        status: 'Error',
        errorCode: response.code,
        errorStatusCode: response.statusCode,
        errorMessage: response.message,
        hasData: response.hasPayload,
        data: response.payload,
        ...(response.stack && { stack: response.stack }),
      };
    }

    return { status: 'Success', data: response, hasData: !!response };
  }
}
