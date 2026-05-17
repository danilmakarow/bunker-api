import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * M5 + M6 — reveals and ETag polling.
 *   • Adds the `reveal_attribute_enum` Postgres type.
 *   • Adds the `player_reveal` table with a partial-NULL-safe uniqueness
 *     guarantee per (playerCharacterId, attribute, traitId).
 *   • Adds `version` int on `room` (default 1) so polled snapshots can
 *     short-circuit unchanged polls via `ETag` / `If-None-Match`.
 */
export class GameReveals1779140000000 implements MigrationInterface {
  name = 'GameReveals1779140000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TYPE "public"."reveal_attribute_enum" AS ENUM(
        'AGE', 'WEIGHT', 'SEX', 'GENDER', 'RACE',
        'HEALTH', 'PROFESSION', 'HOBBY', 'PHOBIA', 'CHARACTER_TRAIT',
        'LUGGAGE', 'PERSONAL_FACT', 'ACTION_CARD', 'CONDITION_CARD'
      )`,
    );

    await queryRunner.query(
      `CREATE TABLE "player_reveal" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        "playerCharacterId" uuid NOT NULL,
        "attribute" "public"."reveal_attribute_enum" NOT NULL,
        "traitId" uuid,
        CONSTRAINT "PK_player_reveal_id" PRIMARY KEY ("id")
      )`,
    );

    await queryRunner.query(
      `CREATE INDEX "IDX_player_reveal_character"
        ON "player_reveal" ("playerCharacterId")`,
    );

    // NULL-safe uniqueness: a player reveals each non-trait attribute at most
    // once; trait kinds with multiple cards (e.g. ACTION_CARD) can have one
    // row per traitId.
    await queryRunner.query(
      `CREATE UNIQUE INDEX "UQ_player_reveal_character_attribute_traitnotnull"
        ON "player_reveal" ("playerCharacterId", "attribute", "traitId")
        WHERE "traitId" IS NOT NULL`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "UQ_player_reveal_character_attribute_traitnull"
        ON "player_reveal" ("playerCharacterId", "attribute")
        WHERE "traitId" IS NULL`,
    );

    await queryRunner.query(
      `ALTER TABLE "player_reveal" ADD CONSTRAINT "FK_player_reveal_character"
        FOREIGN KEY ("playerCharacterId") REFERENCES "player_character"("id")
        ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "player_reveal" ADD CONSTRAINT "FK_player_reveal_trait"
        FOREIGN KEY ("traitId") REFERENCES "trait"("id")
        ON DELETE RESTRICT ON UPDATE NO ACTION`,
    );

    await queryRunner.query(
      `ALTER TABLE "room" ADD COLUMN "version" integer NOT NULL DEFAULT 1`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "room" DROP COLUMN "version"`);

    await queryRunner.query(
      `ALTER TABLE "player_reveal" DROP CONSTRAINT "FK_player_reveal_trait"`,
    );
    await queryRunner.query(
      `ALTER TABLE "player_reveal" DROP CONSTRAINT "FK_player_reveal_character"`,
    );

    await queryRunner.query(
      `DROP INDEX "public"."UQ_player_reveal_character_attribute_traitnull"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."UQ_player_reveal_character_attribute_traitnotnull"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_player_reveal_character"`,
    );

    await queryRunner.query(`DROP TABLE "player_reveal"`);
    await queryRunner.query(`DROP TYPE "public"."reveal_attribute_enum"`);
  }
}
