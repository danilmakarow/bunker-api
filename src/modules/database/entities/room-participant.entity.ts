import { ApiProperty } from '@nestjs/swagger';
import { Column, Entity, Index, JoinColumn, ManyToOne } from 'typeorm';

import { BaseEntity } from './base.entity';
import { ParticipantStatusEnum } from './enums/participant-status.enum';
import { Room } from './room.entity';
import { User } from './user.entity';

/**
 * Single user's seat in a single room. Kept soft-deleted: status flips between
 * JOINED <-> LEFT (rejoin allowed); KICKED is terminal. seatNumber is stable
 * for the same JOINED stint and may change on rejoin if the prior seat was reused.
 */
@Index('IDX_room_participant_room_user', ['roomId', 'userId'], { unique: true })
@Entity('room_participant')
export class RoomParticipant extends BaseEntity {
  @Column({ type: 'uuid' })
  @ApiProperty({ format: 'uuid' })
  roomId: string;

  @ManyToOne(() => Room, (room) => room.participants)
  @JoinColumn({ name: 'roomId' })
  room?: Room;

  @Column({ type: 'uuid' })
  @ApiProperty({ format: 'uuid' })
  userId: string;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'userId' })
  user?: User;

  @Column({ type: 'int' })
  @ApiProperty({ minimum: 1, maximum: 22, example: 1 })
  seatNumber: number;

  @Column({
    type: 'enum',
    enum: ParticipantStatusEnum,
    default: ParticipantStatusEnum.JOINED,
  })
  @ApiProperty({ enum: ParticipantStatusEnum })
  status: ParticipantStatusEnum;

  @Column({ type: 'timestamp' })
  @ApiProperty()
  joinedAt: Date;

  @Column({ type: 'timestamp', nullable: true })
  @ApiProperty({ nullable: true, example: null })
  leftAt: Date | null;
}
