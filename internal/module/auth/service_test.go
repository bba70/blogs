package auth

import (
	"encoding/base64"
	"testing"
	"time"

	"github.com/golang-jwt/jwt/v5"
	"golang.org/x/crypto/bcrypt"
)

const testSecret = "0123456789abcdef0123456789abcdef" // 32 字节

func mustHash(t *testing.T, password string) string {
	t.Helper()
	hash, err := bcrypt.GenerateFromPassword([]byte(password), bcrypt.MinCost)
	if err != nil {
		t.Fatalf("generate bcrypt hash: %v", err)
	}
	return string(hash)
}

func newTestService(t *testing.T, password, secret string) *Service {
	t.Helper()
	svc, err := NewService(mustHash(t, password), secret)
	if err != nil {
		t.Fatalf("NewService: %v", err)
	}
	return svc
}

func TestVerifyPassword(t *testing.T) {
	svc := newTestService(t, "correct-horse", testSecret)

	if !svc.VerifyPassword("correct-horse") {
		t.Error("correct password must verify")
	}
	if svc.VerifyPassword("wrong-password") {
		t.Error("wrong password must not verify")
	}
	if svc.VerifyPassword("") {
		t.Error("empty password must not verify")
	}
}

func TestNewServiceRejectsBadConfig(t *testing.T) {
	if _, err := NewService("not-a-bcrypt-hash", testSecret); err == nil {
		t.Error("invalid bcrypt hash must be rejected")
	}
	if _, err := NewService(mustHash(t, "pw"), "short-secret"); err == nil {
		t.Error("short jwt secret must be rejected")
	}
}

func TestTokenRoundTrip(t *testing.T) {
	svc := newTestService(t, "pw", testSecret)

	token, err := svc.IssueToken()
	if err != nil {
		t.Fatalf("IssueToken: %v", err)
	}
	if err := svc.ValidateToken(token); err != nil {
		t.Fatalf("ValidateToken on fresh token: %v", err)
	}
}

func TestValidateTokenRejects(t *testing.T) {
	svc := newTestService(t, "pw", testSecret)

	token, err := svc.IssueToken()
	if err != nil {
		t.Fatalf("IssueToken: %v", err)
	}

	t.Run("tampered signature", func(t *testing.T) {
		tampered := token[:len(token)-4] + "AAAA"
		if err := svc.ValidateToken(tampered); err == nil {
			t.Error("tampered token must be rejected")
		}
	})

	t.Run("wrong secret", func(t *testing.T) {
		other := newTestService(t, "pw", "fedcba9876543210fedcba9876543210")
		otherToken, err := other.IssueToken()
		if err != nil {
			t.Fatalf("IssueToken: %v", err)
		}
		if err := svc.ValidateToken(otherToken); err == nil {
			t.Error("token signed with another secret must be rejected")
		}
	})

	t.Run("expired", func(t *testing.T) {
		expiredSvc := newTestService(t, "pw", testSecret)
		expiredSvc.now = func() time.Time { return time.Now().Add(-8 * 24 * time.Hour) }
		expired, err := expiredSvc.IssueToken()
		if err != nil {
			t.Fatalf("IssueToken: %v", err)
		}
		if err := svc.ValidateToken(expired); err == nil {
			t.Error("expired token must be rejected")
		}
	})

	t.Run("wrong algorithm", func(t *testing.T) {
		signed := signClaims(t, []byte(testSecret), jwt.SigningMethodHS512, ownerClaims(time.Now()))
		if err := svc.ValidateToken(signed); err == nil {
			t.Error("HS512 token must be rejected when only HS256 is allowed")
		}
	})

	t.Run("alg none", func(t *testing.T) {
		header := base64.RawURLEncoding.EncodeToString([]byte(`{"alg":"none","typ":"JWT"}`))
		claims := base64.RawURLEncoding.EncodeToString([]byte(`{"sub":"owner","iss":"` + TokenIssuer + `"}`))
		if err := svc.ValidateToken(header + "." + claims + "."); err == nil {
			t.Error("alg=none token must be rejected")
		}
	})

	t.Run("wrong issuer", func(t *testing.T) {
		claims := ownerClaims(time.Now())
		claims.Issuer = "evil-issuer"
		signed := signClaims(t, []byte(testSecret), jwt.SigningMethodHS256, claims)
		if err := svc.ValidateToken(signed); err == nil {
			t.Error("token with wrong issuer must be rejected")
		}
	})

	t.Run("wrong audience", func(t *testing.T) {
		claims := ownerClaims(time.Now())
		claims.Audience = jwt.ClaimStrings{"evil-audience"}
		signed := signClaims(t, []byte(testSecret), jwt.SigningMethodHS256, claims)
		if err := svc.ValidateToken(signed); err == nil {
			t.Error("token with wrong audience must be rejected")
		}
	})

	t.Run("wrong subject", func(t *testing.T) {
		claims := ownerClaims(time.Now())
		claims.Subject = "someone-else"
		signed := signClaims(t, []byte(testSecret), jwt.SigningMethodHS256, claims)
		if err := svc.ValidateToken(signed); err == nil {
			t.Error("token with wrong subject must be rejected")
		}
	})
}

func ownerClaims(now time.Time) jwt.RegisteredClaims {
	return jwt.RegisteredClaims{
		Subject:   OwnerSubject,
		Issuer:    TokenIssuer,
		Audience:  jwt.ClaimStrings{TokenAudience},
		IssuedAt:  jwt.NewNumericDate(now),
		ExpiresAt: jwt.NewNumericDate(now.Add(SessionTTL)),
	}
}

func signClaims(t *testing.T, secret []byte, method jwt.SigningMethod, claims jwt.RegisteredClaims) string {
	t.Helper()
	signed, err := jwt.NewWithClaims(method, claims).SignedString(secret)
	if err != nil {
		t.Fatalf("sign claims: %v", err)
	}
	return signed
}
