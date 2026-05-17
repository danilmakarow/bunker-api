import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEnum,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';

import {
  ContentFieldsDto,
  OptionalContentFieldsDto,
} from './content-fields.dto';
import { PolarityEnum } from '@/modules/database/entities';

export class BackofficeShelterResponseDto extends ContentFieldsDto {
  @ApiProperty({ format: 'uuid' })
  id: string;

  @ApiProperty({ example: '800 м²' })
  areaUk: string;

  @ApiProperty({ example: 'Швейцарія, Альпи' })
  locationUk: string;

  @ApiProperty({ example: '30 років' })
  durationUk: string;

  @ApiProperty()
  equipmentUk: string;

  @ApiProperty()
  suppliesUk: string;

  @ApiProperty({ enum: PolarityEnum })
  polarity: PolarityEnum;

  @ApiProperty({ example: '2026-05-16T12:34:56.000Z' })
  createdAt: string;

  @ApiProperty({ example: '2026-05-16T12:34:56.000Z' })
  updatedAt: string;
}

export class CreateShelterRequestDto extends OptionalContentFieldsDto {
  @ApiProperty({ example: '800 м²' })
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  areaUk: string;

  @ApiProperty({ example: 'Швейцарія, Альпи' })
  @IsString()
  @MinLength(1)
  locationUk: string;

  @ApiProperty({ example: '30 років' })
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  durationUk: string;

  @ApiProperty()
  @IsString()
  @MinLength(1)
  equipmentUk: string;

  @ApiProperty()
  @IsString()
  @MinLength(1)
  suppliesUk: string;

  @ApiProperty({ enum: PolarityEnum })
  @IsEnum(PolarityEnum)
  polarity: PolarityEnum;
}

export class UpdateShelterRequestDto extends OptionalContentFieldsDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  areaUk?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MinLength(1)
  locationUk?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  durationUk?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MinLength(1)
  equipmentUk?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MinLength(1)
  suppliesUk?: string;

  @ApiPropertyOptional({ enum: PolarityEnum })
  @IsOptional()
  @IsEnum(PolarityEnum)
  polarity?: PolarityEnum;
}
