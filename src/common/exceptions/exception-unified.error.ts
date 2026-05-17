import { HttpStatus } from '@nestjs/common';

import { ErrorCodesEnum } from '@/constants/error-codes';

export interface ExceptionData {
  message: string;
  code: ErrorCodesEnum;
  statusCode: HttpStatus;
  status: string;
  endpoint: string;
  timestamp: string;
  stack?: string;
  payload?: unknown;
}

/**
 * Carrier object passed from the global exception filter into the response unifier.
 * Keeps the wire format identical between thrown HttpExceptions and unknown errors.
 */
export class ExceptionUnifiedError {
  public message: string;

  public statusCode: HttpStatus;

  public status: string;

  public endpoint: string;

  public stack: string;

  public timestamp: string;

  public code: ErrorCodesEnum;

  public payload: unknown;

  public hasPayload: boolean;

  constructor(error: ExceptionData) {
    this.message = error.message;
    this.code = error.code;
    this.statusCode = error.statusCode;
    this.status = error.status;
    this.endpoint = error.endpoint;
    this.timestamp = error.timestamp;
    this.stack = error.stack ?? '';

    if (error.payload) {
      this.payload = error.payload;
      this.hasPayload = true;
    } else {
      this.payload = null;
      this.hasPayload = false;
    }
  }
}
