import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

import {
  ContentFieldsDto,
  OptionalContentFieldsDto,
} from './content-fields.dto';

/**
 * All five biology axes share the same shape: id + `valueUk` + enabled/weight.
 * One pair of request DTOs and a single response DTO is enough for the lot.
 */
export class BackofficeBiologyResponseDto extends ContentFieldsDto {
  @ApiProperty({ format: 'uuid' })
  id: string;

  @ApiProperty({ example: '23 роки' })
  valueUk: string;

  @ApiProperty({ example: '2026-05-16T12:34:56.000Z' })
  createdAt: string;

  @ApiProperty({ example: '2026-05-16T12:34:56.000Z' })
  updatedAt: string;
}

export class CreateBiologyRequestDto extends OptionalContentFieldsDto {
  @ApiProperty({ example: '23 роки' })
  @IsString()
  @MinLength(1)
  @MaxLength(160)
  valueUk: string;
}

export class UpdateBiologyRequestDto extends OptionalContentFieldsDto {
  @ApiPropertyOptional({ example: '23 роки' })
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(160)
  valueUk?: string;
}
