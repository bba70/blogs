@echo off
chcp 65001 >nul
echo.
echo === Blogs Dev Server ===
echo.

REM Start Docker PostgreSQL if available (optional)
docker compose up -d db 2>nul
if %errorlevel% equ 0 (
    echo [OK] Docker PostgreSQL started.
) else (
    echo [Info] Skipping Docker PostgreSQL (using local PostgreSQL).
)

echo.
echo Starting server...
echo.
go run cmd/server/main.go

echo.
echo Server exited with code %errorlevel%.
pause
