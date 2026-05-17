import { Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';

import { PlayerCharacter } from '../entities';
import { BaseRepository } from './base.repository';

/**
 * TypeORM repository for PlayerCharacter. Read helpers used by the game
 * snapshot endpoint; mutating writes happen inside the start transaction
 * via the EntityManager directly.
 */
@Injectable()
export class PlayerCharacterRepository extends BaseRepository<PlayerCharacter> {
  constructor(dataSource: DataSource) {
    super(PlayerCharacter, dataSource.createEntityManager());
  }

  /**
   * Returns the character drawn for the given (room, user), with all
   * biology + trait relations eager-loaded for the snapshot.
   */
  getByRoomAndUserWithRelations(
    roomId: string,
    userId: string,
  ): Promise<PlayerCharacter | null> {
    return this.findOne({
      where: { roomId, userId },
      relations: {
        age: true,
        weight: true,
        sex: true,
        gender: true,
        race: true,
        characterTraits: { trait: true },
      },
    });
  }

  /**
   * Returns every character in the room with biology + trait relations.
   * Used to resolve revealed attributes for each player in the snapshot.
   */
  getAllByRoomWithRelations(roomId: string): Promise<PlayerCharacter[]> {
    return this.find({
      where: { roomId },
      relations: {
        age: true,
        weight: true,
        sex: true,
        gender: true,
        race: true,
        characterTraits: { trait: true },
      },
    });
  }
}
