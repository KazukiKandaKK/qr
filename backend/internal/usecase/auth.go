package usecase

import (
	"context"
	"errors"
	"fmt"
	"log/slog"
	"regexp"
	"time"

	"github.com/KazukiKandaKK/qr/backend/internal/domain"
)

type PasswordHasher interface {
	Hash(password string) (string, error)
	Compare(password, hash string) error
}

type TokenIssuer interface {
	Issue(user domain.User) (string, error)
	Verify(token string) (domain.User, error)
}

type AuthUseCase struct {
	userRepo    UserRepository
	auditRepo   AuditLogRepository
	hasher      PasswordHasher
	issuer      TokenIssuer
	maxFailures int
	lockout     time.Duration
	logger      *slog.Logger
}

func NewAuthUseCase(
	userRepo UserRepository,
	auditRepo AuditLogRepository,
	hasher PasswordHasher,
	issuer TokenIssuer,
	maxFailures int,
	lockout time.Duration,
	logger *slog.Logger,
) *AuthUseCase {
	return &AuthUseCase{
		userRepo:    userRepo,
		auditRepo:   auditRepo,
		hasher:      hasher,
		issuer:      issuer,
		maxFailures: maxFailures,
		lockout:     lockout,
		logger:      logger,
	}
}

func (u *AuthUseCase) Register(ctx context.Context, input domain.RegisterInput, ip, userAgent *string) (domain.User, error) {
	if err := validatePassword(input.Password); err != nil {
		return domain.User{}, err
	}
	if _, err := u.userRepo.FindByEmail(input.Email); err == nil {
		return domain.User{}, errors.New("email already registered")
	} else if !errors.Is(err, domain.ErrNotFound) {
		return domain.User{}, err
	}

	hash, err := u.hasher.Hash(input.Password)
	if err != nil {
		return domain.User{}, err
	}

	count, err := u.userRepo.Count()
	if err != nil {
		return domain.User{}, err
	}
	role := domain.RoleUser
	if count == 0 {
		role = domain.RoleAdmin
	}

	user, err := u.userRepo.Create(input, hash, role)
	if err != nil {
		return domain.User{}, err
	}

	u.audit(ctx, domain.AuditLogInput{
		Action:     "REGISTER",
		ActorID:    &user.ID,
		ActorEmail: &user.Email,
		IP:         ip,
		UserAgent:  userAgent,
	})
	return user, nil
}

func (u *AuthUseCase) Login(ctx context.Context, input domain.LoginInput, ip, userAgent *string) (domain.AuthPayload, error) {
	user, err := u.userRepo.FindByEmailWithHash(input.Email)
	if err != nil {
		if errors.Is(err, domain.ErrNotFound) {
			u.audit(ctx, domain.AuditLogInput{
				Action:    "LOGIN_FAILURE",
				ActorEmail: &input.Email,
				IP:        ip,
				UserAgent: userAgent,
				Metadata:  map[string]any{"reason": "UNKNOWN_EMAIL"},
			})
			return domain.AuthPayload{}, errors.New("Invalid email or password")
		}
		return domain.AuthPayload{}, err
	}

	now := time.Now()
	if user.LockedUntil != nil && user.LockedUntil.After(now) {
		u.audit(ctx, domain.AuditLogInput{
			Action:     "LOGIN_FAILURE",
			ActorID:    &user.ID,
			ActorEmail: &user.Email,
			IP:         ip,
			UserAgent:  userAgent,
			Metadata: map[string]any{
				"reason":      "ACCOUNT_LOCKED",
				"lockedUntil": user.LockedUntil.Format(time.RFC3339),
			},
		})
		return domain.AuthPayload{}, errors.New("account temporarily locked due to too many failed login attempts")
	}

	if err := u.hasher.Compare(input.Password, user.PasswordHash); err != nil {
		attempts := user.FailedLoginAttempts + 1
		var lockedUntil *time.Time
		if attempts >= u.maxFailures {
			t := now.Add(u.lockout)
			lockedUntil = &t
		}
		if err := u.userRepo.UpdateFailedLoginAttempts(user.ID, attempts, lockedUntil); err != nil {
			return domain.AuthPayload{}, err
		}
		u.audit(ctx, domain.AuditLogInput{
			Action:     "LOGIN_FAILURE",
			ActorID:    &user.ID,
			ActorEmail: &user.Email,
			IP:         ip,
			UserAgent:  userAgent,
			Metadata: map[string]any{
				"reason":   "INVALID_PASSWORD",
				"attempts": attempts,
			},
		})
		if lockedUntil != nil {
			u.audit(ctx, domain.AuditLogInput{
				Action:     "ACCOUNT_LOCKED",
				ActorID:    &user.ID,
				ActorEmail: &user.Email,
				IP:         ip,
				UserAgent:  userAgent,
				Metadata: map[string]any{
					"attempts":    attempts,
					"lockedUntil": lockedUntil.Format(time.RFC3339),
				},
			})
		}
		return domain.AuthPayload{}, errors.New("Invalid email or password")
	}

	if err := u.userRepo.UpdateFailedLoginAttempts(user.ID, 0, nil); err != nil {
		return domain.AuthPayload{}, err
	}

	token, err := u.issuer.Issue(user.User)
	if err != nil {
		return domain.AuthPayload{}, err
	}

	u.audit(ctx, domain.AuditLogInput{
		Action:     "LOGIN_SUCCESS",
		ActorID:    &user.ID,
		ActorEmail: &user.Email,
		IP:         ip,
		UserAgent:  userAgent,
	})
	return domain.AuthPayload{Token: token, User: user.User}, nil
}

