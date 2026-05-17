import { ApiProperty } from '@nestjs/swagger';
import { Column, Entity } from 'typeorm';

import { BaseEntity } from './base.entity';

/**
 * Pool of biological-sex values. Source data only ships male/female today.
 */
@Entity('biology_sex')
export class BiologySex extends BaseEntity {
  @Column({ type: 'varchar' })
  @ApiProperty({ example: 'Чоловік' })
  valueUk: string;
}
