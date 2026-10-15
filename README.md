# Blog

A personal blog system built with Go and React.

## Start with Docker

Docker and Docker Compose v2 are required. The startup script builds and starts the frontend, backend, and PostgreSQL together.

- Linux/macOS: `sh start.sh`
- Windows: run `start.bat`

The default site URL is `http://localhost:3000`. On first startup, `.env.example` is copied to `.env`.

Before starting the complete stack, configure the single-owner credentials in `.env`:

1. Set `AUTH_PASSWORD='your-own-password'` in the root `.env` (1–72 bytes). The backend generates a bcrypt hash at startup. Alternatively, generate a hash with `go run ./cmd/hashpass` and set `AUTH_PASSWORD_HASH`; a non-empty hash takes precedence, so clear it when switching to `AUTH_PASSWORD`. Keep `.env` private and out of Git. Use single quotes for literal `$` and `#` characters in Docker Compose.
2. Generate a random secret of at least 32 bytes (for example, `openssl rand -hex 32`) and set `AUTH_JWT_SECRET`.
3. Keep `AUTH_COOKIE_SECURE=false` only for local HTTP. Production HTTPS deployments must set it to `true` and list their exact origin in `AUTH_ALLOWED_ORIGINS`.

The author login page is available directly at `/login`; it is intentionally not linked from the public navigation.

After changing the password, restart the local Go backend. For Docker, run `docker compose up -d --build api` to apply configuration and code changes; `docker compose restart` alone does not reload environment variables. Both password options being empty, an invalid explicit hash, or a plaintext password longer than 72 bytes (when no hash is configured) prevents the backend from starting. Password changes do not revoke existing sessions; rotate `AUTH_JWT_SECRET` as well if you need everyone to log in again.

## Article covers

In the editor's left article card (above the writing area on smaller screens), upload, replace or remove a cover, then save the article. JPEG, PNG and GIF images up to 5MB are supported. Covers appear in the archive, article lists and article detail header; older archive entries can fall back to the first Markdown image.

Images are stored in `uploads/` under the repository root when running the backend from the root. Set `UPLOAD_DIR` to change the local storage directory. Docker Compose mounts `./uploads` into `/app/uploads`, so uploaded files survive container recreation. The directory is ignored by Git and the Docker build; back it up along with the database.

The upload endpoint requires author authentication. Uploaded images have public URLs and are not private draft attachments. Removing or replacing a cover removes its article reference; existing files are retained. Local storage implements a small storage interface that can later be replaced with object storage.

After updating an already running backend, restart it to load the upload routes and run the new cover-field migration. For Docker, rebuild using the usual startup script. Both platform scripts use the same Compose configuration.
