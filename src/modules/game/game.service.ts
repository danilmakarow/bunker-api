import { Injectable } from '@nestjs/common';
import {
  DataSource,
  EntityManager,
  EntityTarget,
  FindOptionsWhere,
  IsNull,
} from 'typeorm';

import {
  BIOLOGY_REVEAL_ATTRIBUTES,
  TRAIT_DRAW_COUNTS,
  TRAIT_KIND_BY_REVEAL_ATTRIBUTE,
} from './constants/game.constants';
import {
  ApocalypseResponseDto,
  BiologyValueResponseDto,
  GamePlayerResponseDto,
  GameSnapshotResponseDto,
  MyCharacterResponseDto,
  RevealRequestDto,
  RevealedAttributeResponseDto,
  ShelterResponseDto,
  TraitResponseDto,
} from './dto';
import { weightedPick } from './utils/random.util';
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
  PlayerCharacterTrait,
  PlayerReveal,
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
import {
  ROOM_MAX_PARTICIPANTS,
  ROOM_MIN_PARTICIPANTS_TO_START,
} from '@/modules/rooms/constants/room.constants';
import { normaliseRoomCode } from '@/modules/rooms/utils/room-code.util';

interface SnapshotInputs {
  room: Room;
  myCharacter: PlayerCharacter;
  charactersByUserId: Map<string, PlayerCharacter>;
  revealsByCharacterId: Map<string, PlayerReveal[]>;
}

/**
 * Owns the game-start transaction, the polled /game snapshot, and the
 * reveal mutation. Pre-loads content/biology pools so character draws use
 * `crypto.randomInt` rather than `ORDER BY RANDOM()` per slot.
 */
@Injectable()
export class GameService {
  constructor(
    private readonly dataSource: DataSource,
    private readonly roomDatabaseService: RoomDatabaseService,
    private readonly playerCharacterDatabaseService: PlayerCharacterDatabaseService,
    private readonly playerRevealDatabaseService: PlayerRevealDatabaseService,
  ) {}

  /**
   * Locks the room row by code inside the current transaction (SELECT FOR UPDATE).
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
   * Loads every enabled+positive-weight row from a content table and draws one
   * via weighted random. Disabled rows (`enabled = false`) and zero-weight
   * rows are excluded. Throws 409 when nothing draws so a misconfigured pool
   * surfaces as a clear admin-facing error rather than a silent fallback.
   */
  private async pickWeighted<
    TEntity extends { id: string; enabled: boolean; weight: number },
  >(
    manager: EntityManager,
    target: EntityTarget<TEntity>,
    label: string,
  ): Promise<TEntity> {
    const pool = await manager.find(target, {
      where: { enabled: true } as FindOptionsWhere<TEntity>,
    });
    const eligible = pool.filter((row) => row.weight > 0);

    if (!eligible.length) {
      throw new ConflictException(
        `Content pool "${label}" has no enabled rows with weight > 0; cannot start the game.`,
      );
    }

    return weightedPick(eligible);
  }

  /**
   * Returns the enabled+positive-weight rows from a biology axis, or throws
   * 409 when nothing remains — the start-game caller relies on this for the
   * "every axis must have at least one drawable row" precondition.
   */
  private async loadBiologyPool<
    TEntity extends { id: string; enabled: boolean; weight: number },
  >(
    manager: EntityManager,
    target: EntityTarget<TEntity>,
    label: string,
  ): Promise<TEntity[]> {
    const pool = await manager.find(target, {
      where: { enabled: true } as FindOptionsWhere<TEntity>,
    });
    const eligible = pool.filter((row) => row.weight > 0);

    if (!eligible.length) {
      throw new ConflictException(
        `Biology axis "${label}" has no enabled rows with weight > 0; cannot start the game.`,
      );
    }

    return eligible;
  }

  /**
   * Groups enabled+positive-weight traits by kind for per-slot weighted draws.
   */
  private async loadTraitsByKind(
    manager: EntityManager,
  ): Promise<Record<TraitKindEnum, Trait[]>> {
    const all = await manager.find(Trait, { where: { enabled: true } });
    const byKind = {} as Record<TraitKindEnum, Trait[]>;

    for (const kind of Object.values(TraitKindEnum)) {
      byKind[kind] = [];
    }

    for (const trait of all) {
      if (trait.weight > 0) {
        byKind[trait.kind].push(trait);
      }
    }

    return byKind;
  }

