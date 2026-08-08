import { gql } from '@apollo/client'

export const GET_FEEDS = gql`
  query GetFeeds {
    feeds {
      id
      name
      url
      category
      enabled
    }
  }
`

export const GET_ARTICLES = gql`
  query GetArticles($filter: ArticleFilterInput) {
    articles(filter: $filter) {
      id
      title
      link
      snippet
      publishedAt
      isRead
      isStarred
      feed {
        name
      }
    }
  }
`

export const CREATE_FEED = gql`
  mutation CreateFeed($input: CreateFeedInput!) {
    createFeed(input: $input) {
      id
      name
      url
      category
      enabled
    }
  }
`

export const FETCH_FEEDS = gql`
  mutation FetchFeeds {
    fetchFeeds {
      feedName
      inserted
      updated
      error
    }
  }
`

export const MARK_ARTICLE_READ = gql`
  mutation MarkArticleRead($id: ID!, $isRead: Boolean!) {
    markArticleRead(id: $id, isRead: $isRead) {
      id
      isRead
    }
  }
`

export const MARK_ARTICLE_STARRED = gql`
  mutation MarkArticleStarred($id: ID!, $isStarred: Boolean!) {
    markArticleStarred(id: $id, isStarred: $isStarred) {
      id
      isStarred
    }
  }
`

export const DELETE_ARTICLE = gql`
  mutation DeleteArticle($id: ID!) {
    deleteArticle(id: $id)
  }
`

export const GET_STATS = gql`
  query GetStats {
    stats {
      feedCount
      articleCount
      readCount
      unreadCount
      starredCount
    }
  }
`
