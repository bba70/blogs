package config

import (
	"fmt"
	"net/url"
	"os"
	"strconv"
	"strings"

	"golang.org/x/crypto/bcrypt"
)

// MinJWTSecretLen 是 AUTH_JWT_SECRET 的最小字节数，低于该长度的密钥拒绝启动。
const MinJWTSecretLen = 32

type Config struct {
	Server    ServerConfig
	DB        DBConfig
	Auth      AuthConfig
	UploadDir string
}

type ServerConfig struct {
	Port int
}

type DBConfig struct {
	Host     string
	Port     int
	User     string
	Password string
	Name     string
	SSLMode  string
}

// AuthConfig 承载单作者认证配置。密码哈希与 JWT 密钥缺失或非法时，
// 服务器必须在监听端口前终止启动，不允许降级为无认证运行。
type AuthConfig struct {
	// PasswordHash 是作者密码的 bcrypt 哈希，必填。
	PasswordHash string
	// JWTSecret 是 HS256 会话签名密钥，必填且不少于 MinJWTSecretLen 字节。
	JWTSecret string
	// CookieSecure 为 true 时作者会话 Cookie 只通过 HTTPS 发送；
	// 生产环境必须为 true，本地 HTTP 开发必须显式设为 false。
	CookieSecure bool
	// AllowedOrigins 是允许发起非安全方法请求的明确来源列表，不接受通配符。
	AllowedOrigins []string
}

func (d DBConfig) DSN() string {
	return fmt.Sprintf("postgres://%s:%s@%s:%d/%s?sslmode=%s",
		d.User, d.Password, d.Host, d.Port, d.Name, d.SSLMode,
	)
}

// Load 读取环境变量（可被项目根目录 .env 文件补充），并执行统一校验。
// 认证配置缺失或非法时返回错误，调用方应终止启动。
func Load() (*Config, error) {
	loadDotEnv(".env")

	cfg := &Config{
		UploadDir: envStr("UPLOAD_DIR", "uploads"),
		Server: ServerConfig{
			Port: envInt("SERVER_PORT", 8080),
		},
		DB: DBConfig{
			Host:     envStr("DB_HOST", "localhost"),
			Port:     envInt("DB_PORT", 5432),
			User:     envStr("DB_USER", "blogs"),
			Password: envStr("DB_PASSWORD", "blogs"),
			Name:     envStr("DB_NAME", "blogs"),
			SSLMode:  envStr("DB_SSLMODE", "disable"),
		},
		Auth: AuthConfig{
			PasswordHash:   os.Getenv("AUTH_PASSWORD_HASH"),
			JWTSecret:      os.Getenv("AUTH_JWT_SECRET"),
			AllowedOrigins: parseOrigins(envStr("AUTH_ALLOWED_ORIGINS", defaultLocalOrigins)),
		},
	}

	secure, present := os.LookupEnv("AUTH_COOKIE_SECURE")
	if !present {
		// 默认只允许 HTTPS 建立会话；本地 HTTP 开发必须显式关闭。
		cfg.Auth.CookieSecure = true
	} else {
		v, err := strconv.ParseBool(secure)
		if err != nil {
			return nil, fmt.Errorf("AUTH_COOKIE_SECURE must be true or false, got %q", secure)
		}
		cfg.Auth.CookieSecure = v
	}

	if err := cfg.Auth.validate(); err != nil {
		return nil, err
	}
	return cfg, nil
}

// defaultLocalOrigins 只在本机开发未显式配置来源时使用，
// 生产部署必须通过 AUTH_ALLOWED_ORIGINS 列出真实来源。
const defaultLocalOrigins = "http://localhost:3000,http://localhost:5173"

func (a AuthConfig) validate() error {
	if a.PasswordHash == "" {
		return fmt.Errorf("AUTH_PASSWORD_HASH is required; generate one with `go run ./cmd/hashpass`")
	}
	if _, err := bcrypt.Cost([]byte(a.PasswordHash)); err != nil {
		// 只说明格式非法，不回显哈希内容。
		return fmt.Errorf("AUTH_PASSWORD_HASH is not a valid bcrypt hash")
	}

	if a.JWTSecret == "" {
		return fmt.Errorf("AUTH_JWT_SECRET is required; generate one with e.g. `openssl rand -hex 32`")
	}
	if len(a.JWTSecret) < MinJWTSecretLen {
		return fmt.Errorf("AUTH_JWT_SECRET must be at least %d bytes", MinJWTSecretLen)
	}

	if len(a.AllowedOrigins) == 0 {
		return fmt.Errorf("AUTH_ALLOWED_ORIGINS must list at least one origin")
	}
	for _, origin := range a.AllowedOrigins {
		if origin == "*" {
			return fmt.Errorf("AUTH_ALLOWED_ORIGINS must not contain a wildcard")
		}
		u, err := url.Parse(origin)
		if err != nil || u.Scheme == "" || u.Host == "" ||
			(u.Scheme != "http" && u.Scheme != "https") || u.User != nil ||
			u.Path != "" || u.RawQuery != "" || u.Fragment != "" {
			return fmt.Errorf("AUTH_ALLOWED_ORIGINS contains an invalid origin %q", origin)
		}
	}
	return nil
}

func parseOrigins(raw string) []string {
	var origins []string
	for _, part := range strings.Split(raw, ",") {
		if trimmed := strings.TrimSpace(part); trimmed != "" {
			origins = append(origins, trimmed)
		}
	}
	return origins
}

func envStr(key, fallback string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return fallback
}

func envInt(key string, fallback int) int {
	if v := os.Getenv(key); v != "" {
		if n, err := strconv.Atoi(v); err == nil {
			return n
		}
	}
	return fallback
}
