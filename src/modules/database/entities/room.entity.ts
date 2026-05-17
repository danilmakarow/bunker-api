import { ApiProperty } from '@nestjs/swagger';
import {
  Column,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  OneToMany,
} from 'typeorm';

import { Apocalypse } from './apocalypse.entity';
import { BaseEntity } from './base.entity';
import { RoomStatusEnum } from './enums/room-status.enum';
import { RoomParticipant } from './room-participant.entity';
import { Shelter } from './shelter.entity';
import { User } from './user.entity';

/**
 * A game session container. Codes are 4 uppercase letters A–Z; lifecycle is
 * managed by RoomsService. apocalypseId / shelterId are picked atomically
 * when the admin starts the game (TASK.md §6).
 */
@Entity('room')
export class Room extends BaseEntity {
  @Index({ unique: true })
  @Column({ type: 'char', length: 4 })
  @ApiProperty({ example: 'ABCD' })
  code: string;

  @Column({
    type: 'enum',
    enum: RoomStatusEnum,
    default: RoomStatusEnum.LOBBY,
  })
  @ApiProperty({ enum: RoomStatusEnum, example: RoomStatusEnum.LOBBY })
  status: RoomStatusEnum;

  @Column({ type: 'uuid' })
  @ApiProperty({ format: 'uuid' })
  adminUserId: string;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'adminUserId' })
  adminUser?: User;

  @Column({ type: 'uuid', nullable: true })
  @ApiProperty({ nullable: true, format: 'uuid' })
  apocalypseId: string | null;

  @ManyToOne(() => Apocalypse)
  @JoinColumn({ name: 'apocalypseId' })
  apocalypse?: Apocalypse | null;

  @Column({ type: 'uuid', nullable: true })
  @ApiProperty({ nullable: true, format: 'uuid' })
  shelterId: string | null;

  @ManyToOne(() => Shelter)
  @JoinColumn({ name: 'shelterId' })
  shelter?: Shelter | null;

  @Column({ type: 'timestamp', nullable: true })
  @ApiProperty({ nullable: true, example: null })
  startedAt: Date | null;

  @Column({ type: 'timestamp', nullable: true })
  @ApiProperty({ nullable: true, example: null })
  finishedAt: Date | null;

  /**
   * Monotonically-increasing revision counter. Bumped by every mutation
   * (create/join/leave/kick/start/reveal/finish). Serialised as the `ETag`
   * header on polled snapshots so the FE can short-circuit unchanged polls
   * with `If-None-Match`.
   */
  @Column({ type: 'int', default: 1 })
  @ApiProperty({ example: 1 })
  version: number;

  @OneToMany(() => RoomParticipant, (participant) => participant.room)
  participants?: RoomParticipant[];
}
