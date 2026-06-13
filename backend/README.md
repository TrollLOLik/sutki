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

| Method | Path                     | Description                         |
|--------|--------------------------|-------------------------------------|
| GET    | `/healthz`               | Liveness probe                      |
| GET    | `/api/v1/listings`       | Active listings (`?limit&offset`)   |
| GET    | `/api/v1/listings/{id}`  | Listing detail + photos/services    |

## Configuration

| Variable         | Default                  | Notes                                  |
|------------------|--------------------------|----------------------------------------|
| `HTTP_ADDR`      | `:8080`                  | HTTP listen address                    |
| `DATABASE_URL`   | —                        | Required; pgx connection string        |
| `MEDIA_BASE_URL` | empty                    | Prefix for stored relative media paths |
| `JWT_SECRET`     | empty                    | Used by auth endpoints (later phase)   |
