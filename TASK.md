# Bunker — Backend (Nest.js) — Implementation Plan

## 1. Overview

NestJS REST API for a "Bunker" / "Shelter" party game. The API is the single source of truth — frontend polls every ~1s for room/game state, so all state, randomness, and reveal decisions live server-side.

The application is played in Ukrainian, but the API surface (field names, error codes) stays in English. All user-facing strings (apocalypse/shelter descriptions, trait labels) are stored as i18n keys or as `uk` text in seed data; the FE renders via i18n.

## 2. Tech stack

- **Framework:** NestJS (latest, TypeScript strict)
- **DB:** PostgreSQL
- **ORM:** TypeORM with decorator-based entities. Migrations via `typeorm migration:generate`/`migration:run`. `synchronize: false` in every environment — migrations are the only way schema changes land.
- **Auth:** `@nestjs/passport` + `passport-google-oauth20` for the Google handshake, then issue our own JWT (HS256) and deliver it as an **HttpOnly cookie** (`SameSite=Lax`, `Secure` in prod). No bearer-header flow.
- **Validation:** `class-validator` + `class-transformer` on all DTOs
- **Config:** `@nestjs/config` with `.env` (DATABASE_URL, GOOGLE_CLIENT_ID/SECRET, JWT_SECRET, FRONTEND_URL, COOKIE_DOMAIN)
- **Random:** Node `crypto.randomInt` for room codes and selections (not `Math.random`)
- **Testing:** **Vitest** for unit tests only at v1. `@nestjs/testing` works with Vitest via `vitest-mock-extended` + a small `vitest.config.ts` (swc or esbuild transform). No e2e/Supertest yet — add later if needed.

## 3. Domain model

All entities below are described as logical models — implemented as TypeORM `@Entity()` classes with `@PrimaryGeneratedColumn('uuid')`, explicit `@Index()` for the unique constraints noted, and `@ManyToOne` / `@OneToMany` for relations. Enums use TypeORM `enum` column type backed by Postgres `ENUM` types.

### 3.1 User & auth

```
User
  id              uuid pk
  googleId        string unique
  email           string unique
  name            string
  avatarUrl       string nullable
  createdAt       timestamp
```

### 3.2 Rooms & participation

```
Room
  id              uuid pk
  code            char(4) unique  -- A–Z only, uppercase
  status          enum(LOBBY, IN_GAME, FINISHED, ABANDONED)
  adminUserId     uuid fk -> User
  apocalypseId    uuid fk -> Apocalypse, nullable until start
  shelterId       uuid fk -> Shelter,    nullable until start
  createdAt       timestamp
  startedAt       timestamp nullable
  finishedAt      timestamp nullable

RoomParticipant
  id              uuid pk
  roomId          uuid fk -> Room
  userId          uuid fk -> User
  seatNumber      int           -- 1..22, assigned on join, stable for the run
  status          enum(JOINED, KICKED, LEFT)
  joinedAt        timestamp
  leftAt          timestamp nullable
  unique(roomId, userId)
  unique(roomId, seatNumber) where status=JOINED
```

`seatNumber` is what the FE shows as "Player 3" before reveals. It must be stable across reconnects.

### 3.3 Game content (seed data)

```
Apocalypse        id, nameKey (or nameUk), descriptionUk
Shelter           id, nameUk, descriptionUk, capacity, durationUk, ...
                  -- exact fields TBD with content; keep flexible
```

Biology — **separate entities** per the spec, each a small lookup table seeded with a pool of values:

```
BiologyAge        id, valueUk    e.g. "23 роки", "67 років"
BiologyWeight     id, valueUk
BiologySex        id, valueUk    -- biological sex
BiologyGender     id, valueUk    -- gender identity
BiologyRace       id, valueUk
```

Traits — **single entity** with a `kind` discriminator and a `polarity`:

```
Trait
  id          uuid pk
  kind        enum(HEALTH, PROFESSION, HOBBY, PHOBIA,
                   CHARACTER_TRAIT, LUGGAGE, PERSONAL_FACT,
                   ACTION_CARD, CONDITION_CARD)
  polarity    enum(POSITIVE, NEGATIVE, NEUTRAL)
  titleUk     string
  descriptionUk string nullable
```

