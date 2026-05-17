import { ApiProperty } from '@nestjs/swagger';
import { Column, Entity } from 'typeorm';

import { BaseEntity } from './base.entity';

/**
 * Pool of ages a PlayerCharacter can draw from at game start (TASK.md §3.3).
 */
@Entity('biology_age')
export class BiologyAge extends BaseEntity {
  @Column({ type: 'varchar' })
  @ApiProperty({ example: '23 роки' })
  valueUk: string;
}
