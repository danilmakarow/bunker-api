import { ApiProperty } from '@nestjs/swagger';
import { Column, Entity } from 'typeorm';

import { ContentEntity } from './content.entity';
import { PolarityEnum } from './enums/polarity.enum';

/**
 * The bunker assigned to a room at game start. Fields mirror the columns of
 * the Ukrainian content source (`bunker_cards_ua_v7.xlsx` → "Умови бункеру"):
 * area, location, survivable duration, on-site equipment, supplies.
 */
@Entity('shelter')
export class Shelter extends ContentEntity {
  @Column({ type: 'varchar' })
  @ApiProperty({ example: '800 м²' })
  areaUk: string;

  @Column({ type: 'text' })
  @ApiProperty({ example: 'Швейцарія, Альпи (50 м під горою)' })
  locationUk: string;

  @Column({ type: 'varchar' })
  @ApiProperty({ example: '30 років' })
  durationUk: string;

  @Column({ type: 'text' })
  @ApiProperty()
  equipmentUk: string;

  @Column({ type: 'text' })
  @ApiProperty()
  suppliesUk: string;

  @Column({ type: 'enum', enum: PolarityEnum })
  @ApiProperty({ enum: PolarityEnum })
  polarity: PolarityEnum;
}
