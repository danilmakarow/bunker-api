import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Request, Response } from 'express';
import { QueryFailedError } from 'typeorm';

import { Sentry } from '@/config/sentry.config';
import { ErrorCodesEnum } from '@/constants/error-codes';
import { BaseException } from '@/exceptions/base.exception';
import {
  ExceptionData,
  ExceptionUnifiedError,
} from '@/exceptions/exception-unified.error';
import { AppLogger } from '@/modules/logger/app-logger';
import { UnifyResponseService } from '@/services/unify-response.service';

/**
 * Catches every unhandled exception and renders it as a unified response.
 * Production-mode query failures are sanitised before being returned to the client.
 */
@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  constructor(
    private unifyResponseService: UnifyResponseService,
    private configService: ConfigService,
    private logger: AppLogger,
  ) {}

  private isDev() {
    return this.configService.get('NODE_ENV') === 'development';
  }

  private extractMessage(exception: unknown): string {
    if (exception instanceof BaseException) {
      if (exception.message) {
        return exception.message;
      }

      const response = exception.getResponse();

      if (typeof response === 'string') {
        return response;
      }
    }

    if (exception instanceof HttpException) {
      const exceptionResponse = exception.getResponse();

      if (typeof exceptionResponse === 'string') {
        return exceptionResponse;
      }

      if (
        exceptionResponse &&
        typeof exceptionResponse === 'object' &&
        'message' in exceptionResponse &&
        typeof exceptionResponse.message === 'string'
      ) {
        return exceptionResponse.message;
      }

      return 'Internal server error';
    }

    if (exception instanceof Error) {
      return exception.message;
    }

    return 'Internal server error';
  }

  private getStatusText(statusCode: HttpStatus): string {
    switch (statusCode) {
      case HttpStatus.BAD_REQUEST:
        return 'Bad Request';
      case HttpStatus.UNAUTHORIZED:
        return 'Unauthorized';
      case HttpStatus.FORBIDDEN:
        return 'Forbidden';
      case HttpStatus.NOT_FOUND:
        return 'Not Found';
      case HttpStatus.CONFLICT:
        return 'Conflict';
      case HttpStatus.INTERNAL_SERVER_ERROR:
        return 'Internal Server Error';
      default:
        return 'Error';
    }
  }

  private extractStack(exception: unknown): string {
    if (exception instanceof Error) {
      return exception.stack ?? '';
    }

    return '';
  }

  private getStatusCode(exception: unknown): number {
    if (exception instanceof HttpException) {
      return exception.getStatus();
    }

    return HttpStatus.INTERNAL_SERVER_ERROR;
  }

  private getErrorCode(exception: unknown): ErrorCodesEnum {
    if (exception instanceof BaseException) {
      return exception.code;
    }

    return ErrorCodesEnum.UNKNOWN;
  }

  private getPayload(exception: unknown): object | unknown[] | null {
    if (exception instanceof BaseException) {
      const response = exception.getResponse();

      if (response && typeof response === 'object') {
        return response;
      }
    }

    return null;
  }

  private extractErrorData(
    exception: unknown,
    request: Request,
  ): ExceptionData {
    const statusCode = this.getStatusCode(exception);
    const isQueryException = exception instanceof QueryFailedError;

    if (isQueryException) {
      if (this.isDev()) {
        return {
          statusCode,
          code: ErrorCodesEnum.QUERY_FAILURE,
          message: exception.message,
          status: this.getStatusText(statusCode),
          endpoint: `${request.method} ${request.url}`,
          timestamp: new Date().toISOString(),
          stack: this.extractStack(exception),
          payload: {
            query: exception.query,
            parameters: exception.parameters,
            driverError: exception.message,
          },
        };
      }

      return {
        statusCode,
        code: ErrorCodesEnum.INTERNAL_SERVER_ERROR,
        message: 'Internal server error',
        status: this.getStatusText(HttpStatus.INTERNAL_SERVER_ERROR),
        endpoint: `${request.method} ${request.url}`,
        timestamp: new Date().toISOString(),
      };
    }

    const errorData: ExceptionData = {
      statusCode,
      code: this.getErrorCode(exception),
      message: this.extractMessage(exception),
      status: this.getStatusText(statusCode),
      endpoint: `${request.method} ${request.url}`,
      timestamp: new Date().toISOString(),
    };

    const payload = this.getPayload(exception);

    if (payload) {
      errorData.payload = payload;
    }

    if (this.isDev()) {
      errorData.stack = this.extractStack(exception);
    }

    return errorData;
  }

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    const statusCode = this.getStatusCode(exception);
    const errorData = this.extractErrorData(exception, request);
    const unifiedException = new ExceptionUnifiedError(errorData);
    const erroneousResponse = this.unifyResponseService.unify(unifiedException);

    if (errorData.statusCode >= HttpStatus.INTERNAL_SERVER_ERROR) {
      Sentry.captureException(exception);
      this.logger.inspectError(exception, 'Caught exception');
    } else {
      this.logger.info(`Sending ${statusCode} response`, {
        code: errorData.code,
        method: request.method,
        message: errorData.message,
        path: new URL(request.url, 'http://localhost').pathname,
      });
    }

    response.status(statusCode).json(erroneousResponse);
  }
}
