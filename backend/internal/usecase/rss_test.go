package usecase

import (
	"context"
	"errors"
	"log/slog"
	"os"
	"testing"
	"time"

	"github.com/KazukiKandaKK/qr/backend/internal/domain"
	"github.com/KazukiKandaKK/qr/backend/internal/repository"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"gorm.io/gorm/logger"
)

func testRss(t *testing.T, parser func(context.Context, string) ([]ParsedArticle, error)) *RssUseCase {
	t.Helper()
	db, err := repository.NewDB("file::memory:?cache=shared", logger.Silent)
	require.NoError(t, err)
	t.Cleanup(func() {
		sqlDB, _ := db.DB()
		_ = sqlDB.Close()
	})
	repo := repository.NewRssRepository(db)
	logger := slog.New(slog.NewTextHandler(os.Stdout, &slog.HandlerOptions{Level: slog.LevelError}))
	return NewRssUseCase(repo, parser, logger)
}

func TestRssUseCase_CreateAndListFeeds(t *testing.T) {
	uc := testRss(t, nil)
	ctx := context.Background()
	feed, err := uc.CreateFeed(ctx, domain.CreateFeedInput{
		Name:     "Test",
		URL:      "https://example.com/feed",
		Category: "Test",
	})
	require.NoError(t, err)
	assert.Equal(t, "Test", feed.Name)
	feeds, err := uc.ListFeeds(ctx, nil)
	require.NoError(t, err)
	assert.Len(t, feeds, 1)
}

func TestRssUseCase_DuplicateURL(t *testing.T) {
	uc := testRss(t, nil)
	ctx := context.Background()
	_, err := uc.CreateFeed(ctx, domain.CreateFeedInput{Name: "A", URL: "https://example.com/feed", Category: "A"})
	require.NoError(t, err)
	_, err = uc.CreateFeed(ctx, domain.CreateFeedInput{Name: "B", URL: "https://example.com/feed", Category: "B"})
	assert.Error(t, err)
}

func TestRssUseCase_FetchFeeds(t *testing.T) {
	parser := func(_ context.Context, url string) ([]ParsedArticle, error) {
		if url == "https://example.com/feed" {
			return []ParsedArticle{
				{Title: "Article 1", Link: "https://example.com/1", Snippet: "Snippet 1", PublishedAt: time.Now()},
			}, nil
		}
		return nil, errors.New("unknown feed")
	}
	uc := testRss(t, parser)
	ctx := context.Background()
	_, err := uc.CreateFeed(ctx, domain.CreateFeedInput{Name: "Test", URL: "https://example.com/feed", Category: "Test"})
	require.NoError(t, err)
	results, err := uc.FetchFeeds(ctx)
	require.NoError(t, err)
	require.Len(t, results, 1)
	assert.Equal(t, 1, results[0].Inserted)
	assert.Equal(t, 0, results[0].Updated)

	stats, err := uc.GetStats(ctx)
	require.NoError(t, err)
	assert.Equal(t, 1, stats.ArticleCount)
	assert.Equal(t, 0, stats.ReadCount)
	assert.Equal(t, 1, stats.UnreadCount)
}

func TestRssUseCase_ArticleReadAndStar(t *testing.T) {
	parser := func(_ context.Context, url string) ([]ParsedArticle, error) {
		return []ParsedArticle{{Title: "A", Link: "https://example.com/a", Snippet: "s", PublishedAt: time.Now()}}, nil
	}
	uc := testRss(t, parser)
	ctx := context.Background()
	feed, err := uc.CreateFeed(ctx, domain.CreateFeedInput{Name: "Test", URL: "https://example.com/feed", Category: "Test"})
	require.NoError(t, err)
	_, err = uc.FetchFeeds(ctx)
	require.NoError(t, err)
	articles, err := uc.ListArticles(ctx, domain.ArticleFilter{FeedID: &feed.ID}, nil)
	require.NoError(t, err)
	require.Len(t, articles, 1)
	article := articles[0]
	updated, err := uc.MarkArticleRead(ctx, article.ID, true)
	require.NoError(t, err)
	assert.True(t, updated.IsRead)
	updated, err = uc.MarkArticleStarred(ctx, article.ID, true)
	require.NoError(t, err)
	assert.True(t, updated.IsStarred)
}

func TestRssUseCase_PaginationLimits(t *testing.T) {
	uc := testRss(t, nil)
	ctx := context.Background()
	_, err := uc.CreateFeed(ctx, domain.CreateFeedInput{Name: "Test", URL: "https://example.com/feed", Category: "Test"})
	require.NoError(t, err)
	feeds, err := uc.ListFeeds(ctx, &domain.Pagination{Limit: intPtr(10), Offset: intPtr(0)})
	require.NoError(t, err)
	assert.Len(t, feeds, 1)
}

func intPtr(i int) *int { return &i }
