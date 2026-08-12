package http

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"log/slog"
	"net/http"
	"os"
	"strings"
	"time"

	"github.com/KazukiKandaKK/qr/backend/internal/config"
	gql "github.com/KazukiKandaKK/qr/backend/internal/delivery/graphql"
	"github.com/KazukiKandaKK/qr/backend/internal/usecase"
	"github.com/graph-gophers/graphql-go"
	"github.com/graph-gophers/graphql-go/relay"
	"github.com/rs/cors"
	"golang.org/x/time/rate"
)

type Server struct {
	cfg     *config.Config
	rss     *usecase.RssUseCase
	auth    *usecase.AuthUseCase
	issuer  usecase.TokenIssuer
	logger  *slog.Logger
	schema  *graphql.Schema
	handler http.Handler
	limiter *authLimiter
}

func NewServer(cfg *config.Config, rss *usecase.RssUseCase, auth *usecase.AuthUseCase, issuer usecase.TokenIssuer, logger *slog.Logger) (*Server, error) {
	s := &Server{
		cfg:    cfg,
		rss:    rss,
		auth:   auth,
		issuer: issuer,
		logger: logger,
	}

	opts := []graphql.SchemaOpt{graphql.UseFieldResolvers()}
	if cfg.MaxDepth > 0 {
		opts = append(opts, graphql.MaxDepth(cfg.MaxDepth))
	}

	resolver := &gql.Resolver{
		Rss:    rss,
		Auth:   auth,
		Logger: logger,
	}

	schema, err := graphql.ParseSchema(gql.Schema, resolver, opts...)
	if err != nil {
		return nil, fmt.Errorf("failed to parse schema: %w", err)
	}
	s.schema = schema
	s.limiter = newAuthLimiter(cfg.RateLimitWindow(), cfg.RateLimitMax)

	relayHandler := &relay.Handler{Schema: schema}
	mux := http.NewServeMux()
	mux.HandleFunc("/health", s.healthHandler)
	mux.HandleFunc("/.well-known/security.txt", s.securityTxtHandler)
	mux.HandleFunc("/security.txt", func(w http.ResponseWriter, r *http.Request) {
		http.Redirect(w, r, "/.well-known/security.txt", http.StatusMovedPermanently)
	})
	mux.Handle("/graphql", s.withContext(s.withRateLimit(relayHandler)))
	if cfg.FrontendDist != "" {
		mux.Handle("/", s.staticHandler(cfg.FrontendDist))
	}

	corsOrigin, creds := cfg.CORSOriginValue()
	s.handler = cors.New(cors.Options{
		AllowedOrigins: corsOriginToStrings(corsOrigin),
		AllowedMethods: []string{http.MethodGet, http.MethodPost, http.MethodOptions},
		AllowedHeaders: []string{"*"},
		AllowCredentials: creds,
	}).Handler(securityHeaders(mux))
	return s, nil
}

func (s *Server) Handler() http.Handler { return s.handler }

func (s *Server) Addr() string {
	return fmt.Sprintf(":%d", s.cfg.Port)
}

func (s *Server) healthHandler(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(map[string]any{
		"status":    "ok",
		"timestamp": time.Now().UTC().Format(time.RFC3339),
	})
}

func (s *Server) securityTxtHandler(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "text/plain; charset=utf-8")
	_, _ = w.Write([]byte(securityTxt()))
}

func (s *Server) withContext(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		ctx := r.Context()

		ip := clientIP(r)
		ua := r.Header.Get("User-Agent")
		ctx = gql.WithRequestMeta(ctx, ip, ua)

		if token := extractBearerToken(r.Header.Get("Authorization")); token != "" {
			if user, err := s.issuer.Verify(token); err == nil {
				ctx = gql.WithUser(ctx, &user)
			}
		}

		next.ServeHTTP(w, r.WithContext(ctx))
	})
}