Seed packs (apocalypses, shelters, biology values, traits) live in `src/database/seeds/` as TypeORM data-seeder scripts (or plain JSON loaded by a custom `seed.ts` runner). Treat them as content; version them with the schema. Run via an npm script that calls a dedicated seeding entry point — keep it idempotent (upsert by stable key, not by id).

### 3.4 Per-player character (the run-time payload)

When the admin starts the game we draw a character for each participant and persist it. Re-fetching it on reconnect must return the exact same data.

```
PlayerCharacter
  id            uuid pk
  roomId        uuid fk
  userId        uuid fk
  ageId         fk -> BiologyAge
  weightId      fk -> BiologyWeight
  sexId         fk -> BiologySex
  genderId      fk -> BiologyGender
  raceId        fk -> BiologyRace
  unique(roomId, userId)

PlayerCharacterTrait
  id                  uuid pk
  playerCharacterId   fk
  traitId             fk
  -- one row per trait kind the player owns; see §6.2 for how many of each
```

### 3.5 Reveals

```
PlayerReveal
  id                  uuid pk
  playerCharacterId   fk
  attribute           enum(AGE, WEIGHT, SEX, GENDER, RACE,
                            HEALTH, PROFESSION, HOBBY, PHOBIA,
                            CHARACTER_TRAIT, LUGGAGE, PERSONAL_FACT,
                            ACTION_CARD, CONDITION_CARD)
  -- for multi-card kinds (e.g. two hobbies) include the specific trait id:
  traitId             fk -> Trait, nullable
  revealedAt          timestamp
  unique(playerCharacterId, attribute, traitId)
```

A reveal is global — once an attribute is revealed it is visible to every player in the room. There is no "reveal only to player X" mechanic.

## 4. API surface

All endpoints under `/api`. JSON in, JSON out. Auth is via an HttpOnly cookie (`bunker_session`) set on `/auth/google/callback`; every protected route reads it via a `JwtAuthGuard` that pulls the cookie, verifies the JWT, and attaches `req.user`.

### 4.1 Auth

```
GET  /auth/google              -> 302 to Google
GET  /auth/google/callback     -> redirects to FRONTEND_URL with token (or sets cookie)
POST /auth/logout              -> clears session
GET  /auth/me                  -> { id, name, email, avatarUrl }
```

### 4.2 Rooms (lobby phase)

```
POST   /rooms                          -> creates a room. Caller becomes admin & participant #1.
                                          Response: { code, ... }
POST   /rooms/:code/join               -> joins LOBBY room. 4xx if IN_GAME/FINISHED or full (>22).
                                          Idempotent if already a participant.
GET    /rooms/:code                    -> room snapshot (POLLED).
                                          Includes: status, adminUserId, participants[]
                                          (id, seatNumber, name, avatarUrl, isAdmin, status)
DELETE /rooms/:code/participants/:userId  -> admin kicks. Admin cannot kick self.
POST   /rooms/:code/leave              -> voluntary leave. If admin leaves, the longest-tenured
                                          remaining JOINED participant is promoted to admin
                                          (see §6.3). Works in both LOBBY and IN_GAME.
POST   /rooms/:code/start              -> admin only. Requires status=LOBBY, 4..22 participants.
                                          Transitions to IN_GAME, draws apocalypse/shelter,
                                          generates every PlayerCharacter atomically.
```

### 4.3 Game (in-game phase)

```
GET  /rooms/:code/game                 -> game snapshot (POLLED). Returns:
                                          - apocalypse, shelter
                                          - myCharacter (full, only mine)
                                          - players[]: each with seatNumber, name, avatarUrl,
                                            and the revealed attributes only
                                          - status

POST /rooms/:code/game/reveal          -> reveal one of MY OWN attributes.
                                          Body: { attribute, traitId? }
                                          Server validates the player owns that attribute
                                          and it isn't already revealed. Idempotent.

POST /rooms/:code/leave                -> leaves an in-progress game. Character stays in DB
                                          (history). Marked LEFT in participants.

POST /rooms/:code/finish               -> admin only. Transitions IN_GAME -> FINISHED.
                                          Sets finishedAt. Idempotent if already FINISHED.
```

There is **no** "request to reveal someone else's card" endpoint — reveal model is locked to "own-card only".

## 5. Room code generation

- 4 uppercase letters, A–Z (26⁴ ≈ 456k codes — plenty)
- Generate with `crypto.randomInt`, retry on uniqueness collision (rare)
- Exclude visually ambiguous letters if desired (e.g. drop `I`, `O`) — decide in §10
- Codes are case-insensitive on join (normalize to uppercase)