  /**
   * Creates a PlayerCharacter and its trait rows for a single participant.
   * Every kind in `TRAIT_DRAW_COUNTS` must have at least one eligible card —
   * the precondition is checked once before any character is drawn.
   */
  private async drawCharacterForParticipant(
    manager: EntityManager,
    options: {
      roomId: string;
      participant: RoomParticipant;
      ageOptions: BiologyAge[];
      weightOptions: BiologyWeight[];
      sexOptions: BiologySex[];
      genderOptions: BiologyGender[];
      raceOptions: BiologyRace[];
      traitsByKind: Record<TraitKindEnum, Trait[]>;
    },
  ): Promise<PlayerCharacter> {
    const character = manager.create(PlayerCharacter, {
      roomId: options.roomId,
      userId: options.participant.userId,
      ageId: weightedPick(options.ageOptions).id,
      weightId: weightedPick(options.weightOptions).id,
      sexId: weightedPick(options.sexOptions).id,
      genderId: weightedPick(options.genderOptions).id,
      raceId: weightedPick(options.raceOptions).id,
    });

    await manager.save(PlayerCharacter, character);

    for (const [kind, count] of Object.entries(TRAIT_DRAW_COUNTS) as [
      TraitKindEnum,
      number,
    ][]) {
      const pool = options.traitsByKind[kind];

      for (let draw = 0; draw < count; draw += 1) {
        const trait = weightedPick(pool);
        const characterTrait = manager.create(PlayerCharacterTrait, {
          playerCharacterId: character.id,
          traitId: trait.id,
        });

        await manager.save(PlayerCharacterTrait, characterTrait);
      }
    }

    return character;
  }

  /**
   * Maps a fully-loaded biology entity to the wire DTO.
   */
  private toBiologyValue(
    entity: { id: string; valueUk: string } | undefined,
  ): BiologyValueResponseDto {
    if (!entity) {
      throw new Error('Missing biology relation while building game snapshot');
    }

    return { id: entity.id, valueUk: entity.valueUk };
  }

  private toApocalypse(apocalypse: Apocalypse): ApocalypseResponseDto {
    return {
      id: apocalypse.id,
      nameUk: apocalypse.nameUk,
      descriptionUk: apocalypse.descriptionUk,
      populationRemainderUk: apocalypse.populationRemainderUk,
      polarity: apocalypse.polarity,
    };
  }

  private toShelter(shelter: Shelter): ShelterResponseDto {
    return {
      id: shelter.id,
      areaUk: shelter.areaUk,
      locationUk: shelter.locationUk,
      durationUk: shelter.durationUk,
      equipmentUk: shelter.equipmentUk,
      suppliesUk: shelter.suppliesUk,
      polarity: shelter.polarity,
    };
  }

  private toTrait(trait: Trait): TraitResponseDto {
    return {
      id: trait.id,
      kind: trait.kind,
      polarity: trait.polarity,
      titleUk: trait.titleUk,
      descriptionUk: trait.descriptionUk,
    };
  }

  private toMyCharacter(character: PlayerCharacter): MyCharacterResponseDto {
    const traits = (character.characterTraits ?? [])
      .map((row) => row.trait)
      .filter((trait): trait is Trait => Boolean(trait))
      .map((trait) => this.toTrait(trait));

    return {
      id: character.id,
      age: this.toBiologyValue(character.age),
      weight: this.toBiologyValue(character.weight),
      sex: this.toBiologyValue(character.sex),
      gender: this.toBiologyValue(character.gender),
      race: this.toBiologyValue(character.race),
      traits,
    };
  }

  /**
   * Pulls the biology entity off the character for a given reveal attribute.
   * Throws for non-biology attributes so the caller's branching is explicit.
   */
  private getBiologyForAttribute(
    character: PlayerCharacter,
    attribute: RevealAttributeEnum,
  ): BiologyValueResponseDto {
    switch (attribute) {
      case RevealAttributeEnum.AGE:
        return this.toBiologyValue(character.age);
      case RevealAttributeEnum.WEIGHT:
        return this.toBiologyValue(character.weight);
      case RevealAttributeEnum.SEX:
        return this.toBiologyValue(character.sex);
      case RevealAttributeEnum.GENDER:
        return this.toBiologyValue(character.gender);
      case RevealAttributeEnum.RACE:
        return this.toBiologyValue(character.race);
      default:
        throw new Error(
          `getBiologyForAttribute called with non-biology attribute ${attribute}`,
        );
    }
  }

