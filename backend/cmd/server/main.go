package main

import (
	"context"
	"fmt"
	"io"
	"log/slog"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/KazukiKandaKK/qr/backend/internal/config"
	httpdelivery "github.com/KazukiKandaKK/qr/backend/internal/delivery/http"
	"github.com/KazukiKandaKK/qr/backend/internal/repository"
	"github.com/KazukiKandaKK/qr/backend/internal/rss"
	"github.com/KazukiKandaKK/qr/backend/internal/security"
	"github.com/KazukiKandaKK/qr/backend/internal/usecase"
	"gorm.io/gorm/logger"
)

func main() {
	cfg, err := config.Load()
	if err != nil {
		fmt.Fprintf(os.Stderr, "config error: %v\n", err)
		os.Exit(1)
	}

	var logHandler slog.Handler = slog.NewTextHandler(os.Stdout, &slog.HandlerOptions{Level: cfg.LogLevelValue()})
	if cfg.LogFile != "" {
		logHandler = multiHandler(logHandler, cfg.LogFile, cfg.LogLevelValue())
	}
	logger := slog.New(logHandler)

	db, err := repository.NewDB(cfg.DatabaseURL, logLevelForGORM(cfg.LogLevelValue()))
	if err != nil {
		logger.Error("database error", slog.String("error", err.Error()))
		os.Exit(1)
	}

	rssRepo := repository.NewRssRepository(db)
	userRepo := repository.NewUserRepository(db)
	auditRepo := repository.NewAuditRepository(db)

	hasher := security.NewBcryptHasher(10)
	issuer := security.NewJWTIssuer(cfg.JWTSecret, cfg.JWTExpiresIn)

	rssParser := rss.NewParser()
	rssUseCase := usecase.NewRssUseCase(rssRepo, rssParser.Parse, logger)
	authUseCase := usecase.NewAuthUseCase(userRepo, auditRepo, hasher, issuer, cfg.MaxFailedLogins, cfg.LockoutDuration(), logger)

	server, err := httpdelivery.NewServer(cfg, rssUseCase, authUseCase, issuer, logger)
	if err != nil {
		logger.Error("server error", slog.String("error", err.Error()))
		os.Exit(1)
	}

	addr := server.Addr()
	httpServer := &http.Server{
		Addr:         addr,
		Handler:      server.Handler(),
		ReadTimeout:  10 * time.Second,
		WriteTimeout: 30 * time.Second,
		IdleTimeout:  60 * time.Second,
	}

	errChan := make(chan error, 1)
	go func() {
		logger.Info("server starting", slog.String("addr", addr))
		errChan <- httpServer.ListenAndServe()
	}()

	quit := make(chan os.Signal, 1)
	signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)

	select {
	case err := <-errChan:
		logger.Error("server error", slog.String("error", err.Error()))
		os.Exit(1)
	case sig := <-quit:
		logger.Info("shutting down", slog.String("signal", sig.String()))
		ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
		defer cancel()
		if err := httpServer.Shutdown(ctx); err != nil {
			logger.Error("shutdown error", slog.String("error", err.Error()))
			os.Exit(1)
		}
	}
}

func logLevelForGORM(level slog.Level) logger.LogLevel {
	switch {
	case level <= slog.LevelDebug:
		return logger.Info
	default:
		return logger.Silent
	}
}

func multiHandler(base slog.Handler, path string, level slog.Level) slog.Handler {
	f, err := os.OpenFile(path, os.O_APPEND|os.O_CREATE|os.O_WRONLY, 0644)
	if err != nil {
		return base
	}
	return slog.NewTextHandler(io.MultiWriter(os.Stdout, f), &slog.HandlerOptions{Level: level})
}