## 6. Start-game logic

Run inside a single TypeORM transaction (`dataSource.transaction(async (manager) => …)`) so a partial start is impossible:

1. Lock the room row with `manager.createQueryBuilder().setLock('pessimistic_write')`, re-check `status = LOBBY` and admin identity.
2. Re-count `JOINED` participants — must be 4..22.
3. Pick one random `Apocalypse` and one random `Shelter`.
4. For every participant: pick one Age, Weight, Sex, Gender, Race + a fixed set of traits (see §6.1). Insert `PlayerCharacter` + N `PlayerCharacterTrait` rows.
5. Update room: `status=IN_GAME`, set `apocalypseId`, `shelterId`, `startedAt`.

### 6.1 How many traits per player?

Initial proposal — one of each kind, except as marked:

| kind             | count per player |
|------------------|------------------|
| HEALTH           | 1                |
| PROFESSION       | 1                |
| HOBBY            | 1                |
| PHOBIA           | 1                |
| CHARACTER_TRAIT  | 1                |
| LUGGAGE          | 1                |
| PERSONAL_FACT    | 1                |
| ACTION_CARD      | 2 (used during game) |
| CONDITION_CARD   | 1 (used during game) |

**Open** — confirm exact counts and whether trait kinds have per-room uniqueness (see §10).

### 6.2 Polarity distribution

The spec says traits have a polarity but no per-player quota. **Decision: pure random** — for each trait slot, draw uniformly from the available traits of that `kind` regardless of polarity. Seed data should keep a healthy mix of polarities per kind so the random draw produces interesting hands.

### 6.3 Admin promotion

Admin role is reassigned automatically when the current admin leaves or is otherwise removed:

- The new admin is the `JOINED` participant in the room with the **earliest `joinedAt`** (i.e. longest-tenured).
- Tie-break by lowest `seatNumber`.
- Promotion happens in the same transaction as the leave/kick so there is never a moment with no admin (unless the room is empty, in which case it transitions to `ABANDONED`).
- Promotion is silent server-side; the next FE poll will surface the new `adminUserId` and that client's UI flips to admin controls.

## 7. Polling, ETags, and load

FE polls `/rooms/:code` every 1s while in the lobby, and `/rooms/:code/game` every 1s in-game. With 22 players that is 22 req/s per room — easily fine, but:

- Return a lightweight payload (don't re-send static apocalypse/shelter text every tick; or accept it — it's small).
- Add a `version` integer on `Room` that increments on every mutation (join, kick, leave, reveal, start). FE sends `If-None-Match: <version>`; if unchanged return `304`. Cheap and removes most chatter.
- No need for Redis in v1 — Postgres is more than fast enough at this scale.

## 8. Auth flow details

1. FE redirects to `GET /auth/google`. Passport redirects to Google.
2. On callback, we upsert `User` by `googleId` (capture name/email/avatarUrl on every login so they stay fresh).
3. Issue our own JWT and set it as an HttpOnly cookie:
   - Name: `bunker_session`
   - Flags: `HttpOnly`, `Secure` (prod), `SameSite=Lax`, `Path=/`
   - `Domain=COOKIE_DOMAIN` so it covers both FE and API hosts under a shared parent in prod
   - Lifetime: 30 days (single long-lived token; no refresh endpoint at v1)
4. Redirect the browser to `${FRONTEND_URL}/home`.
5. `/auth/logout` clears the cookie (`Max-Age=0`) and returns 204.
6. CORS: `credentials: true`, `origin: FRONTEND_URL` exact match — wildcard is incompatible with credentialed requests.
7. Local dev: FE proxies `/api/*` to the API via `next.config.ts` rewrites so the cookie origin is the same — no cross-site cookie gymnastics during development.

## 9. Authorization rules (enforce in Nest guards)

- Any `/rooms/:code/*` endpoint requires the caller to be a `RoomParticipant` with status `JOINED` — except `/join`.
- `/start`, `DELETE participants/:userId` require `adminUserId === caller.id`.
- `/game/*` requires `room.status === IN_GAME`.
- Reconnect: any `JOINED` participant can `GET /rooms/:code` and `/game` at any time and see the full state they're entitled to.

## 10. Decisions (locked) and remaining open items

### Locked

