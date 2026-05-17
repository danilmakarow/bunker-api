import { ApiProperty } from '@nestjs/swagger';

import { PolarityEnum } from '@/modules/database/entities';

export class ApocalypseResponseDto {
  @ApiProperty({ format: 'uuid' })
  id: string;

  @ApiProperty({ example: 'Глобальна посуха' })
  nameUk: string;

  @ApiProperty()
  descriptionUk: string;

  @ApiProperty({ example: '30%' })
  populationRemainderUk: string;

  @ApiProperty({ enum: PolarityEnum })
  polarity: PolarityEnum;
}
