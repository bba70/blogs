#!/usr/bin/env sh

set -eu

project_dir=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
cd "$project_dir"

if ! command -v docker >/dev/null 2>&1; then
    echo "Error: Docker is not installed or is not available in PATH." >&2
    exit 1
fi

if ! docker compose version >/dev/null 2>&1; then
    echo "Error: Docker Compose v2 is not available." >&2
    exit 1
fi

if [ ! -f .env ]; then
    cp .env.example .env
    echo "Created .env from .env.example."
fi

if grep -q '^AUTH_PASSWORD_HASH=$' .env; then
    echo "Error: Configure AUTH_PASSWORD_HASH in .env before starting." >&2
    echo "Generate it with: go run ./cmd/hashpass" >&2
    exit 1
fi

if grep -q '^AUTH_JWT_SECRET=$' .env; then
    echo "Error: Configure AUTH_JWT_SECRET in .env before starting." >&2
    echo "Generate one with: openssl rand -hex 32" >&2
    exit 1
fi

echo "Building and starting database, API, and web services..."
docker compose up -d --build

echo
docker compose ps
echo
echo "Default site URL: http://localhost:3000"
