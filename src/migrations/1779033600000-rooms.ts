import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * M2 — adds Room + RoomParticipant tables, status enums, and the partial
 * unique index that keeps seatNumber unique among JOINED participants only.
 */
export class Rooms1779033600000 implements MigrationInterface {
  name = 'Rooms1779033600000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TYPE "public"."room_status_enum" AS ENUM('LOBBY', 'IN_GAME', 'FINISHED', 'ABANDONED')`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."room_participant_status_enum" AS ENUM('JOINED', 'KICKED', 'LEFT')`,
    );

    await queryRunner.query(
      `CREATE TABLE "room" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        "code" character(4) NOT NULL,
        "status" "public"."room_status_enum" NOT NULL DEFAULT 'LOBBY',
        "adminUserId" uuid NOT NULL,
        "startedAt" TIMESTAMP,
        "finishedAt" TIMESTAMP,
        CONSTRAINT "PK_room_id" PRIMARY KEY ("id")
      )`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_room_code" ON "room" ("code")`,
    );
    await queryRunner.query(
      `ALTER TABLE "room" ADD CONSTRAINT "FK_room_adminUser"
        FOREIGN KEY ("adminUserId") REFERENCES "user"("id")
        ON DELETE RESTRICT ON UPDATE NO ACTION`,
    );

    await queryRunner.query(
      `CREATE TABLE "room_participant" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        "roomId" uuid NOT NULL,
        "userId" uuid NOT NULL,
        "seatNumber" integer NOT NULL,
        "status" "public"."room_participant_status_enum" NOT NULL DEFAULT 'JOINED',
        "joinedAt" TIMESTAMP NOT NULL,
        "leftAt" TIMESTAMP,
        CONSTRAINT "PK_room_participant_id" PRIMARY KEY ("id")
      )`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_room_participant_room_user"
        ON "room_participant" ("roomId", "userId")`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_room_participant_room_seat_active"
        ON "room_participant" ("roomId", "seatNumber")
        WHERE "status" = 'JOINED'`,
    );
    await queryRunner.query(
      `ALTER TABLE "room_participant" ADD CONSTRAINT "FK_room_participant_room"
        FOREIGN KEY ("roomId") REFERENCES "room"("id")
        ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "room_participant" ADD CONSTRAINT "FK_room_participant_user"
        FOREIGN KEY ("userId") REFERENCES "user"("id")
        ON DELETE RESTRICT ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "room_participant" DROP CONSTRAINT "FK_room_participant_user"`,
    );
    await queryRunner.query(
      `ALTER TABLE "room_participant" DROP CONSTRAINT "FK_room_participant_room"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_room_participant_room_seat_active"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_room_participant_room_user"`,
    );
    await queryRunner.query(`DROP TABLE "room_participant"`);

    await queryRunner.query(
      `ALTER TABLE "room" DROP CONSTRAINT "FK_room_adminUser"`,
    );
    await queryRunner.query(`DROP INDEX "public"."IDX_room_code"`);
    await queryRunner.query(`DROP TABLE "room"`);

    await queryRunner.query(
      `DROP TYPE "public"."room_participant_status_enum"`,
    );
    await queryRunner.query(`DROP TYPE "public"."room_status_enum"`);
  }
}
