package repository

import (
	"errors"

	"github.com/KazukiKandaKK/qr/backend/internal/domain"
	"gorm.io/gorm"
)

func mapError(err error) error {
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return domain.ErrNotFound
	}
	return err
}
