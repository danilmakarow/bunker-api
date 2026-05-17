import { ApiProperty } from '@nestjs/swagger';

/**
 * Body of GET /auth/me — minimal identity surface the FE needs.
 */
export class MeResponseDto {
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
}
