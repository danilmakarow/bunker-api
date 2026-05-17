import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEnum,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
  ValidateIf,
} from 'class-validator';

import {
  ContentFieldsDto,
  OptionalContentFieldsDto,
} from './content-fields.dto';
import { PolarityEnum, TraitKindEnum } from '@/modules/database/entities';

export class BackofficeTraitResponseDto extends ContentFieldsDto {
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

  @ApiProperty({ example: '2026-05-16T12:34:56.000Z' })
  createdAt: string;

  @ApiProperty({ example: '2026-05-16T12:34:56.000Z' })
  updatedAt: string;
}

export class CreateTraitRequestDto extends OptionalContentFieldsDto {
  @ApiProperty({ enum: TraitKindEnum })
  @IsEnum(TraitKindEnum)
  kind: TraitKindEnum;

  @ApiProperty({ enum: PolarityEnum })
  @IsEnum(PolarityEnum)
  polarity: PolarityEnum;

  @ApiProperty({ example: 'Лікар-хірург' })
  @IsString()
  @MinLength(1)
  @MaxLength(160)
  titleUk: string;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @IsString()
  descriptionUk?: string | null;
}

export class UpdateTraitRequestDto extends OptionalContentFieldsDto {
  @ApiPropertyOptional({ enum: TraitKindEnum })
  @IsOptional()
  @IsEnum(TraitKindEnum)
  kind?: TraitKindEnum;

  @ApiPropertyOptional({ enum: PolarityEnum })
  @IsOptional()
  @IsEnum(PolarityEnum)
  polarity?: PolarityEnum;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(160)
  titleUk?: string;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @IsString()
  descriptionUk?: string | null;
}
