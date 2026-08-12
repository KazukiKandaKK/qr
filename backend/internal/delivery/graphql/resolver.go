package graphql

import (
	"context"
	"encoding/json"
	"errors"
	"log/slog"

	"github.com/KazukiKandaKK/qr/backend/internal/domain"
	"github.com/KazukiKandaKK/qr/backend/internal/usecase"
	graphqlgo "github.com/graph-gophers/graphql-go"
)

type Resolver struct {
	Rss    *usecase.RssUseCase
	Auth   *usecase.AuthUseCase
	Logger *slog.Logger
}

func requireAuth(ctx context.Context) (*domain.User, error) {
	u, ok := userFromContext(ctx)
	if !ok || u == nil {
		return nil, domain.ErrUnauthorized
	}
	return u, nil
}

func requireAdmin(ctx context.Context) (*domain.User, error) {
	u, err := requireAuth(ctx)
	if err != nil {
		return nil, err
	}
	if u.Role != domain.RoleAdmin {
		return nil, domain.ErrForbidden
	}
	return u, nil
}

func (r *Resolver) Feeds(ctx context.Context, args struct{ Limit, Offset *int }) ([]*FeedResolver, error) {
	if _, err := requireAuth(ctx); err != nil {
		return nil, err
	}
	feeds, err := r.Rss.ListFeeds(ctx, paginationFromArgs(args.Limit, args.Offset))
	if err != nil {
		return nil, err
	}
	return feedResolvers(feeds, r.Rss), nil
}

func (r *Resolver) Feed(ctx context.Context, args struct{ ID graphqlgo.ID }) (*FeedResolver, error) {
	if _, err := requireAuth(ctx); err != nil {
		return nil, err
	}
	feed, err := r.Rss.GetFeed(ctx, string(args.ID))
	if err != nil {
		if errors.Is(err, domain.ErrNotFound) {
			return nil, nil
		}
		return nil, err
	}
	return &FeedResolver{feed: feed, rss: r.Rss}, nil
}

func (r *Resolver) Articles(ctx context.Context, args struct {
	Filter       *ArticleFilterInput
	Limit, Offset *int
}) ([]*ArticleResolver, error) {
	if _, err := requireAuth(ctx); err != nil {
		return nil, err
	}
	filter := domain.ArticleFilter{}
	if args.Filter != nil {
		filter = args.Filter.toDomain()
	}
	articles, err := r.Rss.ListArticles(ctx, filter, paginationFromArgs(args.Limit, args.Offset))
	if err != nil {
		return nil, err
	}
	return articleResolvers(articles, r.Rss), nil
}

func (r *Resolver) Article(ctx context.Context, args struct{ ID graphqlgo.ID }) (*ArticleResolver, error) {
	if _, err := requireAuth(ctx); err != nil {
		return nil, err
	}
	article, err := r.Rss.GetArticle(ctx, string(args.ID))
	if err != nil {
		if errors.Is(err, domain.ErrNotFound) {
			return nil, nil
		}
		return nil, err
	}
	return &ArticleResolver{article: article, rss: r.Rss}, nil
}

func (r *Resolver) Stats(ctx context.Context) (StatsResolver, error) {
	if _, err := requireAuth(ctx); err != nil {
		return StatsResolver{}, err
	}
	stats, err := r.Rss.GetStats(ctx)
	if err != nil {
		return StatsResolver{}, err
	}
	return StatsResolver{
		FeedCount:    int32(stats.FeedCount),
		ArticleCount: int32(stats.ArticleCount),
		ReadCount:    int32(stats.ReadCount),
		UnreadCount:  int32(stats.UnreadCount),
		StarredCount: int32(stats.StarredCount),
	}, nil
}

func (r *Resolver) Me(ctx context.Context) (*UserResolver, error) {
	u, ok := userFromContext(ctx)
	if !ok || u == nil {
		return nil, nil
	}
	return &UserResolver{user: *u}, nil
}

func (r *Resolver) AuditLogs(ctx context.Context, args struct{ Limit, Offset *int }) ([]*AuditLogResolver, error) {
	u, err := requireAdmin(ctx)
	if err != nil {
		return nil, err
	}
	logs, err := r.Auth.ListAuditLogs(ctx, *u, limitOr(args.Limit, 100), offsetOr(args.Offset, 0))
	if err != nil {
		return nil, err
	}
	resolvers := make([]*AuditLogResolver, len(logs))
	for i, log := range logs {
		resolvers[i] = &AuditLogResolver{log: log}
	}
	return resolvers, nil
}