  /**
   * Maps a PlayerReveal row into the wire DTO. Biology reveals resolve the
   * biology value off the player's character; trait reveals serialise the
   * already-loaded trait.
   */
  private toRevealedAttribute(
    character: PlayerCharacter,
    reveal: PlayerReveal,
  ): RevealedAttributeResponseDto {
    const isBiology = BIOLOGY_REVEAL_ATTRIBUTES.has(reveal.attribute);

    return {
      attribute: reveal.attribute,
      biologyValue: isBiology
        ? this.getBiologyForAttribute(character, reveal.attribute)
        : null,
      trait: reveal.trait ? this.toTrait(reveal.trait) : null,
      revealedAt: reveal.createdAt.toISOString(),
    };
  }

  /**
   * Builds the per-player array. Each participant carries the reveals
   * that belong to their character (looked up by userId).
   */
  private toPlayers(
    room: Room,
    charactersByUserId: Map<string, PlayerCharacter>,
    revealsByCharacterId: Map<string, PlayerReveal[]>,
  ): GamePlayerResponseDto[] {
    return (room.participants ?? [])
      .slice()
      .sort((left, right) => left.seatNumber - right.seatNumber)
      .map((participant) => {
        const character = charactersByUserId.get(participant.userId);
        const reveals = character
          ? (revealsByCharacterId.get(character.id) ?? [])
          : [];

        return {
          userId: participant.userId,
          seatNumber: participant.seatNumber,
          name: participant.user?.name ?? '',
          avatarUrl: participant.user?.avatarUrl ?? null,
          isAdmin: participant.userId === room.adminUserId,
          status: participant.status,
          reveals: character
            ? reveals.map((reveal) =>
                this.toRevealedAttribute(character, reveal),
              )
            : [],
        };
      });
  }

  private buildSnapshot(inputs: SnapshotInputs): GameSnapshotResponseDto {
    const { room, myCharacter, charactersByUserId, revealsByCharacterId } =
      inputs;

    if (!room.apocalypse || !room.shelter || !room.startedAt) {
      throw new ConflictException(
        'Room is in IN_GAME/FINISHED state but is missing game data — corrupt state.',
      );
    }

    return {
      roomId: room.id,
      code: room.code,
      status: room.status,
      adminUserId: room.adminUserId,
      apocalypse: this.toApocalypse(room.apocalypse),
      shelter: this.toShelter(room.shelter),
      myCharacter: this.toMyCharacter(myCharacter),
      players: this.toPlayers(room, charactersByUserId, revealsByCharacterId),
      startedAt: room.startedAt.toISOString(),
      finishedAt: room.finishedAt ? room.finishedAt.toISOString() : null,
      version: room.version,
    };
  }

  /**
   * Groups reveals by their playerCharacterId — the snapshot mapper keys
   * into it once per player.
   */
  private groupRevealsByCharacterId(
    reveals: PlayerReveal[],
  ): Map<string, PlayerReveal[]> {
    const grouped = new Map<string, PlayerReveal[]>();

    for (const reveal of reveals) {
      const list = grouped.get(reveal.playerCharacterId) ?? [];

      list.push(reveal);
      grouped.set(reveal.playerCharacterId, list);
    }

    return grouped;
  }

  /**
   * Loads the snapshot inputs (room with relations + every character with
   * relations + every reveal) for an in-progress or finished room. Caller
   * must verify the user's participation status before invoking.
   */
  private async loadSnapshotInputs(
    code: string,
    user: User,
  ): Promise<SnapshotInputs> {
    const room =
      await this.roomDatabaseService.findByCodeWithGameRelations(code);

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

    if (
      room.status !== RoomStatusEnum.IN_GAME &&
      room.status !== RoomStatusEnum.FINISHED
    ) {
      throw new ConflictException(
        `Game snapshot is only available while the room is IN_GAME or FINISHED (current: ${room.status})`,
      );
    }

    const characters =
      await this.playerCharacterDatabaseService.findAllByRoomWithRelations(
        room.id,
      );
    const charactersByUserId = new Map(
      characters.map((character) => [character.userId, character]),
    );
    const myCharacter = charactersByUserId.get(user.id);

    if (!myCharacter) {
      throw new EntityNotFoundException(PlayerCharacter);
    }

    const reveals = await this.playerRevealDatabaseService.findByCharacterIds(
      characters.map((character) => character.id),
    );
    const revealsByCharacterId = this.groupRevealsByCharacterId(reveals);

    return { room, myCharacter, charactersByUserId, revealsByCharacterId };
  }

