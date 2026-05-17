import { ApiProperty } from '@nestjs/swagger';

import { RoomParticipantResponseDto } from './room-participant.response.dto';
import { RoomStatusEnum } from '@/modules/database/entities';

/**
 * Polled snapshot of a single room. Returned by POST /rooms and GET /rooms/:code.
 * Participants include LEFT/KICKED rows so the FE can render lobby history;
 * the FE filters by `status` for the active-roster view.
 */
export class RoomSnapshotResponseDto {
  @ApiProperty({ format: 'uuid' })
  id: string;

  @ApiProperty({ example: 'ABCD' })
  code: string;

  @ApiProperty({ enum: RoomStatusEnum })
  status: RoomStatusEnum;

  @ApiProperty({ format: 'uuid' })
  adminUserId: string;

  @ApiProperty({ example: '2026-05-16T12:34:56.000Z' })
  createdAt: string;

  @ApiProperty({ nullable: true, example: null })
  startedAt: string | null;

  @ApiProperty({ nullable: true, example: null })
  finishedAt: string | null;

  @ApiProperty({ example: 1, description: 'Monotonic revision; ETag source.' })
  version: number;

  @ApiProperty({ type: () => [RoomParticipantResponseDto] })
  participants: RoomParticipantResponseDto[];
}