func (r *Resolver) CreateFeed(ctx context.Context, args struct{ Input CreateFeedInput }) (*FeedResolver, error) {
	if _, err := requireAuth(ctx); err != nil {
		return nil, err
	}
	feed, err := r.Rss.CreateFeed(ctx, args.Input.toDomain())
	if err != nil {
		return nil, err
	}
	return &FeedResolver{feed: feed, rss: r.Rss}, nil
}

func (r *Resolver) UpdateFeed(ctx context.Context, args struct {
	ID    graphqlgo.ID
	Input UpdateFeedInput
}) (*FeedResolver, error) {
	if _, err := requireAuth(ctx); err != nil {
		return nil, err
	}
	feed, err := r.Rss.UpdateFeed(ctx, string(args.ID), args.Input.toDomain())
	if err != nil {
		return nil, err
	}
	return &FeedResolver{feed: feed, rss: r.Rss}, nil
}

func (r *Resolver) DeleteFeed(ctx context.Context, args struct{ ID graphqlgo.ID }) (bool, error) {
	if _, err := requireAdmin(ctx); err != nil {
		return false, err
	}
	if err := r.Rss.DeleteFeed(ctx, string(args.ID)); err != nil {
		return false, err
	}
	return true, nil
}

func (r *Resolver) FetchFeeds(ctx context.Context) ([]*FetchResultResolver, error) {
	if _, err := requireAuth(ctx); err != nil {
		return nil, err
	}
	results, err := r.Rss.FetchFeeds(ctx)
	if err != nil {
		return nil, err
	}
	resolvers := make([]*FetchResultResolver, len(results))
	for i, result := range results {
		resolvers[i] = &FetchResultResolver{
			FeedName: result.FeedName,
			FeedURL:  result.FeedURL,
			Inserted: int32(result.Inserted),
			Updated:  int32(result.Updated),
			Error:    result.Error,
		}
	}
	return resolvers, nil
}

func (r *Resolver) MarkArticleRead(ctx context.Context, args struct {
	ID     graphqlgo.ID
	IsRead bool
}) (*ArticleResolver, error) {
	if _, err := requireAuth(ctx); err != nil {
		return nil, err
	}
	article, err := r.Rss.MarkArticleRead(ctx, string(args.ID), args.IsRead)
	if err != nil {
		return nil, err
	}
	return &ArticleResolver{article: article, rss: r.Rss}, nil
}

func (r *Resolver) MarkArticleStarred(ctx context.Context, args struct {
	ID        graphqlgo.ID
	IsStarred bool
}) (*ArticleResolver, error) {
	if _, err := requireAuth(ctx); err != nil {
		return nil, err
	}
	article, err := r.Rss.MarkArticleStarred(ctx, string(args.ID), args.IsStarred)
	if err != nil {
		return nil, err
	}
	return &ArticleResolver{article: article, rss: r.Rss}, nil
}

func (r *Resolver) DeleteArticle(ctx context.Context, args struct{ ID graphqlgo.ID }) (bool, error) {
	if _, err := requireAdmin(ctx); err != nil {
		return false, err
	}
	if err := r.Rss.DeleteArticle(ctx, string(args.ID)); err != nil {
		return false, err
	}
	return true, nil
}

func (r *Resolver) Register(ctx context.Context, args struct{ Input RegisterInput }) (*AuthPayloadResolver, error) {
	ip, ua := requestMetaFromContext(ctx)
	user, err := r.Auth.Register(ctx, args.Input.toDomain(), ip, ua)
	if err != nil {
		return nil, err
	}
	token, err := r.Auth.IssueTokenForUser(ctx, user)
	if err != nil {
		return nil, err
	}
	return &AuthPayloadResolver{Token: token, User: &UserResolver{user: user}}, nil
}

func (r *Resolver) Login(ctx context.Context, args struct{ Input LoginInput }) (*AuthPayloadResolver, error) {
	ip, ua := requestMetaFromContext(ctx)
	payload, err := r.Auth.Login(ctx, args.Input.toDomain(), ip, ua)
	if err != nil {
		return nil, err
	}
	return &AuthPayloadResolver{Token: payload.Token, User: &UserResolver{user: payload.User}}, nil
}

func (r *Resolver) ExportMyData(ctx context.Context) (*UserDataExportResolver, error) {
	u, err := requireAuth(ctx)
	if err != nil {
		return nil, err
	}
	user, logs, err := r.Auth.ExportMyData(ctx, u.ID)
	if err != nil {
		return nil, err
	}
	logResolvers := make([]*AuditLogResolver, len(logs))
	for i, log := range logs {
		logResolvers[i] = &AuditLogResolver{log: log}
	}
	return &UserDataExportResolver{
		User:      &UserResolver{user: user},
		AuditLogs: logResolvers,
	}, nil
}

