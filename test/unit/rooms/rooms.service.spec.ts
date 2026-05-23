import { Test, TestingModule } from '@nestjs/testing';
import { DataSource, EntityManager, QueryFailedError } from 'typeorm';
import { beforeEach, describe, expect, it, Mock, vi } from 'vitest';
import { mock, mockReset } from 'vitest-mock-extended';

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
import { RoomsService } from '@/modules/rooms/rooms.service';

/**
 * Test helpers — small fake EntityManager so the service's transactional code
 * runs end-to-end against in-memory stubs, no Postgres required.
 */

interface FakeQueryBuilder {
  where: Mock;
  setLock: Mock;
  getOne: Mock;
}

interface FakeManager {
  create: Mock;
  save: Mock;
  findOne: Mock;
  find: Mock;
  createQueryBuilder: Mock;
  queryBuilder: FakeQueryBuilder;
}

const makeFakeManager = (): FakeManager => {
  const queryBuilder: FakeQueryBuilder = {
    where: vi.fn(),
    setLock: vi.fn(),
    getOne: vi.fn(),
  };

  queryBuilder.where.mockReturnValue(queryBuilder);
  queryBuilder.setLock.mockReturnValue(queryBuilder);

  const manager: FakeManager = {
    create: vi.fn((_entity: unknown, data: unknown) => data),
    save: vi.fn((_entity: unknown, value: unknown) => Promise.resolve(value)),
    findOne: vi.fn(),
    find: vi.fn().mockResolvedValue([]),
    createQueryBuilder: vi.fn().mockReturnValue(queryBuilder),
    queryBuilder,
  };

  return manager;
};

const makeUser = (overrides: Partial<User> = {}): User => ({
  id: 'user-1',
  googleId: 'google-1',
  email: 'p1@example.com',
  name: 'Player One',
  avatarUrl: null,
  isAdmin: false,
  createdAt: new Date('2026-01-01T00:00:00Z'),
  updatedAt: new Date('2026-01-01T00:00:00Z'),
  ...overrides,
});

const makeRoom = (overrides: Partial<Room> = {}): Room => ({
  id: 'room-1',
  code: 'ABCD',
  status: RoomStatusEnum.LOBBY,
  adminUserId: 'user-1',
  apocalypseId: null,
  shelterId: null,
  startedAt: null,
  finishedAt: null,
  version: 1,
  createdAt: new Date('2026-01-01T00:00:00Z'),
  updatedAt: new Date('2026-01-01T00:00:00Z'),
  participants: [],
  ...overrides,
});

const makeParticipant = (
  overrides: Partial<RoomParticipant> = {},
): RoomParticipant => ({
  id: 'participant-1',
  roomId: 'room-1',
  userId: 'user-1',
  seatNumber: 1,
  status: ParticipantStatusEnum.JOINED,
  joinedAt: new Date('2026-01-01T00:00:00Z'),
  leftAt: null,
  createdAt: new Date('2026-01-01T00:00:00Z'),
  updatedAt: new Date('2026-01-01T00:00:00Z'),
  ...overrides,
});

const makeQueryFailedError = (driverCode: string): QueryFailedError => {
  const driverError = Object.assign(new Error('unique'), { code: driverCode });

  return new QueryFailedError('insert', [], driverError);
};

