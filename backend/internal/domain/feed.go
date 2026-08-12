package domain

import "time"

type Feed struct {
	ID            string
	Name          string
	URL           string
	Category      string
	Enabled       bool
	LastFetchedAt *time.Time
	CreatedAt     time.Time
	UpdatedAt     time.Time
}

type CreateFeedInput struct {
	Name     string
	URL      string
	Category string
	Enabled  *bool
}

type UpdateFeedInput struct {
	Name     *string
	Category *string
	Enabled  *bool
}
