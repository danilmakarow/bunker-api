import { Injectable } from '@nestjs/common';

import { Room } from '../entities';
import { RoomRepository } from '../repositories';
import { BaseDatabaseService } from './base-database.service';

/**
 * DatabaseService for Room. Generic CRUD plus code-based lookups used by the
 * polled snapshot endpoint. Transactional / locking operations live in
 * RoomsService directly — those need the DataSource manager.
 */
@Injectable()
export class RoomDatabaseService extends BaseDatabaseService<Room> {
  constructor(private roomRepository: RoomRepository) {
    super(roomRepository);
  }

  /**
   * Finds a room by its 4-letter code, or returns null.
   */
  findByCode(code: string) {
    return this.roomRepository.getByCode(code);
  }

  /**
   * Finds a room by code with all participants (and their users) attached.
   */
  findByCodeWithParticipants(code: string) {
    return this.roomRepository.getByCodeWithParticipants(code);
  }

  /**
   * Finds a room by code with apocalypse + shelter + participants joined —
   * used by the game-snapshot endpoint.
   */
  findByCodeWithGameRelations(code: string) {
    return this.roomRepository.getByCodeWithGameRelations(code);
  }
}