  /**
   * Admin starts the game. Transitions room LOBBY → IN_GAME, picks an
   * apocalypse + shelter, atomically generates a PlayerCharacter for every
   * JOINED participant, and bumps the room version (TASK.md §6).
   */
  async startGame(code: string, admin: User): Promise<GameSnapshotResponseDto> {
    const normalisedCode = normaliseRoomCode(code);

    return this.dataSource.transaction(async (manager) => {
      const room = await this.lockRoomByCode(manager, normalisedCode);

      if (room.adminUserId !== admin.id) {
        throw new ForbiddenException('Only the room admin can start the game.');
      }

      if (room.status !== RoomStatusEnum.LOBBY) {
        throw new ConflictException(
          `Cannot start a room in status ${room.status}`,
        );
      }

      const joinedParticipants = await manager.find(RoomParticipant, {
        where: { roomId: room.id, status: ParticipantStatusEnum.JOINED },
        order: { seatNumber: 'ASC' },
      });

      if (joinedParticipants.length < ROOM_MIN_PARTICIPANTS_TO_START) {
        throw new ConflictException(
          `Need at least ${ROOM_MIN_PARTICIPANTS_TO_START} players to start; have ${joinedParticipants.length}.`,
        );
      }

      if (joinedParticipants.length > ROOM_MAX_PARTICIPANTS) {
        throw new ConflictException(
          `Room exceeds the ${ROOM_MAX_PARTICIPANTS}-player cap.`,
        );
      }

      const apocalypse = await this.pickWeighted(
        manager,
        Apocalypse,
        'apocalypse',
      );
      const shelter = await this.pickWeighted(manager, Shelter, 'shelter');
      const [
        ageOptions,
        weightOptions,
        sexOptions,
        genderOptions,
        raceOptions,
      ] = await Promise.all([
        this.loadBiologyPool(manager, BiologyAge, 'biology_age'),
        this.loadBiologyPool(manager, BiologyWeight, 'biology_weight'),
        this.loadBiologyPool(manager, BiologySex, 'biology_sex'),
        this.loadBiologyPool(manager, BiologyGender, 'biology_gender'),
        this.loadBiologyPool(manager, BiologyRace, 'biology_race'),
      ]);

      const traitsByKind = await this.loadTraitsByKind(manager);

      for (const [kind, count] of Object.entries(TRAIT_DRAW_COUNTS) as [
        TraitKindEnum,
        number,
      ][]) {
        if (count > 0 && !traitsByKind[kind]?.length) {
          throw new ConflictException(
            `Trait pool "${kind}" has no enabled rows with weight > 0; cannot start the game.`,
          );
        }
      }
      const adminParticipant = joinedParticipants.find(
        (participant) => participant.userId === admin.id,
      );

      if (!adminParticipant) {
        throw new ConflictException(
          'Admin is not currently JOINED in this room; cannot start.',
        );
      }

      for (const participant of joinedParticipants) {
        await this.drawCharacterForParticipant(manager, {
          roomId: room.id,
          participant,
          ageOptions,
          weightOptions,
          sexOptions,
          genderOptions,
          raceOptions,
          traitsByKind,
        });
      }

      room.status = RoomStatusEnum.IN_GAME;
      room.apocalypseId = apocalypse.id;
      room.shelterId = shelter.id;
      room.startedAt = new Date();
      room.version += 1;
      await manager.save(Room, room);

      const characters = await manager.find(PlayerCharacter, {
        where: { roomId: room.id },
        relations: {
          age: true,
          weight: true,
          sex: true,
          gender: true,
          race: true,
          characterTraits: { trait: true },
        },
      });
      const charactersByUserId = new Map(
        characters.map((character) => [character.userId, character]),
      );
      const myCharacter = charactersByUserId.get(admin.id);
      const roomWithRelations = await manager.findOne(Room, {
        where: { id: room.id },
        relations: {
          apocalypse: true,
          shelter: true,
          participants: { user: true },
        },
      });

      if (!myCharacter || !roomWithRelations) {
        throw new ConflictException('Failed to load freshly-started game.');
      }

      return this.buildSnapshot({
        room: roomWithRelations,
        myCharacter,
        charactersByUserId,
        revealsByCharacterId: new Map(),
      });
    });
  }

