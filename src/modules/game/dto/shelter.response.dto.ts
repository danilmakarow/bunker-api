import { ApiProperty } from '@nestjs/swagger';

import { PolarityEnum } from '@/modules/database/entities';

export class ShelterResponseDto {
  @ApiProperty({ format: 'uuid' })
  id: string;

  @ApiProperty({ example: '800 м²' })
  areaUk: string;

  @ApiProperty()
  locationUk: string;

  @ApiProperty({ example: '30 років' })
  durationUk: string;

  @ApiProperty()
  equipmentUk: string;

  @ApiProperty()
  suppliesUk: string;

  @ApiProperty({ enum: PolarityEnum })
  polarity: PolarityEnum;
}
