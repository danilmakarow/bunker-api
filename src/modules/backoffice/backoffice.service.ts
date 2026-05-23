import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DeepPartial, Repository } from 'typeorm';

import {
  BackofficeApocalypseResponseDto,
  BackofficeBiologyResponseDto,
  BackofficeShelterResponseDto,
  BackofficeTraitResponseDto,
  BackofficeUserResponseDto,
  CreateApocalypseRequestDto,
  CreateBiologyRequestDto,
  CreateShelterRequestDto,
  CreateTraitRequestDto,
  UpdateApocalypseRequestDto,
  UpdateBiologyRequestDto,
  UpdateShelterRequestDto,
  UpdateTraitRequestDto,
} from './dto';
import { EntityNotFoundException } from '@/exceptions/entity-not-found.exception';
import {
  Apocalypse,
  BiologyAge,
  BiologyGender,
  BiologyRace,
  BiologySex,
  BiologyWeight,
  ContentEntity,
  Shelter,
  Trait,
  User,
} from '@/modules/database/entities';
import { UserDatabaseService } from '@/modules/database/services';

/**
 * CRUD surface for the backoffice. All routes are gated by `AdminGuard` at the
 * controller layer, so every method here can assume the caller is an admin.
 *
 * Bypasses the per-entity DatabaseService pattern because each content
 * entity needs the same boilerplate CRUD — keeping it inline here is cheaper
 * than fanning out 8 redundant Repository/DatabaseService pairs.
 */
@Injectable()
export class BackofficeService {
  constructor(
    @InjectRepository(Apocalypse)
    private readonly apocalypseRepository: Repository<Apocalypse>,
    @InjectRepository(Shelter)
    private readonly shelterRepository: Repository<Shelter>,
    @InjectRepository(Trait)
    private readonly traitRepository: Repository<Trait>,
    @InjectRepository(BiologyAge)
    private readonly biologyAgeRepository: Repository<BiologyAge>,
    @InjectRepository(BiologyWeight)
    private readonly biologyWeightRepository: Repository<BiologyWeight>,
    @InjectRepository(BiologySex)
    private readonly biologySexRepository: Repository<BiologySex>,
    @InjectRepository(BiologyGender)
    private readonly biologyGenderRepository: Repository<BiologyGender>,
    @InjectRepository(BiologyRace)
    private readonly biologyRaceRepository: Repository<BiologyRace>,
    private readonly userDatabaseService: UserDatabaseService,
  ) {}

  private toUser(user: User): BackofficeUserResponseDto {
    return {
      id: user.id,
      name: user.name,
      email: user.email,
      avatarUrl: user.avatarUrl,
      isAdmin: user.isAdmin,
      createdAt: user.createdAt.toISOString(),
    };
  }

  /**
   * Applies the create-DTO's enabled/weight defaults when the admin left them
   * unset. New rows are enabled with weight 1 unless overridden.
   */
  private applyDefaults<TPayload extends { enabled?: boolean; weight?: number }>(
    payload: TPayload,
  ): TPayload & { enabled: boolean; weight: number } {
    return {
      ...payload,
      enabled: payload.enabled ?? true,
      weight: payload.weight ?? 1,
    };
  }

  /**
   * Generic content CRUD on top of any repository whose entity extends
   * `ContentEntity`. Each entity-specific method delegates to these helpers.
   */
  private async listContent<TEntity extends ContentEntity>(
    repository: Repository<TEntity>,
  ): Promise<TEntity[]> {
    return repository.find({
      order: { createdAt: 'DESC' } as never,
    });
  }

  private async createContent<TEntity extends ContentEntity>(
    repository: Repository<TEntity>,
    payload: DeepPartial<TEntity>,
  ): Promise<TEntity> {
    const created = repository.create(payload);
    const saved = await repository.save(created as unknown as TEntity);

    return saved;
  }

  private async updateContent<TEntity extends ContentEntity>(
    repository: Repository<TEntity>,
    id: string,
    payload: DeepPartial<TEntity>,
  ): Promise<TEntity> {
    const existing = await repository.findOne({
      where: { id } as never,
    });

    if (!existing) {
      throw new EntityNotFoundException(repository.target);
    }

    const merged = repository.merge(existing, payload);
    const saved = await repository.save(merged as unknown as TEntity);

    return saved;
  }

