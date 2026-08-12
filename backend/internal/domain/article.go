package domain

import "time"

type Article struct {
	ID          string
	FeedID      string
	Title       string
	Link        string
	Snippet     string
	PublishedAt time.Time
	FetchedAt   time.Time
	IsRead      bool
	IsStarred   bool
}

type ArticleFilter struct {
	FeedID    *string
	IsRead    *bool
	IsStarred *bool
	Keyword   *string
}

type Pagination struct {
	Limit  *int
	Offset *int
}

type Stats struct {
	FeedCount    int
	ArticleCount int
	ReadCount    int
	UnreadCount  int
	StarredCount int
}

type FetchResult struct {
	FeedName string
	FeedURL  string
	Inserted int
	Updated  int
	Error    *string
}
