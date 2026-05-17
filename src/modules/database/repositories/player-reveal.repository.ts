import { Injectable } from '@nestjs/common';
import { DataSource, In, IsNull } from 'typeorm';

import { PlayerReveal, RevealAttributeEnum } from '../entities';
import { BaseRepository } from './base.repository';

/**
 * TypeORM repository for PlayerReveal. Read helpers used by the game
 * snapshot; writes happen inside the reveal transaction via EntityManager.
 */
@Injectable()
export class PlayerRevealRepository extends BaseRepository<PlayerReveal> {
  constructor(dataSource: DataSource) {
    super(PlayerReveal, dataSource.createEntityManager());
  }

  /**
   * Returns every PlayerReveal row for the given characters, with the joined
   * Trait eagerly loaded so the snapshot mapper has the title/polarity data.
   */
  getByCharacterIds(playerCharacterIds: string[]): Promise<PlayerReveal[]> {
    if (!playerCharacterIds.length) {
      return Promise.resolve([]);
    }

    return this.find({
      where: { playerCharacterId: In(playerCharacterIds) },
      relations: { trait: true },
    });
  }

  /**
   * Returns the existing reveal for a (character, attribute, traitId) tuple,
   * or null. Used by GameService to make reveals idempotent. `null` traitId is
   * NULL-safe — `IsNull()` produces the correct partial-index match.
   */
  getOneForIdempotency(
    playerCharacterId: string,
    attribute: RevealAttributeEnum,
    traitId: string | null,
  ): Promise<PlayerReveal | null> {
    return this.findOne({
      where: {
        playerCharacterId,
        attribute,
        traitId: traitId === null ? IsNull() : traitId,
      },
      relations: { trait: true },
    });
  }
}
