import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsUUID } from 'class-validator';

import { RevealAttributeEnum } from '@/modules/database/entities';

/**
 * Body for POST /rooms/:code/game/reveal. Reveals one of the caller's own
 * attributes. `traitId` is required for trait kinds with multiple cards per
 * character (currently only ACTION_CARD); biology slots and single-card trait
 * slots should leave it null. Server validates ownership.
 */
export class RevealRequestDto {
  @ApiProperty({ enum: RevealAttributeEnum })
  @IsEnum(RevealAttributeEnum)
  attribute: RevealAttributeEnum;

  @ApiPropertyOptional({ format: 'uuid', nullable: true })
  @IsOptional()
  @IsUUID()
  traitId?: string;
}
