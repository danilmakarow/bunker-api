import { Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';

import { ParticipantStatusEnum, RoomParticipant } from '../entities';
import { BaseRepository } from './base.repository';

/**
 * TypeORM repository for RoomParticipant. Helpers here cover the lookups
 * needed for join / leave / kick logic.
 */
@Injectable()
export class RoomParticipantRepository extends BaseRepository<RoomParticipant> {
  constructor(dataSource: DataSource) {
    super(RoomParticipant, dataSource.createEntityManager());
  }

  /**
   * Returns the participant row for (roomId, userId), regardless of status.
   * Because of the unique constraint there is at most one such row.
   */
  getByRoomAndUser(
    roomId: string,
    userId: string,
  ): Promise<RoomParticipant | null> {
    return this.findOne({ where: { roomId, userId } });
  }

  /**
   * Returns all JOINED participants of the room, ordered by tenure then seat.
   * Tenure-ascending is the admin-promotion order (longest-tenured first).
   */
  getJoinedByRoom(roomId: string): Promise<RoomParticipant[]> {
    return this.find({
      where: { roomId, status: ParticipantStatusEnum.JOINED },
      order: { joinedAt: 'ASC', seatNumber: 'ASC' },
    });
  }

  /**
   * Counts the JOINED rows in a room. Cheap helper for capacity / lifecycle checks.
   */
  countJoinedByRoom(roomId: string): Promise<number> {
    return this.count({
      where: { roomId, status: ParticipantStatusEnum.JOINED },
    });
  }
}
