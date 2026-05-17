import { ApiProperty } from '@nestjs/swagger';
import { Column, Entity, Index, JoinColumn, ManyToOne } from 'typeorm';

import { BaseEntity } from './base.entity';
import { PlayerCharacter } from './player-character.entity';
import { Trait } from './trait.entity';

/**
 * One row per trait card a PlayerCharacter owns. Per TASK.md §6.1 counts are:
 * 1× HEALTH, 1× PROFESSION, 1× HOBBY, 1× PHOBIA, 1× CHARACTER_TRAIT,
 * 1× LUGGAGE, 1× PERSONAL_FACT, 2× ACTION_CARD, 1× CONDITION_CARD.
 *
 * Drawn with replacement across players (§10 locked) — same trait may end up
 * on multiple characters, so this is NOT unique on `traitId`.
 */
@Index('IDX_player_character_trait_character', ['playerCharacterId'])
@Entity('player_character_trait')
export class PlayerCharacterTrait extends BaseEntity {
  @Column({ type: 'uuid' })
  @ApiProperty({ format: 'uuid' })
  playerCharacterId: string;

  @ManyToOne(() => PlayerCharacter, (character) => character.characterTraits)
  @JoinColumn({ name: 'playerCharacterId' })
  playerCharacter?: PlayerCharacter;

  @Column({ type: 'uuid' })
  @ApiProperty({ format: 'uuid' })
  traitId: string;

  @ManyToOne(() => Trait)
  @JoinColumn({ name: 'traitId' })
  trait?: Trait;
}
