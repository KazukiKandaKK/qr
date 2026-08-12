package repository

import "gorm.io/gorm"

type RssRepo struct {
	*FeedRepository
	*ArticleRepository
}

func NewRssRepository(db *gorm.DB) *RssRepo {
	return &RssRepo{
		FeedRepository:    NewFeedRepository(db),
		ArticleRepository: NewArticleRepository(db),
	}
}
