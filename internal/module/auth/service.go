package auth

import (
	"errors"
	"fmt"
	"time"

	"github.com/golang-jwt/jwt/v5"
	"golang.org/x/crypto/bcrypt"
)

const (
	// OwnerSubject 是 JWT 中唯一的身份主体；单作者博客只有作者这一个身份。
	OwnerSubject = "owner"
	// TokenIssuer 与 TokenAudience 是签发与校验时固定使用的 iss 和 aud。
	TokenIssuer   = "blogs-api"
	TokenAudience = "blogs-owner"
	// SessionTTL 是作者会话的固定有效期。这是产品规则（固定 7 天、不续期），
	// 不通过环境变量制造部署差异。
	SessionTTL = 7 * 24 * time.Hour
	// MinSecretLen 是 JWT 密钥的最小字节数。
	MinSecretLen = 32
)

// ErrInvalidCredentials 表示密码校验失败。对外统一映射为 401，
// 不区分“未配置”“密码不存在”或“密码错误”。
var ErrInvalidCredentials = errors.New("invalid credentials")

// Service 承担密码校验与 JWT 签发/验证，不依赖 HTTP 类型。
type Service struct {
	passwordHash []byte
	jwtSecret    []byte
	ttl          time.Duration
	now          func() time.Time
}

// NewService 构造认证服务。passwordHash 必须是合法 bcrypt 哈希，
// jwtSecret 必须满足最小长度；调用方（配置层）已先行校验时此处仍会复核。
func NewService(passwordHash, jwtSecret string) (*Service, error) {
	if _, err := bcrypt.Cost([]byte(passwordHash)); err != nil {
		return nil, fmt.Errorf("invalid bcrypt password hash: %w", err)
	}
	if len(jwtSecret) < MinSecretLen {
		return nil, fmt.Errorf("jwt secret must be at least %d bytes", MinSecretLen)
	}

	return &Service{
		passwordHash: []byte(passwordHash),
		jwtSecret:    []byte(jwtSecret),
		ttl:          SessionTTL,
		now:          time.Now,
	}, nil
}

// VerifyPassword 校验作者密码。
func (s *Service) VerifyPassword(password string) bool {
	if password == "" {
		return false
	}
	return bcrypt.CompareHashAndPassword(s.passwordHash, []byte(password)) == nil
}

// IssueToken 签发仅代表固定作者身份的 HS256 JWT。
func (s *Service) IssueToken() (string, error) {
	now := s.now()
	claims := jwt.RegisteredClaims{
		Subject:   OwnerSubject,
		Issuer:    TokenIssuer,
		Audience:  jwt.ClaimStrings{TokenAudience},
		IssuedAt:  jwt.NewNumericDate(now),
		ExpiresAt: jwt.NewNumericDate(now.Add(s.ttl)),
	}
	return jwt.NewWithClaims(jwt.SigningMethodHS256, claims).SignedString(s.jwtSecret)
}

// ValidateToken 校验 Token 的签名、算法、签发方、受众与过期时间。
// 签名算法固定为 HS256，不接受 Token 头部声明的其他算法。
func (s *Service) ValidateToken(tokenString string) error {
	token, err := jwt.Parse(tokenString, func(*jwt.Token) (any, error) {
		return s.jwtSecret, nil
	},
		jwt.WithValidMethods([]string{jwt.SigningMethodHS256.Alg()}),
		jwt.WithIssuer(TokenIssuer),
		jwt.WithAudience(TokenAudience),
		jwt.WithExpirationRequired(),
		jwt.WithIssuedAt(),
	)
	if err != nil {
		return err
	}
	if !token.Valid {
		return errors.New("invalid token")
	}
	subject, err := token.Claims.GetSubject()
	if err != nil || subject != OwnerSubject {
		return errors.New("unexpected token subject")
	}
	return nil
}
