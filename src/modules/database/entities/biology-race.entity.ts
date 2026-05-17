import { ApiProperty } from '@nestjs/swagger';
import { Column, Entity } from 'typeorm';

import { ContentEntity } from './content.entity';

/**
 * Pool of race/ethnicity labels a PlayerCharacter can draw from.
 */
@Entity('biology_race')
export class BiologyRace extends ContentEntity {
  @Column({ type: 'varchar' })
  @ApiProperty({ example: 'Українець' })
  valueUk: string;
}
