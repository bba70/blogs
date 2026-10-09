package main

import (
	"context"
	"fmt"
	"log/slog"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/go-chi/chi/v5"
	chiMiddleware "github.com/go-chi/chi/v5/middleware"
	"github.com/go-chi/cors"

	"github.com/bba70/blogs/internal/config"
	"github.com/bba70/blogs/internal/database"
	"github.com/bba70/blogs/internal/middleware"
	"github.com/bba70/blogs/internal/module/auth"
	blogModule "github.com/bba70/blogs/internal/module/blog"
	"github.com/bba70/blogs/internal/module/media"
)

func main() {
	cfg, err := config.Load()
	if err != nil {
		// 认证配置缺失或非法时拒绝启动，不以关闭认证或默认密码方式降级。
		slog.Error("load config", "error", err)
		os.Exit(1)
	}

	slog.Info("starting server", "port", cfg.Server.Port)

	ctx := context.Background()

	if err := database.RunMigrations(cfg.DB); err != nil {
		slog.Error("run migrations", "error", err)
		os.Exit(1)
	}

	pool, err := database.NewPool(ctx, cfg.DB)
	if err != nil {
		slog.Error("connect database", "error", err)
		os.Exit(1)
	}
	defer pool.Close()

	authSvc, err := auth.NewService(cfg.Auth.PasswordHash, cfg.Auth.JWTSecret)
	if err != nil {
		slog.Error("init auth service", "error", err)
		os.Exit(1)
	}

	repo := blogModule.NewRepository(pool)
	svc := blogModule.NewService(repo)
	handler := blogModule.NewHandler(svc)
	imageStorage, err := media.NewLocalStorage(cfg.UploadDir)
	if err != nil {
		slog.Error("init image storage", "error", err)
		os.Exit(1)
	}
	mediaHandler := media.NewHandler(media.NewService(imageStorage), imageStorage)

	authHandler := auth.NewHandler(authSvc, auth.NewLoginLimiter(), cfg.Auth.CookieSecure)
	authMw := auth.NewMiddleware(authSvc)

	r := chi.NewRouter()
	// 作者会话走 HttpOnly Cookie，跨域请求必须携带凭证：
	// AllowedOrigins 使用配置中的明确来源列表，不允许通配符与凭证混用。
	// 同源部署（Nginx/Vite 代理 /api）下浏览器仍会携带 Origin，
	// 非安全方法的来源校验由 OriginGuard 统一执行。
	r.Use(cors.Handler(cors.Options{
		AllowedOrigins:   cfg.Auth.AllowedOrigins,
		AllowedMethods:   []string{"GET", "POST", "PUT", "DELETE", "OPTIONS"},
		AllowedHeaders:   []string{"Accept", "Content-Type"},
		AllowCredentials: true,
		MaxAge:           300,
	}))
	r.Use(middleware.OriginGuard(cfg.Auth.AllowedOrigins))
	r.Use(chiMiddleware.RequestID)
	// RealIP 只信任来自受控代理网段的 X-Real-IP / X-Forwarded-For；
	// 部署时不得让公网绕过代理直接访问 API 端口，否则按 IP 的限流会失真。
	r.Use(middleware.RealIP())
	r.Use(middleware.Logger)
	r.Use(chiMiddleware.Recoverer)

	r.Route("/api/v1", func(r chi.Router) {
		r.Use(authMw.Identity)
		r.Mount("/auth", authHandler.Routes())
		blogModule.RegisterRoutes(r, handler, authMw.RequireOwner)
		r.Mount("/media", mediaHandler.Routes(authMw.RequireOwner))
	})

	r.Get("/health", func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
		fmt.Fprint(w, "ok")
	})

	srv := &http.Server{
		Addr:         fmt.Sprintf(":%d", cfg.Server.Port),
		Handler:      r,
		ReadTimeout:  10 * time.Second,
		WriteTimeout: 30 * time.Second,
		IdleTimeout:  60 * time.Second,
	}

	done := make(chan os.Signal, 1)
	signal.Notify(done, os.Interrupt, syscall.SIGTERM)

	go func() {
		slog.Info("server listening", "addr", srv.Addr)
		if err := srv.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			slog.Error("server error", "error", err)
			os.Exit(1)
		}
	}()

	<-done
	slog.Info("shutting down...")

	shutdownCtx, cancel := context.WithTimeout(ctx, 10*time.Second)
	defer cancel()

	if err := srv.Shutdown(shutdownCtx); err != nil {
		slog.Error("server shutdown", "error", err)
	}

	slog.Info("server stopped")
}
