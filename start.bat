@echo off
setlocal
cd /d "%~dp0"

where docker >nul 2>nul
if errorlevel 1 (
    echo Error: Docker is not installed or is not available in PATH.
    exit /b 1
)

docker compose version >nul 2>nul
if errorlevel 1 (
    echo Error: Docker Compose v2 is not available.
    exit /b 1
)

if not exist ".env" (
    copy /Y ".env.example" ".env" >nul
    echo Created .env from .env.example.
)

findstr /B /C:"AUTH_PASSWORD_HASH=" ".env" | findstr /X /C:"AUTH_PASSWORD_HASH=" >nul
if not errorlevel 1 (
    echo Error: Configure AUTH_PASSWORD_HASH in .env before starting.
    echo Generate it with: go run ./cmd/hashpass
    exit /b 1
)

findstr /B /C:"AUTH_JWT_SECRET=" ".env" | findstr /X /C:"AUTH_JWT_SECRET=" >nul
if not errorlevel 1 (
    echo Error: Configure AUTH_JWT_SECRET in .env before starting.
    echo Generate a random secret of at least 32 bytes.
    exit /b 1
)

echo Building and starting database, API, and web services...
docker compose up -d --build
if errorlevel 1 (
    echo Error: Failed to start the Docker services.
    exit /b 1
)

echo.
docker compose ps
echo.
echo Default site URL: http://localhost:3000

endlocal
