.PHONY: dev build run migrate-up migrate-down

DB_URL=postgres://blogs:blogs@localhost:5432/blogs?sslmode=disable

dev:
	docker compose up -d
	go run cmd/server/main.go

build:
	go build -o bin/server cmd/server/main.go

run: build
	./bin/server

migrate-up:
	goose -dir internal/database/migrations postgres "$(DB_URL)" up

migrate-down:
	goose -dir internal/database/migrations postgres "$(DB_URL)" down

sqlc:
	sqlc generate -f sqlc.yaml

tidy:
	go mod tidy
