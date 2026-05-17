import { Injectable } from '@nestjs/common';

import { PlayerCharacter } from '../entities';
import { PlayerCharacterRepository } from '../repositories';
import { BaseDatabaseService } from './base-database.service';

/**
 * DatabaseService for PlayerCharacter. Exposes the relation-loaded read used
 * by the game snapshot. Game-start writes go through the EntityManager
 * directly inside a transaction.
 */
@Injectable()
export class PlayerCharacterDatabaseService extends BaseDatabaseService<PlayerCharacter> {
  constructor(private playerCharacterRepository: PlayerCharacterRepository) {
    super(playerCharacterRepository);
  }

  /**
   * Returns the character for (roomId, userId) with biology and trait
   * relations attached. Stable across reconnects.
   */
  findByRoomAndUserWithRelations(roomId: string, userId: string) {
    return this.playerCharacterRepository.getByRoomAndUserWithRelations(
      roomId,
      userId,
    );
  }

  /**
   * Returns every character in the room with biology + trait relations.
   */
  findAllByRoomWithRelations(roomId: string) {
    return this.playerCharacterRepository.getAllByRoomWithRelations(roomId);
  }
}
