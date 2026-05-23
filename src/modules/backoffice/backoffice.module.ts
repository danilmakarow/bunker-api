import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { BackofficeController } from './backoffice.controller';
import { BackofficeService } from './backoffice.service';
import {
  Apocalypse,
  BiologyAge,
  BiologyGender,
  BiologyRace,
  BiologySex,
  BiologyWeight,
  Shelter,
  Trait,
} from '@/modules/database/entities';
import { DatabaseModule } from '@/modules/database/database.module';

@Module({
  imports: [
    DatabaseModule,
    TypeOrmModule.forFeature([
      Apocalypse,
      Shelter,
      Trait,
      BiologyAge,
      BiologyWeight,
      BiologySex,
      BiologyGender,
      BiologyRace,
    ]),
  ],
  controllers: [BackofficeController],
  providers: [BackofficeService],
})
export class BackofficeModule {}
