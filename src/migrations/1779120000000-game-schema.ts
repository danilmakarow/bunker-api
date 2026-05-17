import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * M4 — game content + per-player schema.
 *   • Adds Apocalypse, Shelter, Biology* and Trait tables.
 *   • Adds PlayerCharacter + PlayerCharacterTrait tables.
 *   • Extends Room with nullable apocalypseId / shelterId FKs (set at start).
 */
export class GameSchema1779120000000 implements MigrationInterface {
  name = 'GameSchema1779120000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TYPE "public"."polarity_enum" AS ENUM('POSITIVE', 'NEUTRAL', 'NEGATIVE')`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."trait_kind_enum" AS ENUM(
        'HEALTH', 'PROFESSION', 'HOBBY', 'PHOBIA', 'CHARACTER_TRAIT',
        'LUGGAGE', 'PERSONAL_FACT', 'ACTION_CARD', 'CONDITION_CARD'
      )`,
    );

    await queryRunner.query(
      `CREATE TABLE "apocalypse" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        "nameUk" character varying NOT NULL,
        "descriptionUk" text NOT NULL,
        "populationRemainderUk" character varying NOT NULL,
        "polarity" "public"."polarity_enum" NOT NULL,
        CONSTRAINT "PK_apocalypse_id" PRIMARY KEY ("id")
      )`,
    );

    await queryRunner.query(
      `CREATE TABLE "shelter" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        "areaUk" character varying NOT NULL,
        "locationUk" text NOT NULL,
        "durationUk" character varying NOT NULL,
        "equipmentUk" text NOT NULL,
        "suppliesUk" text NOT NULL,
        "polarity" "public"."polarity_enum" NOT NULL,
        CONSTRAINT "PK_shelter_id" PRIMARY KEY ("id")
      )`,
    );

    for (const axis of [
      'biology_age',
      'biology_weight',
      'biology_sex',
      'biology_gender',
      'biology_race',
    ]) {
      await queryRunner.query(
        `CREATE TABLE "${axis}" (
          "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
          "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
          "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
          "valueUk" character varying NOT NULL,
          CONSTRAINT "PK_${axis}_id" PRIMARY KEY ("id")
        )`,
      );
    }

    await queryRunner.query(
      `CREATE TABLE "trait" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        "kind" "public"."trait_kind_enum" NOT NULL,
        "polarity" "public"."polarity_enum" NOT NULL,
        "titleUk" character varying NOT NULL,
        "descriptionUk" text,
        CONSTRAINT "PK_trait_id" PRIMARY KEY ("id")
      )`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_trait_kind" ON "trait" ("kind")`,
    );

    await queryRunner.query(
      `ALTER TABLE "room" ADD COLUMN "apocalypseId" uuid`,
    );
    await queryRunner.query(`ALTER TABLE "room" ADD COLUMN "shelterId" uuid`);
    await queryRunner.query(
      `ALTER TABLE "room" ADD CONSTRAINT "FK_room_apocalypse"
        FOREIGN KEY ("apocalypseId") REFERENCES "apocalypse"("id")
        ON DELETE RESTRICT ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "room" ADD CONSTRAINT "FK_room_shelter"
        FOREIGN KEY ("shelterId") REFERENCES "shelter"("id")
        ON DELETE RESTRICT ON UPDATE NO ACTION`,
    );

    await queryRunner.query(
      `CREATE TABLE "player_character" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        "roomId" uuid NOT NULL,
        "userId" uuid NOT NULL,
        "ageId" uuid NOT NULL,
        "weightId" uuid NOT NULL,
        "sexId" uuid NOT NULL,
        "genderId" uuid NOT NULL,
        "raceId" uuid NOT NULL,
        CONSTRAINT "PK_player_character_id" PRIMARY KEY ("id")
      )`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_player_character_room_user"
        ON "player_character" ("roomId", "userId")`,
    );
    await queryRunner.query(
      `ALTER TABLE "player_character" ADD CONSTRAINT "FK_player_character_room"
        FOREIGN KEY ("roomId") REFERENCES "room"("id")
        ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "player_character" ADD CONSTRAINT "FK_player_character_user"
        FOREIGN KEY ("userId") REFERENCES "user"("id")
        ON DELETE RESTRICT ON UPDATE NO ACTION`,
    );

    for (const [column, table] of [
      ['ageId', 'biology_age'],
      ['weightId', 'biology_weight'],
      ['sexId', 'biology_sex'],
      ['genderId', 'biology_gender'],
      ['raceId', 'biology_race'],
    ]) {
      await queryRunner.query(
        `ALTER TABLE "player_character" ADD CONSTRAINT "FK_player_character_${column}"
          FOREIGN KEY ("${column}") REFERENCES "${table}"("id")
          ON DELETE RESTRICT ON UPDATE NO ACTION`,
      );
    }

    await queryRunner.query(
      `CREATE TABLE "player_character_trait" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        "playerCharacterId" uuid NOT NULL,
        "traitId" uuid NOT NULL,
        CONSTRAINT "PK_player_character_trait_id" PRIMARY KEY ("id")
      )`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_player_character_trait_character"
        ON "player_character_trait" ("playerCharacterId")`,
    );
    await queryRunner.query(
      `ALTER TABLE "player_character_trait" ADD CONSTRAINT "FK_pct_player_character"
        FOREIGN KEY ("playerCharacterId") REFERENCES "player_character"("id")
        ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "player_character_trait" ADD CONSTRAINT "FK_pct_trait"
        FOREIGN KEY ("traitId") REFERENCES "trait"("id")
        ON DELETE RESTRICT ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "player_character_trait" DROP CONSTRAINT "FK_pct_trait"`,
    );
    await queryRunner.query(
      `ALTER TABLE "player_character_trait" DROP CONSTRAINT "FK_pct_player_character"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_player_character_trait_character"`,
    );
    await queryRunner.query(`DROP TABLE "player_character_trait"`);

    for (const column of ['raceId', 'genderId', 'sexId', 'weightId', 'ageId']) {
      await queryRunner.query(
        `ALTER TABLE "player_character" DROP CONSTRAINT "FK_player_character_${column}"`,
      );
    }

    await queryRunner.query(
      `ALTER TABLE "player_character" DROP CONSTRAINT "FK_player_character_user"`,
    );
    await queryRunner.query(
      `ALTER TABLE "player_character" DROP CONSTRAINT "FK_player_character_room"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_player_character_room_user"`,
    );
    await queryRunner.query(`DROP TABLE "player_character"`);

    await queryRunner.query(
      `ALTER TABLE "room" DROP CONSTRAINT "FK_room_shelter"`,
    );
    await queryRunner.query(
      `ALTER TABLE "room" DROP CONSTRAINT "FK_room_apocalypse"`,
    );
    await queryRunner.query(`ALTER TABLE "room" DROP COLUMN "shelterId"`);
    await queryRunner.query(`ALTER TABLE "room" DROP COLUMN "apocalypseId"`);

    await queryRunner.query(`DROP INDEX "public"."IDX_trait_kind"`);
    await queryRunner.query(`DROP TABLE "trait"`);

    for (const axis of [
      'biology_race',
      'biology_gender',
      'biology_sex',
      'biology_weight',
      'biology_age',
    ]) {
      await queryRunner.query(`DROP TABLE "${axis}"`);
    }

    await queryRunner.query(`DROP TABLE "shelter"`);
    await queryRunner.query(`DROP TABLE "apocalypse"`);

    await queryRunner.query(`DROP TYPE "public"."trait_kind_enum"`);
    await queryRunner.query(`DROP TYPE "public"."polarity_enum"`);
  }
}
