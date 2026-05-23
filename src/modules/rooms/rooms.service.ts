import { Injectable } from '@nestjs/common';
import { DataSource, EntityManager, QueryFailedError } from 'typeorm';

import {
  ROOM_CODE_ALLOCATION_ATTEMPTS,
  ROOM_MAX_PARTICIPANTS,
} from './constants/room.constants';
import { RoomParticipantResponseDto, RoomSnapshotResponseDto } from './dto';
import { generateRoomCode, normaliseRoomCode } from './utils/room-code.util';
import { ConflictException } from '@/exceptions/conflict.exception';
import { EntityNotFoundException } from '@/exceptions/entity-not-found.exception';
import { ForbiddenException } from '@/exceptions/forbidden.exception';
import {
  ParticipantStatusEnum,
  Room,
  RoomParticipant,
  RoomStatusEnum,
  User,
} from '@/modules/database/entities';
import { RoomDatabaseService } from '@/modules/database/services';

const POSTGRES_UNIQUE_VIOLATION_CODE = '23505';

/**
 * Returns true when the error is a Postgres unique-violation.
 * Used to retry room-code allocation on collision.
 */
const isUniqueViolation = (error: unknown): boolean => {
  if (!(error instanceof QueryFailedError)) {
    return false;
  }

  const driverError = (error as QueryFailedError & { driverError?: unknown })
    .driverError;

  if (!driverError || typeof driverError !== 'object') {
    return false;
  }

  return (
    (driverError as { code?: string }).code === POSTGRES_UNIQUE_VIOLATION_CODE
  );
};

/**
 * Room lifecycle + participation operations. Every state mutation runs in a
 * transaction with a pessimistic write-lock on the room row so concurrent
 * join/leave/kick/finish requests serialise cleanly.
 */
@Injectable()
export class RoomsService {
  constructor(
    private readonly dataSource: DataSource,
    private readonly roomDatabaseService: RoomDatabaseService,
  ) {}

  /**
   * Locks the room row by code inside the current transaction (SELECT FOR UPDATE).
   * Throws EntityNotFoundException if there is no such room.
   */
  private async lockRoomByCode(
    manager: EntityManager,
    code: string,
  ): Promise<Room> {
    const room = await manager
      .createQueryBuilder(Room, 'room')
      .where('room.code = :code', { code })
      .setLock('pessimistic_write')
      .getOne();

    if (!room) {
      throw new EntityNotFoundException(Room);
    }

    return room;
  }

  /**
   * Finds the lowest unused seat number (1..ROOM_MAX_PARTICIPANTS) among
   * currently JOINED participants of the room. Throws Conflict when the room is full.
   */
  private async allocateNextSeat(
    manager: EntityManager,
    roomId: string,
  ): Promise<number> {
    const joinedSeats = await manager.find(RoomParticipant, {
      where: { roomId, status: ParticipantStatusEnum.JOINED },
      select: ['seatNumber'],
    });
    const takenSeats = new Set(joinedSeats.map((row) => row.seatNumber));

    for (let seat = 1; seat <= ROOM_MAX_PARTICIPANTS; seat += 1) {
      if (!takenSeats.has(seat)) {
        return seat;
      }
    }

    throw new ConflictException('Room is full');
  }

  /**
   * Promotes the longest-tenured remaining JOINED participant to admin.
   * If no one is left, transitions the room to ABANDONED. Mutates `room` in place.
   * Does not bump version — the caller (leave/kick) is responsible for that.
   */
  private async reassignAdminOrAbandon(
    manager: EntityManager,
    room: Room,
  ): Promise<void> {
    const successor = await manager.findOne(RoomParticipant, {
      where: { roomId: room.id, status: ParticipantStatusEnum.JOINED },
      order: { joinedAt: 'ASC', seatNumber: 'ASC' },
    });

    if (successor) {
      room.adminUserId = successor.userId;
    } else {
      room.status = RoomStatusEnum.ABANDONED;
    }

    await manager.save(Room, room);
  }

  /**
   * Bumps the room.version counter and persists. Used by every state-changing
   * path so polled snapshots can ETag on `version`.
   */
  private async bumpVersion(manager: EntityManager, room: Room): Promise<void> {
    room.version += 1;
    await manager.save(Room, room);
  }

  /**
   * Reloads the room with participants + users for the snapshot DTO.
   */
  private async loadSnapshot(
    manager: EntityManager,
    roomId: string,
  ): Promise<Room> {
    const room = await manager.findOne(Room, {
      where: { id: roomId },
      relations: { participants: { user: true } },
    });

    if (!room) {
      throw new EntityNotFoundException(Room);
    }

    return room;
  }

