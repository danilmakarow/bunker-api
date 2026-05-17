import { ApiProperty } from '@nestjs/swagger';

/**
 * Lightweight shape used for every biology axis inside the character DTO.
 */
export class BiologyValueResponseDto {
  @ApiProperty({ format: 'uuid' })
  id: string;

  @ApiProperty()
  valueUk: string;
}
