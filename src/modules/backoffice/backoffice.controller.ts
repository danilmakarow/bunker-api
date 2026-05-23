import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import {
  ApiCreatedResponse,
  ApiNoContentResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';

import {
  BackofficeService,
  BiologyAxis,
  BIOLOGY_AXES,
} from './backoffice.service';
import {
  BackofficeApocalypseResponseDto,
  BackofficeBiologyResponseDto,
  BackofficeShelterResponseDto,
  BackofficeTraitResponseDto,
  BackofficeUserResponseDto,
  CreateApocalypseRequestDto,
  CreateBiologyRequestDto,
  CreateShelterRequestDto,
  CreateTraitRequestDto,
  UpdateApocalypseRequestDto,
  UpdateBiologyRequestDto,
  UpdateShelterRequestDto,
  UpdateTraitRequestDto,
  UpdateUserAdminRequestDto,
} from './dto';
import { BadRequestException } from '@/exceptions/bad-request.exception';
import { AdminGuard } from '@/modules/auth/guards/admin.guard';

/**
 * All routes mounted under `/api/backoffice` and gated by `AdminGuard`. The
 * global `CookieJwtGuard` runs first so by the time we hit this controller
 * we already have a logged-in user; `AdminGuard` rejects non-admins with 403.
 */
@ApiTags('Backoffice')
@UseGuards(AdminGuard)
@Controller('backoffice')
export class BackofficeController {
  constructor(private readonly backofficeService: BackofficeService) {}

  // ──────────────────────────────────────────────────────────────────────────
  // Users
  // ──────────────────────────────────────────────────────────────────────────

  @Get('users')
  @ApiOperation({ summary: 'List every registered user with admin flag.' })
  @ApiOkResponse({ type: [BackofficeUserResponseDto] })
  listUsers(): Promise<BackofficeUserResponseDto[]> {
    return this.backofficeService.listUsers();
  }

  @Patch('users/:id')
  @ApiOperation({ summary: 'Toggle the admin role for a user.' })
  @ApiOkResponse({ type: BackofficeUserResponseDto })
  setUserAdmin(
    @Param('id') id: string,
    @Body() body: UpdateUserAdminRequestDto,
  ): Promise<BackofficeUserResponseDto> {
    return this.backofficeService.setUserAdmin(id, body.isAdmin);
  }

  // ──────────────────────────────────────────────────────────────────────────
  // Apocalypses
  // ──────────────────────────────────────────────────────────────────────────

  @Get('apocalypses')
  @ApiOperation({ summary: 'List every apocalypse, including disabled rows.' })
  @ApiOkResponse({ type: [BackofficeApocalypseResponseDto] })
  listApocalypses(): Promise<BackofficeApocalypseResponseDto[]> {
    return this.backofficeService.listApocalypses();
  }

  @Post('apocalypses')
  @ApiOperation({ summary: 'Create an apocalypse row.' })
  @ApiCreatedResponse({ type: BackofficeApocalypseResponseDto })
  createApocalypse(
    @Body() body: CreateApocalypseRequestDto,
  ): Promise<BackofficeApocalypseResponseDto> {
    return this.backofficeService.createApocalypse(body);
  }

  @Patch('apocalypses/:id')
  @ApiOperation({ summary: 'Update an apocalypse row.' })
  @ApiOkResponse({ type: BackofficeApocalypseResponseDto })
  updateApocalypse(
    @Param('id') id: string,
    @Body() body: UpdateApocalypseRequestDto,
  ): Promise<BackofficeApocalypseResponseDto> {
    return this.backofficeService.updateApocalypse(id, body);
  }

  @Delete('apocalypses/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete an apocalypse row.' })
  @ApiNoContentResponse()
  deleteApocalypse(@Param('id') id: string): Promise<void> {
    return this.backofficeService.deleteApocalypse(id);
  }

  // ──────────────────────────────────────────────────────────────────────────
  // Shelters
  // ──────────────────────────────────────────────────────────────────────────

  @Get('shelters')
  @ApiOperation({ summary: 'List every shelter, including disabled rows.' })
  @ApiOkResponse({ type: [BackofficeShelterResponseDto] })
  listShelters(): Promise<BackofficeShelterResponseDto[]> {
    return this.backofficeService.listShelters();
  }

  @Post('shelters')
  @ApiOperation({ summary: 'Create a shelter row.' })
  @ApiCreatedResponse({ type: BackofficeShelterResponseDto })
  createShelter(
    @Body() body: CreateShelterRequestDto,
  ): Promise<BackofficeShelterResponseDto> {
    return this.backofficeService.createShelter(body);
  }

  @Patch('shelters/:id')
  @ApiOperation({ summary: 'Update a shelter row.' })
  @ApiOkResponse({ type: BackofficeShelterResponseDto })
  updateShelter(
    @Param('id') id: string,
    @Body() body: UpdateShelterRequestDto,
  ): Promise<BackofficeShelterResponseDto> {
    return this.backofficeService.updateShelter(id, body);
  }

  @Delete('shelters/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete a shelter row.' })
  @ApiNoContentResponse()
  deleteShelter(@Param('id') id: string): Promise<void> {
    return this.backofficeService.deleteShelter(id);
  }

  // ──────────────────────────────────────────────────────────────────────────
  // Traits
  // ──────────────────────────────────────────────────────────────────────────

  @Get('traits')
  @ApiOperation({ summary: 'List every trait, grouped by kind.' })
  @ApiOkResponse({ type: [BackofficeTraitResponseDto] })
  listTraits(): Promise<BackofficeTraitResponseDto[]> {
    return this.backofficeService.listTraits();
  }

  @Post('traits')
  @ApiOperation({ summary: 'Create a trait card.' })
  @ApiCreatedResponse({ type: BackofficeTraitResponseDto })
  createTrait(
    @Body() body: CreateTraitRequestDto,
  ): Promise<BackofficeTraitResponseDto> {
    return this.backofficeService.createTrait(body);
  }

  @Patch('traits/:id')
  @ApiOperation({ summary: 'Update a trait card.' })
  @ApiOkResponse({ type: BackofficeTraitResponseDto })
  updateTrait(
    @Param('id') id: string,
    @Body() body: UpdateTraitRequestDto,
  ): Promise<BackofficeTraitResponseDto> {
    return this.backofficeService.updateTrait(id, body);
  }

  @Delete('traits/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete a trait card.' })
  @ApiNoContentResponse()
  deleteTrait(@Param('id') id: string): Promise<void> {
    return this.backofficeService.deleteTrait(id);
  }

  // ──────────────────────────────────────────────────────────────────────────
  // Biology axes (ages / weights / sexes / genders / races)
  // ──────────────────────────────────────────────────────────────────────────

  private assertBiologyAxis(axis: string): BiologyAxis {
    if (!(BIOLOGY_AXES as readonly string[]).includes(axis)) {
      throw new BadRequestException(
        `Unknown biology axis "${axis}". Expected one of: ${BIOLOGY_AXES.join(
          ', ',
        )}`,
      );
    }

    return axis as BiologyAxis;
  }

  @Get('biology/:axis')
  @ApiOperation({
    summary: 'List rows of a biology axis (ages/weights/sexes/genders/races).',
  })
  @ApiOkResponse({ type: [BackofficeBiologyResponseDto] })
  listBiology(
    @Param('axis') axis: string,
  ): Promise<BackofficeBiologyResponseDto[]> {
    return this.backofficeService.listBiology(this.assertBiologyAxis(axis));
  }

  @Post('biology/:axis')
  @ApiOperation({ summary: 'Create a biology row on the given axis.' })
  @ApiCreatedResponse({ type: BackofficeBiologyResponseDto })
  createBiology(
    @Param('axis') axis: string,
    @Body() body: CreateBiologyRequestDto,
  ): Promise<BackofficeBiologyResponseDto> {
    return this.backofficeService.createBiology(
      this.assertBiologyAxis(axis),
      body,
    );
  }

  @Patch('biology/:axis/:id')
  @ApiOperation({ summary: 'Update a biology row.' })
  @ApiOkResponse({ type: BackofficeBiologyResponseDto })
  updateBiology(
    @Param('axis') axis: string,
    @Param('id') id: string,
    @Body() body: UpdateBiologyRequestDto,
  ): Promise<BackofficeBiologyResponseDto> {
    return this.backofficeService.updateBiology(
      this.assertBiologyAxis(axis),
      id,
      body,
    );
  }

  @Delete('biology/:axis/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete a biology row.' })
  @ApiNoContentResponse()
  deleteBiology(
    @Param('axis') axis: string,
    @Param('id') id: string,
  ): Promise<void> {
    return this.backofficeService.deleteBiology(
      this.assertBiologyAxis(axis),
      id,
    );
  }
}
