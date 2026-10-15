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
	t.Setenv("AUTH_PASSWORD", "")
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

func TestLoadPlaintextPassword(t *testing.T) {
	for _, password := range []string{"local-author-password", " 带空格的密码 ", strings.Repeat("a", 72)} {
		t.Run(password, func(t *testing.T) {
			validAuthEnv(t)
			t.Setenv("AUTH_PASSWORD_HASH", "")
			t.Setenv("AUTH_PASSWORD", password)
			cfg, err := Load()
			if err != nil {
				t.Fatal(err)
			}
			if err := bcrypt.CompareHashAndPassword([]byte(cfg.Auth.PasswordHash), []byte(password)); err != nil {
				t.Fatalf("generated hash does not verify password: %v", err)
			}
			if err := bcrypt.CompareHashAndPassword([]byte(cfg.Auth.PasswordHash), []byte("wrong-password")); err == nil {
				t.Fatal("wrong password must be rejected")
			}
			if cost, err := bcrypt.Cost([]byte(cfg.Auth.PasswordHash)); err != nil || cost != bcrypt.DefaultCost {
				t.Fatalf("hash must use default cost: cost=%d err=%v", cost, err)
			}
		})
	}
}

func TestLoadPasswordHashTakesPrecedence(t *testing.T) {
	validAuthEnv(t)
	t.Setenv("AUTH_PASSWORD", strings.Repeat("a", 73))
	cfg, err := Load()
	if err != nil {
		t.Fatal(err)
	}
	if cfg.Auth.PasswordHash != testHash {
		t.Fatal("explicit hash must take precedence")
	}

	t.Setenv("AUTH_PASSWORD_HASH", "invalid-hash")
	if _, err := Load(); err == nil || !strings.Contains(err.Error(), "AUTH_PASSWORD_HASH") {
		t.Fatal("invalid explicit hash must fail instead of falling back to plaintext")
	}
}

func TestLoadRejectsOverlongPlaintextPassword(t *testing.T) {
	for _, password := range []string{strings.Repeat("a", 73), strings.Repeat("密", 25)} {
		validAuthEnv(t)
		t.Setenv("AUTH_PASSWORD_HASH", "")
		t.Setenv("AUTH_PASSWORD", password)
		_, err := Load()
		if err == nil || !strings.Contains(err.Error(), "72 bytes") {
			t.Fatalf("overlong password must fail: %v", err)
		}
		if strings.Contains(err.Error(), password) {
			t.Fatal("error must not contain password")
		}
	}
}

func TestLoadPlaintextPasswordFromDotEnv(t *testing.T) {
	validAuthEnv(t)
	t.Setenv("AUTH_PASSWORD_HASH", "")
	// Unset temporarily so .env can supply the value; Setenv restores the original environment.
	if err := os.Unsetenv("AUTH_PASSWORD"); err != nil {
		t.Fatal(err)
	}
	t.Chdir(t.TempDir())
	const password = "local$author#password"
	if err := os.WriteFile(".env", []byte("AUTH_PASSWORD='"+password+"'\n"), 0600); err != nil {
		t.Fatal(err)
	}
	cfg, err := Load()
	if err != nil {
		t.Fatal(err)
	}
	if err := bcrypt.CompareHashAndPassword([]byte(cfg.Auth.PasswordHash), []byte(password)); err != nil {
		t.Fatalf(".env password not loaded literally: %v", err)
	}

	t.Setenv("AUTH_PASSWORD", "process-password")
	cfg, err = Load()
	if err != nil {
		t.Fatal(err)
	}
	if err := bcrypt.CompareHashAndPassword([]byte(cfg.Auth.PasswordHash), []byte("process-password")); err != nil {
		t.Fatal("process environment must take precedence over .env")
	}
}