func (r *Resolver) DeleteMyAccount(ctx context.Context) (bool, error) {
	u, err := requireAuth(ctx)
	if err != nil {
		return false, err
	}
	ip, ua := requestMetaFromContext(ctx)
	if err := r.Auth.DeleteMyAccount(ctx, u.ID, ip, ua); err != nil {
		return false, err
	}
	return true, nil
}

func paginationFromArgs(limit, offset *int) *domain.Pagination {
	p := &domain.Pagination{}
	if limit != nil {
		p.Limit = limit
	}
	if offset != nil {
		offset := offsetOr(offset, 0)
		p.Offset = &offset
	}
	if p.Limit == nil && p.Offset == nil {
		return nil
	}
	return p
}

func offsetOr(p *int, fallback int) int {
	if p == nil {
		return fallback
	}
	return *p
}

func limitOr(p *int, fallback int) int {
	if p == nil {
		return fallback
	}
	return *p
}

// resolver types

type FeedResolver struct {
	feed domain.Feed
	rss  *usecase.RssUseCase
}

func (r *FeedResolver) ID() graphqlgo.ID          { return graphqlgo.ID(r.feed.ID) }
func (r *FeedResolver) Name() string                { return r.feed.Name }
func (r *FeedResolver) URL() string                 { return r.feed.URL }
func (r *FeedResolver) Category() string            { return r.feed.Category }
func (r *FeedResolver) Enabled() bool               { return r.feed.Enabled }
func (r *FeedResolver) LastFetchedAt() *DateTime {
	if r.feed.LastFetchedAt == nil {
		return nil
	}
	return &DateTime{Time: *r.feed.LastFetchedAt}
}
func (r *FeedResolver) CreatedAt() DateTime { return DateTime{Time: r.feed.CreatedAt} }
func (r *FeedResolver) UpdatedAt() DateTime { return DateTime{Time: r.feed.UpdatedAt} }

func (r *FeedResolver) Articles(ctx context.Context, args struct {
	Filter       *ArticleFilterInput
	Limit, Offset *int
}) ([]*ArticleResolver, error) {
	filter := domain.ArticleFilter{FeedID: &r.feed.ID}
	if args.Filter != nil {
		f := args.Filter.toDomain()
		filter.IsRead = f.IsRead
		filter.IsStarred = f.IsStarred
		filter.Keyword = f.Keyword
	}
	articles, err := r.rss.ListArticles(ctx, filter, paginationFromArgs(args.Limit, args.Offset))
	if err != nil {
		return nil, err
	}
	return articleResolvers(articles, r.rss), nil
}

type ArticleResolver struct {
	article domain.Article
	rss     *usecase.RssUseCase
}

func (r *ArticleResolver) ID() graphqlgo.ID           { return graphqlgo.ID(r.article.ID) }
func (r *ArticleResolver) FeedID() graphqlgo.ID       { return graphqlgo.ID(r.article.FeedID) }
func (r *ArticleResolver) Title() string                { return r.article.Title }
func (r *ArticleResolver) Link() string                 { return r.article.Link }
func (r *ArticleResolver) Snippet() string               { return r.article.Snippet }
func (r *ArticleResolver) PublishedAt() DateTime       { return DateTime{Time: r.article.PublishedAt} }
func (r *ArticleResolver) FetchedAt() DateTime          { return DateTime{Time: r.article.FetchedAt} }
func (r *ArticleResolver) IsRead() bool                { return r.article.IsRead }
func (r *ArticleResolver) IsStarred() bool             { return r.article.IsStarred }

func (r *ArticleResolver) Feed(ctx context.Context) (*FeedResolver, error) {
	feed, err := r.rss.GetFeed(ctx, r.article.FeedID)
	if err != nil {
		if errors.Is(err, domain.ErrNotFound) {
			return nil, nil
		}
		return nil, err
	}
	return &FeedResolver{feed: feed, rss: r.rss}, nil
}

type UserResolver struct {
	user domain.User
}

func (r *UserResolver) ID() graphqlgo.ID       { return graphqlgo.ID(r.user.ID) }
func (r *UserResolver) Email() string          { return r.user.Email }
func (r *UserResolver) Name() *string          { return r.user.Name }
func (r *UserResolver) Role() Role             { return Role(r.user.Role) }
func (r *UserResolver) CreatedAt() DateTime    { return DateTime{Time: r.user.CreatedAt} }
func (r *UserResolver) UpdatedAt() DateTime    { return DateTime{Time: r.user.UpdatedAt} }

