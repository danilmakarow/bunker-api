import { Injectable } from '@nestjs/common';

import { RoomParticipant } from '../entities';
import { RoomParticipantRepository } from '../repositories';
import { BaseDatabaseService } from './base-database.service';

/**
 * DatabaseService for RoomParticipant. Generic CRUD plus the (roomId,userId)
 * lookup and a JOINED-count helper.
 */
@Injectable()
export class RoomParticipantDatabaseService extends BaseDatabaseService<RoomParticipant> {
  constructor(private roomParticipantRepository: RoomParticipantRepository) {
    super(roomParticipantRepository);
  }

  /**
   * Returns the (at most one) participant row for the given (roomId, userId).
   */
  findByRoomAndUser(roomId: string, userId: string) {
    return this.roomParticipantRepository.getByRoomAndUser(roomId, userId);
  }

  /**
   * Returns all JOINED participants of a room, ordered by tenure then seat —
   * the admin-promotion order.
   */
  findJoinedByRoom(roomId: string) {
    return this.roomParticipantRepository.getJoinedByRoom(roomId);
  }

  /**
   * Counts JOINED participants in a room.
   */
  countJoinedByRoom(roomId: string) {
    return this.roomParticipantRepository.countJoinedByRoom(roomId);
  }
}
