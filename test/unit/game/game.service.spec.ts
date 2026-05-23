import { Test, TestingModule } from '@nestjs/testing';
import { DataSource, EntityManager, EntityTarget, IsNull } from 'typeorm';
import { beforeEach, describe, expect, it, Mock, vi } from 'vitest';
import { mock, mockReset } from 'vitest-mock-extended';

import { BadRequestException } from '@/exceptions/bad-request.exception';
import { ConflictException } from '@/exceptions/conflict.exception';
import { EntityNotFoundException } from '@/exceptions/entity-not-found.exception';
import { ForbiddenException } from '@/exceptions/forbidden.exception';
import {
  Apocalypse,
  BiologyAge,
  BiologyGender,
  BiologyRace,
  BiologySex,
  BiologyWeight,
  ParticipantStatusEnum,
  PlayerCharacter,
  PlayerReveal,
  PolarityEnum,
  RevealAttributeEnum,
  Room,
  RoomParticipant,
  RoomStatusEnum,
  Shelter,
  Trait,
  TraitKindEnum,
  User,
} from '@/modules/database/entities';
import {
  PlayerCharacterDatabaseService,
  PlayerRevealDatabaseService,
  RoomDatabaseService,
} from '@/modules/database/services';
import { GameService } from '@/modules/game/game.service';

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

  let nextId = 1;
  const manager: FakeManager = {
    create: vi.fn((_target: unknown, data: Record<string, unknown>) => ({
      id: `generated-${nextId++}`,
      ...data,
    })),
    save: vi.fn((_target: unknown, value: unknown) => Promise.resolve(value)),
    findOne: vi.fn(),
    find: vi.fn().mockResolvedValue([]),
    createQueryBuilder: vi.fn().mockReturnValue(queryBuilder),
    queryBuilder,
  };

  return manager;
};

const makeUser = (overrides: Partial<User> = {}): User => ({
  id: 'admin',
  googleId: 'g-admin',
  email: 'admin@example.com',
  name: 'Admin',
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
  adminUserId: 'admin',
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
  id: 'p-1',
  roomId: 'room-1',
  userId: 'admin',
  seatNumber: 1,
  status: ParticipantStatusEnum.JOINED,
  joinedAt: new Date('2026-01-01T00:00:00Z'),
  leftAt: null,
  createdAt: new Date('2026-01-01T00:00:00Z'),
  updatedAt: new Date('2026-01-01T00:00:00Z'),
  ...overrides,
});

const apocalypse: Apocalypse = {
  id: 'apoc-1',
  nameUk: 'Глобальна посуха',
  descriptionUk: 'Опис',
  populationRemainderUk: '30%',
  polarity: PolarityEnum.NEUTRAL,
  enabled: true,
  weight: 1,
  createdAt: new Date(),
  updatedAt: new Date(),
};

const shelter: Shelter = {
  id: 'shelter-1',
  areaUk: '800 м²',
  locationUk: 'Альпи',
  durationUk: '30 років',
  equipmentUk: 'Спальні',
  suppliesUk: 'Криниця',
  polarity: PolarityEnum.POSITIVE,
  enabled: true,
  weight: 1,
  createdAt: new Date(),
  updatedAt: new Date(),
};

const biologyEntries = {
  age: [
    { id: 'age-1', valueUk: '23 роки', enabled: true, weight: 1 } as BiologyAge,
  ],
  weight: [
    { id: 'w-1', valueUk: '60 кг', enabled: true, weight: 1 } as BiologyWeight,
  ],
  sex: [
    { id: 's-1', valueUk: 'Чоловік', enabled: true, weight: 1 } as BiologySex,
  ],
  gender: [
    { id: 'g-1', valueUk: 'Гетеро', enabled: true, weight: 1 } as BiologyGender,
  ],
  race: [
    {
      id: 'r-1',
      valueUk: 'Українець',
      enabled: true,
      weight: 1,
    } as BiologyRace,
  ],
};

const trait = (overrides: Partial<Trait>): Trait => ({
  id: `trait-${overrides.kind}-${overrides.titleUk ?? 'x'}`,
  kind: TraitKindEnum.HEALTH,
  polarity: PolarityEnum.POSITIVE,
  titleUk: 'X',
  descriptionUk: null,
  enabled: true,
  weight: 1,
  createdAt: new Date(),
  updatedAt: new Date(),
  ...overrides,
});

