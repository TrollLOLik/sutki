DATABASE_URL ?= postgres://sutki:sutki@localhost:5432/sutki?sslmode=disable
MIGRATIONS_DIR := db/migrations

.PHONY: help db-up db-down migrate-up migrate-down sqlc build run tidy

help:
	@echo "Targets:"
	@echo "  db-up        Start local PostgreSQL (docker compose)"
	@echo "  db-down      Stop local PostgreSQL"
	@echo "  migrate-up   Apply all up migrations"
	@echo "  migrate-down Roll back the last migration"
	@echo "  sqlc         Regenerate sqlc code"
	@echo "  build        go build ./..."
	@echo "  run          Run the API server"
	@echo "  tidy         go mod tidy"

db-up:
	docker compose up -d db

db-down:
	docker compose down

migrate-up:
	migrate -path $(MIGRATIONS_DIR) -database "$(DATABASE_URL)" up

migrate-down:
	migrate -path $(MIGRATIONS_DIR) -database "$(DATABASE_URL)" down 1

sqlc:
	sqlc generate

build:
	go build ./...

run:
	go run ./cmd/api

tidy:
	go mod tidy
