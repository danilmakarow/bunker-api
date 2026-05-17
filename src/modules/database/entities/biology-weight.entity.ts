import { ApiProperty } from '@nestjs/swagger';
import { Column, Entity } from 'typeorm';

import { ContentEntity } from './content.entity';

/**
 * Pool of weight/build descriptions a PlayerCharacter can draw from.
 */
@Entity('biology_weight')
export class BiologyWeight extends ContentEntity {
  @Column({ type: 'varchar' })
  @ApiProperty({ example: '60 кг (зріст 168 см) — норма' })
  valueUk: string;
}
