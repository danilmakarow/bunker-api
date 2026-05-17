import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Response } from 'express';
import { map, Observable } from 'rxjs';

import {
  StandardResponse,
  UnifyResponseService,
} from '@/services/unify-response.service';

const HTTP_STATUS_NOT_MODIFIED = 304;

/**
 * Wraps every successful HTTP response in the StandardResponse envelope.
 * Errors are handled separately by the global exception filter.
 *
 * Skips wrapping for `304 Not Modified` — those must be sent with an empty
 * body per RFC 7232, and the ETag polling path on poll endpoints relies on
 * that contract.
 */
@Injectable()
export class ResponseWrapperInterceptor implements NestInterceptor {
  constructor(private unifyResponseService: UnifyResponseService) {}

  intercept(
    context: ExecutionContext,
    next: CallHandler,
  ): Observable<StandardResponse | undefined> {
    const response = context.switchToHttp().getResponse<Response>();

    return next.handle().pipe(
      map((value: unknown) => {
        if (response.statusCode === HTTP_STATUS_NOT_MODIFIED) {
          return undefined;
        }

        return this.unifyResponseService.unify(value);
      }),
    );
  }
}
