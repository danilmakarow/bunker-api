import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import {
  Apocalypse,
  BiologyAge,
  BiologyGender,
  BiologyRace,
  BiologySex,
  BiologyWeight,
  PlayerCharacter,
  PlayerCharacterTrait,
  PlayerReveal,
  Room,
  RoomParticipant,
  Shelter,
  Trait,
  User,
} from './entities';
import {
  PlayerCharacterRepository,
  PlayerRevealRepository,
  RoomParticipantRepository,
  RoomRepository,
  UserRepository,
} from './repositories';
import {
  PlayerCharacterDatabaseService,
  PlayerRevealDatabaseService,
  RoomDatabaseService,
  RoomParticipantDatabaseService,
  UserDatabaseService,
} from './services';

/**
 * Centralised data-access module.
 * Exports DatabaseService classes only — entities and repositories stay private.
 */
@Module({
  imports: [
    TypeOrmModule.forFeature([
      User,
      Room,
      RoomParticipant,
      Apocalypse,
      Shelter,
      BiologyAge,
      BiologyWeight,
      BiologySex,
      BiologyGender,
      BiologyRace,
      Trait,
      PlayerCharacter,
      PlayerCharacterTrait,
      PlayerReveal,
    ]),
  ],
  providers: [
    UserRepository,
    UserDatabaseService,
    RoomRepository,
    RoomDatabaseService,
    RoomParticipantRepository,
    RoomParticipantDatabaseService,
    PlayerCharacterRepository,
    PlayerCharacterDatabaseService,
    PlayerRevealRepository,
    PlayerRevealDatabaseService,
  ],
  exports: [
    UserDatabaseService,
    RoomDatabaseService,
    RoomParticipantDatabaseService,
    PlayerCharacterDatabaseService,
    PlayerRevealDatabaseService,
  ],
})
export class DatabaseModule {}
