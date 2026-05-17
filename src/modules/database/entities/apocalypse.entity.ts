import { ApiProperty } from '@nestjs/swagger';
import { Column, Entity } from 'typeorm';

import { ContentEntity } from './content.entity';
import { PolarityEnum } from './enums/polarity.enum';

/**
 * Catastrophe scenario seeded as game content. Each room picks one at start
 * via a weighted random draw across `enabled` rows — TASK.md §1.
 */
@Entity('apocalypse')
export class Apocalypse extends ContentEntity {
  @Column({ type: 'varchar' })
  @ApiProperty({ example: 'Глобальна посуха' })
  nameUk: string;

  @Column({ type: 'text' })
  @ApiProperty()
  descriptionUk: string;

  @Column({ type: 'varchar' })
  @ApiProperty({ example: '30%' })
  populationRemainderUk: string;

  @Column({ type: 'enum', enum: PolarityEnum })
  @ApiProperty({ enum: PolarityEnum })
  polarity: PolarityEnum;
}
