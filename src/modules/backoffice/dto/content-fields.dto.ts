import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsBoolean, IsInt, IsOptional, Min } from 'class-validator';

/**
 * Shared backoffice fields exposed on every content entity (apocalypse,
 * shelter, trait, biology_*). Used inside both the response DTOs and the
 * create/update DTOs as common columns.
 */
export class ContentFieldsDto {
  @ApiProperty({ example: true, default: true })
  @IsBoolean()
  enabled: boolean;

  @ApiProperty({
    example: 1,
    minimum: 0,
    description:
      'Relative draw weight inside the kind/axis. 0 = effectively disabled.',
  })
  @IsInt()
  @Min(0)
  @Type(() => Number)
  weight: number;
}

/**
 * Optional variant for partial updates / create-time defaults.
 */
export class OptionalContentFieldsDto {
  @ApiPropertyOptional({ example: true })
  @IsOptional()
  @IsBoolean()
  enabled?: boolean;

  @ApiPropertyOptional({ example: 1, minimum: 0 })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Type(() => Number)
  weight?: number;
}