- **ORM:** TypeORM (decorator entities + generated migrations, `synchronize: false`).
- **Tests:** Vitest, unit only at v1.
- **JWT delivery:** HttpOnly cookie `bunker_session`, `SameSite=Lax`, 30-day lifetime, no refresh flow.
- **Reveal model:** own-card-only. No reveal-request inbox; the FE confirms locally and the server records the reveal directly.
- **Admin handoff:** auto-promote on admin leave/kick — longest-tenured `JOINED` participant becomes admin (see §6.3). Room transitions to `ABANDONED` only when the last participant leaves.
- **Game end:** explicit `POST /rooms/:code/finish` (admin) transitions IN_GAME → FINISHED. The room transitions to `ABANDONED` when the last participant leaves.
- **Trait counts & polarity:** as in §6.1; polarity is uniformly random per slot (§6.2).
- **Trait pool reuse:** two players may receive the same trait (draw with replacement). Seed data should still aim for variety.
- **Soft delete:** kicked/left participants are kept with a status enum, never hard-deleted — preserves history and supports rejoin checks.
- **Room code alphabet:** full A–Z, 4 chars, generated with `crypto.randomInt`; DB unique index handles collisions, service retries up to 16 times.
- **Rejoin policy:** `LEFT` users can rejoin — the participant row flips back to `JOINED` and the original seat is preserved when still free, otherwise a new seat is allocated. `KICKED` is sticky and returns `403 E_FORBIDDEN`.
- **Snapshot scope:** `GET /rooms/:code` returns all participants regardless of status (`JOINED`/`LEFT`/`KICKED`) with the per-row `status` field; the FE filters for the active roster view.
- **Concurrency model:** every room state mutation (create/join/leave/kick/finish) runs in a single TypeORM transaction with `SELECT … FOR UPDATE` on the room row, so concurrent calls serialise. Seat allocation is `O(22)` lowest-free-seat lookup inside the same transaction.
- **Content source:** game content is seeded from `bunker_cards_ua_v7.xlsx` via `GameSeed1779126000000`. The regenerator scripts in `scripts/` (`parse-xlsx.cjs`, `generate-game-seed-migration.cjs`) re-emit the migration when the spreadsheet changes; never hand-edit the generated migration.
- **`CONDITION_CARD`:** retained in `TraitKindEnum` but has no source rows in the current Excel. `GameService.startGame` skips empty trait pools silently — the slot becomes 0 cards until content is supplied (no failure). Add a `condition` sheet to the Excel and rerun the generator to backfill.
- **Entity shape deviations from §3.3:**
  - `Shelter` columns reflect the source columns rather than the spec sketch: `areaUk`, `locationUk`, `durationUk`, `equipmentUk`, `suppliesUk`, `polarity`. No `nameUk`/`capacity` — the FE composes a display label from location + area.
  - `Apocalypse` adds `populationRemainderUk` and `polarity` to the spec's `nameUk`/`descriptionUk`.
  - `BiologyGender` is seeded from the Excel's "Орієнтація" sheet (sexual orientation labels). The entity name stays as in §3.3; the FE/data already speaks "orientation".
  - `Trait.descriptionUk` is reserved but stays NULL in the v1 seed — all source cards use a single title field.
  - All content rows carry a `polarity` column (POSITIVE/NEUTRAL/NEGATIVE, mapping from "Добре"/"Нейтральне"/"Погане"). Polarity is informational only; draws are uniform per kind.
