import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Backoffice — admin role + per-row enabled/weight controls.
 *   • Adds `isAdmin` to `user` (default false).
 *   • Adds `enabled` (default true) and `weight` (int default 1) to every
 *     content table that game start draws from.
 */
export class Backoffice1779200000000 implements MigrationInterface {
  name = 'Backoffice1779200000000';

  private readonly contentTables = [
    'apocalypse',
    'shelter',
    'trait',
    'biology_age',
    'biology_weight',
    'biology_sex',
    'biology_gender',
    'biology_race',
  ];

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "user" ADD COLUMN "isAdmin" boolean NOT NULL DEFAULT false`,
    );

    for (const table of this.contentTables) {
      await queryRunner.query(
        `ALTER TABLE "${table}" ADD COLUMN "enabled" boolean NOT NULL DEFAULT true`,
      );
      await queryRunner.query(
        `ALTER TABLE "${table}" ADD COLUMN "weight" integer NOT NULL DEFAULT 1`,
      );
      await queryRunner.query(
        `ALTER TABLE "${table}" ADD CONSTRAINT "CHK_${table}_weight_nonneg"
          CHECK ("weight" >= 0)`,
      );
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    for (const table of [...this.contentTables].reverse()) {
      await queryRunner.query(
        `ALTER TABLE "${table}" DROP CONSTRAINT "CHK_${table}_weight_nonneg"`,
      );
      await queryRunner.query(
        `ALTER TABLE "${table}" DROP COLUMN "weight"`,
      );
      await queryRunner.query(
        `ALTER TABLE "${table}" DROP COLUMN "enabled"`,
      );
    }

    await queryRunner.query(`ALTER TABLE "user" DROP COLUMN "isAdmin"`);
  }
}
