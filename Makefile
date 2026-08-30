.PHONY: dev build run docker-up docker-down docker-build docker-logs migrate-up migrate-down sqlc tidy

DB_URL=postgres://blogs:blogs@localhost:5432/blogs?sslmode=disable

dev:
	docker compose up -d db
	go run cmd/server/main.go

docker-up:
	docker compose up -d --build

docker-down:
	docker compose down

docker-build:
	docker compose build

docker-logs:
	docker compose logs -f

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