- **Content draw model:** at start, `GameService` pre-loads the full content pools once per transaction and draws client-side with `crypto.randomInt`. This avoids `ORDER BY RANDOM()` per slot per player; total network is `O(content tables)` not `O(players × slots)`.
- **Post-mortem snapshot:** `GET /rooms/:code/game` returns a read-only snapshot when the room is `FINISHED` (same shape as the live snapshot, reveals frozen at game-end). Decided during M5 over returning a 410 — the FE keeps rendering the board for screenshots / post-game discussion.
- **Reveal idempotency model:** `POST /rooms/:code/game/reveal` is idempotent on `(playerCharacterId, attribute, traitId)`. Re-revealing the same slot reuses the existing `PlayerReveal` row and **does not bump** `room.version`. The unique guarantee uses two partial indexes (`WHERE traitId IS NULL` and `WHERE traitId IS NOT NULL`) since Postgres treats `NULL` as distinct in regular unique indexes.
- **Reveal ownership:**
  - Biology attributes (`AGE`/`WEIGHT`/`SEX`/`GENDER`/`RACE`) — `traitId` must be absent (`400 E_BAD_REQUEST` if supplied).
  - Single-card trait kinds (`HEALTH`/`PROFESSION`/`HOBBY`/`PHOBIA`/`CHARACTER_TRAIT`/`LUGGAGE`/`PERSONAL_FACT`/`CONDITION_CARD`) — `traitId` is optional; when absent the server resolves to the player's only card.
  - Multi-card kinds (currently `ACTION_CARD`, 2 cards per player) — `traitId` is **required** (`400 E_BAD_REQUEST` otherwise) and must reference one of the caller's own `PlayerCharacterTrait` rows (`403 E_FORBIDDEN` otherwise).
  - Reveal of a kind the player owns zero cards of — `409 E_CONFLICT` (e.g. `CONDITION_CARD` while the content is empty).
- **ETag polling:** `Room` carries a monotonic `version` integer. Both polled endpoints set `ETag: "v<n>"`, and `If-None-Match` short-circuits to `304 Not Modified` with an empty body. The `ResponseWrapperInterceptor` skips its envelope on 304 responses (RFC 7232). Every mutation (create/join/leave/kick/start/reveal/finish) bumps `version`; the room snapshot DTOs expose it.
- **Throttling:** `@nestjs/throttler` is wired as a global `APP_GUARD` after the cookie-JWT guard, with a per-user tracker (falls back to `X-Forwarded-For` / `req.ip`). Default cap is 10 req/s/user, which leaves comfortable headroom over the 2 req/s/user steady-state poll loop (rooms + game).

### Still open

1. **`CONDITION_CARD` content** — backfill the Ukrainian source so reveals on that slot return cards instead of `409 E_CONFLICT`. Server logic already handles it; only content is missing.

## 11. Suggested module layout

```
src/
  auth/                 (controller, google strategy, cookie-jwt strategy, guards)
  users/
  rooms/                (controller, service — create/join/leave/kick/start/finish/poll)
  game/                 (controller, service — start, reveal, snapshot)
  content/              (apocalypses, shelters, biology, traits — read-only)
  common/               (DTOs, pipes, exception filter)
  database/
    data-source.ts      (TypeORM DataSource — used by app + CLI)
    migrations/
    seeds/              (per-content seeders + a runner)
  entities/             (User, Room, RoomParticipant, Apocalypse, Shelter,
                         BiologyAge/Weight/Sex/Gender/Race, Trait,
                         PlayerCharacter, PlayerCharacterTrait, PlayerReveal)
vitest.config.ts
```

## 12. Milestones

1. **M1 — Skeleton & auth — ✅ Done**
   Nest app, TypeORM data source, `User` entity + `Init1747426800000` migration, Google OAuth → cookie issuance, `/auth/me`, Vitest with sample unit tests, manual smoke test.

   Shipped:
   - `src/main.ts` boots Nest with `cookieParser`, `setGlobalPrefix('api')`, CORS scoped to `FRONTEND_URL` with `credentials: true`, Swagger at `/docs` with the cookie auth scheme.
   - Zod-validated env config (`@nestjs/config` + `getConfigModule`); fails fast on missing/invalid vars.
   - `User` entity with unique indexes on `googleId`/`email`; audit columns via `BaseEntity`.
   - `AuthService` upserts users by `googleId` on every Google login, refreshing `name`/`email`/`avatarUrl`. JWT signed HS256 with `JWT_SECRET` and `JWT_EXPIRE` (30d), delivered as the `bunker_session` HttpOnly cookie.
   - Globally-applied `CookieJwtGuard` reading the cookie via a custom Passport extractor; `@Public()` opt-out for the OAuth routes and logout. `@AuthorizedUser()` param decorator pulls the user out of request-scoped `TypedMap` storage.
   - Unified `StandardResponse` envelope wraps both successes and errors; `GlobalExceptionFilter` sanitises `QueryFailedError` in prod, sends 5xx to Sentry, and maps to stable `E_*` codes (`UNKNOWN`, `BAD_REQUEST`, `VALIDATION`, `UNAUTHORIZED`, `FORBIDDEN`, `NOT_FOUND`, `ENTITY_NOT_FOUND`, `CONFLICT`, `INTERNAL_SERVER_ERROR`, `QUERY_FAILURE`).
   - Winston-backed `AppLogger`, Sentry init guarded by `SENTRY_DSN` + `SENTRY_ENABLE`, request-context + log-request middleware.
   - Repository → DatabaseService → FeatureService data-access pattern: `UserRepository`, `UserDatabaseService` exposed from `DatabaseModule`.
   - Vitest config (`vitest.config.mts`) with `unplugin-swc` and `vite-tsconfig-paths`; sample `AuthService` specs cover `getMe` and both branches of `handleGoogleLogin`.

