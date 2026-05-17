import { HttpStatus } from '@nestjs/common';
import { HttpExceptionOptions } from '@nestjs/common/exceptions/http.exception';
import { EntityTarget } from 'typeorm';

import { ErrorCodesEnum } from '@/constants/error-codes';
import { BaseException } from '@/exceptions/base.exception';

/**
 * Resolves a friendly entity name from a TypeORM EntityTarget for log/error messages.
 */
const resolveEntityName = <Entity>(entity: EntityTarget<Entity>): string => {
  if (typeof entity === 'function') {
    return entity.name;
  }

  if (typeof entity === 'object' && entity && 'name' in entity) {
    return String(entity.name);
  }

  return String(entity);
};

/**
 * 404 thrown when a DatabaseService cannot find a row that the caller required to exist.
 */
export class EntityNotFoundException extends BaseException {
  code = ErrorCodesEnum.ENTITY_NOT_FOUND;

  constructor(entity: EntityTarget<unknown>, options?: HttpExceptionOptions) {
    super(
      {
        message: `${resolveEntityName(entity)} not found`,
        statusCode: HttpStatus.NOT_FOUND,
      },
      options,
    );
  }
}
