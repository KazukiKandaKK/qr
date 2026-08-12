package repository

import (
	"time"

	"gorm.io/gorm"
)

type FeedModel struct {
	ID            string `gorm:"primaryKey"`
	Name          string
	URL           string `gorm:"uniqueIndex"`
	Category      string
	Enabled       bool
	LastFetchedAt *time.Time
	CreatedAt     time.Time
	UpdatedAt     time.Time
}

func (FeedModel) TableName() string { return "feeds" }

type ArticleModel struct {
	ID          string `gorm:"primaryKey"`
	FeedID      string `gorm:"index"`
	Title       string
	Link        string
	Snippet     string
	PublishedAt time.Time
	FetchedAt   time.Time
	IsRead      bool
	IsStarred   bool
}

func (ArticleModel) TableName() string { return "articles" }

type UserModel struct {
	ID                  string `gorm:"primaryKey"`
	Email               string `gorm:"uniqueIndex"`
	Name                *string
	Role                string
	PasswordHash        string
	FailedLoginAttempts int
	LockedUntil         *time.Time
	CreatedAt           time.Time
	UpdatedAt           time.Time
}

func (UserModel) TableName() string { return "users" }

type AuditLogModel struct {
	ID        string `gorm:"primaryKey"`
	Action    string
	ActorID   *string
	ActorEmail *string
	TargetID  *string
	TargetType *string
	IP        *string
	UserAgent *string
	Metadata  string
	CreatedAt time.Time
}

func (AuditLogModel) TableName() string { return "audit_logs" }

func AutoMigrate(db *gorm.DB) error {
	return db.AutoMigrate(&FeedModel{}, &ArticleModel{}, &UserModel{}, &AuditLogModel{})
}
