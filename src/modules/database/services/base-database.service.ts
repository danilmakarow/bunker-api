import {
  DeepPartial,
  DeleteResult,
  FindManyOptions,
  FindOneOptions,
  FindOptionsWhere,
} from 'typeorm';

import { BaseEntity } from '../entities';
import { BaseRepository } from '../repositories';
import { EntityNotFoundException } from '@/exceptions/entity-not-found.exception';

/**
 * Generic CRUD service backed by a BaseRepository.
 * Feature services should always go through a *DatabaseService (never Repository directly)
 * so the data-access layer stays mockable and consistent.
 */
export abstract class BaseDatabaseService<TEntity extends BaseEntity> {
  constructor(private repository: BaseRepository<TEntity>) {}

  /**
   * Persists a new entity instance and returns the saved row.
   */
  async create(entity?: DeepPartial<TEntity>): Promise<TEntity> {
    const newInstance = entity
      ? this.repository.create(entity)
      : this.repository.create();

    return this.repository.save(newInstance);
  }

  /**
   * Builds an entity instance without persisting it (no INSERT yet).
   */
  createInstance(entity?: DeepPartial<TEntity>): TEntity {
    return entity ? this.repository.create(entity) : this.repository.create();
  }

  /**
   * Persists the given entity instance.
   */
  save(entity: TEntity): Promise<TEntity> {
    return this.repository.save(entity);
  }

  findOne(options: FindOneOptions<TEntity>): Promise<TEntity | null> {
    return this.repository.findOne(options);
  }

  findOneBy(where: FindOptionsWhere<TEntity>): Promise<TEntity | null> {
    return this.repository.findOneBy(where);
  }

  findAll(options?: FindManyOptions<TEntity>): Promise<TEntity[]> {
    return this.repository.find(options);
  }

  findAllBy(where: FindOptionsWhere<TEntity>): Promise<TEntity[]> {
    return this.repository.findBy(where);
  }

  /**
   * findOne but throws EntityNotFoundException when nothing matches.
   */
  async findOneOrThrow(options: FindOneOptions<TEntity>): Promise<TEntity> {
    const entity = await this.findOne(options);

    if (!entity) {
      throw new EntityNotFoundException(this.repository.target);
    }

    return entity;
  }

  findOneByOrThrow(where: FindOptionsWhere<TEntity>): Promise<TEntity> {
    return this.findOneOrThrow({ where });
  }

  /**
   * Merges updateData into entity and persists.
   */
  update(entity: TEntity, updateData: DeepPartial<TEntity>): Promise<TEntity> {
    const updatedEntity = this.repository.merge(entity, updateData);

    return this.repository.save(updatedEntity);
  }

  delete(
    criteria:
      | string
      | string[]
      | FindOptionsWhere<TEntity>
      | FindOptionsWhere<TEntity>[],
  ): Promise<DeleteResult> {
    return this.repository.delete(criteria);
  }
}