describe('RoomsService', () => {
  const roomDatabaseService = mock<RoomDatabaseService>();
  const dataSource = mock<DataSource>();
  let fakeManager: FakeManager;
  let service: RoomsService;

  beforeEach(async () => {
    mockReset(roomDatabaseService);
    mockReset(dataSource);
    fakeManager = makeFakeManager();

    dataSource.transaction.mockImplementation(
      async (callbackOrIsolation: unknown, maybeCallback?: unknown) => {
        const callback =
          typeof callbackOrIsolation === 'function'
            ? callbackOrIsolation
            : maybeCallback;

        return (callback as (manager: EntityManager) => Promise<unknown>)(
          fakeManager as unknown as EntityManager,
        );
      },
    );

    const moduleRef: TestingModule = await Test.createTestingModule({
      providers: [
        RoomsService,
        { provide: DataSource, useValue: dataSource },
        { provide: RoomDatabaseService, useValue: roomDatabaseService },
      ],
    }).compile();

    service = moduleRef.get(RoomsService);
  });

  describe('createRoom', () => {
    it('inserts a room in LOBBY with the admin in seat #1 and returns the snapshot', async () => {
      const admin = makeUser({ id: 'admin-1', name: 'Admin' });

      // The service saves the room (1st save), then the admin participant (2nd save),
      // then reloads with relations for the snapshot DTO.
      let savedRoom: Room | null = null;
      const now = new Date('2026-05-16T12:00:00Z');

      fakeManager.save.mockImplementation(
        (_entity: unknown, value: unknown) => {
          if (value && typeof value === 'object' && 'code' in value) {
            savedRoom = {
              ...(value as Room),
              id: 'room-new',
              createdAt: now,
              updatedAt: now,
            };

            return Promise.resolve(savedRoom);
          }

          return Promise.resolve(value);
        },
      );
      fakeManager.findOne.mockImplementation(() =>
        Promise.resolve({
          ...(savedRoom as Room),
          participants: [
            makeParticipant({
              id: 'p-admin',
              roomId: 'room-new',
              userId: admin.id,
              seatNumber: 1,
              user: admin,
            }),
          ],
        }),
      );

      const snapshot = await service.createRoom(admin);

      expect(snapshot.code).toMatch(/^[A-Z]{4}$/);
      expect(snapshot.status).toBe(RoomStatusEnum.LOBBY);
      expect(snapshot.adminUserId).toBe(admin.id);
      expect(snapshot.participants).toHaveLength(1);
      expect(snapshot.participants[0]).toMatchObject({
        userId: admin.id,
        seatNumber: 1,
        isAdmin: true,
        status: ParticipantStatusEnum.JOINED,
      });
    });

    it('retries on a room-code unique-violation and eventually succeeds', async () => {
      const admin = makeUser({ id: 'admin-2' });
      let attempt = 0;

      dataSource.transaction.mockImplementation(
        async (callbackOrIsolation: unknown, maybeCallback?: unknown) => {
          const callback =
            typeof callbackOrIsolation === 'function'
              ? callbackOrIsolation
              : maybeCallback;

          attempt += 1;

          if (attempt === 1) {
            throw makeQueryFailedError('23505');
          }

          return (callback as (manager: EntityManager) => Promise<unknown>)(
            fakeManager as unknown as EntityManager,
          );
        },
      );

      fakeManager.findOne.mockResolvedValue(
        makeRoom({
          id: 'room-retry',
          adminUserId: admin.id,
          participants: [
            makeParticipant({ userId: admin.id, seatNumber: 1, user: admin }),
          ],
        }),
      );

      const snapshot = await service.createRoom(admin);

      expect(attempt).toBe(2);
      expect(snapshot.id).toBe('room-retry');
    });
  });

  describe('joinRoom', () => {
    const admin = makeUser({ id: 'admin' });
    const joiner = makeUser({ id: 'joiner', name: 'Joiner' });

    it('rejects when the room is not in LOBBY', async () => {
      fakeManager.queryBuilder.getOne.mockResolvedValue(
        makeRoom({ status: RoomStatusEnum.IN_GAME }),
      );

      await expect(service.joinRoom('ABCD', joiner)).rejects.toBeInstanceOf(
        ConflictException,
      );
    });

    it('rejects KICKED users with 403', async () => {
      fakeManager.queryBuilder.getOne.mockResolvedValue(makeRoom());
      fakeManager.findOne.mockResolvedValue(
        makeParticipant({
          userId: joiner.id,
          status: ParticipantStatusEnum.KICKED,
        }),
      );

      await expect(service.joinRoom('ABCD', joiner)).rejects.toBeInstanceOf(
        ForbiddenException,
      );
    });

    it('is idempotent for an already-JOINED user', async () => {
      const room = makeRoom({
        adminUserId: admin.id,
        participants: [
          makeParticipant({ userId: admin.id, user: admin }),
          makeParticipant({
            id: 'p-joiner',
            userId: joiner.id,
            seatNumber: 2,
            user: joiner,
          }),
        ],
      });

      fakeManager.queryBuilder.getOne.mockResolvedValue(room);
      // 1st findOne: lookup existing participant for joiner → JOINED
      // 2nd findOne: loadSnapshot
      fakeManager.findOne
        .mockResolvedValueOnce(
          makeParticipant({
            userId: joiner.id,
            seatNumber: 2,
            status: ParticipantStatusEnum.JOINED,
          }),
        )
        .mockResolvedValueOnce(room);

      const snapshot = await service.joinRoom('ABCD', joiner);

      expect(fakeManager.save).not.toHaveBeenCalled();
      expect(snapshot.participants.map((p) => p.userId)).toEqual([
        admin.id,
        joiner.id,
      ]);
    });

    it('flips LEFT→JOINED preserving the original seat when free', async () => {
      const room = makeRoom({ adminUserId: admin.id });

      fakeManager.queryBuilder.getOne.mockResolvedValue(room);

      const previousParticipant = makeParticipant({
        userId: joiner.id,
        seatNumber: 5,
        status: ParticipantStatusEnum.LEFT,
        leftAt: new Date(),
      });

      // findOne calls in order:
      //   1) lookup existing participant by (roomId, userId) → LEFT row
      //   2) check if old seat is still free among JOINED → null (free)
      //   3) loadSnapshot
      fakeManager.findOne
        .mockResolvedValueOnce(previousParticipant)
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce({
          ...room,
          participants: [
            {
              ...previousParticipant,
              status: ParticipantStatusEnum.JOINED,
              leftAt: null,
              user: joiner,
            },
          ],
        });

      const snapshot = await service.joinRoom('ABCD', joiner);

      // Two saves: the flipped participant + room.version bump.
      expect(fakeManager.save).toHaveBeenCalledTimes(2);
      expect(room.version).toBe(2);
      expect(previousParticipant.status).toBe(ParticipantStatusEnum.JOINED);
      expect(previousParticipant.seatNumber).toBe(5);
      expect(previousParticipant.leftAt).toBeNull();
      expect(snapshot.participants[0]).toMatchObject({
        userId: joiner.id,
        seatNumber: 5,
        status: ParticipantStatusEnum.JOINED,
      });
    });

    it('allocates a new seat when a LEFT user rejoins but their old seat is taken', async () => {
      const room = makeRoom({ adminUserId: admin.id });

      fakeManager.queryBuilder.getOne.mockResolvedValue(room);

      const previousParticipant = makeParticipant({
        userId: joiner.id,
        seatNumber: 3,
        status: ParticipantStatusEnum.LEFT,
        leftAt: new Date(),
      });

      // findOne calls:
      //   1) existing participant → LEFT
      //   2) old seat taken? → returns a participant (seat 3 occupied)
      //   3) loadSnapshot
      fakeManager.findOne
        .mockResolvedValueOnce(previousParticipant)
        .mockResolvedValueOnce(
          makeParticipant({
            id: 'p-occupant',
            userId: 'other',
            seatNumber: 3,
          }),
        )
        .mockResolvedValueOnce({
          ...room,
          participants: [
            {
              ...previousParticipant,
              status: ParticipantStatusEnum.JOINED,
              leftAt: null,
              user: joiner,
            },
          ],
        });

      // allocateNextSeat: find takes (roomId, status=JOINED). Stub current seat occupants.
      fakeManager.find.mockResolvedValueOnce([
        { seatNumber: 1 } as RoomParticipant,
        { seatNumber: 2 } as RoomParticipant,
        { seatNumber: 3 } as RoomParticipant,
      ]);

      await service.joinRoom('ABCD', joiner);
      expect(previousParticipant.seatNumber).toBe(4);
      expect(previousParticipant.status).toBe(ParticipantStatusEnum.JOINED);
    });

    it('throws ConflictException when the room is full (22/22 seats)', async () => {
      fakeManager.queryBuilder.getOne.mockResolvedValue(makeRoom());
      fakeManager.findOne.mockResolvedValueOnce(null);
      fakeManager.find.mockResolvedValueOnce(
        Array.from(
          { length: 22 },
          (_, idx) =>
            ({
              seatNumber: idx + 1,
            }) as RoomParticipant,
        ),
      );

      await expect(service.joinRoom('ABCD', joiner)).rejects.toBeInstanceOf(
        ConflictException,
      );
    });
  });

  describe('leaveRoom', () => {
    it('marks a non-admin participant as LEFT without touching admin', async () => {
      const room = makeRoom({ adminUserId: 'admin' });

      fakeManager.queryBuilder.getOne.mockResolvedValue(room);

      const participant = makeParticipant({
        userId: 'leaver',
        seatNumber: 2,
      });

      fakeManager.findOne.mockResolvedValueOnce(participant);

      await service.leaveRoom('ABCD', makeUser({ id: 'leaver' }));

      expect(participant.status).toBe(ParticipantStatusEnum.LEFT);
      expect(participant.leftAt).not.toBeNull();
      // Two saves: the LEFT participant + room.version bump.
      expect(fakeManager.save).toHaveBeenCalledTimes(2);
      expect(room.version).toBe(2);
      expect(room.adminUserId).toBe('admin');
      expect(room.status).toBe(RoomStatusEnum.LOBBY);
    });

    it('promotes the longest-tenured remaining JOINED player when the admin leaves', async () => {
      const room = makeRoom({ adminUserId: 'admin' });

      fakeManager.queryBuilder.getOne.mockResolvedValue(room);

      const adminParticipant = makeParticipant({
        userId: 'admin',
        seatNumber: 1,
      });
      const successor = makeParticipant({
        id: 'p-successor',
        userId: 'next-admin',
        seatNumber: 2,
        joinedAt: new Date('2026-01-01T00:01:00Z'),
      });

      fakeManager.findOne
        .mockResolvedValueOnce(adminParticipant) // initial lookup of caller
        .mockResolvedValueOnce(successor); // reassignAdminOrAbandon

      await service.leaveRoom('ABCD', makeUser({ id: 'admin' }));

      expect(adminParticipant.status).toBe(ParticipantStatusEnum.LEFT);
      expect(room.adminUserId).toBe('next-admin');
      expect(room.status).toBe(RoomStatusEnum.LOBBY);
    });

    it('transitions the room to ABANDONED when the last participant leaves', async () => {
      const room = makeRoom({ adminUserId: 'admin' });

      fakeManager.queryBuilder.getOne.mockResolvedValue(room);

      const adminParticipant = makeParticipant({
        userId: 'admin',
        seatNumber: 1,
      });

      fakeManager.findOne
        .mockResolvedValueOnce(adminParticipant) // initial caller lookup
        .mockResolvedValueOnce(null); // no successor

      await service.leaveRoom('ABCD', makeUser({ id: 'admin' }));

      expect(adminParticipant.status).toBe(ParticipantStatusEnum.LEFT);
      expect(room.status).toBe(RoomStatusEnum.ABANDONED);
    });

    it('is a silent no-op when the caller is not currently JOINED', async () => {
      const room = makeRoom({ adminUserId: 'admin' });

      fakeManager.queryBuilder.getOne.mockResolvedValue(room);
      fakeManager.findOne.mockResolvedValueOnce(
        makeParticipant({
          userId: 'someone',
          status: ParticipantStatusEnum.LEFT,
        }),
      );

      await service.leaveRoom('ABCD', makeUser({ id: 'someone' }));

      expect(fakeManager.save).not.toHaveBeenCalled();
    });
  });

  describe('kickParticipant', () => {
    it('admin kicks a JOINED participant successfully', async () => {
      const room = makeRoom({ adminUserId: 'admin' });

      fakeManager.queryBuilder.getOne.mockResolvedValue(room);

      const target = makeParticipant({
        userId: 'target',
        seatNumber: 3,
      });

      fakeManager.findOne
        .mockResolvedValueOnce(target) // target lookup
        .mockResolvedValueOnce({
          ...room,
          participants: [target],
        });

      await service.kickParticipant(
        'ABCD',
        makeUser({ id: 'admin' }),
        'target',
      );

      expect(target.status).toBe(ParticipantStatusEnum.KICKED);
      expect(target.leftAt).not.toBeNull();
    });

    it('rejects when the caller is not the admin', async () => {
      fakeManager.queryBuilder.getOne.mockResolvedValue(
        makeRoom({ adminUserId: 'admin' }),
      );

      await expect(
        service.kickParticipant(
          'ABCD',
          makeUser({ id: 'not-admin' }),
          'target',
        ),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('rejects self-kick with 409', async () => {
      fakeManager.queryBuilder.getOne.mockResolvedValue(
        makeRoom({ adminUserId: 'admin' }),
      );

      await expect(
        service.kickParticipant('ABCD', makeUser({ id: 'admin' }), 'admin'),
      ).rejects.toBeInstanceOf(ConflictException);
    });

    it('throws not-found when the target is not a JOINED participant', async () => {
      fakeManager.queryBuilder.getOne.mockResolvedValue(
        makeRoom({ adminUserId: 'admin' }),
      );
      fakeManager.findOne.mockResolvedValueOnce(null);

      await expect(
        service.kickParticipant('ABCD', makeUser({ id: 'admin' }), 'ghost'),
      ).rejects.toBeInstanceOf(EntityNotFoundException);
    });
  });

  describe('finishRoom', () => {
    it('admin transitions IN_GAME → FINISHED and sets finishedAt', async () => {
      const room = makeRoom({
        adminUserId: 'admin',
        status: RoomStatusEnum.IN_GAME,
        startedAt: new Date('2026-01-01T00:00:00Z'),
      });

      fakeManager.queryBuilder.getOne.mockResolvedValue(room);
      fakeManager.findOne.mockResolvedValueOnce(room);

      const snapshot = await service.finishRoom(
        'ABCD',
        makeUser({ id: 'admin' }),
      );

      expect(room.status).toBe(RoomStatusEnum.FINISHED);
      expect(room.finishedAt).not.toBeNull();
      expect(snapshot.status).toBe(RoomStatusEnum.FINISHED);
    });

    it('is idempotent when the room is already FINISHED', async () => {
      const finishedAt = new Date('2026-01-02T00:00:00Z');
      const room = makeRoom({
        adminUserId: 'admin',
        status: RoomStatusEnum.FINISHED,
        finishedAt,
      });

      fakeManager.queryBuilder.getOne.mockResolvedValue(room);
      fakeManager.findOne.mockResolvedValueOnce(room);

      const snapshot = await service.finishRoom(
        'ABCD',
        makeUser({ id: 'admin' }),
      );

      expect(fakeManager.save).not.toHaveBeenCalled();
      expect(snapshot.status).toBe(RoomStatusEnum.FINISHED);
      expect(snapshot.finishedAt).toBe(finishedAt.toISOString());
    });

    it('rejects from LOBBY with 409', async () => {
      fakeManager.queryBuilder.getOne.mockResolvedValue(
        makeRoom({ adminUserId: 'admin', status: RoomStatusEnum.LOBBY }),
      );

      await expect(
        service.finishRoom('ABCD', makeUser({ id: 'admin' })),
      ).rejects.toBeInstanceOf(ConflictException);
    });

    it('rejects non-admins with 403', async () => {
      fakeManager.queryBuilder.getOne.mockResolvedValue(
        makeRoom({ adminUserId: 'admin', status: RoomStatusEnum.IN_GAME }),
      );

      await expect(
        service.finishRoom('ABCD', makeUser({ id: 'not-admin' })),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });
  });

  describe('getSnapshot', () => {
    it('returns the snapshot for a JOINED participant', async () => {
      const room = makeRoom({
        adminUserId: 'admin',
        participants: [
          makeParticipant({
            userId: 'admin',
            user: makeUser({ id: 'admin', name: 'Admin' }),
          }),
          makeParticipant({
            id: 'p-2',
            userId: 'joiner',
            seatNumber: 2,
            user: makeUser({ id: 'joiner', name: 'Joiner' }),
          }),
        ],
      });

      roomDatabaseService.findByCodeWithParticipants.mockResolvedValue(room);

      const snapshot = await service.getSnapshot(
        'ABCD',
        makeUser({ id: 'joiner' }),
      );

      expect(snapshot.participants.map((p) => p.userId)).toEqual([
        'admin',
        'joiner',
      ]);
      expect(
        snapshot.participants.find((p) => p.userId === 'admin')?.isAdmin,
      ).toBe(true);
    });

    it('throws not-found when the room is missing', async () => {
      roomDatabaseService.findByCodeWithParticipants.mockResolvedValue(null);

      await expect(
        service.getSnapshot('ZZZZ', makeUser({ id: 'x' })),
      ).rejects.toBeInstanceOf(EntityNotFoundException);
    });

    it('throws Forbidden when the caller is not JOINED', async () => {
      const room = makeRoom({
        participants: [
          makeParticipant({
            userId: 'someone',
            status: ParticipantStatusEnum.LEFT,
            user: makeUser({ id: 'someone' }),
          }),
        ],
      });

      roomDatabaseService.findByCodeWithParticipants.mockResolvedValue(room);

      await expect(
        service.getSnapshot('ABCD', makeUser({ id: 'someone' })),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });
  });
});
