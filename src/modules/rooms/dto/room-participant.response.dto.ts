import { ApiProperty } from '@nestjs/swagger';

import { ParticipantStatusEnum } from '@/modules/database/entities';

/**
 * Single participant entry inside a room snapshot.
 */
export class RoomParticipantResponseDto {
  @ApiProperty({ format: 'uuid' })
  id: string;

  @ApiProperty({ format: 'uuid' })
  userId: string;

  @ApiProperty({ minimum: 1, maximum: 22, example: 1 })
  seatNumber: number;

  @ApiProperty({ example: 'Player One' })
  name: string;

  @ApiProperty({ nullable: true, example: 'https://example.com/avatar.jpg' })
  avatarUrl: string | null;

  @ApiProperty({ enum: ParticipantStatusEnum })
  status: ParticipantStatusEnum;

  @ApiProperty({ example: false })
  isAdmin: boolean;

  @ApiProperty({ example: '2026-05-16T12:34:56.000Z' })
  joinedAt: string;

  @ApiProperty({ nullable: true, example: null })
  leftAt: string | null;
}
