import { ApiProperty } from '@nestjs/swagger';

import { BiologyValueResponseDto } from './biology-value.response.dto';
import { TraitResponseDto } from './trait.response.dto';

/**
 * The caller's own character. Only the caller ever sees these full fields —
 * other players are returned in the snapshot with revealed attributes only
 * (revealing comes in M5).
 */
export class MyCharacterResponseDto {
  @ApiProperty({ format: 'uuid' })
  id: string;

  @ApiProperty({ type: () => BiologyValueResponseDto })
  age: BiologyValueResponseDto;

  @ApiProperty({ type: () => BiologyValueResponseDto })
  weight: BiologyValueResponseDto;

  @ApiProperty({ type: () => BiologyValueResponseDto })
  sex: BiologyValueResponseDto;

  @ApiProperty({ type: () => BiologyValueResponseDto })
  gender: BiologyValueResponseDto;

  @ApiProperty({ type: () => BiologyValueResponseDto })
  race: BiologyValueResponseDto;

  @ApiProperty({ type: () => [TraitResponseDto] })
  traits: TraitResponseDto[];
}