const traitPool: Trait[] = [
  trait({ kind: TraitKindEnum.HEALTH, titleUk: 'h' }),
  trait({ kind: TraitKindEnum.PROFESSION, titleUk: 'p' }),
  trait({ kind: TraitKindEnum.HOBBY, titleUk: 'ho' }),
  trait({ kind: TraitKindEnum.PHOBIA, titleUk: 'ph' }),
  trait({ kind: TraitKindEnum.CHARACTER_TRAIT, titleUk: 'ch' }),
  trait({ kind: TraitKindEnum.LUGGAGE, titleUk: 'lu' }),
  trait({ kind: TraitKindEnum.PERSONAL_FACT, titleUk: 'pf' }),
  trait({ kind: TraitKindEnum.ACTION_CARD, titleUk: 'a1' }),
  trait({ kind: TraitKindEnum.ACTION_CARD, titleUk: 'a2' }),
  trait({ kind: TraitKindEnum.CONDITION_CARD, titleUk: 'cc1' }),
];

const adminCharacter = {
  id: 'character-admin',
  roomId: 'room-1',
  userId: 'admin',
  ageId: biologyEntries.age[0].id,
  weightId: biologyEntries.weight[0].id,
  sexId: biologyEntries.sex[0].id,
  genderId: biologyEntries.gender[0].id,
  raceId: biologyEntries.race[0].id,
  age: biologyEntries.age[0],
  weight: biologyEntries.weight[0],
  sex: biologyEntries.sex[0],
  gender: biologyEntries.gender[0],
  race: biologyEntries.race[0],
  characterTraits: [
    { id: 'pct-1', traitId: traitPool[0].id, trait: traitPool[0] },
    { id: 'pct-2', traitId: traitPool[1].id, trait: traitPool[1] },
    {
      id: 'pct-a1',
      traitId: traitPool[7].id,
      trait: traitPool[7],
    },
    {
      id: 'pct-a2',
      traitId: traitPool[8].id,
      trait: traitPool[8],
    },
  ],
  createdAt: new Date(),
  updatedAt: new Date(),
} as unknown as PlayerCharacter;

const inGameRoom = (overrides: Partial<Room> = {}): Room => ({
  ...makeRoom({
    adminUserId: 'admin',
    status: RoomStatusEnum.IN_GAME,
    apocalypseId: apocalypse.id,
    shelterId: shelter.id,
    startedAt: new Date('2026-05-17T20:00:00Z'),
    version: 3,
  }),
  apocalypse,
  shelter,
  participants: [
    makeParticipant({ userId: 'admin', seatNumber: 1 }),
    makeParticipant({ id: 'p-2', userId: 'other', seatNumber: 2 }),
  ],
  ...overrides,
});

const wireFind = (
  fakeManager: FakeManager,
  responses: Map<EntityTarget<unknown>, unknown[]>,
) => {
  fakeManager.find.mockImplementation((target: EntityTarget<unknown>) =>
    Promise.resolve(responses.get(target) ?? []),
  );
};

