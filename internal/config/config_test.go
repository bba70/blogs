package config

import (
	"os"
	"strings"
	"testing"

	"golang.org/x/crypto/bcrypt"
)

const testHash = "$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy"

// validAuthEnv 设置一组合法的认证环境变量。
// 注意：不能在测试间并行运行，因为会修改进程环境变量。
func validAuthEnv(t *testing.T) {
	t.Helper()
	t.Setenv("AUTH_PASSWORD_HASH", testHash)
	t.Setenv("AUTH_JWT_SECRET", strings.Repeat("s", MinJWTSecretLen))
	t.Setenv("AUTH_COOKIE_SECURE", "false")
	t.Setenv("AUTH_ALLOWED_ORIGINS", "http://localhost:3000")
}

func TestLoadValidConfig(t *testing.T) {
	validAuthEnv(t)

	cfg, err := Load()
	if err != nil {
		t.Fatalf("Load: %v", err)
	}
	if cfg.Auth.PasswordHash != testHash {
		t.Error("PasswordHash not loaded")
	}
	if cfg.Auth.CookieSecure {
		t.Error("AUTH_COOKIE_SECURE=false must be honored")
	}
	if len(cfg.Auth.AllowedOrigins) != 1 || cfg.Auth.AllowedOrigins[0] != "http://localhost:3000" {
		t.Errorf("AllowedOrigins = %v", cfg.Auth.AllowedOrigins)
	}
}

func TestLoadDefaultsCookieSecureTrue(t *testing.T) {
	validAuthEnv(t)
	// 删除显式值，验证默认走 HTTPS-only。
	os.Unsetenv("AUTH_COOKIE_SECURE")

	cfg, err := Load()
	if err != nil {
		t.Fatalf("Load: %v", err)
	}
	if !cfg.Auth.CookieSecure {
		t.Error("CookieSecure must default to true")
	}
}

func TestLoadRejectsMissingOrInvalidAuth(t *testing.T) {
	cases := []struct {
		name    string
		mutate  func(t *testing.T)
		wantErr string
	}{
		{
			name:    "missing password hash",
			mutate:  func(t *testing.T) { t.Setenv("AUTH_PASSWORD_HASH", "") },
			wantErr: "AUTH_PASSWORD_HASH",
		},
		{
			name:    "invalid password hash",
			mutate:  func(t *testing.T) { t.Setenv("AUTH_PASSWORD_HASH", "not-bcrypt") },
			wantErr: "AUTH_PASSWORD_HASH",
		},
		{
			name:    "missing jwt secret",
			mutate:  func(t *testing.T) { t.Setenv("AUTH_JWT_SECRET", "") },
			wantErr: "AUTH_JWT_SECRET",
		},
		{
			name:    "short jwt secret",
			mutate:  func(t *testing.T) { t.Setenv("AUTH_JWT_SECRET", "short") },
			wantErr: "AUTH_JWT_SECRET",
		},
		{
			name:    "wildcard origin",
			mutate:  func(t *testing.T) { t.Setenv("AUTH_ALLOWED_ORIGINS", "*") },
			wantErr: "AUTH_ALLOWED_ORIGINS",
		},
		{
			name:    "invalid origin",
			mutate:  func(t *testing.T) { t.Setenv("AUTH_ALLOWED_ORIGINS", "not a url") },
			wantErr: "AUTH_ALLOWED_ORIGINS",
		},
		{
			name:    "origin with path",
			mutate:  func(t *testing.T) { t.Setenv("AUTH_ALLOWED_ORIGINS", "http://localhost:3000/login") },
			wantErr: "AUTH_ALLOWED_ORIGINS",
		},
		{
			name:    "invalid cookie secure flag",
			mutate:  func(t *testing.T) { t.Setenv("AUTH_COOKIE_SECURE", "maybe") },
			wantErr: "AUTH_COOKIE_SECURE",
		},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			validAuthEnv(t)
			tc.mutate(t)
			_, err := Load()
			if err == nil {
				t.Fatal("Load must fail")
			}
			if !strings.Contains(err.Error(), tc.wantErr) {
				t.Errorf("error = %q, want mention of %s", err.Error(), tc.wantErr)
			}
		})
	}
}

func TestGeneratedHashIsAccepted(t *testing.T) {
	validAuthEnv(t)
	hash, err := bcrypt.GenerateFromPassword([]byte("fresh-password"), bcrypt.MinCost)
	if err != nil {
		t.Fatal(err)
	}
	t.Setenv("AUTH_PASSWORD_HASH", string(hash))

	if _, err := Load(); err != nil {
		t.Fatalf("freshly generated hash must be accepted: %v", err)
	}
}