func (s *Server) withRateLimit(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if s.cfg.RateLimitDisabled || s.cfg.Env == "test" {
			next.ServeHTTP(w, r)
			return
		}
		body, err := io.ReadAll(r.Body)
		if err != nil {
			http.Error(w, "bad request", http.StatusBadRequest)
			return
		}
		r.Body = io.NopCloser(bytes.NewBuffer(body))

		if isAuthMutation(body) {
			ip := clientIP(r)
			if !s.limiter.Allow(ip) {
				http.Error(w, "Too many authentication requests, please try again later.", http.StatusTooManyRequests)
				return
			}
		}

		next.ServeHTTP(w, r)
	})
}

func extractBearerToken(header string) string {
	if !strings.HasPrefix(strings.ToLower(header), "bearer ") {
		return ""
	}
	return strings.TrimSpace(header[7:])
}

func clientIP(r *http.Request) string {
	fwd := r.Header.Get("X-Forwarded-For")
	if fwd != "" {
		parts := strings.Split(fwd, ",")
		if len(parts) > 0 {
			return strings.TrimSpace(parts[0])
		}
	}
	ip := r.Header.Get("X-Real-Ip")
	if ip != "" {
		return ip
	}
	return r.RemoteAddr
}

func isAuthMutation(body []byte) bool {
	var payload struct {
		Query string `json:"query"`
	}
	if err := json.Unmarshal(body, &payload); err != nil {
		return false
	}
	q := strings.ToLower(payload.Query)
	return strings.Contains(q, "mutation") && (strings.Contains(q, "register") || strings.Contains(q, "login"))
}

func securityHeaders(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("X-Content-Type-Options", "nosniff")
		w.Header().Set("X-Frame-Options", "DENY")
		w.Header().Set("X-XSS-Protection", "1; mode=block")
		w.Header().Set("Referrer-Policy", "strict-origin-when-cross-origin")
		w.Header().Set("Content-Security-Policy", "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self'; font-src 'self'; object-src 'none'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'")
		w.Header().Set("Strict-Transport-Security", "max-age=31536000; includeSubDomains; preload")
		next.ServeHTTP(w, r)
	})
}

func securityTxt() string {
	return "Contact: mailto:security@example.com\n" +
		"Expires: 2027-12-31T00:00:00.000Z\n" +
		"Acknowledgments: /security-acknowledgments\n" +
		"Policy: /security-policy\n" +
		"\n" +
		"# This is a sample security.txt for ISO 27017 readiness.\n" +
		"# Replace the contact and policy URLs with real values before production.\n"
}

func (s *Server) staticHandler(root string) http.Handler {
	dir := http.Dir(root)
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		path := strings.TrimPrefix(r.URL.Path, "/")
		if path == "" {
			path = "index.html"
		}
		f, err := dir.Open(path)
		if err == nil {
			_ = f.Close()
		}
		if os.IsNotExist(err) {
			r.URL.Path = "/index.html"
		}
		http.FileServer(dir).ServeHTTP(w, r)
	})
}

func corsOriginToStrings(origin any) []string {
	switch v := origin.(type) {
	case []string:
		return v
	case string:
		return []string{v}
	default:
		return nil
	}
}

type authLimiter struct {
	window   time.Duration
	max      int
	visitors map[string]*visitor
}

type visitor struct {
	limiter  *rate.Limiter
	lastSeen time.Time
}

func newAuthLimiter(window time.Duration, max int) *authLimiter {
	return &authLimiter{window: window, max: max, visitors: make(map[string]*visitor)}
}

func (l *authLimiter) Allow(ip string) bool {
	v, ok := l.visitors[ip]
	if !ok {
		v = &visitor{limiter: rate.NewLimiter(rate.Every(l.window/time.Duration(l.max)), l.max)}
		l.visitors[ip] = v
	}
	v.lastSeen = time.Now()
	return v.limiter.Allow()
}
