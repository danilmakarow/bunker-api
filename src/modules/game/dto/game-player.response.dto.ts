import { ApiProperty } from '@nestjs/swagger';

import { RevealedAttributeResponseDto } from './revealed-attribute.response.dto';
import { ParticipantStatusEnum } from '@/modules/database/entities';

/**
 * Public view of another player in the game. M5 adds the `reveals` array —
 * every attribute the player has publicly revealed. Reveals are global, so
 * the same array shape appears on every player entry (including the caller's).
 */
export class GamePlayerResponseDto {
  @ApiProperty({ format: 'uuid' })
  userId: string;

  @ApiProperty({ minimum: 1, maximum: 22 })
  seatNumber: number;

  @ApiProperty()
  name: string;

  @ApiProperty({ nullable: true })
  avatarUrl: string | null;

  @ApiProperty({ example: false })
  isAdmin: boolean;

  @ApiProperty({ enum: ParticipantStatusEnum })
  status: ParticipantStatusEnum;

  @ApiProperty({ type: () => [RevealedAttributeResponseDto] })
  reveals: RevealedAttributeResponseDto[];
}
