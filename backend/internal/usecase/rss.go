package usecase

import (
	"context"
	"fmt"
	"log/slog"
	"strings"
	"time"

	"github.com/KazukiKandaKK/qr/backend/internal/domain"
)

type ParsedArticle struct {
	Title       string
	Link        string
	Snippet     string
	PublishedAt time.Time
}

type RssUseCase struct {
	repo       RssRepository
	parser     func(ctx context.Context, url string) ([]ParsedArticle, error)
	logger     *slog.Logger
	maxLimit   int
}

func NewRssUseCase(repo RssRepository, parser func(ctx context.Context, url string) ([]ParsedArticle, error), logger *slog.Logger) *RssUseCase {
	return &RssUseCase{
		repo:     repo,
		parser:   parser,
		logger:   logger,
		maxLimit: 100,
	}
}

func (u *RssUseCase) ListFeeds(ctx context.Context, pagination *domain.Pagination) ([]domain.Feed, error) {
	u.logger.DebugContext(ctx, "listing feeds")
	return u.repo.FindFeeds(sanitizePagination(pagination, u.maxLimit))
}

func (u *RssUseCase) GetFeed(ctx context.Context, id string) (domain.Feed, error) {
	u.logger.DebugContext(ctx, "getting feed", slog.String("id", id))
	return u.repo.FindFeedByID(id)
}

func (u *RssUseCase) CreateFeed(ctx context.Context, input domain.CreateFeedInput) (domain.Feed, error) {
	u.logger.InfoContext(ctx, "creating feed", slog.String("url", input.URL))
	if input.Name == "" || input.URL == "" || input.Category == "" {
		return domain.Feed{}, fmt.Errorf("name, url and category are required")
	}
	if _, err := u.repo.FindFeedByURL(input.URL); err == nil {
		return domain.Feed{}, fmt.Errorf("feed already exists: %s", input.URL)
	}
	return u.repo.CreateFeed(input)
}

func (u *RssUseCase) UpdateFeed(ctx context.Context, id string, input domain.UpdateFeedInput) (domain.Feed, error) {
	u.logger.InfoContext(ctx, "updating feed", slog.String("id", id))
	return u.repo.UpdateFeed(id, input)
}

func (u *RssUseCase) DeleteFeed(ctx context.Context, id string) error {
	u.logger.InfoContext(ctx, "deleting feed", slog.String("id", id))
	return u.repo.DeleteFeed(id)
}

func (u *RssUseCase) ListArticles(ctx context.Context, filter domain.ArticleFilter, pagination *domain.Pagination) ([]domain.Article, error) {
	u.logger.DebugContext(ctx, "listing articles")
	return u.repo.FindArticles(filter, sanitizePagination(pagination, u.maxLimit))
}

func (u *RssUseCase) GetArticle(ctx context.Context, id string) (domain.Article, error) {
	u.logger.DebugContext(ctx, "getting article", slog.String("id", id))
	return u.repo.FindArticleByID(id)
}

func (u *RssUseCase) MarkArticleRead(ctx context.Context, id string, isRead bool) (domain.Article, error) {
	u.logger.InfoContext(ctx, "marking article read", slog.String("id", id), slog.Bool("isRead", isRead))
	return u.repo.UpdateArticle(id, map[string]any{"is_read": isRead})
}

func (u *RssUseCase) MarkArticleStarred(ctx context.Context, id string, isStarred bool) (domain.Article, error) {
	u.logger.InfoContext(ctx, "marking article starred", slog.String("id", id), slog.Bool("isStarred", isStarred))
	return u.repo.UpdateArticle(id, map[string]any{"is_starred": isStarred})
}

func (u *RssUseCase) DeleteArticle(ctx context.Context, id string) error {
	u.logger.InfoContext(ctx, "deleting article", slog.String("id", id))
	return u.repo.DeleteArticle(id)
}

func (u *RssUseCase) GetStats(ctx context.Context) (domain.Stats, error) {
	u.logger.DebugContext(ctx, "getting stats")
	return u.repo.GetStats()
}

func (u *RssUseCase) FetchFeeds(ctx context.Context) ([]domain.FetchResult, error) {
	feeds, err := u.repo.FindEnabledFeeds()
	if err != nil {
		return nil, err
	}

	results := make([]domain.FetchResult, 0, len(feeds))
	now := time.Now()
	for _, feed := range feeds {
		base := domain.FetchResult{
			FeedName: feed.Name,
			FeedURL:  feed.URL,
		}
		items, err := u.parser(ctx, feed.URL)
		if err != nil {
			msg := err.Error()
			base.Error = &msg
			u.logger.ErrorContext(ctx, "fetch failed", slog.String("feed", feed.URL), slog.String("error", msg))
			results = append(results, base)
			continue
		}

		links := make([]string, len(items))
		for i, item := range items {
			links[i] = item.Link
		}
		existing, err := u.repo.FindArticlesByFeedIDAndLinks(feed.ID, links)
		if err != nil {
			return nil, err
		}
		existingByLink := make(map[string]domain.Article, len(existing))
		for _, article := range existing {
			existingByLink[article.Link] = article
		}

		inserted, updated := 0, 0
		for _, item := range items {
			if existing, ok := existingByLink[item.Link]; ok {
				if _, err := u.repo.UpdateArticle(existing.ID, map[string]any{
					"title":         item.Title,
					"snippet":       item.Snippet,
					"published_at":  item.PublishedAt,
					"fetched_at":    now,
				}); err != nil {
					return nil, err
				}
				updated++
			} else {
				if _, err := u.repo.CreateArticle(domain.Article{
					FeedID:      feed.ID,
					Title:       item.Title,
					Link:        item.Link,
					Snippet:     item.Snippet,
					PublishedAt: item.PublishedAt,
					FetchedAt:   now,
					IsRead:      false,
					IsStarred:   false,
				}); err != nil {
					return nil, err
				}
				inserted++
			}
		}
		if err := u.repo.UpdateFeedLastFetched(feed.ID, now); err != nil {
			return nil, err
		}
		base.Inserted = inserted
		base.Updated = updated
		results = append(results, base)
	}
	return results, nil
}

func sanitizePagination(p *domain.Pagination, max int) *domain.Pagination {
	if p == nil {
		return nil
	}
	out := &domain.Pagination{}
	if p.Limit != nil {
		limit := *p.Limit
		if limit < 1 {
			limit = 1
		}
		if limit > max {
			limit = max
		}
		out.Limit = &limit
	}
	if p.Offset != nil {
		offset := *p.Offset
		if offset < 0 {
			offset = 0
		}
		out.Offset = &offset
	}
	return out
}

func sanitizeKeyword(kw *string) *string {
	if kw == nil {
		return nil
	}
	s := strings.TrimSpace(*kw)
	if s == "" {
		return nil
	}
	return &s
}