2. **M2 — Rooms — ✅ Done**
   Create/join/leave/kick/poll. Status machine LOBBY → IN_GAME / FINISHED / ABANDONED. Admin auto-promotion. Unit tests for the state transitions.

   Shipped:
   - Entities `Room` (4-char code, `RoomStatusEnum`, `adminUserId`, `startedAt`/`finishedAt`) and `RoomParticipant` (`seatNumber`, `ParticipantStatusEnum`, `joinedAt`/`leftAt`) with relations into `User`.
   - Migration `Rooms1779033600000` creates both enum types, both tables, FKs (`room.adminUserId` RESTRICT, `room_participant.roomId` CASCADE, `room_participant.userId` RESTRICT), the unique `(roomId, userId)` index, and the **partial unique** index on `(roomId, seatNumber) WHERE status = 'JOINED'`.
   - `RoomRepository` (`getByCode`, `getByCodeWithParticipants`, `getByCodeWithJoinedParticipants`) and `RoomParticipantRepository` (`getByRoomAndUser`, `getJoinedByRoom`, `countJoinedByRoom`).
   - `RoomDatabaseService` and `RoomParticipantDatabaseService` extending `BaseDatabaseService`; both exported from `DatabaseModule`.
   - `RoomsService` owns every state mutation. Each runs in `dataSource.transaction(...)` with `manager.createQueryBuilder(Room, 'room').setLock('pessimistic_write')` on the room row. Seat allocation is the lowest free `seatNumber` in `1..22` among JOINED rows.
   - Endpoints (all `/api/rooms/*`):
     - `POST /rooms` — creates room (LOBBY), caller is admin and seat #1, retries on the rare 4-letter code collision.
     - `GET /rooms/:code` — snapshot for any `JOINED` member; 404 if missing, 403 if not a member.
     - `POST /rooms/:code/join` — idempotent for current members, flips `LEFT → JOINED` (seat preserved when free, otherwise reallocated), `403` for `KICKED`, `409` if room not in `LOBBY` or full.
     - `POST /rooms/:code/leave` — `204`. Admin departure auto-promotes the longest-tenured `JOINED` member (tie-break by lowest `seatNumber`); when the last `JOINED` member leaves the room transitions to `ABANDONED`.
     - `DELETE /rooms/:code/participants/:userId` — admin only; self-kick rejected with `409`.
     - `POST /rooms/:code/finish` — admin only; `IN_GAME → FINISHED`, idempotent on `FINISHED`, rejects `LOBBY`/`ABANDONED` with `409`.
   - Snapshot DTO includes participants of every status (`JOINED`/`LEFT`/`KICKED`) with per-row `status` and `isAdmin`; FE filters for active roster.
   - New typed exceptions `ForbiddenException` (`E_FORBIDDEN`) and `ConflictException` (`E_CONFLICT`).
   - Room code generation uses `crypto.randomInt` over the full A–Z alphabet, bounded retry (`ROOM_CODE_ALLOCATION_ATTEMPTS = 16`).
   - 23 Vitest specs for `RoomsService` cover every state transition (create, join idempotency / LEFT-rejoin / KICKED-block / not-LOBBY / full, leave with admin promotion + ABANDONED + silent no-op, kick happy/non-admin/self/not-found, finish IN_GAME → FINISHED + idempotent + LOBBY rejection + non-admin) plus snapshot 403/404 and code-generator format.