  /**
   * Maps a fully-loaded Room entity to the snapshot DTO.
   */
  private toSnapshot(room: Room): RoomSnapshotResponseDto {
    const participants: RoomParticipantResponseDto[] = (room.participants ?? [])
      .slice()
      .sort((left, right) => left.seatNumber - right.seatNumber)
      .map((participant) => ({
        id: participant.id,
        userId: participant.userId,
        seatNumber: participant.seatNumber,
        name: participant.user?.name ?? '',
        avatarUrl: participant.user?.avatarUrl ?? null,
        status: participant.status,
        isAdmin: participant.userId === room.adminUserId,
        joinedAt: participant.joinedAt.toISOString(),
        leftAt: participant.leftAt ? participant.leftAt.toISOString() : null,
      }));

    return {
      id: room.id,
      code: room.code,
      status: room.status,
      adminUserId: room.adminUserId,
      createdAt: room.createdAt.toISOString(),
      startedAt: room.startedAt ? room.startedAt.toISOString() : null,
      finishedAt: room.finishedAt ? room.finishedAt.toISOString() : null,
      version: room.version,
      participants,
    };
  }

  /**
   * Creates a new room with the caller as admin and seat #1. Retries on the
   * (rare) room-code collision; surfaces 500 if too many collisions in a row.
   */
  async createRoom(adminUser: User): Promise<RoomSnapshotResponseDto> {
    for (
      let attempt = 0;
      attempt < ROOM_CODE_ALLOCATION_ATTEMPTS;
      attempt += 1
    ) {
      const code = generateRoomCode();
      const now = new Date();

      try {
        return await this.dataSource.transaction(async (manager) => {
          const room = manager.create(Room, {
            code,
            status: RoomStatusEnum.LOBBY,
            adminUserId: adminUser.id,
            startedAt: null,
            finishedAt: null,
          });

          await manager.save(Room, room);

          const participant = manager.create(RoomParticipant, {
            roomId: room.id,
            userId: adminUser.id,
            seatNumber: 1,
            status: ParticipantStatusEnum.JOINED,
            joinedAt: now,
            leftAt: null,
          });

          await manager.save(RoomParticipant, participant);

          const reloaded = await this.loadSnapshot(manager, room.id);

          return this.toSnapshot(reloaded);
        });
      } catch (error) {
        if (isUniqueViolation(error)) {
          continue;
        }

        throw error;
      }
    }

    throw new ConflictException(
      'Could not allocate a unique room code; please retry.',
    );
  }

  /**
   * Joins the caller into the room with the given code. Idempotent if they are
   * already JOINED; flips LEFT→JOINED (preserving the seat where possible);
   * rejects KICKED users with 403; rejects when room is not in LOBBY or is full.
   */
  async joinRoom(code: string, user: User): Promise<RoomSnapshotResponseDto> {
    const normalisedCode = normaliseRoomCode(code);

    return this.dataSource.transaction(async (manager) => {
      const room = await this.lockRoomByCode(manager, normalisedCode);

      if (room.status !== RoomStatusEnum.LOBBY) {
        throw new ConflictException(
          `Cannot join a room with status ${room.status}`,
        );
      }

      const existing = await manager.findOne(RoomParticipant, {
        where: { roomId: room.id, userId: user.id },
      });

      if (existing?.status === ParticipantStatusEnum.KICKED) {
        throw new ForbiddenException(
          'You were kicked from this room and cannot rejoin.',
        );
      }

      if (existing?.status === ParticipantStatusEnum.JOINED) {
        const reloaded = await this.loadSnapshot(manager, room.id);

        return this.toSnapshot(reloaded);
      }

      if (existing?.status === ParticipantStatusEnum.LEFT) {
        const seatStillFree = await manager.findOne(RoomParticipant, {
          where: {
            roomId: room.id,
            seatNumber: existing.seatNumber,
            status: ParticipantStatusEnum.JOINED,
          },
        });

        if (seatStillFree) {
          existing.seatNumber = await this.allocateNextSeat(manager, room.id);
        }

        existing.status = ParticipantStatusEnum.JOINED;
        existing.leftAt = null;
        await manager.save(RoomParticipant, existing);
        await this.bumpVersion(manager, room);

        const reloaded = await this.loadSnapshot(manager, room.id);

        return this.toSnapshot(reloaded);
      }

      const seatNumber = await this.allocateNextSeat(manager, room.id);
      const participant = manager.create(RoomParticipant, {
        roomId: room.id,
        userId: user.id,
        seatNumber,
        status: ParticipantStatusEnum.JOINED,
        joinedAt: new Date(),
        leftAt: null,
      });

      await manager.save(RoomParticipant, participant);
      await this.bumpVersion(manager, room);

      const reloaded = await this.loadSnapshot(manager, room.id);

      return this.toSnapshot(reloaded);
    });
  }

