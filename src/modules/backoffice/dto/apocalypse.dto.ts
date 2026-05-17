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

export class BackofficeApocalypseResponseDto extends ContentFieldsDto {
  @ApiProperty({ format: 'uuid' })
  id: string;

  @ApiProperty({ example: 'Глобальна посуха' })
  nameUk: string;

  @ApiProperty({ example: 'Опис апокаліпсису' })
  descriptionUk: string;

  @ApiProperty({ example: '30%' })
  populationRemainderUk: string;

  @ApiProperty({ enum: PolarityEnum })
  polarity: PolarityEnum;

  @ApiProperty({ example: '2026-05-16T12:34:56.000Z' })
  createdAt: string;

  @ApiProperty({ example: '2026-05-16T12:34:56.000Z' })
  updatedAt: string;
}

export class CreateApocalypseRequestDto extends OptionalContentFieldsDto {
  @ApiProperty({ example: 'Глобальна посуха' })
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  nameUk: string;

  @ApiProperty({ example: 'Опис апокаліпсису' })
  @IsString()
  @MinLength(1)
  descriptionUk: string;

  @ApiProperty({ example: '30%' })
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  populationRemainderUk: string;

  @ApiProperty({ enum: PolarityEnum })
  @IsEnum(PolarityEnum)
  polarity: PolarityEnum;
}

export class UpdateApocalypseRequestDto extends OptionalContentFieldsDto {
  @ApiPropertyOptional({ example: 'Глобальна посуха' })
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  nameUk?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MinLength(1)
  descriptionUk?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  populationRemainderUk?: string;

  @ApiPropertyOptional({ enum: PolarityEnum })
  @IsOptional()
  @IsEnum(PolarityEnum)
  polarity?: PolarityEnum;
}
