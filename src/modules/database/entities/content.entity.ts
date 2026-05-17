import { ApiProperty } from '@nestjs/swagger';
import { Column } from 'typeorm';

import { BaseEntity } from './base.entity';

/**
 * Base entity for every content table that the game-start draw considers
 * (apocalypse, shelter, trait, biology_*). Adds two backoffice-managed columns
 * on top of `BaseEntity`:
 *
 *   - `enabled` — soft on/off switch. Disabled rows are excluded from draws.
 *   - `weight`  — non-negative integer relative draw weight. Default 1.
 *                 A row's draw probability within its kind/axis is
 *                 `weight / sum(weight of enabled rows in the same pool)`.
 *                 A weight of 0 is equivalent to disabled.
 */
export abstract class ContentEntity extends BaseEntity {
  @Column({ type: 'boolean', default: true })
  @ApiProperty({ example: true })
  enabled: boolean;

  @Column({ type: 'int', default: 1 })
  @ApiProperty({ example: 1, minimum: 0 })
  weight: number;
}
