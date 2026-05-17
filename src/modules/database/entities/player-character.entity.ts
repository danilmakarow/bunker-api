import { ApiProperty } from '@nestjs/swagger';
import {
  Column,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  OneToMany,
} from 'typeorm';

import { BaseEntity } from './base.entity';
import { BiologyAge } from './biology-age.entity';
import { BiologyGender } from './biology-gender.entity';
import { BiologyRace } from './biology-race.entity';
import { BiologySex } from './biology-sex.entity';
import { BiologyWeight } from './biology-weight.entity';
import { PlayerCharacterTrait } from './player-character-trait.entity';
import { Room } from './room.entity';
import { User } from './user.entity';

/**
 * A player's drawn character in a single room. One row per (roomId, userId)
 * created inside the game-start transaction; the same row is returned on
 * reconnects so the snapshot is stable for the whole run.
 */
@Index('IDX_player_character_room_user', ['roomId', 'userId'], { unique: true })
@Entity('player_character')
export class PlayerCharacter extends BaseEntity {
  @Column({ type: 'uuid' })
  @ApiProperty({ format: 'uuid' })
  roomId: string;

  @ManyToOne(() => Room)
  @JoinColumn({ name: 'roomId' })
  room?: Room;

  @Column({ type: 'uuid' })
  @ApiProperty({ format: 'uuid' })
  userId: string;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'userId' })
  user?: User;

  @Column({ type: 'uuid' })
  @ApiProperty({ format: 'uuid' })
  ageId: string;

  @ManyToOne(() => BiologyAge)
  @JoinColumn({ name: 'ageId' })
  age?: BiologyAge;

  @Column({ type: 'uuid' })
  @ApiProperty({ format: 'uuid' })
  weightId: string;

  @ManyToOne(() => BiologyWeight)
  @JoinColumn({ name: 'weightId' })
  weight?: BiologyWeight;

  @Column({ type: 'uuid' })
  @ApiProperty({ format: 'uuid' })
  sexId: string;

  @ManyToOne(() => BiologySex)
  @JoinColumn({ name: 'sexId' })
  sex?: BiologySex;

  @Column({ type: 'uuid' })
  @ApiProperty({ format: 'uuid' })
  genderId: string;

  @ManyToOne(() => BiologyGender)
  @JoinColumn({ name: 'genderId' })
  gender?: BiologyGender;

  @Column({ type: 'uuid' })
  @ApiProperty({ format: 'uuid' })
  raceId: string;

  @ManyToOne(() => BiologyRace)
  @JoinColumn({ name: 'raceId' })
  race?: BiologyRace;

  @OneToMany(() => PlayerCharacterTrait, (trait) => trait.playerCharacter)
  characterTraits?: PlayerCharacterTrait[];
}
