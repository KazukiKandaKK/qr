package config

import (
	"fmt"
	"log/slog"
	"strings"
	"time"

	"github.com/caarlos0/env/v11"
	"github.com/joho/godotenv"
)

type Config struct {
	Env               string        `env:"NODE_ENV" envDefault:"development"`
	Port              int           `env:"PORT" envDefault:"4000"`
	DatabaseURL       string        `env:"DATABASE_URL" envDefault:"file:./dev.db"`
	JWTSecret         string        `env:"JWT_SECRET" envDefault:"dev-secret-do-not-use-in-production"`
	JWTExpiresIn      time.Duration   `env:"JWT_EXPIRES_IN" envDefault:"168h"`
	CORSOrigin        string        `env:"CORS_ORIGIN" envDefault:"*"`
	CORSCredentials   bool          `env:"CORS_CREDENTIALS" envDefault:"false"`
	MaxDepth          int           `env:"GRAPHQL_MAX_DEPTH" envDefault:"10"`
	RateLimitMax      int           `env:"RATE_LIMIT_MAX" envDefault:"20"`
	RateLimitWindowMs int           `env:"RATE_LIMIT_WINDOW_MS" envDefault:"900000"`
	RateLimitDisabled bool          `env:"RATE_LIMIT_DISABLED" envDefault:"false"`
	MaxFailedLogins   int           `env:"AUTH_MAX_FAILED_LOGINS" envDefault:"5"`
	LockoutDurationMs int           `env:"AUTH_LOCKOUT_DURATION_MS" envDefault:"900000"`
	LogLevel          string        `env:"LOG_LEVEL" envDefault:"info"`
	LogFile           string        `env:"LOG_FILE" envDefault:""`
	FrontendDist      string        `env:"FRONTEND_DIST" envDefault:"../frontend/dist"`
}

func Load() (*Config, error) {
	_ = godotenv.Load(".env")

	var cfg Config
	if err := env.Parse(&cfg); err != nil {
		return nil, fmt.Errorf("failed to parse env: %w", err)
	}

	if cfg.Env == "production" {
		if cfg.JWTSecret == "dev-secret-do-not-use-in-production" {
			return nil, fmt.Errorf("JWT_SECRET must be changed from the default value in production")
		}
		if len(cfg.JWTSecret) < 32 {
			return nil, fmt.Errorf("JWT_SECRET must be at least 32 characters in production")
		}
		if cfg.CORSOrigin == "*" {
			return nil, fmt.Errorf("CORS_ORIGIN must not be \"*\" in production; set it to your frontend origin or \"false\"")
		}
	}

	return &cfg, nil
}

func (c *Config) LogLevelValue() slog.Level {
	switch strings.ToLower(c.LogLevel) {
	case "debug":
		return slog.LevelDebug
	case "info":
		return slog.LevelInfo
	case "warn":
		return slog.LevelWarn
	case "error":
		return slog.LevelError
	default:
		return slog.LevelInfo
	}
}

func (c *Config) CORSOriginValue() (any, bool) {
	switch strings.ToLower(c.CORSOrigin) {
	case "*":
		return true, false
	case "false", "":
		return nil, false
	default:
		return []string{c.CORSOrigin}, c.CORSCredentials
	}
}

func (c *Config) RateLimitWindow() time.Duration {
	return time.Duration(c.RateLimitWindowMs) * time.Millisecond
}

func (c *Config) LockoutDuration() time.Duration {
	return time.Duration(c.LockoutDurationMs) * time.Millisecond
}