  private async deleteContent<TEntity extends ContentEntity>(
    repository: Repository<TEntity>,
    id: string,
  ): Promise<void> {
    const result = await repository.delete(id);

    if (!result.affected) {
      throw new EntityNotFoundException(repository.target);
    }
  }

  // ──────────────────────────────────────────────────────────────────────────
  // Users
  // ──────────────────────────────────────────────────────────────────────────

  async listUsers(): Promise<BackofficeUserResponseDto[]> {
    const users = await this.userDatabaseService.findAll({
      order: { createdAt: 'DESC' },
    });

    return users.map((user) => this.toUser(user));
  }

  async setUserAdmin(
    userId: string,
    isAdmin: boolean,
  ): Promise<BackofficeUserResponseDto> {
    const user = await this.userDatabaseService.findOneBy({ id: userId });

    if (!user) {
      throw new EntityNotFoundException(User);
    }

    const updated = await this.userDatabaseService.update(user, { isAdmin });

    return this.toUser(updated);
  }

  // ──────────────────────────────────────────────────────────────────────────
  // Apocalypses
  // ──────────────────────────────────────────────────────────────────────────

  private toApocalypse(
    entity: Apocalypse,
  ): BackofficeApocalypseResponseDto {
    return {
      id: entity.id,
      nameUk: entity.nameUk,
      descriptionUk: entity.descriptionUk,
      populationRemainderUk: entity.populationRemainderUk,
      polarity: entity.polarity,
      enabled: entity.enabled,
      weight: entity.weight,
      createdAt: entity.createdAt.toISOString(),
      updatedAt: entity.updatedAt.toISOString(),
    };
  }

  async listApocalypses(): Promise<BackofficeApocalypseResponseDto[]> {
    const rows = await this.listContent(this.apocalypseRepository);

    return rows.map((row) => this.toApocalypse(row));
  }

  async createApocalypse(
    body: CreateApocalypseRequestDto,
  ): Promise<BackofficeApocalypseResponseDto> {
    const saved = await this.createContent<Apocalypse>(
      this.apocalypseRepository,
      this.applyDefaults(body),
    );

    return this.toApocalypse(saved);
  }

  async updateApocalypse(
    id: string,
    body: UpdateApocalypseRequestDto,
  ): Promise<BackofficeApocalypseResponseDto> {
    const saved = await this.updateContent<Apocalypse>(
      this.apocalypseRepository,
      id,
      body,
    );

    return this.toApocalypse(saved);
  }

  async deleteApocalypse(id: string): Promise<void> {
    await this.deleteContent(this.apocalypseRepository, id);
  }

  // ──────────────────────────────────────────────────────────────────────────
  // Shelters
  // ──────────────────────────────────────────────────────────────────────────

  private toShelter(entity: Shelter): BackofficeShelterResponseDto {
    return {
      id: entity.id,
      areaUk: entity.areaUk,
      locationUk: entity.locationUk,
      durationUk: entity.durationUk,
      equipmentUk: entity.equipmentUk,
      suppliesUk: entity.suppliesUk,
      polarity: entity.polarity,
      enabled: entity.enabled,
      weight: entity.weight,
      createdAt: entity.createdAt.toISOString(),
      updatedAt: entity.updatedAt.toISOString(),
    };
  }

  async listShelters(): Promise<BackofficeShelterResponseDto[]> {
    const rows = await this.listContent(this.shelterRepository);

    return rows.map((row) => this.toShelter(row));
  }

  async createShelter(
    body: CreateShelterRequestDto,
  ): Promise<BackofficeShelterResponseDto> {
    const saved = await this.createContent<Shelter>(
      this.shelterRepository,
      this.applyDefaults(body),
    );

    return this.toShelter(saved);
  }

  async updateShelter(
    id: string,
    body: UpdateShelterRequestDto,
  ): Promise<BackofficeShelterResponseDto> {
    const saved = await this.updateContent<Shelter>(
      this.shelterRepository,
      id,
      body,
    );

    return this.toShelter(saved);
  }

  async deleteShelter(id: string): Promise<void> {
    await this.deleteContent(this.shelterRepository, id);
  }