type AuditLogResolver struct {
	log domain.AuditLog
}

func (r *AuditLogResolver) ID() graphqlgo.ID          { return graphqlgo.ID(r.log.ID) }
func (r *AuditLogResolver) Action() string            { return r.log.Action }
func (r *AuditLogResolver) ActorID() *graphqlgo.ID    {
	if r.log.ActorID == nil {
		return nil
	}
	id := graphqlgo.ID(*r.log.ActorID)
	return &id
}
func (r *AuditLogResolver) ActorEmail() *string         { return r.log.ActorEmail }
func (r *AuditLogResolver) TargetID() *graphqlgo.ID   {
	if r.log.TargetID == nil {
		return nil
	}
	id := graphqlgo.ID(*r.log.TargetID)
	return &id
}
func (r *AuditLogResolver) TargetType() *string         { return r.log.TargetType }
func (r *AuditLogResolver) IP() *string                 { return r.log.IP }
func (r *AuditLogResolver) UserAgent() *string          { return r.log.UserAgent }
func (r *AuditLogResolver) CreatedAt() DateTime         { return DateTime{Time: r.log.CreatedAt} }
func (r *AuditLogResolver) Metadata() *string {
	if r.log.Metadata == nil {
		return nil
	}
	b, err := json.Marshal(r.log.Metadata)
	if err != nil {
		return nil
	}
	s := string(b)
	return &s
}

type AuthPayloadResolver struct {
	Token string
	User  *UserResolver
}

type FetchResultResolver struct {
	FeedName string
	FeedURL  string
	Inserted int32
	Updated  int32
	Error    *string
}

type StatsResolver struct {
	FeedCount    int32
	ArticleCount int32
	ReadCount    int32
	UnreadCount  int32
	StarredCount int32
}

type UserDataExportResolver struct {
	User      *UserResolver
	AuditLogs []*AuditLogResolver
}

func feedResolvers(feeds []domain.Feed, rss *usecase.RssUseCase) []*FeedResolver {
	res := make([]*FeedResolver, len(feeds))
	for i, feed := range feeds {
		res[i] = &FeedResolver{feed: feed, rss: rss}
	}
	return res
}

func articleResolvers(articles []domain.Article, rss *usecase.RssUseCase) []*ArticleResolver {
	res := make([]*ArticleResolver, len(articles))
	for i, article := range articles {
		res[i] = &ArticleResolver{article: article, rss: rss}
	}
	return res
}

// input types

type ArticleFilterInput struct {
	FeedID    *graphqlgo.ID
	IsRead    *bool
	IsStarred *bool
	Keyword   *string
}

func (a *ArticleFilterInput) toDomain() domain.ArticleFilter {
	var feedID *string
	if a.FeedID != nil {
		s := string(*a.FeedID)
		feedID = &s
	}
	return domain.ArticleFilter{
		FeedID:    feedID,
		IsRead:    a.IsRead,
		IsStarred: a.IsStarred,
		Keyword:   sanitizeKeyword(a.Keyword),
	}
}

type CreateFeedInput struct {
	Name     string
	URL      string
	Category string
	Enabled  *bool
}

func (c CreateFeedInput) toDomain() domain.CreateFeedInput {
	return domain.CreateFeedInput{
		Name:     c.Name,
		URL:      c.URL,
		Category: c.Category,
		Enabled:  c.Enabled,
	}
}

type UpdateFeedInput struct {
	Name     *string
	Category *string
	Enabled  *bool
}

func (u UpdateFeedInput) toDomain() domain.UpdateFeedInput {
	return domain.UpdateFeedInput{
		Name:     u.Name,
		Category: u.Category,
		Enabled:  u.Enabled,
	}
}

type RegisterInput struct {
	Email    string
	Password string
	Name     *string
}

func (r RegisterInput) toDomain() domain.RegisterInput {
	return domain.RegisterInput{
		Email:    r.Email,
		Password: r.Password,
		Name:     r.Name,
	}
}

type LoginInput struct {
	Email    string
	Password string
}

func (l LoginInput) toDomain() domain.LoginInput {
	return domain.LoginInput{
		Email:    l.Email,
		Password: l.Password,
	}
}

func sanitizeKeyword(kw *string) *string {
	if kw == nil {
		return nil
	}
	if *kw == "" {
		return nil
	}
	return kw
}
