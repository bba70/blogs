package config

import (
	"fmt"
	"os"
	"strconv"
)

type Config struct {
	Server ServerConfig
	DB     DBConfig
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

func (d DBConfig) DSN() string {
	return fmt.Sprintf("postgres://%s:%s@%s:%d/%s?sslmode=%s",
		d.User, d.Password, d.Host, d.Port, d.Name, d.SSLMode,
	)
}

func Load() *Config {
	return &Config{
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
	}
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
