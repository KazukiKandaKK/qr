package usecase

import (
	"time"

	"github.com/KazukiKandaKK/qr/backend/internal/domain"
)

type RssRepository interface {
	FindFeeds(pagination *domain.Pagination) ([]domain.Feed, error)
	FindFeedsByIDs(ids []string) ([]domain.Feed, error)
	FindFeedByID(id string) (domain.Feed, error)
	FindFeedByURL(url string) (domain.Feed, error)
	FindEnabledFeeds() ([]domain.Feed, error)
	CreateFeed(input domain.CreateFeedInput) (domain.Feed, error)
	UpdateFeed(id string, input domain.UpdateFeedInput) (domain.Feed, error)
	DeleteFeed(id string) error
	UpdateFeedLastFetched(id string, at time.Time) error

	FindArticles(filter domain.ArticleFilter, pagination *domain.Pagination) ([]domain.Article, error)
	FindArticlesByFeedIDs(feedIDs []string, filter domain.ArticleFilter) ([]domain.Article, error)
	FindArticleByID(id string) (domain.Article, error)
	FindArticlesByFeedIDAndLinks(feedID string, links []string) ([]domain.Article, error)
	CreateArticle(article domain.Article) (domain.Article, error)
	UpdateArticle(id string, data map[string]any) (domain.Article, error)
	DeleteArticle(id string) error
	GetStats() (domain.Stats, error)
}

type UserRepository interface {
	FindByID(id string) (domain.User, error)
	FindByEmail(email string) (domain.User, error)
	FindByEmailWithHash(email string) (domain.UserWithCredentials, error)
	Create(input domain.RegisterInput, passwordHash string, role domain.Role) (domain.User, error)
	Count() (int, error)
	UpdateFailedLoginAttempts(id string, attempts int, lockedUntil *time.Time) error
	Delete(id string) error
}

type AuditLogRepository interface {
	Create(input domain.AuditLogInput) (domain.AuditLog, error)
	FindRecent(limit, offset int) ([]domain.AuditLog, error)
	FindByActorID(actorID string, limit, offset int) ([]domain.AuditLog, error)
	DeleteByActorID(actorID string) error
}
