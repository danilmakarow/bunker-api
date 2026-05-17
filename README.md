# bunker-api

NestJS REST API for the **Бункер / Shelter** party game. The API is the **single source of truth**: the [frontend](../bunker-fe) polls every ~1 s for room/game state, so all randomness, reveal authority, and admin actions live server-side.

Game content is in Ukrainian; the API surface (field names, error codes) stays in English. User-facing strings (apocalypse / shelter descriptions, trait labels) are stored as `uk` text in the seed data and rendered as-is by the FE.

## Stack

- **NestJS 11** (TypeScript strict, ESLint + Prettier)
- **PostgreSQL** + **TypeORM 0.3** — entities under [`src/modules/*/entities`](src/modules), migrations in [`src/migrations/`](src/migrations). `synchronize: false` everywhere — migrations are the only way schema changes land.
- **Auth** — `@nestjs/passport` + `passport-google-oauth20` for Google sign-in, then our own HS256 JWT delivered as an HttpOnly cookie (`bunker_session`). No bearer-header flow.
- **Validation** — `class-validator` + `class-transformer` on every DTO; env validated on boot via `zod`.
- **Logging** — `nest-winston` ([`src/modules/logger`](src/modules/logger)).
- **Observability** — Sentry (`@sentry/nestjs`), initialised first in [`src/main.ts`](src/main.ts).
- **Docs** — Swagger at [`/docs`](http://localhost:3000/docs) (see [`src/config/swagger.config.ts`](src/config/swagger.config.ts)).
- **Tests** — Vitest with `vitest-mock-extended`. Unit tests only at v1.

## Getting started

Prereqs: Node 22+, pnpm, Docker (for the dev Postgres).

```bash
pnpm install
cp .env.example .env                # then fill in Google OAuth + JWT_SECRET
docker compose -f docker-compose.dev.yml --env-file .env up -d
pnpm migration:run                  # apply schema + seed migrations
pnpm start:dev                      # http://localhost:3000  •  docs at /docs
```

`DB_RUN_MIGRATIONS=true` in `.env` will auto-run migrations on each boot; flip it to `false` if you'd rather control timing manually.

### Useful scripts

| Command | What it does |
| --- | --- |
| `pnpm start:dev` | Watch-mode dev server |
| `pnpm start:debug` | Watch + debugger attached |
| `pnpm start:prod` | Run the built bundle (`dist/main`) |
| `pnpm build` | `nest build` |
| `pnpm lint` | ESLint over `src` + `test` |
| `pnpm type` | `tsc --noEmit` |
| `pnpm test` | Vitest one-shot |
| `pnpm test:watch` | Vitest watch mode |
| `pnpm test:cov` | Vitest with coverage |
| `pnpm migration:generate` | Diff entities vs DB, write a new migration |
| `pnpm migration:run` | Apply pending migrations |
| `pnpm migration:revert` | Roll back the last migration |

## Environment variables

All of the variables in [`.env.example`](.env.example) are validated on boot via `validateEnvs`; a missing value crashes the cold start so misconfigured deploys fail loud. The full list:

- **Application** — `NODE_ENV`, `PORT`
- **Frontend** — `FRONTEND_URL` (must match the FE origin for CORS + cookies), `COOKIE_DOMAIN`
- **Database** — `DB_HOST`, `DB_PORT`, `DB_USERNAME`, `DB_PASSWORD`, `DB_DATABASE`, `DB_SYNCHRONIZE`, `DB_RUN_MIGRATIONS`, `DB_LOGGING`, `DB_DISABLE_SSL_AUTH`
- **Auth** — `JWT_SECRET` (≥64 random chars), `JWT_EXPIRE`, `COOKIE_NAME`
- **Google OAuth** — `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_CALLBACK_URL`
- **Sentry** — `SENTRY_DSN`, `SENTRY_ENABLE`

## API surface

All routes are prefixed `/api` (set globally in [`main.ts`](src/main.ts)). Every response goes through `ResponseWrapperInterceptor`:

```jsonc
// success
{ "status": "Success", "hasData": true, "data": { /* … */ } }

// error
{ "status": "Error", "hasData": false, "errorCode": "...", "errorStatusCode": 404, "errorMessage": "..." }
```

### Auth
```
GET  /api/auth/google             302 to Google
GET  /api/auth/google/callback    sets bunker_session cookie, redirects to FRONTEND_URL
POST /api/auth/logout             clears cookie
GET  /api/auth/me                 { id, name, email, avatarUrl }
```

### Rooms
```
POST   /api/rooms                                creates a room; caller becomes admin + participant #1
POST   /api/rooms/:code/join                     joins LOBBY room (idempotent)
GET    /api/rooms/:code                          room snapshot (POLLED at 1 s)
DELETE /api/rooms/:code/participants/:userId    admin kicks a participant
POST   /api/rooms/:code/leave                    voluntary leave; admin promotion if needed
POST   /api/rooms/:code/start                    admin only; LOBBY → IN_GAME, draws content
```

### Game
```
GET  /api/rooms/:code/game           game snapshot (POLLED) — apocalypse, shelter, myCharacter, players[]
POST /api/rooms/:code/game/reveal    reveal one of MY attributes (idempotent)
POST /api/rooms/:code/finish         admin only; IN_GAME → FINISHED
```

There is **no** "request to reveal someone else's card" endpoint — the reveal model is locked to own-card only.

## Domain shape (high level)

- **User** — Google-linked profile.
- **Room** + **RoomParticipant** — code is `char(4)` A–Z, unique. Seat numbers are stable across reconnects.
- **Apocalypse, Shelter, BiologyAge/Weight/Sex/Gender/Race, Trait** — content tables, seeded via migrations (see [`scripts/generate-game-seed-migration.cjs`](scripts/generate-game-seed-migration.cjs) and [`scripts/parse-xlsx.cjs`](scripts/parse-xlsx.cjs)).
- **PlayerCharacter** + **PlayerCharacterTrait** — per-run payload, generated atomically when the admin presses Start.
- **PlayerReveal** — append-only log of what each player has revealed. Reveals are global — once shown, every player sees them on their next poll.

Full data model and design rationale live in [`TASK.md`](TASK.md).

## Conventions

- TypeScript strict, no `any`.
- Arrow functions, early-exit pattern, no single-letter variable names — apply the global house style.
- Randomness uses `crypto.randomInt`, not `Math.random` (room codes, character draws, reveal ordering).
- All DTOs validated with `class-validator`; reject unknown fields.
- Errors flow through the custom exception filters in [`src/common/exception-filters/`](src/common/exception-filters) so the response envelope stays consistent.

## Deployment (Vercel)

The Nest app is wrapped as a single serverless function in [`api/index.ts`](api/index.ts); [`vercel.json`](vercel.json) rewrites all requests to it.

- Set every variable from `.env.example` in **Project Settings → Environment Variables** for Production / Preview / Development. `validateEnvs` will hard-fail boot if anything is missing.
- `PORT` is ignored on Vercel (the platform owns the HTTP server) but the zod schema still requires it — set it to any number.
- `FRONTEND_URL` must match the Vercel FE origin so CORS allows credentials.
- `GOOGLE_CALLBACK_URL` must equal the deployed BE origin + `/api/auth/google/callback`, and the same URL must be whitelisted in the Google OAuth client.
- Use a **pooled** Postgres connection string (Supabase / Neon pooler). Each warm worker holds its own pool; an unpooled DB will run out of slots.
- `DB_RUN_MIGRATIONS=true` runs migrations on every cold start (idempotent, ~hundreds of ms). Flip to `false` and run `pnpm migration:run` manually if you'd rather control timing.

## Project layout

```
src/
  main.ts                  Bootstrap: cookie-parser, CORS, Swagger, AppLogger
  app.module.ts            Root module wiring
  config/                  env / sentry / swagger / typeorm config
  common/                  guards, interceptors, filters, decorators, shared utils
  modules/
    auth/                  Google strategy + JWT cookie issuance + /auth/me
    user/                  user DTOs
    rooms/                 lobby phase — create, join, leave, kick, start
    game/                  in-game phase — snapshot + reveals + finish
    database/              TypeORM module
    logger/                winston-backed AppLogger
  migrations/              TypeORM SQL migrations (schema + seed content)
api/
  index.ts                 Vercel serverless entry that boots the Nest app
scripts/
  parse-xlsx.cjs           parse content workbook → JSON
  generate-game-seed-migration.cjs   emit a TypeORM migration from the JSON
test/                      Vitest tests (unit)
```

For schema rationale, endpoint contracts, and the start-of-game algorithm see [`TASK.md`](TASK.md).
