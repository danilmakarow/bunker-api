import {
  Body,
  Controller,
  Get,
  Headers,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Res,
} from '@nestjs/common';
import {
  ApiHeader,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import type { Response } from 'express';

import { GameSnapshotResponseDto, RevealRequestDto } from './dto';
import { GameService } from './game.service';
import { applyVersionEtag } from '@/common/utils/etag.util';
import { AuthorizedUser } from '@/modules/auth/decorators/authorized-user.decorator';
import { User } from '@/modules/database/entities';

@ApiTags('Game')
@Controller('rooms')
export class GameController {
  constructor(private readonly gameService: GameService) {}

  /**
   * POST /rooms/:code/start — admin only. Transitions LOBBY → IN_GAME and
   * generates a PlayerCharacter for every JOINED participant atomically.
   */
  @Post(':code/start')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary:
      'Admin starts the game. Draws apocalypse, shelter, and characters.',
  })
  @ApiOkResponse({ type: GameSnapshotResponseDto })
  startGame(
    @AuthorizedUser() admin: User,
    @Param('code') code: string,
  ): Promise<GameSnapshotResponseDto> {
    return this.gameService.startGame(code, admin);
  }

  /**
   * GET /rooms/:code/game — polled snapshot. Available in IN_GAME and FINISHED
   * (post-mortem) states. Supports `If-None-Match` against the `ETag` header
   * (version-based polling).
   */
  @Get(':code/game')
  @ApiOperation({
    summary: 'Game snapshot (polled by the FE every ~1s).',
  })
  @ApiHeader({
    name: 'If-None-Match',
    description:
      'Last seen ETag — returns 304 if the room version is unchanged.',
    required: false,
  })
  @ApiOkResponse({ type: GameSnapshotResponseDto })
  async getSnapshot(
    @AuthorizedUser() user: User,
    @Param('code') code: string,
    @Headers('if-none-match') ifNoneMatch: string | undefined,
    @Res({ passthrough: true }) response: Response,
  ): Promise<GameSnapshotResponseDto | void> {
    if (ifNoneMatch !== undefined) {
      const version = await this.gameService.peekVersion(code, user);

      if (applyVersionEtag(response, ifNoneMatch, version)) {
        return;
      }
    }

    const snapshot = await this.gameService.getSnapshot(code, user);

    applyVersionEtag(response, undefined, snapshot.version);

    return snapshot;
  }

  /**
   * POST /rooms/:code/game/reveal — reveal one of the caller's own attributes.
   * Idempotent: re-revealing the same attribute is a no-op and reuses the
   * existing row. Server validates ownership; `traitId` is required for the
   * multi-card slots (currently ACTION_CARD).
   */
  @Post(':code/game/reveal')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Reveal one of the caller’s own attributes (own-card only).',
  })
  @ApiOkResponse({ type: GameSnapshotResponseDto })
  revealAttribute(
    @AuthorizedUser() user: User,
    @Param('code') code: string,
    @Body() body: RevealRequestDto,
  ): Promise<GameSnapshotResponseDto> {
    return this.gameService.revealAttribute(code, user, body);
  }
}
