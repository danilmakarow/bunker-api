import { EntityTarget, Repository } from 'typeorm';
import { EntityManager } from 'typeorm/entity-manager/EntityManager';

import { BaseEntity } from '../entities';

/**
 * Thin wrapper over TypeORM Repository that fixes the constructor signature
 * for entities extending our BaseEntity. Feature-specific repositories extend this.
 */
export class BaseRepository<
  TEntity extends BaseEntity,
> extends Repository<TEntity> {
  constructor(entity: EntityTarget<TEntity>, entityManager: EntityManager) {
    super(entity, entityManager);
  }
}