  // ──────────────────────────────────────────────────────────────────────────
  // Traits
  // ──────────────────────────────────────────────────────────────────────────

  private toTrait(entity: Trait): BackofficeTraitResponseDto {
    return {
      id: entity.id,
      kind: entity.kind,
      polarity: entity.polarity,
      titleUk: entity.titleUk,
      descriptionUk: entity.descriptionUk,
      enabled: entity.enabled,
      weight: entity.weight,
      createdAt: entity.createdAt.toISOString(),
      updatedAt: entity.updatedAt.toISOString(),
    };
  }

  async listTraits(): Promise<BackofficeTraitResponseDto[]> {
    const rows = await this.traitRepository.find({
      order: { kind: 'ASC', createdAt: 'DESC' },
    });

    return rows.map((row) => this.toTrait(row));
  }

  async createTrait(
    body: CreateTraitRequestDto,
  ): Promise<BackofficeTraitResponseDto> {
    const saved = await this.createContent<Trait>(
      this.traitRepository,
      this.applyDefaults(body),
    );

    return this.toTrait(saved);
  }

  async updateTrait(
    id: string,
    body: UpdateTraitRequestDto,
  ): Promise<BackofficeTraitResponseDto> {
    const saved = await this.updateContent<Trait>(
      this.traitRepository,
      id,
      body,
    );

    return this.toTrait(saved);
  }

  async deleteTrait(id: string): Promise<void> {
    await this.deleteContent(this.traitRepository, id);
  }

  // ──────────────────────────────────────────────────────────────────────────
  // Biology axes (5 entities — same shape)
  // ──────────────────────────────────────────────────────────────────────────

  private toBiology<
    TEntity extends ContentEntity & { valueUk: string },
  >(entity: TEntity): BackofficeBiologyResponseDto {
    return {
      id: entity.id,
      valueUk: entity.valueUk,
      enabled: entity.enabled,
      weight: entity.weight,
      createdAt: entity.createdAt.toISOString(),
      updatedAt: entity.updatedAt.toISOString(),
    };
  }

  private biologyRepository(
    axis: BiologyAxis,
  ): Repository<
    BiologyAge | BiologyWeight | BiologySex | BiologyGender | BiologyRace
  > {
    switch (axis) {
      case 'ages':
        return this.biologyAgeRepository;
      case 'weights':
        return this.biologyWeightRepository;
      case 'sexes':
        return this.biologySexRepository;
      case 'genders':
        return this.biologyGenderRepository;
      case 'races':
        return this.biologyRaceRepository;
    }
  }

  async listBiology(axis: BiologyAxis): Promise<BackofficeBiologyResponseDto[]> {
    const rows = await this.biologyRepository(axis).find({
      order: { createdAt: 'DESC' },
    });

    return rows.map((row) => this.toBiology(row));
  }

  async createBiology(
    axis: BiologyAxis,
    body: CreateBiologyRequestDto,
  ): Promise<BackofficeBiologyResponseDto> {
    const repository = this.biologyRepository(axis);
    const created = repository.create(this.applyDefaults(body));
    const saved = await repository.save(created);

    return this.toBiology(saved);
  }

  async updateBiology(
    axis: BiologyAxis,
    id: string,
    body: UpdateBiologyRequestDto,
  ): Promise<BackofficeBiologyResponseDto> {
    const repository = this.biologyRepository(axis);
    const existing = await repository.findOne({ where: { id } });

    if (!existing) {
      throw new EntityNotFoundException(repository.target);
    }

    const merged = repository.merge(existing, body);
    const saved = await repository.save(merged);

    return this.toBiology(saved);
  }

  async deleteBiology(axis: BiologyAxis, id: string): Promise<void> {
    const repository = this.biologyRepository(axis);
    const result = await repository.delete(id);

    if (!result.affected) {
      throw new EntityNotFoundException(repository.target);
    }
  }
}

/**
 * URL slug for each biology axis. Mirrored on the FE so the same string is the
 * route param and the API path segment.
 */
export type BiologyAxis = 'ages' | 'weights' | 'sexes' | 'genders' | 'races';

export const BIOLOGY_AXES: readonly BiologyAxis[] = [
  'ages',
  'weights',
  'sexes',
  'genders',
  'races',
] as const;
