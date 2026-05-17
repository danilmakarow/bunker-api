import { Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';

import { User } from '../entities';
import { BaseRepository } from './base.repository';

/**
 * TypeORM repository for User. Add query helpers here rather than in services.
 */
@Injectable()
export class UserRepository extends BaseRepository<User> {
  constructor(dataSource: DataSource) {
    super(User, dataSource.createEntityManager());
  }

  /**
   * Returns the user with the given Google subject id, or null.
   */
  getByGoogleId(googleId: string) {
    return this.findOne({ where: { googleId } });
  }

  /**
   * Returns the user with the given email, or null.
   */
  getByEmail(email: string) {
    return this.findOne({ where: { email } });
  }
}
