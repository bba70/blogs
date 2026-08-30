# Blog

A personal blog system built with Go and React.

## Start with Docker

Docker and Docker Compose v2 are required. The startup script builds and starts the frontend, backend, and PostgreSQL together.

- Linux/macOS: `sh start.sh`
- Windows: run `start.bat`

The default site URL is `http://localhost:3000`. On first startup, `.env.example` is copied to `.env`; edit that file to override ports or database credentials.
