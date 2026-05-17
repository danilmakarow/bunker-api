import { ApiProperty } from '@nestjs/swagger';
import { Column, Entity, Index } from 'typeorm';

import { BaseEntity } from './base.entity';

/**
 * Authenticated player. We only carry what Google gives us at OAuth time —
 * the profile fields are refreshed on each login so a renamed Google account
 * propagates the next time the user signs in.
 */
@Entity('user')
export class User extends BaseEntity {
  @Index({ unique: true })
  @Column()
  @ApiProperty({ example: '110001234567890123456' })
  googleId: string;

  @Index({ unique: true })
  @Column()
  @ApiProperty({ example: 'player@example.com' })
  email: string;

  @Column()
  @ApiProperty({ example: 'Player One' })
  name: string;

  @Column({ type: 'varchar', nullable: true })
  @ApiProperty({ example: 'https://example.com/avatar.jpg', nullable: true })
  avatarUrl: string | null;

  @Column({ type: 'boolean', default: false })
  @ApiProperty({ example: false })
  isAdmin: boolean;
}
