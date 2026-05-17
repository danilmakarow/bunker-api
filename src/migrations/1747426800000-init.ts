import { MigrationInterface, QueryRunner } from 'typeorm';

export class Init1747426800000 implements MigrationInterface {
  name = 'Init1747426800000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS "uuid-ossp"`);
    await queryRunner.query(
      `CREATE TABLE "user" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        "googleId" character varying NOT NULL,
        "email" character varying NOT NULL,
        "name" character varying NOT NULL,
        "avatarUrl" character varying,
        CONSTRAINT "PK_user_id" PRIMARY KEY ("id")
      )`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_user_googleId" ON "user" ("googleId")`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_user_email" ON "user" ("email")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "public"."IDX_user_email"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_user_googleId"`);
    await queryRunner.query(`DROP TABLE "user"`);
  }
}
