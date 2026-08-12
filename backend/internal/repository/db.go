package repository

import (
	"fmt"
	"strings"

	"gorm.io/driver/sqlite"
	"gorm.io/gorm"
	"gorm.io/gorm/logger"
)

func NewDB(databaseURL string, logLevel logger.LogLevel) (*gorm.DB, error) {
	path := databaseURL
	if strings.HasPrefix(databaseURL, "file:") {
		path = strings.TrimPrefix(databaseURL, "file:")
	}

	db, err := gorm.Open(sqlite.Open(path), &gorm.Config{
		Logger: logger.Default.LogMode(logLevel),
	})
	if err != nil {
		return nil, fmt.Errorf("failed to open database: %w", err)
	}

	if err := db.AutoMigrate(&FeedModel{}, &ArticleModel{}, &UserModel{}, &AuditLogModel{}); err != nil {
		return nil, fmt.Errorf("failed to migrate: %w", err)
	}

	return db, nil
}
