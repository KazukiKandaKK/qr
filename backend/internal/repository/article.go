package repository

import (
	"fmt"

	"github.com/KazukiKandaKK/qr/backend/internal/domain"
	"github.com/google/uuid"
	"gorm.io/gorm"
)

type ArticleRepository struct {
	db *gorm.DB
}

func NewArticleRepository(db *gorm.DB) *ArticleRepository {
	return &ArticleRepository{db: db}
}

func (r *ArticleRepository) toDomain(m ArticleModel) domain.Article {
	return domain.Article{
		ID:          m.ID,
		FeedID:      m.FeedID,
		Title:       m.Title,
		Link:        m.Link,
		Snippet:     m.Snippet,
		PublishedAt: m.PublishedAt,
		FetchedAt:   m.FetchedAt,
		IsRead:      m.IsRead,
		IsStarred:   m.IsStarred,
	}
}

func (r *ArticleRepository) FindArticles(filter domain.ArticleFilter, pagination *domain.Pagination) ([]domain.Article, error) {
	var rows []ArticleModel
	q := r.db.Order("published_at desc")

	if filter.FeedID != nil {
		q = q.Where("feed_id = ?", *filter.FeedID)
	}
	if filter.IsRead != nil {
		q = q.Where("is_read = ?", *filter.IsRead)
	}
	if filter.IsStarred != nil {
		q = q.Where("is_starred = ?", *filter.IsStarred)
	}
	if filter.Keyword != nil && *filter.Keyword != "" {
		kw := "%" + *filter.Keyword + "%"
		q = q.Where("title LIKE ? OR snippet LIKE ?", kw, kw)
	}
	if pagination != nil {
		if pagination.Limit != nil {
			q = q.Limit(*pagination.Limit)
		}
		if pagination.Offset != nil {
			q = q.Offset(*pagination.Offset)
		}
	}

	if err := q.Find(&rows).Error; err != nil {
		return nil, err
	}
	articles := make([]domain.Article, len(rows))
	for i, row := range rows {
		articles[i] = r.toDomain(row)
	}
	return articles, nil
}

func (r *ArticleRepository) FindArticlesByFeedIDs(feedIDs []string, filter domain.ArticleFilter) ([]domain.Article, error) {
	var rows []ArticleModel
	q := r.db.Where("feed_id IN ?", feedIDs).Order("published_at desc")
	if filter.IsRead != nil {
		q = q.Where("is_read = ?", *filter.IsRead)
	}
	if filter.IsStarred != nil {
		q = q.Where("is_starred = ?", *filter.IsStarred)
	}
	if filter.Keyword != nil && *filter.Keyword != "" {
		kw := "%" + *filter.Keyword + "%"
		q = q.Where("title LIKE ? OR snippet LIKE ?", kw, kw)
	}
	if err := q.Find(&rows).Error; err != nil {
		return nil, err
	}
	articles := make([]domain.Article, len(rows))
	for i, row := range rows {
		articles[i] = r.toDomain(row)
	}
	return articles, nil
}

func (r *ArticleRepository) FindArticleByID(id string) (domain.Article, error) {
	var m ArticleModel
	if err := r.db.First(&m, "id = ?", id).Error; err != nil {
		return domain.Article{}, mapError(err)
	}
	return r.toDomain(m), nil
}

func (r *ArticleRepository) FindArticlesByFeedIDAndLinks(feedID string, links []string) ([]domain.Article, error) {
	var rows []ArticleModel
	if err := r.db.Where("feed_id = ? AND link IN ?", feedID, links).Find(&rows).Error; err != nil {
		return nil, err
	}
	articles := make([]domain.Article, len(rows))
	for i, row := range rows {
		articles[i] = r.toDomain(row)
	}
	return articles, nil
}

func (r *ArticleRepository) CreateArticle(article domain.Article) (domain.Article, error) {
	if article.ID == "" {
		article.ID = uuid.New().String()
	}
	m := ArticleModel{
		ID:          article.ID,
		FeedID:      article.FeedID,
		Title:       article.Title,
		Link:        article.Link,
		Snippet:     article.Snippet,
		PublishedAt: article.PublishedAt,
		FetchedAt:   article.FetchedAt,
		IsRead:      article.IsRead,
		IsStarred:   article.IsStarred,
	}
	if err := r.db.Create(&m).Error; err != nil {
		return domain.Article{}, err
	}
	return r.toDomain(m), nil
}

func (r *ArticleRepository) UpdateArticle(id string, data map[string]any) (domain.Article, error) {
	var m ArticleModel
	if err := r.db.First(&m, "id = ?", id).Error; err != nil {
		return domain.Article{}, mapError(err)
	}
	allowed := map[string]bool{
		"title":        true,
		"snippet":      true,
		"published_at": true,
		"fetched_at":   true,
		"is_read":      true,
		"is_starred":   true,
	}
	updates := map[string]any{}
	for k, v := range data {
		if allowed[k] {
			updates[k] = v
		} else {
			return domain.Article{}, fmt.Errorf("invalid update field: %s", k)
		}
	}
	if err := r.db.Model(&m).Updates(updates).Error; err != nil {
		return domain.Article{}, err
	}
	return r.toDomain(m), nil
}

func (r *ArticleRepository) DeleteArticle(id string) error {
	if err := r.db.Delete(&ArticleModel{ID: id}).Error; err != nil {
		return mapError(err)
	}
	return nil
}

func (r *ArticleRepository) GetStats() (domain.Stats, error) {
	var stats domain.Stats
	var feedCount, articleCount, readCount, starredCount int64
	if err := r.db.Model(&FeedModel{}).Count(&feedCount).Error; err != nil {
		return stats, err
	}
	if err := r.db.Model(&ArticleModel{}).Count(&articleCount).Error; err != nil {
		return stats, err
	}
	if err := r.db.Model(&ArticleModel{}).Where("is_read = ?", true).Count(&readCount).Error; err != nil {
		return stats, err
	}
	if err := r.db.Model(&ArticleModel{}).Where("is_starred = ?", true).Count(&starredCount).Error; err != nil {
		return stats, err
	}
	stats.FeedCount = int(feedCount)
	stats.ArticleCount = int(articleCount)
	stats.ReadCount = int(readCount)
	stats.StarredCount = int(starredCount)
	stats.UnreadCount = stats.ArticleCount - stats.ReadCount
	return stats, nil
}