3. **M3 — Content seed — ✅ Folded into M4**
   Done as part of the M4 seed migration `GameSeed1779126000000` rather than a separate seeder. Sourced from `bunker_cards_ua_v7.xlsx` (parsed by `scripts/parse-xlsx.cjs`, migration emitted by `scripts/generate-game-seed-migration.cjs`).

   Seed counts:
   - Traits: **576** total across 8 kinds (PROFESSION 75, HEALTH 75, HOBBY 76, PHOBIA 75, CHARACTER_TRAIT 75, LUGGAGE 75, PERSONAL_FACT 75, ACTION_CARD 50). `CONDITION_CARD` is still empty — see §10.
   - Apocalypses: **30** (`nameUk`, `descriptionUk`, `populationRemainderUk`, `polarity`).
   - Shelters: **30** (`areaUk`, `locationUk`, `durationUk`, `equipmentUk`, `suppliesUk`, `polarity`).
   - Biology: ages **71**, weights **75**, sexes **2**, genders **24**, races **50**.
   - Comfortably above the §12 minimum bars (5/5/20+/10+).

4. **M4 — Game start & snapshot — ✅ Done**
   `/start`, character generation transaction with pessimistic row-lock on room, `/game` snapshot endpoint, reconnect tests.

   Shipped:
   - Content entities `Apocalypse`, `Shelter`, `BiologyAge/Weight/Sex/Gender/Race`, `Trait` (with `TraitKindEnum`, `PolarityEnum`).
   - Per-player entities `PlayerCharacter` (unique `(roomId, userId)`) and `PlayerCharacterTrait`. `Room` now carries nullable `apocalypseId`/`shelterId` FKs, set at start.
   - Migration `GameSchema1779120000000` creates the two enum types, every new table, FKs (player_character cascade-on-room, restrict-on-user/biology/trait), the `(roomId, userId)` unique on `player_character`, and the `(playerCharacterId)` index on `player_character_trait`.
   - Migration `GameSeed1779126000000` inserts all content with `unnest($1::text[], …)` per table — one network round-trip per table instead of one per row. The file is listed in `eslint.config.mjs` as ignored (generated data).
   - `PlayerCharacterRepository` + `PlayerCharacterDatabaseService` expose the relation-loaded read used by the snapshot. `RoomDatabaseService` gained `findByCodeWithGameRelations(code)` (room + apocalypse + shelter + participants + users).
   - `GameService` owns the start transaction:
     1. `SELECT … FOR UPDATE` on the room row.
     2. Validates caller is admin, room is `LOBBY`, JOINED count is `4..22`.
     3. Pre-loads pools: 1 apocalypse + 1 shelter (uniform random); all biology axes and all traits (grouped by `kind`).
     4. For each JOINED participant, creates a `PlayerCharacter` row (one biology id per axis) and 9 `PlayerCharacterTrait` rows per `TRAIT_DRAW_COUNTS` (`1× HEALTH/PROFESSION/HOBBY/PHOBIA/CHARACTER_TRAIT/LUGGAGE/PERSONAL_FACT`, `2× ACTION_CARD`, `1× CONDITION_CARD` — skipped while pool is empty).
     5. Sets `room.status = IN_GAME`, `room.apocalypseId`, `room.shelterId`, `room.startedAt = now`.
     6. Builds and returns the game snapshot.
   - `GameController` exposes `POST /rooms/:code/start` and `GET /rooms/:code/game`.
   - `GET /rooms/:code/game` returns 404 for unknown room, 403 if caller isn't a `JOINED` participant, 409 if `status ≠ IN_GAME`, otherwise the snapshot (apocalypse, shelter, `myCharacter` full, `players` with seat/name/avatar/status/isAdmin — no reveals yet; that's M5).
   - All randomness uses `crypto.randomInt` per TASK.md §2 — no `Math.random` anywhere in the game module.
   - 11 Vitest specs for `GameService`: start happy path (mutates room state, ≥36 trait saves for 4 players, snapshot has correct apocalypse/shelter/character), non-admin 403, non-LOBBY 409, under-4 players 409, empty biology pool 409, empty apocalypse pool 409, plus reconnect snapshot stability (two `getSnapshot` calls return identical payloads) and 404/403/409 paths.

