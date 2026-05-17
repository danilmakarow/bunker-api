import { ApiProperty } from '@nestjs/swagger';

import { BiologyValueResponseDto } from './biology-value.response.dto';
import { TraitResponseDto } from './trait.response.dto';
import { RevealAttributeEnum } from '@/modules/database/entities';

/**
 * One revealed slot on a player's card. Exactly one of `biologyValue` / `trait`
 * is set, depending on the attribute kind. Reveals are global — every player
 * in the room sees the same shape.
 */
export class RevealedAttributeResponseDto {
  @ApiProperty({ enum: RevealAttributeEnum })
  attribute: RevealAttributeEnum;

  @ApiProperty({ type: () => BiologyValueResponseDto, nullable: true })
  biologyValue: BiologyValueResponseDto | null;

  @ApiProperty({ type: () => TraitResponseDto, nullable: true })
  trait: TraitResponseDto | null;

  @ApiProperty({ example: '2026-05-17T20:00:00.000Z' })
  revealedAt: string;
}
