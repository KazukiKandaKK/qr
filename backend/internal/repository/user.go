package repository

import (
	"time"

	"github.com/KazukiKandaKK/qr/backend/internal/domain"
	"github.com/google/uuid"
	"gorm.io/gorm"
)

type UserRepo struct {
	db *gorm.DB
}

func NewUserRepository(db *gorm.DB) *UserRepo {
	return &UserRepo{db: db}
}

func toDomainUser(m UserModel) domain.User {
	return domain.User{
		ID:        m.ID,
		Email:     m.Email,
		Name:      m.Name,
		Role:      domain.Role(m.Role),
		CreatedAt: m.CreatedAt,
		UpdatedAt: m.UpdatedAt,
	}
}

func toDomainUserWithCredentials(m UserModel) domain.UserWithCredentials {
	return domain.UserWithCredentials{
		User:                toDomainUser(m),
		PasswordHash:        m.PasswordHash,
		FailedLoginAttempts: m.FailedLoginAttempts,
		LockedUntil:         m.LockedUntil,
	}
}

func (r *UserRepo) FindByID(id string) (domain.User, error) {
	var m UserModel
	if err := r.db.First(&m, "id = ?", id).Error; err != nil {
		return domain.User{}, mapError(err)
	}
	return toDomainUser(m), nil
}

func (r *UserRepo) FindByEmail(email string) (domain.User, error) {
	var m UserModel
	if err := r.db.First(&m, "email = ?", email).Error; err != nil {
		return domain.User{}, mapError(err)
	}
	return toDomainUser(m), nil
}

func (r *UserRepo) FindByEmailWithHash(email string) (domain.UserWithCredentials, error) {
	var m UserModel
	if err := r.db.First(&m, "email = ?", email).Error; err != nil {
		return domain.UserWithCredentials{}, mapError(err)
	}
	return toDomainUserWithCredentials(m), nil
}

func (r *UserRepo) Create(input domain.RegisterInput, passwordHash string, role domain.Role) (domain.User, error) {
	now := time.Now()
	m := UserModel{
		ID:           uuid.New().String(),
		Email:        input.Email,
		Name:         input.Name,
		Role:         string(role),
		PasswordHash: passwordHash,
		CreatedAt:    now,
		UpdatedAt:    now,
	}
	if err := r.db.Create(&m).Error; err != nil {
		return domain.User{}, err
	}
	return toDomainUser(m), nil
}

func (r *UserRepo) Count() (int, error) {
	var count int64
	if err := r.db.Model(&UserModel{}).Count(&count).Error; err != nil {
		return 0, err
	}
	return int(count), nil
}

func (r *UserRepo) UpdateFailedLoginAttempts(id string, attempts int, lockedUntil *time.Time) error {
	return r.db.Model(&UserModel{ID: id}).Updates(map[string]any{
		"failed_login_attempts": attempts,
		"locked_until":          lockedUntil,
	}).Error
}

func (r *UserRepo) Delete(id string) error {
	if err := r.db.Delete(&UserModel{ID: id}).Error; err != nil {
		return mapError(err)
	}
	return nil
}
