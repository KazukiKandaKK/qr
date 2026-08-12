package graphql

import (
	"context"

	"github.com/KazukiKandaKK/qr/backend/internal/domain"
)

type contextKey string

const (
	userKey      contextKey = "user"
	ipKey        contextKey = "ip"
	userAgentKey contextKey = "userAgent"
)

func WithUser(ctx context.Context, user *domain.User) context.Context {
	return context.WithValue(ctx, userKey, user)
}

func userFromContext(ctx context.Context) (*domain.User, bool) {
	u, ok := ctx.Value(userKey).(*domain.User)
	return u, ok
}

func WithRequestMeta(ctx context.Context, ip, userAgent string) context.Context {
	if ip != "" {
		ctx = context.WithValue(ctx, ipKey, ip)
	}
	if userAgent != "" {
		ctx = context.WithValue(ctx, userAgentKey, userAgent)
	}
	return ctx
}

func requestMetaFromContext(ctx context.Context) (*string, *string) {
	var ip, ua *string
	if v, ok := ctx.Value(ipKey).(string); ok && v != "" {
		ip = &v
	}
	if v, ok := ctx.Value(userAgentKey).(string); ok && v != "" {
		ua = &v
	}
	return ip, ua
}
