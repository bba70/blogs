# Blog

A personal blog system built with Go and React.

## Start with Docker

Docker and Docker Compose v2 are required. The startup script builds and starts the frontend, backend, and PostgreSQL together.

- Linux/macOS: `sh start.sh`
- Windows: run `start.bat`

The default site URL is `http://localhost:3000`. On first startup, `.env.example` is copied to `.env`.

Before starting the complete stack, configure the single-owner credentials in `.env`:

1. Generate a bcrypt password hash with `go run ./cmd/hashpass` and set `AUTH_PASSWORD_HASH`.
2. Generate a random secret of at least 32 bytes (for example, `openssl rand -hex 32`) and set `AUTH_JWT_SECRET`.
3. Keep `AUTH_COOKIE_SECURE=false` only for local HTTP. Production HTTPS deployments must set it to `true` and list their exact origin in `AUTH_ALLOWED_ORIGINS`.

The author login page is available directly at `/login`; it is intentionally not linked from the public navigation.
