import { Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';

import { ParticipantStatusEnum, Room } from '../entities';
import { BaseRepository } from './base.repository';

/**
 * TypeORM repository for Room. Read helpers live here so the service layer
 * doesn't hand-roll query builders.
 */
@Injectable()
export class RoomRepository extends BaseRepository<Room> {
  constructor(dataSource: DataSource) {
    super(Room, dataSource.createEntityManager());
  }

  /**
   * Returns the room with the given code, or null. Codes are case-insensitive
   * but stored uppercase; callers should normalise before calling.
   */
  getByCode(code: string): Promise<Room | null> {
    return this.findOne({ where: { code } });
  }

  /**
   * Returns the room with the given code, with all participants and their
   * users eagerly loaded. Used to build the polled snapshot DTO.
   */
  getByCodeWithParticipants(code: string): Promise<Room | null> {
    return this.findOne({
      where: { code },
      relations: { participants: { user: true } },
      order: { participants: { seatNumber: 'ASC' } },
    });
  }

  /**
   * Returns the room with the given code and ONLY its JOINED participants,
   * with user info eagerly loaded — useful for admin promotion / counting.
   */
  getByCodeWithJoinedParticipants(code: string): Promise<Room | null> {
    return this.findOne({
      where: { code, participants: { status: ParticipantStatusEnum.JOINED } },
      relations: { participants: { user: true } },
      order: { participants: { joinedAt: 'ASC', seatNumber: 'ASC' } },
    });
  }

  /**
   * Returns the room with the given code joined with apocalypse, shelter,
   * and participants (+users) — the relation graph the game snapshot needs.
   */
  getByCodeWithGameRelations(code: string): Promise<Room | null> {
    return this.findOne({
      where: { code },
      relations: {
        apocalypse: true,
        shelter: true,
        participants: { user: true },
      },
      order: { participants: { seatNumber: 'ASC' } },
    });
  }
}
