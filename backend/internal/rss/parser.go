package rss

import (
	"context"
	"fmt"
	"net/url"
	"time"

	"github.com/KazukiKandaKK/qr/backend/internal/usecase"
	"github.com/mmcdole/gofeed"
)

type Parser struct {
	client *gofeed.Parser
}

func NewParser() *Parser {
	return &Parser{client: gofeed.NewParser()}
}

func (p *Parser) Parse(ctx context.Context, feedURL string) ([]usecase.ParsedArticle, error) {
	u, err := url.Parse(feedURL)
	if err != nil || (u.Scheme != "http" && u.Scheme != "https") {
		return nil, fmt.Errorf("invalid feed URL: %s", feedURL)
	}

	feed, err := p.client.ParseURLWithContext(feedURL, ctx)
	if err != nil {
		return nil, err
	}

	items := make([]usecase.ParsedArticle, 0, len(feed.Items))
	for _, item := range feed.Items {
		published := time.Now()
		if item.PublishedParsed != nil {
			published = *item.PublishedParsed
		}
		snippet := item.Description
		if snippet == "" {
			snippet = item.Content
		}
		items = append(items, usecase.ParsedArticle{
			Title:       item.Title,
			Link:        item.Link,
			Snippet:     snippet,
			PublishedAt: published,
		})
	}
	return items, nil
}