describe('GameService', () => {
  const roomDatabaseService = mock<RoomDatabaseService>();
  const playerCharacterDatabaseService = mock<PlayerCharacterDatabaseService>();
  const playerRevealDatabaseService = mock<PlayerRevealDatabaseService>();
  const dataSource = mock<DataSource>();
  let fakeManager: FakeManager;
  let service: GameService;

  beforeEach(async () => {
    mockReset(roomDatabaseService);
    mockReset(playerCharacterDatabaseService);
    mockReset(playerRevealDatabaseService);
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
        GameService,
        { provide: DataSource, useValue: dataSource },
        { provide: RoomDatabaseService, useValue: roomDatabaseService },
        {
          provide: PlayerCharacterDatabaseService,
          useValue: playerCharacterDatabaseService,
        },
        {
          provide: PlayerRevealDatabaseService,
          useValue: playerRevealDatabaseService,
        },
      ],
    }).compile();

    service = moduleRef.get(GameService);
  });

  describe('startGame', () => {
    const admin = makeUser({ id: 'admin' });
    const participants = [
      makeParticipant({ id: 'p1', userId: 'admin', seatNumber: 1 }),
      makeParticipant({ id: 'p2', userId: 'p2', seatNumber: 2 }),
      makeParticipant({ id: 'p3', userId: 'p3', seatNumber: 3 }),
      makeParticipant({ id: 'p4', userId: 'p4', seatNumber: 4 }),
    ];

    const wireHappyPath = (room: Room) => {
      fakeManager.queryBuilder.getOne.mockResolvedValue(room);
      wireFind(
        fakeManager,
        new Map<EntityTarget<unknown>, unknown[]>([
          [RoomParticipant, participants],
          [Apocalypse, [apocalypse]],
          [Shelter, [shelter]],
          [BiologyAge, biologyEntries.age],
          [BiologyWeight, biologyEntries.weight],
          [BiologySex, biologyEntries.sex],
          [BiologyGender, biologyEntries.gender],
          [BiologyRace, biologyEntries.race],
          [Trait, traitPool],
          [PlayerCharacter, [adminCharacter]],
        ]),
      );
    };

    it('transitions LOBBY → IN_GAME, bumps version, and creates a character per participant', async () => {
      const room = makeRoom({ adminUserId: admin.id, version: 1 });

      wireHappyPath(room);

      // The only manager.findOne in startGame after refactor is the Room
      // reload with relations.
      fakeManager.findOne.mockResolvedValueOnce({
        ...room,
        status: RoomStatusEnum.IN_GAME,
        apocalypseId: apocalypse.id,
        shelterId: shelter.id,
        apocalypse,
        shelter,
        startedAt: new Date('2026-05-17T20:00:00Z'),
        // Reflects the post-save version after the bump.
        version: 2,
        participants: participants.map((participant) => ({
          ...participant,
          user: makeUser({ id: participant.userId, name: participant.userId }),
        })),
      });

      const snapshot = await service.startGame('ABCD', admin);

      expect(room.status).toBe(RoomStatusEnum.IN_GAME);
      expect(room.apocalypseId).toBe(apocalypse.id);
      expect(room.shelterId).toBe(shelter.id);
      expect(room.startedAt).not.toBeNull();
      expect(room.version).toBe(2);

      const characterSaves = fakeManager.save.mock.calls.filter(
        ([target]) => target === PlayerCharacter,
      );

      expect(characterSaves).toHaveLength(4);

      // 4 players × 9 traits + 4 characters + 1 room save ≥ 41.
      expect(fakeManager.save.mock.calls.length).toBeGreaterThanOrEqual(
        4 + 4 * 9 + 1,
      );

      expect(snapshot.status).toBe(RoomStatusEnum.IN_GAME);
      expect(snapshot.apocalypse.id).toBe(apocalypse.id);
      expect(snapshot.shelter.id).toBe(shelter.id);
      expect(snapshot.players).toHaveLength(4);
      expect(snapshot.version).toBe(2);
      expect(snapshot.myCharacter.id).toBe(adminCharacter.id);
      expect(snapshot.myCharacter.traits.length).toBeGreaterThanOrEqual(1);
      // No reveals at start.
      expect(
        snapshot.players.every((player) => player.reveals.length === 0),
      ).toBe(true);
    });

    it('rejects non-admin callers with 403', async () => {
      const room = makeRoom({ adminUserId: 'admin' });

      fakeManager.queryBuilder.getOne.mockResolvedValue(room);

      await expect(
        service.startGame('ABCD', makeUser({ id: 'not-admin' })),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('rejects when the room is not in LOBBY with 409', async () => {
      const room = makeRoom({
        adminUserId: admin.id,
        status: RoomStatusEnum.IN_GAME,
      });

      fakeManager.queryBuilder.getOne.mockResolvedValue(room);

      await expect(service.startGame('ABCD', admin)).rejects.toBeInstanceOf(
        ConflictException,
      );
    });

    it('rejects when there are fewer than 4 JOINED participants', async () => {
      const room = makeRoom({ adminUserId: admin.id });

      fakeManager.queryBuilder.getOne.mockResolvedValue(room);
      wireFind(
        fakeManager,
        new Map<EntityTarget<unknown>, unknown[]>([
          [RoomParticipant, participants.slice(0, 3)],
        ]),
      );

      await expect(service.startGame('ABCD', admin)).rejects.toBeInstanceOf(
        ConflictException,
      );
    });

    it('rejects when any biology pool is empty', async () => {
      const room = makeRoom({ adminUserId: admin.id });

      fakeManager.queryBuilder.getOne.mockResolvedValue(room);
      wireFind(
        fakeManager,
        new Map<EntityTarget<unknown>, unknown[]>([
          [RoomParticipant, participants],
          [Apocalypse, [apocalypse]],
          [Shelter, [shelter]],
          [BiologyAge, biologyEntries.age],
          [BiologyWeight, biologyEntries.weight],
          [BiologySex, biologyEntries.sex],
          [BiologyGender, []],
          [BiologyRace, biologyEntries.race],
          [Trait, traitPool],
        ]),
      );

      await expect(service.startGame('ABCD', admin)).rejects.toBeInstanceOf(
        ConflictException,
      );
    });

    it('throws ConflictException when the apocalypse pool is empty', async () => {
      const room = makeRoom({ adminUserId: admin.id });

      fakeManager.queryBuilder.getOne.mockResolvedValue(room);
      wireFind(
        fakeManager,
        new Map<EntityTarget<unknown>, unknown[]>([
          [RoomParticipant, participants],
          [Apocalypse, []],
          [Shelter, [shelter]],
        ]),
      );

      await expect(service.startGame('ABCD', admin)).rejects.toBeInstanceOf(
        ConflictException,
      );
    });
  });

  describe('getSnapshot', () => {
    const admin = makeUser({ id: 'admin' });

    const wireHappyPath = (room: Room, reveals: PlayerReveal[] = []) => {
      roomDatabaseService.findByCodeWithGameRelations.mockResolvedValue(room);
      playerCharacterDatabaseService.findAllByRoomWithRelations.mockResolvedValue(
        [adminCharacter],
      );
      playerRevealDatabaseService.findByCharacterIds.mockResolvedValue(reveals);
    };

    it('returns a stable snapshot across two reconnects for the same user', async () => {
      wireHappyPath(inGameRoom());

      const first = await service.getSnapshot('ABCD', admin);
      const second = await service.getSnapshot('ABCD', admin);

      expect(first).toEqual(second);
      expect(first.myCharacter.id).toBe(adminCharacter.id);
      expect(first.version).toBe(3);
    });

    it('exposes per-player reveals on the players[] entries', async () => {
      const reveal: PlayerReveal = {
        id: 'reveal-1',
        playerCharacterId: adminCharacter.id,
        attribute: RevealAttributeEnum.AGE,
        traitId: null,
        createdAt: new Date('2026-05-17T20:01:00Z'),
        updatedAt: new Date('2026-05-17T20:01:00Z'),
      };

      wireHappyPath(inGameRoom(), [reveal]);

      const snapshot = await service.getSnapshot('ABCD', admin);
      const adminEntry = snapshot.players.find((p) => p.userId === 'admin');

      expect(adminEntry?.reveals).toEqual([
        {
          attribute: RevealAttributeEnum.AGE,
          biologyValue: { id: 'age-1', valueUk: '23 роки' },
          trait: null,
          revealedAt: reveal.createdAt.toISOString(),
        },
      ]);
    });

    it('returns a read-only snapshot when the room is FINISHED (post-mortem)', async () => {
      const finishedRoom = inGameRoom({
        status: RoomStatusEnum.FINISHED,
        finishedAt: new Date('2026-05-17T21:00:00Z'),
        version: 9,
      });

      wireHappyPath(finishedRoom);

      const snapshot = await service.getSnapshot('ABCD', admin);

      expect(snapshot.status).toBe(RoomStatusEnum.FINISHED);
      expect(snapshot.finishedAt).toBe('2026-05-17T21:00:00.000Z');
      expect(snapshot.version).toBe(9);
    });

    it('returns 404 when the room does not exist', async () => {
      roomDatabaseService.findByCodeWithGameRelations.mockResolvedValue(null);

      await expect(service.getSnapshot('ZZZZ', admin)).rejects.toBeInstanceOf(
        EntityNotFoundException,
      );
    });

    it('returns 403 when the caller is not a JOINED participant', async () => {
      wireHappyPath(inGameRoom());

      await expect(
        service.getSnapshot('ABCD', makeUser({ id: 'outsider' })),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('returns 409 when the room is in LOBBY (still pre-game)', async () => {
      wireHappyPath(inGameRoom({ status: RoomStatusEnum.LOBBY }));

      await expect(service.getSnapshot('ABCD', admin)).rejects.toBeInstanceOf(
        ConflictException,
      );
    });

    it('returns 404 when the caller has no character row', async () => {
      roomDatabaseService.findByCodeWithGameRelations.mockResolvedValue(
        inGameRoom(),
      );
      playerCharacterDatabaseService.findAllByRoomWithRelations.mockResolvedValue(
        [],
      );
      playerRevealDatabaseService.findByCharacterIds.mockResolvedValue([]);

      await expect(service.getSnapshot('ABCD', admin)).rejects.toBeInstanceOf(
        EntityNotFoundException,
      );
    });
  });

  describe('revealAttribute', () => {
    const admin = makeUser({ id: 'admin' });

    const wireSnapshotLookups = (room = inGameRoom()) => {
      roomDatabaseService.findByCodeWithGameRelations.mockResolvedValue(room);
      playerCharacterDatabaseService.findAllByRoomWithRelations.mockResolvedValue(
        [adminCharacter],
      );
      playerRevealDatabaseService.findByCharacterIds.mockResolvedValue([]);
    };

    it('persists a biology reveal, bumps room.version, and returns the snapshot', async () => {
      const lockedRoom = inGameRoom({ version: 5 });

      fakeManager.queryBuilder.getOne.mockResolvedValue(lockedRoom);
      fakeManager.findOne
        // 1) participant lookup (caller is JOINED)
        .mockResolvedValueOnce(makeParticipant({ userId: 'admin' }))
        // 2) character lookup with traits
        .mockResolvedValueOnce(adminCharacter)
        // 3) existing reveal idempotency check
        .mockResolvedValueOnce(null);
      wireSnapshotLookups(lockedRoom);

      const snapshot = await service.revealAttribute('ABCD', admin, {
        attribute: RevealAttributeEnum.AGE,
      });

      const revealSaves = fakeManager.save.mock.calls.filter(
        ([target]) => target === PlayerReveal,
      );
      const roomSaves = fakeManager.save.mock.calls.filter(
        ([target]) => target === Room,
      );

      expect(revealSaves).toHaveLength(1);
      expect(roomSaves).toHaveLength(1);
      expect(lockedRoom.version).toBe(6);
      expect(snapshot.code).toBe('ABCD');
    });

    it('is idempotent: re-revealing the same attribute does not save or bump version', async () => {
      const lockedRoom = inGameRoom({ version: 5 });
      const existing: PlayerReveal = {
        id: 'reveal-existing',
        playerCharacterId: adminCharacter.id,
        attribute: RevealAttributeEnum.AGE,
        traitId: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      fakeManager.queryBuilder.getOne.mockResolvedValue(lockedRoom);
      fakeManager.findOne
        .mockResolvedValueOnce(makeParticipant({ userId: 'admin' }))
        .mockResolvedValueOnce(adminCharacter)
        .mockResolvedValueOnce(existing);
      wireSnapshotLookups(lockedRoom);

      await service.revealAttribute('ABCD', admin, {
        attribute: RevealAttributeEnum.AGE,
      });

      expect(
        fakeManager.save.mock.calls.some(([target]) => target === PlayerReveal),
      ).toBe(false);
      expect(
        fakeManager.save.mock.calls.some(([target]) => target === Room),
      ).toBe(false);
      expect(lockedRoom.version).toBe(5);
    });

    it('requires traitId for multi-card slots (ACTION_CARD)', async () => {
      const lockedRoom = inGameRoom();

      fakeManager.queryBuilder.getOne.mockResolvedValue(lockedRoom);
      fakeManager.findOne
        .mockResolvedValueOnce(makeParticipant({ userId: 'admin' }))
        .mockResolvedValueOnce(adminCharacter);

      await expect(
        service.revealAttribute('ABCD', admin, {
          attribute: RevealAttributeEnum.ACTION_CARD,
        }),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('rejects an ACTION_CARD reveal whose traitId is not on the caller’s card', async () => {
      const lockedRoom = inGameRoom();

      fakeManager.queryBuilder.getOne.mockResolvedValue(lockedRoom);
      fakeManager.findOne
        .mockResolvedValueOnce(makeParticipant({ userId: 'admin' }))
        .mockResolvedValueOnce(adminCharacter);

      await expect(
        service.revealAttribute('ABCD', admin, {
          attribute: RevealAttributeEnum.ACTION_CARD,
          traitId: 'someone-elses-trait',
        }),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('accepts an ACTION_CARD reveal with a valid traitId', async () => {
      const lockedRoom = inGameRoom({ version: 5 });
      const ownedAction = adminCharacter.characterTraits!.find(
        (entry) => entry.trait!.kind === TraitKindEnum.ACTION_CARD,
      )!;

      fakeManager.queryBuilder.getOne.mockResolvedValue(lockedRoom);
      fakeManager.findOne
        .mockResolvedValueOnce(makeParticipant({ userId: 'admin' }))
        .mockResolvedValueOnce(adminCharacter)
        .mockResolvedValueOnce(null);
      wireSnapshotLookups(lockedRoom);

      await service.revealAttribute('ABCD', admin, {
        attribute: RevealAttributeEnum.ACTION_CARD,
        traitId: ownedAction.traitId,
      });

      expect(lockedRoom.version).toBe(6);

      const revealSave = fakeManager.save.mock.calls.find(
        ([target]) => target === PlayerReveal,
      )!;

      expect((revealSave[1] as PlayerReveal).traitId).toBe(ownedAction.traitId);
    });

    it('rejects a biology reveal that also passes a traitId', async () => {
      const lockedRoom = inGameRoom();

      fakeManager.queryBuilder.getOne.mockResolvedValue(lockedRoom);
      fakeManager.findOne
        .mockResolvedValueOnce(makeParticipant({ userId: 'admin' }))
        .mockResolvedValueOnce(adminCharacter);

      await expect(
        service.revealAttribute('ABCD', admin, {
          attribute: RevealAttributeEnum.AGE,
          traitId: 'whatever',
        }),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('rejects a reveal for a kind the player owns no cards of (CONDITION_CARD)', async () => {
      const lockedRoom = inGameRoom();

      fakeManager.queryBuilder.getOne.mockResolvedValue(lockedRoom);
      fakeManager.findOne
        .mockResolvedValueOnce(makeParticipant({ userId: 'admin' }))
        .mockResolvedValueOnce(adminCharacter);

      await expect(
        service.revealAttribute('ABCD', admin, {
          attribute: RevealAttributeEnum.CONDITION_CARD,
        }),
      ).rejects.toBeInstanceOf(ConflictException);
    });

    it('rejects reveal when the room is not IN_GAME (409)', async () => {
      const lockedRoom = inGameRoom({ status: RoomStatusEnum.FINISHED });

      fakeManager.queryBuilder.getOne.mockResolvedValue(lockedRoom);

      await expect(
        service.revealAttribute('ABCD', admin, {
          attribute: RevealAttributeEnum.AGE,
        }),
      ).rejects.toBeInstanceOf(ConflictException);
    });

    it('rejects reveal from a non-participant (403)', async () => {
      const lockedRoom = inGameRoom();

      fakeManager.queryBuilder.getOne.mockResolvedValue(lockedRoom);
      fakeManager.findOne.mockResolvedValueOnce(null);

      await expect(
        service.revealAttribute('ABCD', makeUser({ id: 'outsider' }), {
          attribute: RevealAttributeEnum.AGE,
        }),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('passes IsNull() when checking idempotency for biology (NULL traitId)', async () => {
      const lockedRoom = inGameRoom();

      fakeManager.queryBuilder.getOne.mockResolvedValue(lockedRoom);
      fakeManager.findOne
        .mockResolvedValueOnce(makeParticipant({ userId: 'admin' }))
        .mockResolvedValueOnce(adminCharacter)
        .mockResolvedValueOnce(null);
      wireSnapshotLookups(lockedRoom);

      await service.revealAttribute('ABCD', admin, {
        attribute: RevealAttributeEnum.AGE,
      });

      const idempotencyCall = fakeManager.findOne.mock.calls.find(
        ([target]) => target === PlayerReveal,
      )!;
      const where = (idempotencyCall[1] as { where: Record<string, unknown> })
        .where;

      // IsNull() returns a FindOperator instance; just check it's not a string.
      expect(where.traitId).toEqual(IsNull());
    });
  });
});