5. **M5 — Reveals & finish — ✅ Done**
   `/game/reveal` endpoint, `FINISHED` post-mortem snapshot, reveal-aware game DTO. (`/finish` already shipped in M2.)

   Shipped:
   - `PlayerReveal` entity (`@/modules/database/entities/player-reveal.entity.ts`) + `RevealAttributeEnum` (14 values: 5 biology + 9 trait kinds). Cascade on `playerCharacter`, restrict on `trait`. Indexed on `playerCharacterId`.
   - Migration `GameReveals1779140000000`: creates `reveal_attribute_enum`, the `player_reveal` table, two partial unique indexes for NULL-safe `(characterId, attribute, traitId)` uniqueness, and adds `room.version int NOT NULL DEFAULT 1`.
   - `PlayerRevealRepository` (`getByCharacterIds`, `getOneForIdempotency` using `IsNull()` for NULL-safe lookups) + `PlayerRevealDatabaseService`. Both exported from `DatabaseModule`.
   - `PlayerCharacterRepository.getAllByRoomWithRelations(roomId)` so the snapshot can resolve every player's biology values for reveal mapping.
   - DTOs: `RevealRequestDto` (`attribute: RevealAttributeEnum`, optional `traitId`), `RevealedAttributeResponseDto` (`attribute` + exactly one of `biologyValue` / `trait` + `revealedAt`). `GamePlayerResponseDto` gained `reveals: RevealedAttributeResponseDto[]`; `GameSnapshotResponseDto` and `RoomSnapshotResponseDto` gained `version: number`.
   - `GameService.revealAttribute(code, user, body)` runs in a transaction with `SELECT … FOR UPDATE` on the room row, validates `IN_GAME` + JOINED, calls `resolveRevealTraitId` for ownership/biology rules, finds-or-creates the `PlayerReveal` row (idempotent), bumps `room.version` only on insert, then returns the freshly-loaded snapshot.
   - `GameService.getSnapshot` now allows both `IN_GAME` and `FINISHED` rooms (read-only post-mortem) and maps every player's reveals into the `players[]` array. Biology reveals resolve the value via the player's character; trait reveals serialise the joined `Trait`.
   - `GameController` exposes `POST /rooms/:code/game/reveal`.
   - Constants `TRAIT_KIND_BY_REVEAL_ATTRIBUTE` + `BIOLOGY_REVEAL_ATTRIBUTES` (`@/modules/game/constants/game.constants.ts`) keep the reveal-kind plumbing declarative.
   - 13 new Vitest specs on `GameService.revealAttribute` (happy biology + happy ACTION_CARD with traitId + idempotency + missing traitId for multi-card + wrong traitId + biology+traitId rejection + zero-cards CONDITION_CARD + not-IN_GAME + non-participant + `IsNull()` predicate path) plus reveals exposed in snapshot + FINISHED post-mortem. Existing 28 M1/M2/M4 specs still pass — **51/51 green**.

6. **M6 — Hardening — ✅ Done**
   ETag/version polling, throttler, error envelopes (already shipped in M1), structured logging (already shipped in M1).

   Shipped:
   - `Room.version: number` (default 1) + service-level bumps on every mutation (`createRoom`/`joinRoom`/`leaveRoom`/`kickParticipant`/`finishRoom`/`startGame`/`revealAttribute`). Idempotent paths that do not change state (already-JOINED rejoin, repeat finish on FINISHED, repeat reveal) intentionally **do not** bump.
   - `applyVersionEtag` helper (`@/common/utils/etag.util.ts`) builds `"v<n>"` ETags and short-circuits to `304` on match. Wired into `GET /rooms/:code` and `GET /rooms/:code/game`.
   - `ResponseWrapperInterceptor` skips the `StandardResponse` envelope on `304` so the body is genuinely empty (RFC 7232).
   - `@nestjs/throttler` v6 added as a dependency. `ThrottlerModule.forRoot({ throttlers: [{ ttl: 1000, limit: 10 }] })` is applied globally; `UserThrottlerGuard` (`@/common/guards/user-throttler.guard.ts`) replaces the IP-based tracker with `user:<id>` (falls back to `X-Forwarded-For` / `req.ip` for unauthenticated routes). Registered as a second `APP_GUARD` after `CookieJwtGuard`.
   - Error envelopes (`StandardResponse` + `GlobalExceptionFilter` + `E_*` codes) shipped in M1; M5 added `E_BAD_REQUEST` paths around reveal validation.
   - Structured logging (Winston `AppLogger` + Sentry + request-context middleware) shipped in M1; no new logging surface added in M6.

## 13. Things explicitly out of scope for v1

- WebSockets / SSE (use polling, per spec)
- Anonymous / non-Google login
- Kick voting, win condition, scoring
- Multi-language UI on the API (content stays Ukrainian; only error codes are English)
- Spectators / replays
- Mobile push notifications
