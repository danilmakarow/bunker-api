import {
  Body,
  Controller,
  Delete,
  Get,
  Headers,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Res,
} from '@nestjs/common';
import {
  ApiCreatedResponse,
  ApiHeader,
  ApiNoContentResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import type { Response } from 'express';

import { RoomSnapshotResponseDto } from './dto';
import { RoomsService } from './rooms.service';
import { applyVersionEtag } from '@/common/utils/etag.util';
import { AuthorizedUser } from '@/modules/auth/decorators/authorized-user.decorator';
import { User } from '@/modules/database/entities';

@ApiTags('Rooms')
@Controller('rooms')
export class RoomsController {
  constructor(private readonly roomsService: RoomsService) {}

  /**
   * POST /rooms — create a new room. Caller becomes admin and seat #1.
   */
  @Post()
  @ApiOperation({
    summary: 'Create a new room. Caller becomes admin and seat #1.',
  })
  @ApiCreatedResponse({ type: RoomSnapshotResponseDto })
  createRoom(@AuthorizedUser() user: User): Promise<RoomSnapshotResponseDto> {
    return this.roomsService.createRoom(user);
  }

  /**
   * GET /rooms/:code — return the current snapshot for a room the caller is in.
   * Supports `If-None-Match` against the `ETag` header (version-based polling).
   */
  @Get(':code')
  @ApiOperation({
    summary: 'Get a room snapshot (polled by the FE every ~1s).',
  })
  @ApiHeader({
    name: 'If-None-Match',
    description:
      'Last seen ETag — returns 304 if the room version is unchanged.',
    required: false,
  })
  @ApiOkResponse({ type: RoomSnapshotResponseDto })
  async getSnapshot(
    @AuthorizedUser() user: User,
    @Param('code') code: string,
    @Headers('if-none-match') ifNoneMatch: string | undefined,
    @Res({ passthrough: true }) response: Response,
  ): Promise<RoomSnapshotResponseDto | void> {
    if (ifNoneMatch !== undefined) {
      const version = await this.roomsService.peekVersion(code, user);

      if (applyVersionEtag(response, ifNoneMatch, version)) {
        return;
      }
    }

    const snapshot = await this.roomsService.getSnapshot(code, user);

    applyVersionEtag(response, undefined, snapshot.version);

    return snapshot;
  }

  /**
   * POST /rooms/:code/join — join a LOBBY room. Idempotent for already-JOINED callers.
   */
  @Post(':code/join')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary:
      'Join a room. Idempotent for current members; flips LEFT→JOINED; 403 for KICKED.',
  })
  @ApiOkResponse({ type: RoomSnapshotResponseDto })
  joinRoom(
    @AuthorizedUser() user: User,
    @Param('code') code: string,
  ): Promise<RoomSnapshotResponseDto> {
    return this.roomsService.joinRoom(code, user);
  }

  /**
   * POST /rooms/:code/leave — voluntary leave. Admin promotion / ABANDONED on last leave.
   */
  @Post(':code/leave')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary:
      'Leave a room. Admin handoff / ABANDONED transition handled internally.',
  })
  @ApiNoContentResponse()
  async leaveRoom(
    @AuthorizedUser() user: User,
    @Param('code') code: string,
  ): Promise<void> {
    await this.roomsService.leaveRoom(code, user);
  }

  /**
   * DELETE /rooms/:code/participants/:userId — admin kicks a participant.
   */
  @Delete(':code/participants/:userId')
  @ApiOperation({
    summary: 'Admin kicks a participant. Admin cannot kick themselves.',
  })
  @ApiOkResponse({ type: RoomSnapshotResponseDto })
  kickParticipant(
    @AuthorizedUser() admin: User,
    @Param('code') code: string,
    @Param('userId') targetUserId: string,
  ): Promise<RoomSnapshotResponseDto> {
    return this.roomsService.kickParticipant(code, admin, targetUserId);
  }

  /**
   * POST /rooms/:code/finish — admin transitions IN_GAME → FINISHED.
   */
  @Post(':code/finish')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Admin finishes the game. Idempotent when already FINISHED.',
  })
  @ApiOkResponse({ type: RoomSnapshotResponseDto })
  finishRoom(
    @AuthorizedUser() admin: User,
    @Param('code') code: string,
  ): Promise<RoomSnapshotResponseDto> {
    return this.roomsService.finishRoom(code, admin);
  }
}
