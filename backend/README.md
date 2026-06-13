# sutki backend

Go API for the «Дом рядом» mobile app. Clean Architecture over the existing
PostgreSQL database (migrated from the legacy Symfony/Doctrine web project).

## Stack

- Go + [chi](https://github.com/go-chi/chi) router (`net/http` compatible)
- [pgx/v5](https://github.com/jackc/pgx) driver + `pgxpool`
- [sqlc](https://sqlc.dev) for type-safe queries
- [golang-migrate](https://github.com/golang-migrate/migrate) for migrations

## Layout

```
cmd/api/                      entrypoint (config, pool, wiring, graceful shutdown)
internal/config/              env-based configuration
internal/domain/              entities + repository interfaces (no deps)
internal/usecase/listing/     listing read use cases
internal/usecase/auth/        email-code auth + JWT issuing
internal/repository/postgres/ sqlc-backed repository implementation
  └── sqlc/                   generated code (do not edit)
internal/delivery/http/       chi router, handlers, DTOs
db/baseline/schema.sql        schema-only baseline (legacy prod schema, no data)
db/migrations/                additive golang-migrate migrations
db/queries/                   sqlc query sources
```

## Schema strategy

The legacy schema is the **baseline** (already live in production). We never
rewrite it; mobile-only gaps (VK ID, favorites, chat, push tokens, payments,
geo coords, refresh tokens) are added via **additive, idempotent** migrations in
`db/migrations`. `db/baseline/schema.sql` is schema-only (no PII) and is used for
local dev bootstrap and as sqlc input.

> Note on the converted dump: the MySQL→PostgreSQL data dump uses backslash
> escaping, so importing its `INSERT`s requires `SET standard_conforming_strings
> = off;` at the top, otherwise JSON columns (e.g. `user.roles`) fail to parse.

## Local development

```bash
cp .env.example .env
make db-up         # start PostgreSQL (applies db/baseline/schema.sql on init)
make migrate-up    # apply mobile additions
make run           # start the API on :8080
```

## Endpoints

| Method | Path                          | Auth   | Description                                |
|--------|-------------------------------|--------|--------------------------------------------|
| GET    | `/healthz`                    | —      | Liveness probe                             |
| GET    | `/api/v1/listings`            | —      | Active listings (`?limit&offset`)          |
| GET    | `/api/v1/listings/{id}`       | —      | Listing detail + photos/services           |
| POST   | `/api/v1/auth/email/request`  | —      | Send a 6-digit login code to an email      |
| POST   | `/api/v1/auth/email/verify`   | —      | Verify code → issue access/refresh tokens  |
| POST   | `/api/v1/auth/refresh`        | —      | Rotate refresh token → new token pair      |
| POST   | `/api/v1/auth/logout`         | —      | Revoke a refresh token                     |
| GET    | `/api/v1/me`                  | Bearer | Current user profile                       |
| PATCH  | `/api/v1/me`                  | Bearer | Update name / phone / city                 |

### Auth flow (email + 6-digit code)

1. `POST /auth/email/request` `{ "email": "a@b.ru" }` — generates a 6-digit
   code, bcrypt-hashes it, stores it with a 10-minute TTL. No SMTP yet: when
   `AUTH_EXPOSE_CODE=true` (dev), the code is logged and returned as `dev_code`.
   Re-requesting within 60s is rejected with `429` (resend cooldown).
2. `POST /auth/email/verify` `{ "email": "a@b.ru", "code": "123456" }` —
   verifies (max 5 attempts), upserts the user by email, returns
   `{ token_type, access_token, refresh_token, expires_in, user }`.
3. Use `Authorization: Bearer <access_token>` for `/me`. When the access token
   expires, call `POST /auth/refresh` `{ "refresh_token": "..." }` — the old
   refresh token is revoked (rotation) and a new pair is returned.
4. `POST /auth/logout` `{ "refresh_token": "..." }` revokes the refresh token.

Access tokens are HS256 JWTs. Refresh tokens are random opaque strings; only
their SHA-256 hash is stored. VK ID and phone (Voice OTP) login are deferred.

## Configuration

| Variable         | Default                  | Notes                                  |
|------------------|--------------------------|----------------------------------------|
| `HTTP_ADDR`      | `:8080`                  | HTTP listen address                    |
| `DATABASE_URL`   | —                        | Required; pgx connection string        |
| `MEDIA_BASE_URL` | empty                    | Prefix for stored relative media paths |
| `JWT_SECRET`     | empty                    | HS256 signing secret; random ephemeral if empty (dev) |
| `ACCESS_TOKEN_TTL`  | `15m`                 | Access token lifetime (Go duration)    |
| `REFRESH_TOKEN_TTL` | `720h`                | Refresh token lifetime (Go duration)   |
| `AUTH_EXPOSE_CODE`  | `false`               | Dev only: log + return login code in response. Off by default; `.env.example` enables it for local dev |
