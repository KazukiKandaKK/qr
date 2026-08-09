export interface Feed {
  id: string;
  name: string;
  url: string;
  category: string;
  enabled: boolean;
  lastFetchedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface Article {
  id: string;
  feedId: string;
  title: string;
  link: string;
  snippet: string;
  publishedAt: Date;
  fetchedAt: Date;
  isRead: boolean;
  isStarred: boolean;
}

export interface CreateFeedInput {
  name: string;
  url: string;
  category: string;
  enabled?: boolean;
}

export interface UpdateFeedInput {
  name?: string;
  category?: string;
  enabled?: boolean;
}

export interface ArticleFilter {
  feedId?: string;
  isRead?: boolean;
  isStarred?: boolean;
  keyword?: string;
}

export interface Stats {
  feedCount: number;
  articleCount: number;
  readCount: number;
  unreadCount: number;
  starredCount: number;
}

export interface PaginationArgs {
  limit?: number;
  offset?: number;
}