func (u *AuthUseCase) Me(ctx context.Context, user domain.User) domain.User {
	return user
}

func (u *AuthUseCase) IssueTokenForUser(_ context.Context, user domain.User) (string, error) {
	return u.issuer.Issue(user)
}

func (u *AuthUseCase) ExportMyData(ctx context.Context, userID string) (domain.User, []domain.AuditLog, error) {
	user, err := u.userRepo.FindByID(userID)
	if err != nil {
		return domain.User{}, nil, err
	}
	logs, err := u.auditRepo.FindByActorID(userID, 100, 0)
	if err != nil {
		return domain.User{}, nil, err
	}
	return user, logs, nil
}

func (u *AuthUseCase) DeleteMyAccount(ctx context.Context, userID string, ip, userAgent *string) error {
	user, err := u.userRepo.FindByID(userID)
	if err != nil {
		return err
	}
	u.audit(ctx, domain.AuditLogInput{
		Action:     "ACCOUNT_DELETION",
		ActorID:    &user.ID,
		ActorEmail: &user.Email,
		IP:         ip,
		UserAgent:  userAgent,
	})
	if err := u.auditRepo.DeleteByActorID(userID); err != nil {
		return err
	}
	return u.userRepo.Delete(userID)
}

func (u *AuthUseCase) ListAuditLogs(ctx context.Context, user domain.User, limit, offset int) ([]domain.AuditLog, error) {
	if user.Role != domain.RoleAdmin {
		return nil, domain.ErrForbidden
	}
	return u.auditRepo.FindRecent(limit, offset)
}

func (u *AuthUseCase) audit(ctx context.Context, input domain.AuditLogInput) {
	if _, err := u.auditRepo.Create(input); err != nil {
		u.logger.ErrorContext(ctx, "failed to write audit log", slog.String("error", err.Error()))
	}
}

func validatePassword(password string) error {
	if len(password) < 8 || len(password) > 128 {
		return fmt.Errorf("password must be 8-128 characters")
	}
	if !regexp.MustCompile(`[a-z]`).MatchString(password) {
		return fmt.Errorf("password must contain a lowercase letter")
	}
	if !regexp.MustCompile(`[A-Z]`).MatchString(password) {
		return fmt.Errorf("password must contain an uppercase letter")
	}
	if !regexp.MustCompile(`\d`).MatchString(password) {
		return fmt.Errorf("password must contain a number")
	}
	return nil
}
