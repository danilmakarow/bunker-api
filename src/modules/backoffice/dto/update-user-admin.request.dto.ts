import { ApiProperty } from '@nestjs/swagger';
import { IsBoolean } from 'class-validator';

/**
 * Body of PATCH /backoffice/users/:id — flips the admin role.
 */
export class UpdateUserAdminRequestDto {
  @ApiProperty({ example: true })
  @IsBoolean()
  isAdmin: boolean;
}
