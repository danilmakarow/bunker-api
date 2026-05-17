import { Controller, Get } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';

import { Public } from '@/modules/auth/decorators/public.decorator';

@ApiTags('Health')
@Controller()
export class AppController {
  /**
   * Liveness probe.
   */
  @Public()
  @Get('health')
  getHealth() {
    return { status: 'ok' };
  }
}
