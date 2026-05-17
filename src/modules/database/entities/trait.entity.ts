import { ApiProperty } from '@nestjs/swagger';
import { Column, Entity, Index } from 'typeorm';

import { BaseEntity } from './base.entity';
import { PolarityEnum } from './enums/polarity.enum';
import { TraitKindEnum } from './enums/trait-kind.enum';

/**
 * A single trait card. `kind` identifies the slot (HEALTH/PHOBIA/etc.);
 * `polarity` is informational flavour only — draws are uniform per kind.
 * `descriptionUk` is reserved for richer copy and stays null for the v1 seed.
 */
@Index('IDX_trait_kind', ['kind'])
@Entity('trait')
export class Trait extends BaseEntity {
  @Column({ type: 'enum', enum: TraitKindEnum })
  @ApiProperty({ enum: TraitKindEnum })
  kind: TraitKindEnum;

  @Column({ type: 'enum', enum: PolarityEnum })
  @ApiProperty({ enum: PolarityEnum })
  polarity: PolarityEnum;

  @Column({ type: 'varchar' })
  @ApiProperty({ example: 'Лікар-хірург' })
  titleUk: string;

  @Column({ type: 'text', nullable: true })
  @ApiProperty({ nullable: true })
  descriptionUk: string | null;
}
