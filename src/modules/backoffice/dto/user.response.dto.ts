import { ApiProperty } from '@nestjs/swagger';

/**
 * Backoffice view of a User row. Includes `isAdmin` so the admin UI can
 * toggle it; never reaches non-admin callers because every backoffice route
 * is fronted by `AdminGuard`.
 */
export class BackofficeUserResponseDto {
  @ApiProperty({ format: 'uuid' })
  id: string;

  @ApiProperty({ example: 'Player One' })
  name: string;

  @ApiProperty({ example: 'player@example.com' })
  email: string;

  @ApiProperty({ example: 'https://example.com/avatar.jpg', nullable: true })
  avatarUrl: string | null;

  @ApiProperty({ example: false })
  isAdmin: boolean;

  @ApiProperty({ example: '2026-05-16T12:34:56.000Z' })
  createdAt: string;
}
