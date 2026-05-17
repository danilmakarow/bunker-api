import { Injectable } from '@nestjs/common';

import { User } from '../entities';
import { UserRepository } from '../repositories';
import { BaseDatabaseService } from './base-database.service';

/**
 * DatabaseService for User. Provides Google-id / email lookups on top of the generic CRUD.
 */
@Injectable()
export class UserDatabaseService extends BaseDatabaseService<User> {
  constructor(private userRepository: UserRepository) {
    super(userRepository);
  }

  /**
   * Finds a user by their Google subject id.
   */
  findByGoogleId(googleId: string) {
    return this.userRepository.getByGoogleId(googleId);
  }

  /**
   * Finds a user by email.
   */
  findByEmail(email: string) {
    return this.userRepository.getByEmail(email);
  }
}