  /**
   * Polled by the FE every ~1s while in game. Returns the same payload for
   * FINISHED rooms (read-only post-mortem) so the FE can keep rendering the
   * board after the admin ends the round. Always reflects the latest reveals.
   */
  async getSnapshot(
    code: string,
    user: User,
  ): Promise<GameSnapshotResponseDto> {
    const normalisedCode = normaliseRoomCode(code);
    const inputs = await this.loadSnapshotInputs(normalisedCode, user);

    return this.buildSnapshot(inputs);
  }

  /**
   * Cheap poll probe for the game snapshot: resolves the current version
   * without loading the character/reveal graph, so an unchanged poll can
   * short-circuit to 304. Enforces the same membership access check as the
   * full snapshot; the IN_GAME/FINISHED status and character preconditions
   * held when the caller obtained the matching ETag and any change to them
   * bumps the version, so a version match is sufficient to serve a 304.
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
   * Reveals one of the caller's own attributes (TASK.md §3.5 / §4.3).
   * Idempotent: if the same (attribute, traitId) was already revealed the
   * existing row is reused and the room version stays put.
   */
  async revealAttribute(
    code: string,
    user: User,
    body: RevealRequestDto,
  ): Promise<GameSnapshotResponseDto> {
    const normalisedCode = normaliseRoomCode(code);

    await this.dataSource.transaction(async (manager) => {
      const room = await this.lockRoomByCode(manager, normalisedCode);

      if (room.status !== RoomStatusEnum.IN_GAME) {
        throw new ConflictException(
          `Reveals are only allowed while the room is IN_GAME (current: ${room.status})`,
        );
      }

      const callerParticipant = await manager.findOne(RoomParticipant, {
        where: { roomId: room.id, userId: user.id },
      });

      if (
        !callerParticipant ||
        callerParticipant.status !== ParticipantStatusEnum.JOINED
      ) {
        throw new ForbiddenException('You are not a participant of this room.');
      }

      const character = await manager.findOne(PlayerCharacter, {
        where: { roomId: room.id, userId: user.id },
        relations: { characterTraits: { trait: true } },
      });

      if (!character) {
        throw new EntityNotFoundException(PlayerCharacter);
      }

      const resolvedTraitId = this.resolveRevealTraitId(character, body);

      const existing = await manager.findOne(PlayerReveal, {
        where: {
          playerCharacterId: character.id,
          attribute: body.attribute,
          traitId: resolvedTraitId === null ? IsNull() : resolvedTraitId,
        },
      });

      if (existing) {
        return;
      }

      const reveal = manager.create(PlayerReveal, {
        playerCharacterId: character.id,
        attribute: body.attribute,
        traitId: resolvedTraitId,
      });

      await manager.save(PlayerReveal, reveal);

      room.version += 1;
      await manager.save(Room, room);
    });

    return this.getSnapshot(code, user);
  }

  /**
   * Validates the caller actually owns the attribute they're revealing.
   * - Biology attributes: traitId must be absent.
   * - Single-card trait kinds: traitId is optional; when provided it must match.
   * - Multi-card trait kinds (currently only ACTION_CARD): traitId is required
   *   and must match one of the player's owned cards.
   * Returns the traitId to persist (null for biology, the card's id otherwise).
   */
  private resolveRevealTraitId(
    character: PlayerCharacter,
    body: RevealRequestDto,
  ): string | null {
    if (BIOLOGY_REVEAL_ATTRIBUTES.has(body.attribute)) {
      if (body.traitId) {
        throw new BadRequestException(
          'traitId must not be provided for biology attribute reveals.',
        );
      }

      return null;
    }

    const traitKind = TRAIT_KIND_BY_REVEAL_ATTRIBUTE[body.attribute];

    if (!traitKind) {
      throw new BadRequestException(
        `Attribute ${body.attribute} is not revealable.`,
      );
    }

    const ownedCards = (character.characterTraits ?? []).filter(
      (card) => card.trait?.kind === traitKind,
    );

    if (!ownedCards.length) {
      throw new ConflictException(
        `You do not own any ${traitKind} cards to reveal.`,
      );
    }

    if (ownedCards.length > 1 && !body.traitId) {
      throw new BadRequestException(
        `traitId is required for multi-card slots (${traitKind}).`,
      );
    }

    if (body.traitId) {
      const match = ownedCards.find((card) => card.traitId === body.traitId);

      if (!match) {
        throw new ForbiddenException('You do not own that trait card.');
      }

      return match.traitId;
    }

    return ownedCards[0].traitId;
  }
}
