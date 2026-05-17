import { ApiProperty } from '@nestjs/swagger';
import { Column, Entity } from 'typeorm';

import { BaseEntity } from './base.entity';

/**
 * Pool of gender/orientation labels a PlayerCharacter can draw from. Seeded
 * from the source "Орієнтація" sheet — the spec keeps the column name
 * `BiologyGender` (TASK.md §3.3) but the data set is orientation.
 */
@Entity('biology_gender')
export class BiologyGender extends BaseEntity {
  @Column({ type: 'varchar' })
  @ApiProperty({ example: 'Гетеросексуал — потяг до протилежної статі' })
  valueUk: string;
}
