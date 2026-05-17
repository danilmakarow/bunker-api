import { Injectable } from '@nestjs/common';

import { PlayerReveal, RevealAttributeEnum } from '../entities';
import { PlayerRevealRepository } from '../repositories';
import { BaseDatabaseService } from './base-database.service';

/**
 * DatabaseService for PlayerReveal. Exposes the relation-loaded reads used by
 * the game snapshot and the idempotency lookup used by GameService.reveal.
 */
@Injectable()
export class PlayerRevealDatabaseService extends BaseDatabaseService<PlayerReveal> {
  constructor(private playerRevealRepository: PlayerRevealRepository) {
    super(playerRevealRepository);
  }

  /**
   * Returns every reveal row for the given character ids, with traits joined.
   */
  findByCharacterIds(playerCharacterIds: string[]) {
    return this.playerRevealRepository.getByCharacterIds(playerCharacterIds);
  }

  findForIdempotency(
    playerCharacterId: string,
    attribute: RevealAttributeEnum,
    traitId: string | null,
  ) {
    return this.playerRevealRepository.getOneForIdempotency(
      playerCharacterId,
      attribute,
      traitId,
    );
  }
}
