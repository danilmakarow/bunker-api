import { ApiProperty } from '@nestjs/swagger';
import {
  CreateDateColumn,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

/**
 * Base TypeORM entity with UUID primary key and audit timestamps.
 * All Bunker entities (User, Room, Trait, …) extend this.
 */
export abstract class BaseEntity {
  @PrimaryGeneratedColumn('uuid')
  @ApiProperty({ format: 'uuid' })
  id: string;

  @CreateDateColumn()
  @ApiProperty({ example: '2026-05-16T12:34:56.000Z' })
  createdAt: Date;

  @UpdateDateColumn()
  @ApiProperty({ example: '2026-05-16T12:34:56.000Z' })
  updatedAt: Date;
}
