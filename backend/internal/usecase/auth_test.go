package usecase

import (
	"context"
	"log/slog"
	"os"
	"testing"
	"time"

	"github.com/KazukiKandaKK/qr/backend/internal/domain"
	"github.com/KazukiKandaKK/qr/backend/internal/repository"
	"github.com/KazukiKandaKK/qr/backend/internal/security"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"gorm.io/gorm/logger"
)

func testAuth(t *testing.T) (*AuthUseCase, *repository.UserRepo, *repository.AuditRepo) {
	t.Helper()
	db, err := repository.NewDB("file::memory:?cache=shared", logger.Silent)
	require.NoError(t, err)
	t.Cleanup(func() {
		sqlDB, _ := db.DB()
		_ = sqlDB.Close()
	})
	userRepo := repository.NewUserRepository(db)
	auditRepo := repository.NewAuditRepository(db)
	hasher := security.NewBcryptHasher(10)
	issuer := security.NewJWTIssuer("test-secret-test-secret-test-secret", time.Hour)
	logger := slog.New(slog.NewTextHandler(os.Stdout, &slog.HandlerOptions{Level: slog.LevelError}))
	uc := NewAuthUseCase(userRepo, auditRepo, hasher, issuer, 5, 15*time.Minute, logger)
	return uc, userRepo, auditRepo
}

func ptr(s string) *string { return &s }

func TestAuthUseCase_RegisterFirstUserBecomesAdmin(t *testing.T) {
	uc, _, _ := testAuth(t)
	ctx := context.Background()
	user, err := uc.Register(ctx, domain.RegisterInput{
		Email:    "admin@example.com",
		Password: "Password1",
		Name:     ptr("Admin"),
	}, nil, nil)
	require.NoError(t, err)
	assert.Equal(t, domain.RoleAdmin, user.Role)
	assert.Equal(t, "admin@example.com", user.Email)
}

func TestAuthUseCase_RegisterSecondUserBecomesUser(t *testing.T) {
	uc, _, _ := testAuth(t)
	ctx := context.Background()
	_, err := uc.Register(ctx, domain.RegisterInput{Email: "first@example.com", Password: "Password1"}, nil, nil)
	require.NoError(t, err)
	user2, err := uc.Register(ctx, domain.RegisterInput{Email: "second@example.com", Password: "Password1"}, nil, nil)
	require.NoError(t, err)
	assert.Equal(t, domain.RoleUser, user2.Role)
}

func TestAuthUseCase_RegisterDuplicateEmail(t *testing.T) {
	uc, _, _ := testAuth(t)
	ctx := context.Background()
	_, err := uc.Register(ctx, domain.RegisterInput{Email: "a@example.com", Password: "Password1"}, nil, nil)
	require.NoError(t, err)
	_, err = uc.Register(ctx, domain.RegisterInput{Email: "a@example.com", Password: "Password1"}, nil, nil)
	assert.Error(t, err)
}

func TestAuthUseCase_WeakPasswordRejected(t *testing.T) {
	uc, _, _ := testAuth(t)
	ctx := context.Background()
	_, err := uc.Register(ctx, domain.RegisterInput{Email: "a@example.com", Password: "weak"}, nil, nil)
	assert.Error(t, err)
}

func TestAuthUseCase_LoginSuccess(t *testing.T) {
	uc, _, _ := testAuth(t)
	ctx := context.Background()
	_, err := uc.Register(ctx, domain.RegisterInput{Email: "a@example.com", Password: "Password1"}, nil, nil)
	require.NoError(t, err)
	payload, err := uc.Login(ctx, domain.LoginInput{Email: "a@example.com", Password: "Password1"}, nil, nil)
	require.NoError(t, err)
	assert.NotEmpty(t, payload.Token)
	assert.Equal(t, "a@example.com", payload.User.Email)
}

func TestAuthUseCase_LoginFailure(t *testing.T) {
	uc, _, _ := testAuth(t)
	ctx := context.Background()
	_, err := uc.Register(ctx, domain.RegisterInput{Email: "a@example.com", Password: "Password1"}, nil, nil)
	require.NoError(t, err)
	_, err = uc.Login(ctx, domain.LoginInput{Email: "a@example.com", Password: "WrongPass1"}, nil, nil)
	assert.Error(t, err)
}

func TestAuthUseCase_AccountLockout(t *testing.T) {
	uc, _, _ := testAuth(t)
	ctx := context.Background()
	_, err := uc.Register(ctx, domain.RegisterInput{Email: "a@example.com", Password: "Password1"}, nil, nil)
	require.NoError(t, err)
	for i := 0; i < 5; i++ {
		_, err = uc.Login(ctx, domain.LoginInput{Email: "a@example.com", Password: "WrongPass1"}, nil, nil)
		require.Error(t, err)
	}
	_, err = uc.Login(ctx, domain.LoginInput{Email: "a@example.com", Password: "Password1"}, nil, nil)
	assert.Error(t, err)
}

func TestAuthUseCase_VerifyToken(t *testing.T) {
	uc, _, _ := testAuth(t)
	ctx := context.Background()
	_, err := uc.Register(ctx, domain.RegisterInput{Email: "a@example.com", Password: "Password1"}, nil, nil)
	require.NoError(t, err)
	payload, err := uc.Login(ctx, domain.LoginInput{Email: "a@example.com", Password: "Password1"}, nil, nil)
	require.NoError(t, err)
	user, err := uc.issuer.Verify(payload.Token)
	require.NoError(t, err)
	assert.Equal(t, "a@example.com", user.Email)
}

func TestAuthUseCase_ExportAndDeleteMyAccount(t *testing.T) {
	uc, _, _ := testAuth(t)
	ctx := context.Background()
	user, err := uc.Register(ctx, domain.RegisterInput{Email: "a@example.com", Password: "Password1"}, nil, nil)
	require.NoError(t, err)
	_, err = uc.Login(ctx, domain.LoginInput{Email: "a@example.com", Password: "Password1"}, nil, nil)
	require.NoError(t, err)
	exportedUser, logs, err := uc.ExportMyData(ctx, user.ID)
	require.NoError(t, err)
	assert.Equal(t, user.ID, exportedUser.ID)
	assert.GreaterOrEqual(t, len(logs), 1)
	err = uc.DeleteMyAccount(ctx, user.ID, nil, nil)
	require.NoError(t, err)
}
