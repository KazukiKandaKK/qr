package repository

import (
	"time"

	"github.com/KazukiKandaKK/qr/backend/internal/domain"
	"github.com/google/uuid"
	"gorm.io/gorm"
)

type FeedRepository struct {
	db *gorm.DB
}

func NewFeedRepository(db *gorm.DB) *FeedRepository {
	return &FeedRepository{db: db}
}

func (r *FeedRepository) toDomain(m FeedModel) domain.Feed {
	return domain.Feed{
		ID:            m.ID,
		Name:          m.Name,
		URL:           m.URL,
		Category:      m.Category,
		Enabled:       m.Enabled,
		LastFetchedAt: m.LastFetchedAt,
		CreatedAt:     m.CreatedAt,
		UpdatedAt:     m.UpdatedAt,
	}
}

func (r *FeedRepository) FindFeeds(pagination *domain.Pagination) ([]domain.Feed, error) {
	var rows []FeedModel
	q := r.db.Order("created_at desc")
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
	feeds := make([]domain.Feed, len(rows))
	for i, row := range rows {
		feeds[i] = r.toDomain(row)
	}
	return feeds, nil
}

func (r *FeedRepository) FindFeedsByIDs(ids []string) ([]domain.Feed, error) {
	var rows []FeedModel
	if err := r.db.Where("id IN ?", ids).Find(&rows).Error; err != nil {
		return nil, err
	}
	feeds := make([]domain.Feed, len(rows))
	for i, row := range rows {
		feeds[i] = r.toDomain(row)
	}
	return feeds, nil
}

func (r *FeedRepository) FindFeedByID(id string) (domain.Feed, error) {
	var m FeedModel
	if err := r.db.First(&m, "id = ?", id).Error; err != nil {
		return domain.Feed{}, mapError(err)
	}
	return r.toDomain(m), nil
}

func (r *FeedRepository) FindFeedByURL(url string) (domain.Feed, error) {
	var m FeedModel
	if err := r.db.First(&m, "url = ?", url).Error; err != nil {
		return domain.Feed{}, mapError(err)
	}
	return r.toDomain(m), nil
}

func (r *FeedRepository) FindEnabledFeeds() ([]domain.Feed, error) {
	var rows []FeedModel
	if err := r.db.Where("enabled = ?", true).Order("created_at desc").Find(&rows).Error; err != nil {
		return nil, err
	}
	feeds := make([]domain.Feed, len(rows))
	for i, row := range rows {
		feeds[i] = r.toDomain(row)
	}
	return feeds, nil
}

func (r *FeedRepository) CreateFeed(input domain.CreateFeedInput) (domain.Feed, error) {
	enabled := true
	if input.Enabled != nil {
		enabled = *input.Enabled
	}
	now := time.Now()
	m := FeedModel{
		ID:        uuid.New().String(),
		Name:      input.Name,
		URL:       input.URL,
		Category:  input.Category,
		Enabled:   enabled,
		CreatedAt: now,
		UpdatedAt: now,
	}
	if err := r.db.Create(&m).Error; err != nil {
		return domain.Feed{}, err
	}
	return r.toDomain(m), nil
}

func (r *FeedRepository) UpdateFeed(id string, input domain.UpdateFeedInput) (domain.Feed, error) {
	var m FeedModel
	if err := r.db.First(&m, "id = ?", id).Error; err != nil {
		return domain.Feed{}, mapError(err)
	}
	updates := map[string]any{}
	if input.Name != nil {
		updates["name"] = *input.Name
	}
	if input.Category != nil {
		updates["category"] = *input.Category
	}
	if input.Enabled != nil {
		updates["enabled"] = *input.Enabled
	}
	if err := r.db.Model(&m).Updates(updates).Error; err != nil {
		return domain.Feed{}, err
	}
	return r.toDomain(m), nil
}

func (r *FeedRepository) DeleteFeed(id string) error {
	if err := r.db.Delete(&ArticleModel{}, "feed_id = ?", id).Error; err != nil {
		return err
	}
	if err := r.db.Delete(&FeedModel{ID: id}).Error; err != nil {
		return mapError(err)
	}
	return nil
}

func (r *FeedRepository) UpdateFeedLastFetched(id string, at time.Time) error {
	return r.db.Model(&FeedModel{ID: id}).Updates(map[string]any{
		"last_fetched_at": at,
		"updated_at":      time.Now(),
	}).Error
}
