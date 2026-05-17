import { ApiProperty } from '@nestjs/swagger';

import { ApocalypseResponseDto } from './apocalypse.response.dto';
import { GamePlayerResponseDto } from './game-player.response.dto';
import { MyCharacterResponseDto } from './my-character.response.dto';
import { ShelterResponseDto } from './shelter.response.dto';
import { RoomStatusEnum } from '@/modules/database/entities';

/**
 * Polled snapshot returned by GET /rooms/:code/game.
 */
export class GameSnapshotResponseDto {
  @ApiProperty({ format: 'uuid' })
  roomId: string;

  @ApiProperty({ example: 'ABCD' })
  code: string;

  @ApiProperty({ enum: RoomStatusEnum })
  status: RoomStatusEnum;

  @ApiProperty({ format: 'uuid' })
  adminUserId: string;

  @ApiProperty({ type: () => ApocalypseResponseDto })
  apocalypse: ApocalypseResponseDto;

  @ApiProperty({ type: () => ShelterResponseDto })
  shelter: ShelterResponseDto;

  @ApiProperty({ type: () => MyCharacterResponseDto })
  myCharacter: MyCharacterResponseDto;

  @ApiProperty({ type: () => [GamePlayerResponseDto] })
  players: GamePlayerResponseDto[];

  @ApiProperty()
  startedAt: string;

  @ApiProperty({ nullable: true, example: null })
  finishedAt: string | null;

  @ApiProperty({ example: 7, description: 'Monotonic revision; ETag source.' })
  version: number;
}
