import { ApiProperty } from '@nestjs/swagger';

import { PolarityEnum, TraitKindEnum } from '@/modules/database/entities';

export class TraitResponseDto {
  @ApiProperty({ format: 'uuid' })
  id: string;

  @ApiProperty({ enum: TraitKindEnum })
  kind: TraitKindEnum;

  @ApiProperty({ enum: PolarityEnum })
  polarity: PolarityEnum;

  @ApiProperty({ example: 'Лікар-хірург' })
  titleUk: string;

  @ApiProperty({ nullable: true })
  descriptionUk: string | null;
}
