import { ApiProperty } from '@nestjs/swagger';
import { Column, Entity, Index, JoinColumn, ManyToOne } from 'typeorm';

import { BaseEntity } from './base.entity';
import { RevealAttributeEnum } from './enums/reveal-attribute.enum';
import { PlayerCharacter } from './player-character.entity';
import { Trait } from './trait.entity';

/**
 * One row per attribute a player has publicly revealed (TASK.md §3.5).
 * Reveals are global — every other player in the room can see them.
 *
 * Trait kinds with multiple cards per character (e.g. ACTION_CARD) include the
 * specific `traitId` so the FE can show which card was revealed. Biology axes
 * (single value per slot) leave `traitId` NULL.
 */
@Index('IDX_player_reveal_character', ['playerCharacterId'])
@Index('UQ_player_reveal_character_attribute_trait', [
  'playerCharacterId',
  'attribute',
  'traitId',
])
@Entity('player_reveal')
export class PlayerReveal extends BaseEntity {
  @Column({ type: 'uuid' })
  @ApiProperty({ format: 'uuid' })
  playerCharacterId: string;

  @ManyToOne(() => PlayerCharacter)
  @JoinColumn({ name: 'playerCharacterId' })
  playerCharacter?: PlayerCharacter;

  @Column({ type: 'enum', enum: RevealAttributeEnum })
  @ApiProperty({ enum: RevealAttributeEnum })
  attribute: RevealAttributeEnum;

  @Column({ type: 'uuid', nullable: true })
  @ApiProperty({ nullable: true, format: 'uuid' })
  traitId: string | null;

  @ManyToOne(() => Trait)
  @JoinColumn({ name: 'traitId' })
  trait?: Trait | null;
}