  /**
   * Returns the current snapshot for a room the caller is JOINED in.
   * Reconnect-friendly: any JOINED participant can poll at any room status.
   */
  async getSnapshot(
    code: string,
    user: User,
  ): Promise<RoomSnapshotResponseDto> {
    const normalisedCode = normaliseRoomCode(code);
    const room =
      await this.roomDatabaseService.findByCodeWithParticipants(normalisedCode);

    if (!room) {
      throw new EntityNotFoundException(Room);
    }

    const callerParticipant = (room.participants ?? []).find(
      (participant) => participant.userId === user.id,
    );

    if (
      !callerParticipant ||
      callerParticipant.status !== ParticipantStatusEnum.JOINED
    ) {
      throw new ForbiddenException('You are not a participant of this room.');
    }

    return this.toSnapshot(room);
  }

  /**
   * Cheap poll probe for the room snapshot: resolves the current version
   * without loading the participant graph, so an unchanged poll can
   * short-circuit to 304. Enforces the same membership access check as
   * getSnapshot — and because every mutation bumps the version, a matching
   * ETag implies the caller's access has not changed.
   */
  async peekVersion(code: string, user: User): Promise<number> {
    const normalisedCode = normaliseRoomCode(code);
    const pollState = await this.roomDatabaseService.getPollState(
      normalisedCode,
      user.id,
    );

    if (!pollState) {
      throw new EntityNotFoundException(Room);
    }

    if (!pollState.isMember) {
      throw new ForbiddenException('You are not a participant of this room.');
    }

    return pollState.version;
  }

  /**
   * Voluntary leave. Works in both LOBBY and IN_GAME. If the caller was admin,
   * promotes the longest-tenured remaining JOINED player; transitions to
   * ABANDONED when the last participant leaves.
   * Idempotent: silently no-ops when the caller is no longer JOINED.
   */
  async leaveRoom(code: string, user: User): Promise<void> {
    const normalisedCode = normaliseRoomCode(code);

    await this.dataSource.transaction(async (manager) => {
      const room = await this.lockRoomByCode(manager, normalisedCode);

      const participant = await manager.findOne(RoomParticipant, {
        where: { roomId: room.id, userId: user.id },
      });

      if (!participant || participant.status !== ParticipantStatusEnum.JOINED) {
        return;
      }

      participant.status = ParticipantStatusEnum.LEFT;
      participant.leftAt = new Date();
      await manager.save(RoomParticipant, participant);

      if (room.adminUserId === user.id) {
        await this.reassignAdminOrAbandon(manager, room);
      }

      await this.bumpVersion(manager, room);
    });
  }

  /**
   * Admin kicks a participant. Cannot kick self. Target must be JOINED in this room.
   */
  async kickParticipant(
    code: string,
    admin: User,
    targetUserId: string,
  ): Promise<RoomSnapshotResponseDto> {
    const normalisedCode = normaliseRoomCode(code);

    return this.dataSource.transaction(async (manager) => {
      const room = await this.lockRoomByCode(manager, normalisedCode);

      if (room.adminUserId !== admin.id) {
        throw new ForbiddenException('Only the room admin can kick.');
      }

      if (targetUserId === admin.id) {
        throw new ConflictException('Admin cannot kick themselves.');
      }

      const target = await manager.findOne(RoomParticipant, {
        where: { roomId: room.id, userId: targetUserId },
      });

      if (!target || target.status !== ParticipantStatusEnum.JOINED) {
        throw new EntityNotFoundException(RoomParticipant);
      }

      target.status = ParticipantStatusEnum.KICKED;
      target.leftAt = new Date();
      await manager.save(RoomParticipant, target);
      await this.bumpVersion(manager, room);

      const reloaded = await this.loadSnapshot(manager, room.id);

      return this.toSnapshot(reloaded);
    });
  }

  /**
   * Admin finishes an in-game room. Idempotent if already FINISHED.
   * Rejects from LOBBY/ABANDONED with 409.
   */
  async finishRoom(
    code: string,
    admin: User,
  ): Promise<RoomSnapshotResponseDto> {
    const normalisedCode = normaliseRoomCode(code);

    return this.dataSource.transaction(async (manager) => {
      const room = await this.lockRoomByCode(manager, normalisedCode);

      if (room.adminUserId !== admin.id) {
        throw new ForbiddenException('Only the room admin can finish a game.');
      }

      if (room.status === RoomStatusEnum.FINISHED) {
        const reloaded = await this.loadSnapshot(manager, room.id);

        return this.toSnapshot(reloaded);
      }

      if (room.status !== RoomStatusEnum.IN_GAME) {
        throw new ConflictException(
          `Cannot finish a room in status ${room.status}`,
        );
      }

      room.status = RoomStatusEnum.FINISHED;
      room.finishedAt = new Date();
      room.version += 1;
      await manager.save(Room, room);

      const reloaded = await this.loadSnapshot(manager, room.id);

      return this.toSnapshot(reloaded);
    });
  }
}
